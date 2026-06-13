import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { usageLogSchema } from '@/lib/validators'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get('equipment')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: {
      equipmentId?: string
      operatorId?: string
      shiftDate?: { gte?: Date; lte?: Date }
    } = {
      ...(equipmentId && { equipmentId }),
      ...(from || to
        ? {
            shiftDate: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    }

    // Operators only see their own usage logs
    if (session.role === 'operator') {
      where.operatorId = session.id
    }

    // Technicians see all but cannot create
    const logs = await prisma.usageLog.findMany({
      where,
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        operator: { select: { id: true, fullName: true } },
      },
      orderBy: { shiftDate: 'desc' },
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('Get usage logs error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role === 'technician') {
      return NextResponse.json(
        { error: 'Technicians cannot log usage shifts' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = usageLogSchema.safeParse(body)

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

    // ─── RULE: Block usage logging for vehicles under maintenance ─────────────
    if (equipment.status === 'under_maintenance') {
      return NextResponse.json(
        {
          error: `Cannot log usage for "${equipment.name}" — this vehicle is currently under maintenance.`,
        },
        { status: 409 }
      )
    }

    if (equipment.status === 'retired') {
      return NextResponse.json(
        { error: `Cannot log usage for "${equipment.name}" — this vehicle is retired.` },
        { status: 409 }
      )
    }

    // Operator can only log for their assigned equipment
    if (
      session.role === 'operator' &&
      equipment.assignedOperatorId !== session.id
    ) {
      return NextResponse.json(
        { error: 'You can only log usage for your assigned equipment' },
        { status: 403 }
      )
    }

    const isVehicle = ['truck', 'tipper_truck'].includes(equipment.type)
    let totalHours = 0
    let startHours = 0
    let endHours = 0
    let startOdometer: number | null = null
    let endOdometer: number | null = null
    let distanceTraveled: number | null = null

    if (isVehicle) {
      // Validate odometer readings for vehicles
      if (parsed.data.startOdometer === undefined || parsed.data.endOdometer === undefined) {
        return NextResponse.json(
          { error: 'Start and end odometer readings are required for vehicles.' },
          { status: 400 }
        )
      }
      if (parsed.data.endOdometer <= parsed.data.startOdometer) {
        return NextResponse.json(
          { error: 'End odometer must be greater than start odometer' },
          { status: 400 }
        )
      }
      startOdometer = parsed.data.startOdometer
      endOdometer = parsed.data.endOdometer
      distanceTraveled = endOdometer - startOdometer
    } else {
      // Validate engine hours for heavy equipment
      if (parsed.data.startHours === undefined || parsed.data.endHours === undefined) {
        return NextResponse.json(
          { error: 'Start and end engine hours are required for heavy equipment.' },
          { status: 400 }
        )
      }
      if (parsed.data.endHours <= parsed.data.startHours) {
        return NextResponse.json(
          { error: 'End engine hours must be greater than start engine hours' },
          { status: 400 }
        )
      }
      startHours = parsed.data.startHours
      endHours = parsed.data.endHours
      totalHours = endHours - startHours
    }

    const log = await prisma.usageLog.create({
      data: {
        equipmentId: parsed.data.equipmentId,
        operatorId: session.id,
        startHours,
        endHours,
        totalHours,
        startOdometer,
        endOdometer,
        distanceTraveled,
        idleHours: parsed.data.idleHours || 0,
        projectSite: parsed.data.projectSite,
        shiftDate: new Date(parsed.data.shiftDate),
        notes: parsed.data.notes,
      },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        operator: { select: { id: true, fullName: true } },
      },
    })

    // Update equipment stats
    if (isVehicle && endOdometer !== null) {
      if (endOdometer > equipment.currentOdometer) {
        await prisma.equipment.update({
          where: { id: parsed.data.equipmentId },
          data: { currentOdometer: endOdometer },
        })
      }
    } else {
      if (endHours > equipment.currentHours) {
        await prisma.equipment.update({
          where: { id: parsed.data.equipmentId },
          data: { currentHours: endHours },
        })
      }
    }

    // Trigger maintenance thresholds check
    const { checkMaintenanceThresholds } = await import('@/lib/maintenance-thresholds')
    await checkMaintenanceThresholds(parsed.data.equipmentId)

    await logAction(
      session.id,
      'CREATE_USAGE_LOG',
      'usage',
      isVehicle
        ? `Logged ${distanceTraveled ?? 0} km usage for ${equipment.name}`
        : `Logged ${totalHours} hrs usage for ${equipment.name}`
    )

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    console.error('Create usage log error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}