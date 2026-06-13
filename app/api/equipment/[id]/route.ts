import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { equipmentSchema } from '@/lib/validators'
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

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        warranties: true,
        assignedOperator: {
          select: { id: true, fullName: true, email: true },
        },
        maintenanceLogs: {
          orderBy: { serviceDate: 'desc' },
          take: 5,
          include: {
            technician: { select: { fullName: true } },
          },
        },
        schedules: {
          where: { status: { not: 'completed' } },
          orderBy: { nextDueDate: 'asc' },
          take: 5,
        },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    if (session.role === 'operator' && equipment.assignedOperatorId !== session.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: equipment })
  } catch (error) {
    console.error('Get equipment by id error:', error)
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
      return NextResponse.json({ error: 'Only Admin and Manager can edit equipment' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = equipmentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const existing = await prisma.equipment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    if (parsed.data.serialNumber !== existing.serialNumber) {
      const duplicate = await prisma.equipment.findUnique({
        where: { serialNumber: parsed.data.serialNumber },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Serial number already in use by another equipment' },
          { status: 409 }
        )
      }
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        name: parsed.data.name,
        type: parsed.data.type as never,
        model: parsed.data.model,
        serialNumber: parsed.data.serialNumber,
        year: parsed.data.year,
        assignedOperatorId: parsed.data.assignedOperatorId || null,
        defaultFuelRate: parsed.data.defaultFuelRate || null,
        fuelTolerance: parsed.data.fuelTolerance !== undefined ? parsed.data.fuelTolerance : 20.0,
      },
    })

    await logAction(
      session.id,
      'UPDATE_EQUIPMENT',
      'equipment',
      `Updated equipment: ${updated.name}`
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update equipment error:', error)
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
      return NextResponse.json({ error: 'Only Admin can delete equipment' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.equipment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    await prisma.equipment.update({
      where: { id },
      data: { status: 'retired' },
    })

    await logAction(
      session.id,
      'RETIRE_EQUIPMENT',
      'equipment',
      `Retired equipment: ${existing.name}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete equipment error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}