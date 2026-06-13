import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { equipmentSchema } from '@/lib/validators'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const where: any = {
      ...(status && { status: status as never }),
      ...(type && { type: type as never }),
    }

    if (session.role === 'operator') {
      where.assignedOperatorId = session.id
    }

    const equipment = await prisma.equipment.findMany({
      where,
      include: {
        assignedOperator: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: equipment })
  } catch (error) {
    console.error('Get equipment error:', error)
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
      return NextResponse.json({ error: 'Only Admin and Manager can add equipment' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = equipmentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const existing = await prisma.equipment.findUnique({
      where: { serialNumber: parsed.data.serialNumber },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Equipment with this serial number already exists' },
        { status: 409 }
      )
    }

    const equipment = await prisma.equipment.create({
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
      'CREATE_EQUIPMENT',
      'equipment',
      `Added equipment: ${equipment.name}`
    )

    return NextResponse.json({ success: true, data: equipment })
  } catch (error) {
    console.error('Create equipment error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}