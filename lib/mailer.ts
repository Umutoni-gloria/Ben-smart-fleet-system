/**
 * mailer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gmail SMTP mailer with:
 *  - Lazy transporter creation (created on first use, not at module load)
 *  - SMTP verification with explicit logging
 *  - Full EmailLog persistence for every attempt (PENDING → SENT or FAILED)
 *  - Explicit error logging with stack traces (no silent failures)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import nodemailer from 'nodemailer'
import { checkEmailEnv } from './env-check'

// Validate env vars on first import
checkEmailEnv()

// Lazy singleton — created on first call to getTransporter()
let _transporter: nodemailer.Transporter | null = null
let _smtpVerified = false

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    console.log('[Mailer] Creating SMTP transporter...')
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })
    console.log(`[Mailer] Transporter created for user: ${process.env.GMAIL_USER}`)
  }
  return _transporter
}

/**
 * Verify the SMTP connection. Returns true if successful.
 * Caches the result so subsequent calls don't re-verify.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    const msg = 'SMTP not configured — GMAIL_USER or GMAIL_PASS is missing'
    console.error(`[Mailer] ❌ ${msg}`)
    return { ok: false, error: msg }
  }

  try {
    const transporter = getTransporter()
    await transporter.verify()
    _smtpVerified = true
    console.log('[Mailer] ✅ SMTP verification successful')
    return { ok: true }
  } catch (err: any) {
    _smtpVerified = false
    const msg = err?.message || String(err)
    console.error('[Mailer] ❌ SMTP verification failed:', msg)
    console.error('[Mailer] Stack:', err?.stack)
    return { ok: false, error: msg }
  }
}

/**
 * Returns current SMTP configuration status (without making a live connection).
 */
export function getSmtpStatus() {
  return {
    smtpConfigured: !!(process.env.GMAIL_USER && process.env.GMAIL_PASS),
    gmailUser: process.env.GMAIL_USER || null,
    adminEmail: process.env.ADMIN_EMAIL || null,
    smtpVerified: _smtpVerified,
  }
}

/**
 * Core send function — logs every attempt to the EmailLog table.
 * Status: PENDING → SENT on success, FAILED on error.
 */
async function sendMail(options: {
  to: string
  subject: string
  html: string
}): Promise<{ messageId: string }> {
  const { to, subject, html } = options

  console.log(`[Mailer] → Attempting to send email to: ${to} | Subject: "${subject}"`)

  // Persist PENDING log — import prisma lazily to avoid circular deps
  let logId: string | null = null
  try {
    const prisma = (await import('./prisma')).default
    const log = await prisma.emailLog.create({
      data: { recipient: to, subject, status: 'PENDING' },
    })
    logId = log.id
  } catch (dbErr: any) {
    console.warn('[Mailer] Could not create EmailLog record:', dbErr?.message)
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    const error = 'SMTP not configured — GMAIL_USER or GMAIL_PASS missing'
    console.error(`[Mailer] ❌ ${error}`)
    await _markLog(logId, 'FAILED', null, error)
    throw new Error(error)
  }

  try {
    const transporter = getTransporter()
    const info = await transporter.sendMail({
      from: `"Ben Supply Fleet" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    })

    const messageId: string = (info as any).messageId || ''
    console.log(`[Mailer] ✅ Email sent to ${to} | MessageId: ${messageId}`)
    await _markLog(logId, 'SENT', messageId, null)
    return { messageId }
  } catch (err: any) {
    const errorMsg = err?.message || String(err)
    console.error(`[Mailer] ❌ Failed to send email to ${to} | Error: ${errorMsg}`)
    console.error('[Mailer] Stack:', err?.stack)
    await _markLog(logId, 'FAILED', null, errorMsg)
    throw err
  }
}

/** Update an existing EmailLog record with final status */
async function _markLog(
  logId: string | null,
  status: 'SENT' | 'FAILED',
  messageId: string | null,
  error: string | null
): Promise<void> {
  if (!logId) return
  try {
    const prisma = (await import('./prisma')).default
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status,
        ...(messageId && { messageId }),
        ...(error && { error }),
      },
    })
  } catch (dbErr: any) {
    console.warn('[Mailer] Could not update EmailLog record:', dbErr?.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public email functions
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  await sendMail({
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Password Reset Request</h2>
        <p>You requested a password reset for your Ben Supply Fleet account.</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display: inline-block; padding: 12px 24px; background-color: #1a56db;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  })
}

export async function sendAlertEmail(email: string, title: string, message: string) {
  await sendMail({
    to: email,
    subject: `Alert: ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e53e3e;">System Alert</h2>
        <h3>${title}</h3>
        <p>${message}</p>
        <p style="color: #666;">Login to Ben Supply Fleet to take action.</p>
      </div>
    `,
  })
}

export async function sendTestEmail(recipient: string): Promise<{ messageId: string }> {
  return sendMail({
    to: recipient,
    subject: 'Ben Supply Fleet — SMTP Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 24px;">
          <h2 style="color: #f97316; margin: 0;">Ben Supply Fleet</h2>
          <p style="color: #94a3b8; margin: 8px 0 0;">Email Diagnostics</p>
        </div>
        <div style="padding: 24px;">
          <h3 style="color: #1e293b;">✅ SMTP Configuration Verified</h3>
          <p style="color: #475569;">This test email confirms your Gmail SMTP is correctly configured and operational.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">Sent At</td>
              <td style="padding: 8px; color: #1e293b;">${new Date().toISOString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">Recipient</td>
              <td style="padding: 8px; color: #1e293b;">${recipient}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">SMTP Host</td>
              <td style="padding: 8px; color: #1e293b;">smtp.gmail.com:465</td>
            </tr>
          </table>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">If you received this email, all notifications are properly configured.</p>
        </div>
      </div>
    `,
  })
}