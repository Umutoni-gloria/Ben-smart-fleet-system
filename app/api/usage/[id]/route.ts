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

    const log = await prisma.usageLog.findUnique({
      where: { id },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        operator: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!log) {
      return NextResponse.json({ error: 'Usage log not found' }, { status: 404 })
    }

    // Operator can only see their own logs
    if (session.role === 'operator' && log.operatorId !== session.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    console.error('Get usage log error:', error)
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

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin and Manager can edit usage logs' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.usageLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usage log not found' }, { status: 404 })
    }

    const startHours = body.startHours ?? existing.startHours
    const endHours = body.endHours ?? existing.endHours

    if (endHours <= startHours) {
      return NextResponse.json(
        { error: 'End hours must be greater than start hours' },
        { status: 400 }
      )
    }

    const totalHours = endHours - startHours

    const updated = await prisma.usageLog.update({
      where: { id },
      data: {
        startHours,
        endHours,
        totalHours,
        projectSite: body.projectSite ?? existing.projectSite,
        shiftDate: body.shiftDate
          ? new Date(body.shiftDate)
          : existing.shiftDate,
        notes: body.notes ?? existing.notes,
      },
    })

    await logAction(
      session.id,
      'UPDATE_USAGE_LOG',
      'usage',
      `Updated usage log ${id}`
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update usage log error:', error)
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
        { error: 'Only Admin and Manager can delete usage logs' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.usageLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usage log not found' }, { status: 404 })
    }

    await prisma.usageLog.delete({ where: { id } })

    await logAction(
      session.id,
      'DELETE_USAGE_LOG',
      'usage',
      `Deleted usage log ${id}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete usage log error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}