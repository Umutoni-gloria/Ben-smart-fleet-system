/**
 * maintenance-thresholds.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Called on every POST /api/usage after the equipment odometer / engine hours
 * are updated. Implements graduated, usage-based schedule status transitions:
 *
 *   remaining > 20% of interval  →  upcoming   (no alert)
 *   remaining ≤ 20% of interval  →  due_soon   (schedule_due alert, medium)
 *   remaining ≤ 10% of interval  →  urgent     (schedule_due alert, high)
 *   remaining ≤ 0                →  overdue    (schedule_overdue alert, critical)
 *
 * Business rules:
 *   • Vehicles      (truck, tipper_truck) — intervals in KM (currentOdometer)
 *   • Heavy Equip.  (excavator, bulldozer, grader) — intervals in Hours (currentHours)
 *
 * On every status transition:
 *   1. ServiceSchedule.status is updated in the DB
 *   2. An Alert record is created (in-app notification)
 *   3. All active managers + admins are emailed via sendNotification()
 *
 * Alert deduplication: no duplicate alert within 24 hours for the same
 * equipment + alert type combination.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'

// ── Constants ─────────────────────────────────────────────────────────────────
/** Fraction of interval remaining at which status becomes "due_soon" */
const DUE_SOON_FRACTION = 0.20
/** Fraction of interval remaining at which status becomes "urgent" */
const URGENT_FRACTION = 0.10

type ScheduleStatus = 'upcoming' | 'due_soon' | 'urgent' | 'overdue'
type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
type AlertType = 'schedule_due' | 'schedule_overdue'

/**
 * Compute the graduated schedule status based on remaining KM or hours.
 * @param remaining - How many KM or hours until next service (negative = overdue)
 * @param intervalValue - The full service interval (e.g. 5000 km, 250 hrs)
 */
function computeStatus(remaining: number, intervalValue: number): ScheduleStatus {
  if (remaining <= 0) return 'overdue'
  if (remaining <= intervalValue * URGENT_FRACTION) return 'urgent'
  if (remaining <= intervalValue * DUE_SOON_FRACTION) return 'due_soon'
  return 'upcoming'
}

/**
 * Map a schedule status to alert metadata.
 */
function alertMetaForStatus(status: ScheduleStatus): {
  type: AlertType
  severity: AlertSeverity
} | null {
  if (status === 'upcoming') return null // No alert for upcoming
  if (status === 'overdue') return { type: 'schedule_overdue', severity: 'critical' }
  if (status === 'urgent') return { type: 'schedule_due', severity: 'high' }
  return { type: 'schedule_due', severity: 'medium' }
}

/**
 * Build a human-readable alert title and message.
 */
function buildAlertContent(params: {
  status: ScheduleStatus
  scheduleName: string
  equipmentName: string
  remaining: number
  unit: string
}): { title: string; message: string } {
  const { status, scheduleName, equipmentName, remaining, unit } = params
  const abs = Math.abs(remaining)
  const formattedRemaining = abs.toLocaleString(undefined, { maximumFractionDigits: 1 })

  switch (status) {
    case 'overdue':
      return {
        title: `OVERDUE: ${scheduleName} — ${equipmentName}`,
        message: `${scheduleName} for ${equipmentName} is ${formattedRemaining} ${unit} overdue. Immediate maintenance required.`,
      }
    case 'urgent':
      return {
        title: `URGENT: ${scheduleName} due in ${formattedRemaining} ${unit} — ${equipmentName}`,
        message: `${scheduleName} for ${equipmentName} is due very soon — only ${formattedRemaining} ${unit} remaining. Please schedule the service immediately.`,
      }
    case 'due_soon':
      return {
        title: `Due Soon: ${scheduleName} — ${equipmentName} (${formattedRemaining} ${unit} remaining)`,
        message: `${scheduleName} for ${equipmentName} is approaching its service interval. ${formattedRemaining} ${unit} remaining before maintenance is required.`,
      }
    default:
      return { title: scheduleName, message: '' }
  }
}

/**
 * Check whether a duplicate unread alert already exists within the last 24h
 * for this equipment + alert type combination.
 */
async function hasDuplicateAlert(equipmentId: string, alertType: AlertType): Promise<boolean> {
  const existing = await prisma.alert.findFirst({
    where: {
      equipmentId,
      type: alertType,
      isRead: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  })
  return !!existing
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Check and update all maintenance schedule statuses for a given piece of
 * equipment based on its current odometer / engine hours reading.
 *
 * Called automatically from POST /api/usage after updating equipment stats.
 */
export async function checkMaintenanceThresholds(equipmentId: string): Promise<void> {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    })

    if (!equipment || equipment.status === 'retired') return

    const isVehicle = ['truck', 'tipper_truck'].includes(equipment.type)
    const currentReading = isVehicle ? equipment.currentOdometer : equipment.currentHours
    const unit = isVehicle ? 'km' : 'hrs'

    // Fetch all active (non-completed) schedules for this equipment
    const schedules = await prisma.serviceSchedule.findMany({
      where: {
        equipmentId,
        status: { not: 'completed' },
      },
      include: {
        technician: { select: { id: true, fullName: true, email: true } },
      },
    })

    // Fetch manager/admin emails once for batch notification
    const managers = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager'] }, isActive: true },
      select: { id: true, email: true, fullName: true },
    })
    const managerEmails = managers.map((m) => m.email)

    for (const schedule of schedules) {
      // ── Determine the next-due reading for this schedule ────────────────────
      let nextDueReading: number | null = null

      if (isVehicle && schedule.nextDueOdometer !== null) {
        nextDueReading = schedule.nextDueOdometer
      } else if (!isVehicle && schedule.nextDueHours !== null) {
        nextDueReading = schedule.nextDueHours
      }

      // If we have no usage-based trigger point, skip this schedule
      // (it may be date-only, handled by schedule-checker.ts)
      if (nextDueReading === null) continue

      const remaining = nextDueReading - currentReading
      const newStatus = computeStatus(remaining, schedule.intervalValue)

      console.log(
        `[MaintenanceThresholds] ${equipment.name} / "${schedule.title}": ` +
          `reading=${currentReading} ${unit}, nextDue=${nextDueReading} ${unit}, ` +
          `remaining=${remaining.toFixed(1)} ${unit} → status=${newStatus} (was: ${schedule.status})`
      )

      // ── Update status if changed ────────────────────────────────────────────
      if (schedule.status !== newStatus) {
        await prisma.serviceSchedule.update({
          where: { id: schedule.id },
          data: { status: newStatus },
        })
        console.log(
          `[MaintenanceThresholds] Status updated: "${schedule.title}" ${schedule.status} → ${newStatus}`
        )
      }

      // ── Fire alert & notifications for actionable statuses ──────────────────
      const alertMeta = alertMetaForStatus(newStatus)
      if (!alertMeta) continue // upcoming — no alert

      // Deduplicate: skip if the same alert type was already sent in last 24h
      const duplicate = await hasDuplicateAlert(equipmentId, alertMeta.type)
      if (duplicate) {
        console.log(
          `[MaintenanceThresholds] Skipping duplicate alert (${alertMeta.type}) for ${equipment.name}`
        )
        continue
      }

      const { title, message } = buildAlertContent({
        status: newStatus,
        scheduleName: schedule.title,
        equipmentName: equipment.name,
        remaining,
        unit,
      })

      // 1. Create in-app alert + send email to all managers/admins
      console.log(
        `[MaintenanceThresholds] Sending ${newStatus.toUpperCase()} notification ` +
          `to ${managerEmails.length} manager(s) for: "${schedule.title}" on ${equipment.name}`
      )
      await sendNotification({
        emails: managerEmails,
        title,
        message,
        severity: alertMeta.severity,
        equipmentId,
        type: alertMeta.type,
      })

      // 2. Also notify the assigned technician (if any)
      if (schedule.technician?.email) {
        const techTitle =
          newStatus === 'overdue'
            ? `Action Required: Your schedule is OVERDUE — ${schedule.title}`
            : `Reminder: "${schedule.title}" is ${newStatus.replace('_', ' ')} — ${equipment.name}`

        const techMessage =
          newStatus === 'overdue'
            ? `Your assigned schedule "${schedule.title}" for ${equipment.name} is ` +
              `${Math.abs(remaining).toFixed(1)} ${unit} overdue. Please complete it immediately ` +
              `or contact your manager.`
            : `Your assigned schedule "${schedule.title}" for ${equipment.name} has ` +
              `${remaining.toFixed(1)} ${unit} remaining. Status: ${newStatus.replace('_', ' ')}.`

        console.log(
          `[MaintenanceThresholds] Notifying technician ${schedule.technician.fullName} ` +
            `(${schedule.technician.email}) for ${newStatus} schedule: "${schedule.title}"`
        )
        await sendNotification({
          userId: schedule.technician.id,
          title: techTitle,
          message: techMessage,
          severity: alertMeta.severity,
          equipmentId,
          type: alertMeta.type,
        })
      }
    }

    // ── Handle MaintenanceInterval rows that have no active schedule yet ──────
    // If a configured interval has never had a schedule created, and the equipment
    // has already exceeded (or is approaching) the interval from zero, auto-create
    // a pending recommendation schedule and fire an alert.
    await checkUnscheduledIntervals(equipment, currentReading, unit, isVehicle, managerEmails)
  } catch (error) {
    console.error('[MaintenanceThresholds] Error:', error instanceof Error ? error.message : error)
  }
}

/**
 * For each MaintenanceInterval configured for this equipment type,
 * if no active schedule exists for that serviceType, check whether
 * the current reading has crossed (or is approaching) the interval
 * threshold — and if so, create a recommended schedule + alert.
 */
async function checkUnscheduledIntervals(
  equipment: {
    id: string
    name: string
    type: string
    currentOdometer: number
    currentHours: number
  },
  currentReading: number,
  unit: string,
  isVehicle: boolean,
  managerEmails: string[]
): Promise<void> {
  const intervals = await prisma.maintenanceInterval.findMany({
    where: { equipmentType: equipment.type as never },
  })

  for (const interval of intervals) {
    // Only process intervals that match this equipment's measurement axis
    if (isVehicle && interval.intervalType !== 'km') continue
    if (!isVehicle && interval.intervalType !== 'hours') continue

    // Check if an active schedule already exists for this service type
    const existingSchedule = await prisma.serviceSchedule.findFirst({
      where: {
        equipmentId: equipment.id,
        serviceType: interval.serviceType,
        status: { not: 'completed' },
      },
    })

    if (existingSchedule) continue // Already handled in the main loop above

    // No active schedule — compute how far past (or close to) the interval we are
    // Cycle = floor(currentReading / intervalValue)
    const cycle = Math.floor(currentReading / interval.intervalValue)
    const nextDue = (cycle + 1) * interval.intervalValue
    const remaining = nextDue - currentReading
    const newStatus = computeStatus(remaining, interval.intervalValue)

    if (newStatus === 'upcoming') continue // Not close enough to warrant action

    // Find a technician to assign
    const tech = await prisma.user.findFirst({
      where: { role: 'technician', isActive: true },
      select: { id: true },
    })
    if (!tech) continue

    const serviceLabel = interval.serviceType.replace(/_/g, ' ').toUpperCase()
    const recommendedTitle = `${serviceLabel} Service`

    // Check for existing unread alert before creating a new schedule
    const alertMeta = alertMetaForStatus(newStatus)
    if (!alertMeta) continue

    const duplicate = await hasDuplicateAlert(equipment.id, alertMeta.type)
    if (duplicate) continue

    // Create a recommended schedule
    await prisma.serviceSchedule.create({
      data: {
        equipmentId: equipment.id,
        technicianId: tech.id,
        title: recommendedTitle,
        serviceType: interval.serviceType,
        intervalType: interval.intervalType,
        intervalValue: interval.intervalValue,
        isRecurring: true,
        isApproved: false,
        status: newStatus,
        nextDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        lastOdometer: isVehicle ? 0 : null,
        nextDueOdometer: isVehicle ? nextDue : null,
        lastHours: !isVehicle ? 0 : null,
        nextDueHours: !isVehicle ? nextDue : null,
        notes: 'Auto-generated recommendation based on usage threshold.',
      },
    })

    console.log(
      `[MaintenanceThresholds] Auto-created recommended schedule "${recommendedTitle}" ` +
        `for ${equipment.name} (status: ${newStatus})`
    )

    const { title, message } = buildAlertContent({
      status: newStatus,
      scheduleName: recommendedTitle,
      equipmentName: equipment.name,
      remaining,
      unit,
    })

    await sendNotification({
      emails: managerEmails,
      title,
      message,
      severity: alertMeta.severity,
      equipmentId: equipment.id,
      type: alertMeta.type,
    })
  }
}
