import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifySmtp, getSmtpStatus } from '@/lib/mailer'

/**
 * GET /api/debug/email
 * Returns SMTP configuration and live verification status.
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

    const status = getSmtpStatus()

    // Run live SMTP verification
    const verification = await verifySmtp()

    return NextResponse.json({
      success: true,
      data: {
        smtpConfigured: status.smtpConfigured,
        gmailUser: status.gmailUser,
        adminEmail: status.adminEmail,
        smtpVerified: verification.ok,
        canSendEmail: status.smtpConfigured && verification.ok,
        verificationError: verification.error || null,
      },
    })
  } catch (error: any) {
    console.error('[/api/debug/email] Error:', error?.message)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
