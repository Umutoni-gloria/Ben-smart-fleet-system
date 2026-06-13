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

    const log = await prisma.fuelLog.findUnique({
      where: { id },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        loggedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!log) {
      return NextResponse.json({ error: 'Fuel log not found' }, { status: 404 })
    }

    // Operator access check
    if (session.role === 'operator') {
      const equipment = await prisma.equipment.findUnique({
        where: { id: log.equipmentId },
        select: { assignedOperatorId: true },
      })
      if (equipment?.assignedOperatorId !== session.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    console.error('Get fuel log error:', error)
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
        { error: 'Only Admin and Manager can edit fuel logs' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.fuelLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fuel log not found' }, { status: 404 })
    }

    const liters = body.liters ?? existing.liters
    const costPerLiter = body.costPerLiter ?? existing.costPerLiter
    const totalCost = liters * costPerLiter

    const updated = await prisma.fuelLog.update({
      where: { id },
      data: {
        liters,
        costPerLiter,
        totalCost,
        odometer: body.odometer ?? existing.odometer,
        fuelDate: body.fuelDate ? new Date(body.fuelDate) : existing.fuelDate,
        projectSite: body.projectSite ?? existing.projectSite,
        notes: body.notes ?? existing.notes,
      },
    })

    await logAction(
      session.id,
      'UPDATE_FUEL_LOG',
      'fuel',
      `Updated fuel log ${id}`
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update fuel log error:', error)
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
        { error: 'Only Admin and Manager can delete fuel logs' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.fuelLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fuel log not found' }, { status: 404 })
    }

    await prisma.fuelLog.delete({ where: { id } })

    await logAction(
      session.id,
      'DELETE_FUEL_LOG',
      'fuel',
      `Deleted fuel log ${id}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete fuel log error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}