import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['technician', 'admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schedules = await prisma.serviceSchedule.findMany({
      where: session.role === 'technician' ? { technicianId: session.id, status: { not: 'completed' } } : { status: { not: 'completed' } },
      include: { equipment: { select: { id: true, name: true, type: true, serialNumber: true } } }
    })

    const equipment = await prisma.equipment.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, type: true, serialNumber: true }
    })

    return NextResponse.json({ success: true, data: { schedules, equipment, timestamp: new Date() } })
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Expected structure: { logsToSync: [...] }
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ success: true, message: 'Offline sync received' })
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
