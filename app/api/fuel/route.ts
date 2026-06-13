import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { fuelLogSchema } from '@/lib/validators'
import { sendNotification } from '@/lib/notifications'
import { getBaselineRateRange, getRecommendedFuel } from '@/lib/fuel-rate'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const context = searchParams.get('context')
    const equipmentId = searchParams.get('equipmentId') || searchParams.get('equipment')

    // ── Special: Fuel Form Context (recommendation data) ────────────────────
    if (context === 'fuel-form' && equipmentId) {
      const dateStr = searchParams.get('date')
      const equipment = await prisma.equipment.findUnique({
        where: { id: equipmentId },
        select: { id: true, name: true, type: true, currentOdometer: true, currentHours: true, defaultFuelRate: true },
      })
      if (!equipment) {
        return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
      }

      const lastFuelLog = await prisma.fuelLog.findFirst({
        where: { equipmentId },
        orderBy: { fuelDate: 'desc' },
        select: { odometer: true, hours: true, fuelDate: true, liters: true },
      })

      const baseline = getBaselineRateRange(equipment.type)

      let recommendation = null
      if (dateStr) {
        recommendation = await getRecommendedFuel(equipmentId, equipment.type, new Date(dateStr))
      }

      return NextResponse.json({
        success: true,
        data: {
          equipment,
          lastFuelLog,
          baseline,
          recommendation,
        },
      })
    }

    // ── Standard: List fuel logs ─────────────────────────────────────────────
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: {
      equipmentId?: string
      loggedById?: string
      fuelDate?: { gte?: Date; lte?: Date }
    } = {
      ...(equipmentId && { equipmentId }),
      ...(from || to
        ? {
            fuelDate: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    }

    // Operators only see fuel logs for their equipment
    if (session.role === 'operator') {
      const myEquipment = await prisma.equipment.findMany({
        where: { assignedOperatorId: session.id },
        select: { id: true },
      })
      const myEquipmentIds = myEquipment.map((e) => e.id)
      if (equipmentId && !myEquipmentIds.includes(equipmentId)) {
        return NextResponse.json({ success: true, data: [] })
      }
      if (!equipmentId) {
        where.equipmentId = myEquipmentIds[0] || 'none'
      }
    }

    const logs = await prisma.fuelLog.findMany({
      where,
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        loggedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { fuelDate: 'desc' },
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('Get fuel logs error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager', 'operator'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Technicians cannot log fuel' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = fuelLogSchema.safeParse(body)

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

    if (equipment.status === 'under_maintenance') {
      return NextResponse.json(
        {
          error: `Cannot log fuel for "${equipment.name}" — this vehicle is currently under maintenance. Please resolve the maintenance first.`,
        },
        { status: 409 }
      )
    }

    if (equipment.status === 'retired') {
      return NextResponse.json(
        { error: `Cannot log fuel for "${equipment.name}" — this vehicle is retired.` },
        { status: 409 }
      )
    }

    if (
      session.role === 'operator' &&
      equipment.assignedOperatorId !== session.id
    ) {
      return NextResponse.json(
        { error: 'You can only log fuel for your assigned equipment' },
        { status: 403 }
      )
    }

    const isVehicle = ['truck', 'tipper_truck'].includes(equipment.type)
    const fuelDate = new Date(parsed.data.fuelDate)
    const totalCost = parsed.data.liters * parsed.data.costPerLiter

    let odometerValue: number | null = null
    let hoursValue: number | null = null

    if (isVehicle) {
      if (parsed.data.odometer === undefined) {
        return NextResponse.json(
          { error: 'Odometer reading is required for vehicles.' },
          { status: 400 }
        )
      }
      if (parsed.data.odometer < equipment.currentOdometer) {
        return NextResponse.json(
          { error: `Odometer reading cannot be less than current odometer (${equipment.currentOdometer} km)` },
          { status: 400 }
        )
      }
      odometerValue = parsed.data.odometer
    } else {
      if (parsed.data.hours === undefined) {
        return NextResponse.json(
          { error: 'Engine hours reading is required for heavy equipment.' },
          { status: 400 }
        )
      }
      if (parsed.data.hours < equipment.currentHours) {
        return NextResponse.json(
          { error: `Engine hours cannot be less than current engine hours (${equipment.currentHours} hrs)` },
          { status: 400 }
        )
      }
      hoursValue = parsed.data.hours
    }

    // Find the last fuel log before this one
    const lastFuelLog = await prisma.fuelLog.findFirst({
      where: {
        equipmentId: equipment.id,
        fuelDate: { lt: fuelDate },
      },
      orderBy: { fuelDate: 'desc' },
    })

    // Calculate usage amount since the last fuel log
    const usageLogs = await prisma.usageLog.findMany({
      where: {
        equipmentId: equipment.id,
        ...(lastFuelLog ? { shiftDate: { gt: lastFuelLog.fuelDate } } : {}),
      },
    })

    let usageAmount = 0
    if (isVehicle) {
      usageAmount = usageLogs.reduce((sum, log) => sum + (log.distanceTraveled || 0), 0)
      if (usageAmount === 0 && odometerValue !== null) {
        usageAmount = odometerValue - (lastFuelLog?.odometer ?? equipment.currentOdometer)
      }
    } else {
      usageAmount = usageLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0)
      if (usageAmount === 0 && hoursValue !== null) {
        usageAmount = hoursValue - (lastFuelLog?.hours ?? equipment.currentHours)
      }
    }

    // Get efficiency standard rate — use baseline range midpoint as default
    const baseline = getBaselineRateRange(equipment.type)
    const standardRate = equipment.defaultFuelRate ?? ((baseline.min + baseline.max) / 2)

    // Check for anomalies if usageAmount > 0
    if (usageAmount > 0) {
      const expectedLiters = standardRate * usageAmount
      const tolerance = equipment.fuelTolerance ?? 20.0
      const actualLiters = parsed.data.liters

      if (actualLiters > expectedLiters * (1 + tolerance / 100)) {
        const overagePercent = ((actualLiters - expectedLiters) / expectedLiters) * 100
        const rateUnit = isVehicle ? 'L/km' : 'L/hr'
        const usageUnit = isVehicle ? 'km' : 'hrs'

        const anomalyTitle = `High Fuel Consumption Detected — ${equipment.name}`
        const anomalyMessage = `Actual fuel logged: ${actualLiters}L. Expected: ${expectedLiters.toFixed(1)}L (for ${usageAmount.toFixed(1)} ${usageUnit} at standard rate of ${standardRate} ${rateUnit}). Exceeds expectation by ${overagePercent.toFixed(0)}%. Possible fuel theft, leakage, equipment inefficiency, excessive idling, or incorrect entry.`

        // Notify all admins/managers + the person logging
        const managers = await prisma.user.findMany({
          where: { role: { in: ['admin', 'manager'] }, isActive: true },
          select: { email: true },
        })
        const managerEmails = managers.map((m) => m.email)

        await sendNotification({
          userId: session.id,
          emails: managerEmails,
          title: anomalyTitle,
          message: anomalyMessage,
          severity: 'high',
          equipmentId: equipment.id,
          type: 'fuel_anomaly',
        })
      }
    }

    // Create the fuel log
    const log = await prisma.fuelLog.create({
      data: {
        equipmentId: parsed.data.equipmentId,
        loggedById: session.id,
        liters: parsed.data.liters,
        costPerLiter: parsed.data.costPerLiter,
        totalCost,
        odometer: odometerValue,
        hours: hoursValue,
        fuelDate,
        projectSite: parsed.data.projectSite,
        notes: parsed.data.notes,
      },
      include: {
        equipment: { select: { id: true, name: true } },
        loggedBy: { select: { id: true, fullName: true } },
      },
    })

    // Update equipment current reading
    if (isVehicle && odometerValue !== null && odometerValue > equipment.currentOdometer) {
      await prisma.equipment.update({
        where: { id: parsed.data.equipmentId },
        data: { currentOdometer: odometerValue },
      })
    } else if (!isVehicle && hoursValue !== null && hoursValue > equipment.currentHours) {
      await prisma.equipment.update({
        where: { id: parsed.data.equipmentId },
        data: { currentHours: hoursValue },
      })
    }

    // Recalculate rolling average fuel efficiency for vehicles
    if (isVehicle) {
      const { getEffectiveFuelRate: recalcRate } = await import('@/lib/fuel-rate')
      await recalcRate(parsed.data.equipmentId)
    }

    await logAction(
      session.id,
      'CREATE_FUEL_LOG',
      'fuel',
      `Logged ${parsed.data.liters}L fuel for ${equipment.name}`
    )

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    console.error('Create fuel log error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}