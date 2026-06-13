import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sendTestEmail } from '@/lib/mailer'

/**
 * POST /api/debug/send-test-email
 * Sends a test email to ADMIN_EMAIL (or a custom recipient).
 * Only accessible to admin role.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can send test emails' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const recipient = body.recipient || process.env.ADMIN_EMAIL

    if (!recipient) {
      return NextResponse.json(
        { error: 'No recipient specified and ADMIN_EMAIL is not configured' },
        { status: 400 }
      )
    }

    console.log(`[SendTestEmail] Admin ${session.email} triggered test email to: ${recipient}`)

    const result = await sendTestEmail(recipient)

    return NextResponse.json({
      success: true,
      data: {
        recipient,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    console.error('[SendTestEmail] Failed:', errorMsg)
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
