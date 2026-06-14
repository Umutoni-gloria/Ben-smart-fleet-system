/**
 * POST /api/debug/fix-schedules
 *
 * One-time repair: finds all active schedules where nextDueOdometer or nextDueHours
 * is NULL but the intervalType is 'km' or 'hours'. Fills in the missing value from
 * the equipment's current odometer/hours + intervalValue so the maintenance checker
 * can track them properly.
 *
 * Safe to run multiple times — only updates records that are missing the value.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const schedules = await prisma.serviceSchedule.findMany({
      where: {
        status: { not: 'completed' },
        OR: [
          { intervalType: 'km', nextDueOdometer: null },
          { intervalType: 'hours', nextDueHours: null },
        ],
      },
      include: {
        equipment: {
          select: { id: true, name: true, type: true, currentOdometer: true, currentHours: true },
        },
      },
    })

    const fixed: string[] = []
    const skipped: string[] = []

    for (const s of schedules) {
      const eq = s.equipment

      if (s.intervalType === 'km') {
        const nextDueOdometer = (s.lastOdometer ?? eq.currentOdometer) + s.intervalValue
        await prisma.serviceSchedule.update({
          where: { id: s.id },
          data: {
            lastOdometer: s.lastOdometer ?? eq.currentOdometer,
            nextDueOdometer,
          },
        })
        fixed.push(`"${s.title}" on ${eq.name}: nextDueOdometer set to ${nextDueOdometer} km`)
      } else if (s.intervalType === 'hours') {
        const nextDueHours = (s.lastHours ?? eq.currentHours) + s.intervalValue
        await prisma.serviceSchedule.update({
          where: { id: s.id },
          data: {
            lastHours: s.lastHours ?? eq.currentHours,
            nextDueHours,
          },
        })
        fixed.push(`"${s.title}" on ${eq.name}: nextDueHours set to ${nextDueHours} hrs`)
      } else {
        skipped.push(`"${s.title}" on ${eq.name}: intervalType=${s.intervalType} (date-only, skipped)`)
      }
    }

    // After fixing, run the threshold checker for all affected equipment
    const equipmentIds = [...new Set(schedules.map((s) => s.equipmentId))]
    const { checkMaintenanceThresholds } = await import('@/lib/maintenance-thresholds')
    for (const eqId of equipmentIds) {
      await checkMaintenanceThresholds(eqId)
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixed.length} schedule(s). Maintenance check re-run for ${equipmentIds.length} equipment.`,
      fixed,
      skipped,
    })
  } catch (error) {
    console.error('[fix-schedules] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
