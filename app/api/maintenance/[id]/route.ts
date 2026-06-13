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

    const log = await prisma.maintenanceLog.findUnique({
      where: { id },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        technician: { select: { id: true, fullName: true, email: true } },
        parts: true,
        schedule: { select: { id: true, title: true } },
      },
    })

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    console.error('Get maintenance log error:', error)
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
        { error: 'Only Admin and Manager can edit maintenance logs' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.maintenanceLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    const { parts, ...rest } = body

    const partsCost =
      parts && parts.length > 0
        ? parts.reduce(
            (sum: number, p: { quantity: number; unitCost: number }) =>
              sum + p.quantity * p.unitCost,
            0
          )
        : 0

    const totalCost = (rest.laborCost || existing.laborCost) + partsCost

    const updated = await prisma.maintenanceLog.update({
      where: { id },
      data: {
        description: rest.description ?? existing.description,
        failureCause: rest.failureCause ?? existing.failureCause,
        downtimeHours: rest.downtimeHours ?? existing.downtimeHours,
        wasAvoidable: rest.wasAvoidable ?? existing.wasAvoidable,
        laborCost: rest.laborCost ?? existing.laborCost,
        partsCost,
        totalCost,
        serviceDate: rest.serviceDate
          ? new Date(rest.serviceDate)
          : existing.serviceDate,
        parts: parts
          ? {
              deleteMany: {},
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

    await logAction(
      session.id,
      'UPDATE_MAINTENANCE_LOG',
      'maintenance',
      `Updated maintenance log ${id}`
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update maintenance log error:', error)
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

    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only Admin can delete maintenance logs' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.maintenanceLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    await prisma.maintenancePart.deleteMany({ where: { maintenanceLogId: id } })
    await prisma.maintenanceLog.delete({ where: { id } })

    await logAction(
      session.id,
      'DELETE_MAINTENANCE_LOG',
      'maintenance',
      `Deleted maintenance log ${id}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete maintenance log error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}