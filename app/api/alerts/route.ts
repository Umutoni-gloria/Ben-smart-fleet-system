import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const isRead = searchParams.get('isRead')
    const severity = searchParams.get('severity')
    const type = searchParams.get('type')

    const alerts = await prisma.alert.findMany({
      where: {
        ...(isRead !== null && { isRead: isRead === 'true' }),
        ...(severity && { severity: severity as never }),
        ...(type && { type: type as never }),
      },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: alerts })
  } catch (error) {
    console.error('Get alerts error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Mark all unread alerts as read
    await prisma.alert.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark all alerts read error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}