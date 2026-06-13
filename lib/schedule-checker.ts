/**
 * schedule-checker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable schedule status update logic, previously in /api/cron/check-schedules.
 * Called on every GET /api/schedules and POST /api/maintenance so statuses
 * stay fresh on page load — no background cron job needed.
 *
 * FIX: Previously called sendAlertEmail directly (no logging, bypassed
 * notification system). Now routes all emails through sendNotification()
 * so every attempt is logged to EmailLog and in-app alerts are created.
 *
 * FIX: Overdue schedule emails are now ALWAYS sent to the assigned technician,
 * not just on urgent. Technicians are notified for both urgent AND overdue.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '@/lib/prisma'
import { issueTechnicianViolation } from '@/lib/violations'
import { sendNotification } from '@/lib/notifications'

/**
 * Check and update schedule statuses for all (or a specific) equipment.
 * Transitions: upcoming → due_soon → urgent → overdue
 * Also creates alerts and issues technician violations for overdue schedules.
 *
 * @param equipmentId - Optional. If provided, only checks schedules for this equipment.
 */
export async function checkAndUpdateScheduleStatuses(equipmentId?: string): Promise<void> {
  try {
    const now = new Date()
    const in7Days = new Date(now)
    in7Days.setDate(now.getDate() + 7)
    const in3Days = new Date(now)
    in3Days.setDate(now.getDate() + 3)

    const schedules = await prisma.serviceSchedule.findMany({
      where: {
        status: { not: 'completed' },
        ...(equipmentId && { equipmentId }),
      },
      include: {
        equipment: { select: { id: true, name: true } },
        technician: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        maintenanceLogs: {
          select: { id: true },
          orderBy: { serviceDate: 'desc' },
          take: 1,
        },
      },
    })

    if (schedules.length === 0) return

    // Fetch all managers and admins for email notifications
    const managers = await prisma.user.findMany({
      where: {
        role: { in: ['admin', 'manager'] },
        isActive: true,
      },
      select: { id: true, fullName: true, email: true },
    })
    const managerEmails = managers.map((m) => m.email)

    for (const schedule of schedules) {
      const due = new Date(schedule.nextDueDate)
      let newStatus: 'upcoming' | 'due_soon' | 'urgent' | 'overdue'

      if (due < now) {
        newStatus = 'overdue'
      } else if (due <= in3Days) {
        newStatus = 'urgent'
      } else if (due <= in7Days) {
        newStatus = 'due_soon'
      } else {
        newStatus = 'upcoming'
      }

      // Only update if status changed
      if (schedule.status !== newStatus) {
        await prisma.serviceSchedule.update({
          where: { id: schedule.id },
          data: { status: newStatus },
        })
        console.log(
          `[ScheduleChecker] Schedule "${schedule.title}" for ${schedule.equipment.name}: ${schedule.status} → ${newStatus}`
        )
      }

      // Create alerts and send emails for urgent and overdue
      if (newStatus === 'urgent' || newStatus === 'overdue') {
        // Avoid duplicate alerts within the last 24 hours
        const existingAlert = await prisma.alert.findFirst({
          where: {
            equipmentId: schedule.equipmentId,
            title: { contains: schedule.title },
            isRead: false,
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        })

        if (!existingAlert) {
          const severity = newStatus === 'overdue' ? 'critical' : 'high'
          const daysOverdue =
            newStatus === 'overdue'
              ? Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
              : null
          const daysLeft =
            newStatus === 'urgent'
              ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null

          const alertTitle =
            newStatus === 'overdue'
              ? `OVERDUE: ${schedule.title} — ${schedule.equipment.name}`
              : `URGENT: ${schedule.title} due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`

          const alertMessage =
            newStatus === 'overdue'
              ? `${schedule.title} for ${schedule.equipment.name} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue. Immediate attention required.`
              : `${schedule.title} for ${schedule.equipment.name} is due on ${due.toLocaleDateString()}. Please schedule the service soon.`

          // Notify all admins/managers via sendNotification (creates alert + sends email)
          console.log(
            `[ScheduleChecker] Sending ${newStatus.toUpperCase()} notification to ${managerEmails.length} manager(s) for: "${schedule.title}"`
          )
          await sendNotification({
            emails: managerEmails,
            title: alertTitle,
            message: alertMessage,
            severity,
            equipmentId: schedule.equipmentId,
            type: newStatus === 'overdue' ? 'schedule_overdue' : 'schedule_due',
          })

          // Always notify the assigned technician for both urgent AND overdue
          if (schedule.technician?.email) {
            const techTitle =
              newStatus === 'overdue'
                ? `Action Required: Your schedule is OVERDUE — ${schedule.title}`
                : `Reminder: Your schedule is URGENT — ${schedule.title}`

            const techMessage =
              newStatus === 'overdue'
                ? `Your assigned maintenance schedule "${schedule.title}" for ${schedule.equipment.name} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue. Please complete it immediately or contact your manager.`
                : `Your assigned maintenance schedule "${schedule.title}" for ${schedule.equipment.name} is due on ${due.toLocaleDateString()} (${daysLeft} day${daysLeft === 1 ? '' : 's'} away). Please prepare to complete it on time.`

            console.log(
              `[ScheduleChecker] Notifying technician ${schedule.technician.fullName} (${schedule.technician.email}) for ${newStatus} schedule: "${schedule.title}"`
            )
            await sendNotification({
              userId: schedule.technician.id,
              title: techTitle,
              message: techMessage,
              severity,
              equipmentId: schedule.equipmentId,
              type: newStatus === 'overdue' ? 'schedule_overdue' : 'schedule_due',
            })
          }
        }
      }

      // ── Issue violations for overdue schedules with no maintenance log ───────
      if (newStatus === 'overdue' && schedule.maintenanceLogs.length === 0) {
        const existingViolationToday = await prisma.technicianViolation.findFirst({
          where: {
            scheduleId: schedule.id,
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        })

        if (!existingViolationToday) {
          try {
            await issueTechnicianViolation(
              schedule.technician.id,
              schedule.id,
              schedule.title,
              schedule.equipment.name
            )
          } catch (violationError: any) {
            console.error(
              `[ScheduleChecker] Failed to issue violation for schedule ${schedule.id}:`,
              violationError?.message
            )
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[ScheduleChecker] Error:', error?.message)
  }
}
