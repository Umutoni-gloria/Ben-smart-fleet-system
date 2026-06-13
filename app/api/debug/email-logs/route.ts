import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/debug/email-logs
 * Returns the last 50 EmailLog records.
 * Only accessible to admin and manager roles.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const logs = await prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const summary = {
      total: logs.length,
      sent: logs.filter((l) => l.status === 'SENT').length,
      failed: logs.filter((l) => l.status === 'FAILED').length,
      pending: logs.filter((l) => l.status === 'PENDING').length,
    }

    return NextResponse.json({ success: true, data: logs, summary })
  } catch (error: any) {
    console.error('[/api/debug/email-logs] Error:', error?.message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
