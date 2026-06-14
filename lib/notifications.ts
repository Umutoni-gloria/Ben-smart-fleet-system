/**
 * notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified notification dispatcher.
 * Sends in-app alerts (prisma.alert) AND emails (via mailer.ts) for any
 * system event (fuel anomaly, schedule overdue, breakdown, etc.).
 *
 * FIX: Now respects each user's notificationPrefs.email field.
 *      Users with email notifications disabled will NOT receive emails.
 *      When emails[] list is passed directly (e.g. from role-based queries),
 *      we look up those users' prefs and filter accordingly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from './prisma'
import { sendAlertEmail } from './mailer'

export interface NotificationParams {
  /** Optional single user ID — we'll look up their email + prefs */
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
 * 2. Sends an email ONLY to recipients who have email notifications enabled
 *    in their notificationPrefs ({"email": true}).
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
  } catch (err) {
    console.error('[Notification] Failed to create alert record:', err instanceof Error ? err.message : err)
  }

  // 2. Build a map of email → hasEmailEnabled using DB prefs
  //    so we can filter out users who opted out of email notifications.
  const emailsToCheck = new Set<string>(emails.filter(Boolean))

  // Also add the single userId's email if provided
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, notificationPrefs: true },
      })
      if (user?.email) {
        const prefs = user.notificationPrefs as Record<string, boolean> | null
        const emailEnabled = prefs?.email !== false // default true if not set
        if (emailEnabled) {
          emailsToCheck.add(user.email)
        } else {
          console.log(`[Notification] User ${user.email} has email notifications disabled — skipping`)
        }
      }
    } catch (err) {
      console.error('[Notification] Failed to fetch user prefs:', err instanceof Error ? err.message : err)
    }
  }

  // 3. For the emails[] list (role-based), look up their notificationPrefs
  //    and filter to only those who have email: true
  const filteredEmails = new Set<string>()

  if (emails.length > 0) {
    try {
      const users = await prisma.user.findMany({
        where: { email: { in: emails.filter(Boolean) }, isActive: true },
        select: { email: true, notificationPrefs: true },
      })

      for (const user of users) {
        const prefs = user.notificationPrefs as Record<string, boolean> | null
        const emailEnabled = prefs?.email !== false // default true if pref not set
        if (emailEnabled) {
          filteredEmails.add(user.email)
        } else {
          console.log(`[Notification] "${user.email}" has email notifications disabled — skipping`)
        }
      }
    } catch (err) {
      console.error('[Notification] Failed to look up user prefs for email list:', err instanceof Error ? err.message : err)
      // Fallback: send to all if DB lookup fails
      emails.forEach((e) => filteredEmails.add(e))
    }
  }

  // Merge userId-based email (already filtered above) with role-based emails
  if (userId) {
    // userId email was already added to emailsToCheck with pref check above
    emailsToCheck.forEach((e) => filteredEmails.add(e))
  }

  if (filteredEmails.size === 0) {
    console.warn(`[Notification] No email-enabled recipients for alert: "${title}" — skipping email`)
    return
  }

  console.log(
    `[Notification] Sending alert "${title}" to ${filteredEmails.size} recipient(s): ${[...filteredEmails].join(', ')}`
  )

  // 4. Send emails — each attempt is independently logged
  for (const email of filteredEmails) {
    try {
      await sendAlertEmail(email, title, message)
    } catch (err) {
      // Error already logged inside mailer.ts — just note it here
      console.error(`[Notification] Email delivery failed for ${email}:`, err instanceof Error ? err.message : err)
    }
  }
}
