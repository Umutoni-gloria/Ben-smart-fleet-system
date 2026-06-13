/**
 * notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified notification dispatcher.
 * Sends in-app alerts (prisma.alert) AND emails (via mailer.ts) for any
 * system event (fuel anomaly, schedule overdue, breakdown, etc.).
 *
 * FIX: Removed the silent `if (GMAIL_USER && GMAIL_PASS)` guard that was
 * preventing emails from being sent. The mailer itself now handles missing
 * credentials with explicit errors. Every email attempt is logged to EmailLog.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from './prisma'
import { sendAlertEmail } from './mailer'

export interface NotificationParams {
  /** Optional single user ID — we'll look up their email */
  userId?: string
  /** Optional list of email addresses to notify directly */
  emails?: string[]
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  equipmentId?: string
  type?: string
}

/**
 * Send a notification:
 * 1. Creates an in-app Alert record in the database.
 * 2. Sends an email to all provided emails + the user's email (if userId given).
 *
 * All email attempts are logged to EmailLog (via mailer.ts).
 * Failures are logged but do NOT throw — a failed email must never
 * prevent the main business operation from completing.
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  const { userId, emails = [], title, message, severity, equipmentId, type } = params

  // 1. Create in-app alert record
  try {
    await prisma.alert.create({
      data: {
        title,
        message,
        severity: severity as never,
        type: (type || 'corrective_breakdown') as never,
        equipmentId: equipmentId || null,
        isRead: false,
      },
    })
  } catch (err: any) {
    console.error('[Notification] Failed to create alert record:', err?.message)
  }

  // 2. Gather all unique email addresses to notify
  const allEmails = new Set<string>(emails.filter(Boolean))

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
      if (user?.email) allEmails.add(user.email)
    } catch (err: any) {
      console.error('[Notification] Failed to fetch user email:', err?.message)
    }
  }

  if (allEmails.size === 0) {
    console.warn(`[Notification] No recipients for alert: "${title}" — skipping email`)
    return
  }

  console.log(`[Notification] Sending alert "${title}" to ${allEmails.size} recipient(s): ${[...allEmails].join(', ')}`)

  // 3. Send emails — each attempt is independently logged
  for (const email of allEmails) {
    try {
      await sendAlertEmail(email, title, message)
    } catch (err: any) {
      // Error already logged inside mailer.ts — just note it here
      console.error(`[Notification] Email delivery failed for ${email}: ${err?.message}`)
    }
  }
}
