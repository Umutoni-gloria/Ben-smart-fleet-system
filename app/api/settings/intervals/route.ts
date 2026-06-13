import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAction } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'

// Fetch all intervals
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const intervals = await prisma.maintenanceInterval.findMany({
      orderBy: [
        { equipmentType: 'asc' },
        { serviceType: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, data: intervals })
  } catch (error) {
    console.error('Get intervals error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Bulk update intervals
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin and Manager can modify maintenance intervals' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { intervals } = body // Expected: Array of { equipmentType, serviceType, intervalValue, intervalType }

    if (!Array.isArray(intervals)) {
      return NextResponse.json({ error: 'Intervals must be an array' }, { status: 400 })
    }

    // Update each interval in database
    for (const item of intervals) {
      if (!item.equipmentType || !item.serviceType || typeof item.intervalValue !== 'number' || !item.intervalType) {
        return NextResponse.json({ error: 'Invalid interval item format' }, { status: 400 })
      }

      await prisma.maintenanceInterval.upsert({
        where: {
          equipmentType_serviceType: {
            equipmentType: item.equipmentType,
            serviceType: item.serviceType,
          },
        },
        update: {
          intervalValue: item.intervalValue,
          intervalType: item.intervalType,
        },
        create: {
          equipmentType: item.equipmentType,
          serviceType: item.serviceType,
          intervalValue: item.intervalValue,
          intervalType: item.intervalType,
        },
      })
    }

    await logAction(
      session.id,
      'UPDATE_MAINTENANCE_INTERVALS',
      'settings',
      `Updated ${intervals.length} maintenance intervals`
    )

    return NextResponse.json({ success: true, message: 'Intervals updated successfully' })
  } catch (error) {
    console.error('Update intervals error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
