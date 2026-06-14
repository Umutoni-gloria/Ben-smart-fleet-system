/**
 * GET /api/debug/maintenance-check
 *
 * Admin/Manager-only debug endpoint that:
 * 1. Shows the current state of all active schedules (status, remaining KM/hrs)
 * 2. Shows the last 10 maintenance-related alerts
 * 3. Shows the last 10 email logs for schedule alerts
 *
 * This lets you verify the full alert pipeline without needing to submit a real usage log.
 *
 * POST /api/debug/maintenance-check?equipmentId=<id>
 * Manually triggers checkMaintenanceThresholds() for a specific equipment ID.
 * Use this to test the pipeline without creating a usage log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 1. All active schedules with remaining KM/hours
    const schedules = await prisma.serviceSchedule.findMany({
      where: { status: { not: 'completed' } },
      include: {
        equipment: {
          select: { id: true, name: true, type: true, currentOdometer: true, currentHours: true },
        },
        technician: { select: { fullName: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const scheduleSummary = schedules.map((s) => {
      const eq = s.equipment
      const isVehicle = ['truck', 'tipper_truck'].includes(eq.type)
      const currentReading = isVehicle ? eq.currentOdometer : eq.currentHours
      const nextDue = isVehicle ? s.nextDueOdometer : s.nextDueHours
      const remaining = nextDue !== null ? nextDue - currentReading : null
      const unit = isVehicle ? 'km' : 'hrs'

      return {
        id: s.id,
        title: s.title,
        serviceType: s.serviceType,
        equipment: eq.name,
        equipmentType: eq.type,
        status: s.status,
        currentReading: `${currentReading.toLocaleString()} ${unit}`,
        nextDue: nextDue !== null ? `${nextDue.toLocaleString()} ${unit}` : 'N/A (date-only)',
        remaining: remaining !== null
          ? remaining < 0
            ? `⛔ ${Math.abs(remaining).toFixed(0)} ${unit} OVERDUE`
            : `✅ ${remaining.toFixed(0)} ${unit} remaining`
          : 'N/A',
        intervalValue: `${s.intervalValue} ${unit}`,
        technician: s.technician?.fullName ?? 'Unassigned',
        technicianEmail: s.technician?.email ?? '—',
      }
    })

    // 2. Last 10 maintenance alerts
    const alerts = await prisma.alert.findMany({
      where: { type: { in: ['schedule_due', 'schedule_overdue'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { equipment: { select: { name: true } } },
    })

    // 3. Last 10 email logs
    const emailLogs = await prisma.emailLog.findMany({
      where: {
        subject: { contains: 'Alert:' },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // 4. KPI counts
    const [upcoming, dueSoon, urgent, overdue] = await Promise.all([
      prisma.serviceSchedule.count({ where: { status: 'upcoming' } }),
      prisma.serviceSchedule.count({ where: { status: 'due_soon' } }),
      prisma.serviceSchedule.count({ where: { status: 'urgent' } }),
      prisma.serviceSchedule.count({ where: { status: 'overdue' } }),
    ])

    return NextResponse.json({
      success: true,
      kpis: { upcoming, dueSoon, urgent, overdue },
      schedules: scheduleSummary,
      recentAlerts: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        equipment: a.equipment?.name ?? 'System',
        isRead: a.isRead,
        createdAt: a.createdAt,
      })),
      recentEmailLogs: emailLogs,
    })
  } catch (error) {
    console.error('[/api/debug/maintenance-check] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get('equipmentId')

    if (!equipmentId) {
      return NextResponse.json(
        { error: 'equipmentId query parameter is required' },
        { status: 400 }
      )
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, name: true, type: true, currentOdometer: true, currentHours: true },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    console.log(`[DEBUG] Manually triggering maintenance check for: ${equipment.name} (${equipment.id})`)
    console.log(`[DEBUG] Current reading: odometer=${equipment.currentOdometer} km, hours=${equipment.currentHours} hrs`)

    const { checkMaintenanceThresholds } = await import('@/lib/maintenance-thresholds')
    await checkMaintenanceThresholds(equipmentId)

    // Return updated state after the check
    const updatedSchedules = await prisma.serviceSchedule.findMany({
      where: { equipmentId, status: { not: 'completed' } },
      select: {
        id: true, title: true, serviceType: true, status: true,
        nextDueOdometer: true, nextDueHours: true, intervalValue: true,
      },
    })

    const newAlerts = await prisma.alert.findMany({
      where: {
        equipmentId,
        type: { in: ['schedule_due', 'schedule_overdue'] },
        createdAt: { gte: new Date(Date.now() - 60 * 1000) }, // last 60 seconds
      },
      orderBy: { createdAt: 'desc' },
    })

    const newEmails = await prisma.emailLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    })

    const isVehicle = ['truck', 'tipper_truck'].includes(equipment.type)
    const currentReading = isVehicle ? equipment.currentOdometer : equipment.currentHours
    const unit = isVehicle ? 'km' : 'hrs'

    return NextResponse.json({
      success: true,
      message: `Maintenance check triggered for "${equipment.name}"`,
      equipment: {
        name: equipment.name,
        type: equipment.type,
        currentReading: `${currentReading} ${unit}`,
      },
      updatedSchedules: updatedSchedules.map((s) => {
        const nextDue = isVehicle ? s.nextDueOdometer : s.nextDueHours
        const remaining = nextDue !== null ? nextDue - currentReading : null
        return {
          title: s.title,
          serviceType: s.serviceType,
          status: s.status,
          nextDue: nextDue !== null ? `${nextDue} ${unit}` : 'N/A',
          remaining: remaining !== null
            ? remaining < 0
              ? `OVERDUE by ${Math.abs(remaining)} ${unit}`
              : `${remaining} ${unit} remaining`
            : 'N/A',
        }
      }),
      alertsCreated: newAlerts.length,
      emailsTriggered: newEmails.length,
      alerts: newAlerts,
      emails: newEmails,
    })
  } catch (error) {
    console.error('[/api/debug/maintenance-check] POST Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
