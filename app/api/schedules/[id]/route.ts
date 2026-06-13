import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const schedule = await prisma.serviceSchedule.findUnique({
      where: { id },
      include: {
        equipment: { select: { id: true, name: true, type: true, assignedOperatorId: true } },
        technician: { select: { id: true, fullName: true, email: true } },
        history: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { fullName: true } } },
        },
        maintenanceLogs: {
          orderBy: { serviceDate: 'desc' },
          take: 5,
          include: {
            technician: { select: { fullName: true } },
          },
        },
      },
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Role based access check
    if (session.role === 'technician' && schedule.technicianId !== session.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (session.role === 'operator') {
      if (schedule.equipment && 'assignedOperatorId' in schedule.equipment) {
        const eq = await prisma.equipment.findUnique({
          where: { id: schedule.equipmentId },
          select: { assignedOperatorId: true },
        })
        if (eq?.assignedOperatorId !== session.id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
      }
    }

    return NextResponse.json({ success: true, data: schedule })
  } catch (error) {
    console.error('Get schedule error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.serviceSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Logic for completing/updating schedule
    const isCompleted = body.status === 'completed'
    
    let lastOdometer = existing.lastOdometer
    let nextDueOdometer = existing.nextDueOdometer
    let lastHours = existing.lastHours
    let nextDueHours = existing.nextDueHours
    let nextDueDate = body.nextDueDate ? new Date(body.nextDueDate) : existing.nextDueDate
    let newStatus = body.status ?? existing.status

    if (isCompleted && existing.isRecurring) {
      const equipment = await prisma.equipment.findUnique({
        where: { id: existing.equipmentId }
      })

      const interval = existing.intervalValue
      const type = existing.intervalType

      if (type === 'days') {
        const next = new Date()
        next.setDate(next.getDate() + interval)
        nextDueDate = next
        newStatus = 'upcoming'
      } else if (type === 'km' && equipment) {
        lastOdometer = equipment.currentOdometer
        nextDueOdometer = equipment.currentOdometer + interval
        newStatus = 'upcoming'
        const next = new Date()
        next.setDate(next.getDate() + 90) // estimate 90 days
        nextDueDate = next
      } else if (type === 'hours' && equipment) {
        lastHours = equipment.currentHours
        nextDueHours = equipment.currentHours + interval
        newStatus = 'upcoming'
        const next = new Date()
        next.setDate(next.getDate() + 90) // estimate 90 days
        nextDueDate = next
      }
    }

    if (session.role === 'technician') {
      if (existing.technicianId !== session.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      if (body.status !== 'completed') {
        return NextResponse.json(
          { error: 'Technicians can only mark schedules as completed' },
          { status: 403 }
        )
      }

      const updated = await prisma.serviceSchedule.update({
        where: { id },
        data: {
          status: newStatus as any,
          lastOdometer,
          nextDueOdometer,
          lastHours,
          nextDueHours,
          nextDueDate,
        },
      })

      await prisma.scheduleHistory.create({
        data: {
          scheduleId: id,
          changedById: session.id,
          previousState: JSON.stringify(existing),
          newState: JSON.stringify(updated),
          changeReason: existing.isRecurring ? 'Recurring schedule reset' : 'Marked as completed'
        }
      })

      await logAction(
        session.id,
        'COMPLETE_SCHEDULE',
        'schedule',
        `Marked schedule as completed: ${existing.title}`
      )

      return NextResponse.json({ success: true, data: updated })
    }

    // Admin and manager can update everything
    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const priorityMap: Record<string, number> = {
      low: 1, medium: 2, high: 3, critical: 4,
    }

    const newStateData = {
      title: body.title ?? existing.title,
      serviceType: body.serviceType
        ? (body.serviceType as never)
        : existing.serviceType,
      intervalType: body.intervalType
        ? (body.intervalType as never)
        : existing.intervalType,
      intervalValue: body.intervalValue ?? existing.intervalValue,
      nextDueDate,
      status: newStatus as never,
      priority: body.priority
        ? priorityMap[body.priority]
        : existing.priority,
      isRecurring: body.isRecurring ?? existing.isRecurring,
      notes: body.notes ?? existing.notes,
      lastOdometer,
      nextDueOdometer,
      lastHours,
      nextDueHours,
    }

    const updated = await prisma.serviceSchedule.update({
      where: { id },
      data: newStateData,
    })

    await prisma.scheduleHistory.create({
      data: {
        scheduleId: id,
        changedById: session.id,
        previousState: JSON.stringify(existing),
        newState: JSON.stringify(updated),
        changeReason: body.changeReason || (isCompleted && existing.isRecurring ? 'Recurring schedule reset' : 'Updated details manually')
      }
    })

    await logAction(
      session.id,
      'UPDATE_SCHEDULE',
      'schedule',
      `Updated schedule: ${existing.title}`
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update schedule error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin and Manager can delete schedules' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.serviceSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    await prisma.serviceSchedule.delete({ where: { id } })

    await logAction(
      session.id,
      'DELETE_SCHEDULE',
      'schedule',
      `Deleted schedule: ${existing.title}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete schedule error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}