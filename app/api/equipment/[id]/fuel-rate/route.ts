/**
 * PATCH /api/equipment/[id]/fuel-rate
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only endpoint to set or override the default fuel rate (L/km) for a
 * specific vehicle. The system will use this value when historical fuel log
 * data is insufficient (fewer than 2 logs) or when the admin wants to override
 * the auto-calculated rate with a known/manufacturer-specified value.
 *
 * Also returns the current auto-calculated rate for reference.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { getEffectiveFuelRate } from '@/lib/fuel-rate'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
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
      select: {
        id: true,
        name: true,
        fuelRateL_per_km: true,
        defaultFuelRate: true,
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    // Trigger a live recalculation and return all rate info
    const effectiveRate = await getEffectiveFuelRate(id)

    return NextResponse.json({
      success: true,
      data: {
        equipmentId: id,
        name: equipment.name,
        autoCalculatedRate: equipment.fuelRateL_per_km,    // last saved auto rate
        adminDefaultRate: equipment.defaultFuelRate,        // admin override
        effectiveRate,                                       // what the system will use
        effectiveRateSource:
          equipment.fuelRateL_per_km !== null
            ? 'auto_calculated'
            : equipment.defaultFuelRate !== null
            ? 'admin_default'
            : 'none',
      },
    })
  } catch (error) {
    console.error('Get fuel rate error:', error)
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

    // Only admins and managers can set the default fuel rate
    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin and Manager can set the default fuel rate' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()

    const { defaultFuelRate } = body

    if (
      defaultFuelRate === undefined ||
      typeof defaultFuelRate !== 'number' ||
      defaultFuelRate <= 0
    ) {
      return NextResponse.json(
        {
          error:
            'defaultFuelRate is required and must be a positive number (e.g., 0.35 for 0.35 L/km)',
        },
        { status: 400 }
      )
    }

    const equipment = await prisma.equipment.findUnique({ where: { id } })
    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: { defaultFuelRate },
      select: {
        id: true,
        name: true,
        fuelRateL_per_km: true,
        defaultFuelRate: true,
      },
    })

    await logAction(
      session.id,
      'SET_DEFAULT_FUEL_RATE',
      'equipment',
      `Set default fuel rate for ${equipment.name} to ${defaultFuelRate} L/km`
    )

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Default fuel rate set to ${defaultFuelRate} L/km for ${equipment.name}`,
    })
  } catch (error) {
    console.error('Set fuel rate error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
