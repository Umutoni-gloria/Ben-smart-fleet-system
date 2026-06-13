import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { scheduleSchema } from '@/lib/validators'
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
    const status = searchParams.get('status')

    const where: {
      equipmentId?: string
      status?: 'upcoming' | 'due_soon' | 'urgent' | 'overdue' | 'completed'
      technicianId?: string
      equipment?: { assignedOperatorId: string }
    } = {
      ...(equipmentId && { equipmentId }),
      ...(status && {
        status: status as 'upcoming' | 'due_soon' | 'urgent' | 'overdue' | 'completed',
      }),
    }

    // Role based filtering
    if (session.role === 'technician') {
      where.technicianId = session.id
    } else if (session.role === 'operator') {
      where.equipment = { assignedOperatorId: session.id }
    }

    // Refresh schedule statuses on every page load (replaces cron job)
    await checkAndUpdateScheduleStatuses(equipmentId ?? undefined)

    const schedules = await prisma.serviceSchedule.findMany({
      where,
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        technician: { select: { id: true, fullName: true, email: true } },
        maintenanceLogs: {
          select: { id: true, description: true, serviceDate: true },
          take: 1,
          orderBy: { serviceDate: 'desc' },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    })

    return NextResponse.json({ success: true, data: schedules })
  } catch (error) {
    console.error('Get schedules error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}


export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin and Manager can create schedules' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = scheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    // ─── CRITERIA 1: Vehicle must exist and be active ─────────────────────────
    const equipment = await prisma.equipment.findUnique({
      where: { id: parsed.data.equipmentId },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    if (equipment.status === 'under_maintenance') {
      return NextResponse.json(
        {
          error: `Cannot assign a schedule to "${equipment.name}" — this vehicle is currently under maintenance. Wait for maintenance to be completed first.`,
        },
        { status: 409 }
      )
    }

    if (equipment.status === 'retired') {
      return NextResponse.json(
        { error: `Cannot assign a schedule to "${equipment.name}" — this vehicle is retired from the fleet.` },
        { status: 409 }
      )
    }

    // ─── CRITERIA 2: Technician must exist and not be suspended ──────────────
    const technician = await prisma.user.findUnique({
      where: { id: parsed.data.technicianId },
      select: { id: true, fullName: true, role: true, isActive: true },
    })

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    if (technician.role !== 'technician') {
      return NextResponse.json(
        { error: `"${technician.fullName}" is not a technician. Only users with the technician role can be assigned to service schedules.` },
        { status: 400 }
      )
    }

    if (!technician.isActive) {
      return NextResponse.json(
        {
          error: `Cannot assign schedule to "${technician.fullName}" — their account is currently suspended due to previous violations. Please resolve the suspension before assigning new work.`,
        },
        { status: 409 }
      )
    }

    // ─── CRITERIA 3: Technician must not exceed max 3 active schedules ────────
    const MAX_ACTIVE_SCHEDULES = 3

    const activeTechnicianSchedules = await prisma.serviceSchedule.count({
      where: {
        technicianId: parsed.data.technicianId,
        status: { in: ['upcoming', 'due_soon', 'urgent', 'overdue'] },
      },
    })

    if (activeTechnicianSchedules >= MAX_ACTIVE_SCHEDULES) {
      return NextResponse.json(
        {
          error: `"${technician.fullName}" already has ${activeTechnicianSchedules} active schedule(s). Maximum allowed is ${MAX_ACTIVE_SCHEDULES}. Please assign to another technician or wait for existing schedules to be completed.`,
        },
        { status: 409 }
      )
    }

    // ─── CREATE SCHEDULE ─────────────────────────────────────────────────────
    // Priority mapping: low=1, medium=2, high=3, critical=4
    const priorityMap: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    }

    const schedule = await prisma.serviceSchedule.create({
      data: {
        equipmentId: parsed.data.equipmentId,
        technicianId: parsed.data.technicianId,
        title: parsed.data.title,
        serviceType: (parsed.data.serviceType ?? 'engine') as never,
        intervalType: (parsed.data.intervalType ?? 'days') as never,
        intervalValue: parsed.data.intervalValue ?? 1,
        nextDueDate: new Date(parsed.data.nextDueDate),
        isRecurring: parsed.data.scheduleType === 'follow_up'
          ? false
          : parsed.data.isRecurring,
        priority: priorityMap[parsed.data.priority ?? 'medium'],
        notes: parsed.data.notes,
        status: 'upcoming',
      },
      include: {
        equipment: { select: { id: true, name: true } },
        technician: { select: { id: true, fullName: true } },
      },
    })

    await logAction(
      session.id,
      'CREATE_SCHEDULE',
      'schedule',
      `Created schedule: ${parsed.data.title} for ${equipment.name} → assigned to ${technician.fullName}`
    )

    return NextResponse.json({ success: true, data: schedule })
  } catch (error) {
    console.error('Create schedule error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}