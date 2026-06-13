import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { maintenanceLogSchema } from '@/lib/validators'
import { sendNotification } from '@/lib/notifications'
import { checkAndUpdateScheduleStatuses } from '@/lib/schedule-checker'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get('equipment')
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const logs = await prisma.maintenanceLog.findMany({
      where: {
        ...(equipmentId && { equipmentId }),
        ...(type && { type: type as never }),
        ...(from && { serviceDate: { gte: new Date(from) } }),
        ...(to && { serviceDate: { lte: new Date(to) } }),
      },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        technician: { select: { id: true, fullName: true } },
        parts: true,
      },
      orderBy: { serviceDate: 'desc' },
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('Get maintenance logs error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager', 'technician'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Operators cannot create maintenance logs' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { parts, ...rest } = body
    const parsed = maintenanceLogSchema.safeParse(rest)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id: parsed.data.equipmentId },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    const partsCostFromItems =
      parts && parts.length > 0
        ? parts.reduce(
            (sum: number, p: { quantity: number; unitCost: number }) =>
              sum + p.quantity * p.unitCost,
            0
          )
        : 0

    const totalCost = parsed.data.laborCost + partsCostFromItems

    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: parsed.data.equipmentId,
        technicianId: session.id,
        type: parsed.data.type as never,
        serviceType: parsed.data.serviceType as never,
        description: parsed.data.description,
        failureCause: parsed.data.failureCause,
        downtimeHours: parsed.data.downtimeHours,
        wasAvoidable: parsed.data.wasAvoidable,
        laborCost: parsed.data.laborCost,
        partsCost: partsCostFromItems,
        totalCost,
        serviceDate: new Date(parsed.data.serviceDate),
        beforePhotoUrls: parsed.data.beforePhotoUrls || [],
        afterPhotoUrls: parsed.data.afterPhotoUrls || [],
        signatureUrl: parsed.data.signatureUrl,
        parts: parts && parts.length > 0
          ? {
              create: parts.map((p: {
                partName: string
                quantity: number
                unitCost: number
              }) => ({
                partName: p.partName,
                quantity: p.quantity,
                unitCost: p.unitCost,
                totalCost: p.quantity * p.unitCost,
              })),
            }
          : undefined,
      },
      include: { parts: true },
    })

    await prisma.equipment.update({
       where: { id: parsed.data.equipmentId },
       data: { lastServiceDate: new Date(parsed.data.serviceDate) },
    })

    // Auto reset / update scheduling if it is a preventive maintenance log
    if (parsed.data.type === 'preventive' && parsed.data.serviceType) {
      // 1. Mark existing active schedules for this equipment & serviceType as completed
      const activeSchedules = await prisma.serviceSchedule.findMany({
        where: {
          equipmentId: parsed.data.equipmentId,
          serviceType: parsed.data.serviceType as any,
          status: { not: 'completed' }
        }
      })

      for (const schedule of activeSchedules) {
        const updatedSch = await prisma.serviceSchedule.update({
          where: { id: schedule.id },
          data: { status: 'completed' }
        })

        // Log schedule completion history
        await prisma.scheduleHistory.create({
          data: {
            scheduleId: schedule.id,
            changedById: session.id,
            previousState: JSON.stringify(schedule),
            newState: JSON.stringify(updatedSch),
            changeReason: `Completed automatically by logging maintenance activity.`
          }
        })
      }

      // 2. Lookup configured interval for this equipment & serviceType
      const interval = await prisma.maintenanceInterval.findUnique({
        where: {
          equipmentType_serviceType: {
            equipmentType: equipment.type,
            serviceType: parsed.data.serviceType as any
          }
        }
      })

      if (interval) {
        // Calculate next targets
        const nextDueDate = new Date()
        let lastOdometer: number | null = null
        let nextDueOdometer: number | null = null
        let lastHours: number | null = null
        let nextDueHours: number | null = null

        if (interval.intervalType === 'days') {
          nextDueDate.setDate(nextDueDate.getDate() + interval.intervalValue)
        } else if (interval.intervalType === 'km') {
          lastOdometer = equipment.currentOdometer
          nextDueOdometer = equipment.currentOdometer + interval.intervalValue
          // Estimate due date as 90 days from now
          nextDueDate.setDate(nextDueDate.getDate() + 90)
        } else if (interval.intervalType === 'hours') {
          lastHours = equipment.currentHours
          nextDueHours = equipment.currentHours + interval.intervalValue
          // Estimate due date as 90 days from now
          nextDueDate.setDate(nextDueDate.getDate() + 90)
        }

        // Create new active schedule
        await prisma.serviceSchedule.create({
          data: {
            equipmentId: parsed.data.equipmentId,
            technicianId: session.id,
            title: `${parsed.data.serviceType.replace('_', ' ').toUpperCase()} Service`,
            serviceType: parsed.data.serviceType as any,
            intervalType: interval.intervalType,
            intervalValue: interval.intervalValue,
            lastOdometer,
            nextDueOdometer,
            lastHours,
            nextDueHours,
            nextDueDate,
            status: 'upcoming',
            isRecurring: true,
            isApproved: true,
            notes: 'Automatically scheduled based on previous completion and configured interval.'
          }
        })
      }
    }

    // Auto create alert for corrective/breakdown maintenance
    if (parsed.data.type === 'corrective') {
      const managers = await prisma.user.findMany({
        where: { role: { in: ['admin', 'manager'] }, isActive: true },
        select: { email: true },
      })
      const managerEmails = managers.map((m) => m.email)

      const breakdownTitle = `Breakdown: ${equipment.name}`
      const breakdownMessage = `A corrective maintenance was logged for ${equipment.name}. ${
        parsed.data.failureCause
          ? `Cause: ${parsed.data.failureCause}.`
          : ''
      } ${
        parsed.data.downtimeHours
          ? `Downtime: ${parsed.data.downtimeHours} hours.`
          : ''
      } Total cost: RWF ${totalCost.toLocaleString()}.`

      await sendNotification({
        userId: session.id,
        emails: managerEmails,
        title: breakdownTitle,
        message: breakdownMessage,
        severity: parsed.data.downtimeHours && parsed.data.downtimeHours > 8 ? 'critical' : 'high',
        equipmentId: parsed.data.equipmentId,
        type: 'corrective_breakdown',
      })
    }

    // After preventive maintenance, refresh schedule statuses for this equipment
    if (parsed.data.type === 'preventive') {
      await checkAndUpdateScheduleStatuses(parsed.data.equipmentId)
    }

    await logAction(
      session.id,
      'CREATE_MAINTENANCE_LOG',
      'maintenance',
      `Logged ${parsed.data.type} maintenance for ${equipment.name}`
    )

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    console.error('Create maintenance log error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}