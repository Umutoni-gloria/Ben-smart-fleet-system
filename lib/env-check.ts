/**
 * env-check.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates required environment variables at startup.
 * Called at the top of mailer.ts so warnings appear the moment the mailer
 * module is first imported.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REQUIRED_SMTP_VARS = ['GMAIL_USER', 'GMAIL_PASS', 'ADMIN_EMAIL'] as const

export function checkEmailEnv(): void {
  for (const varName of REQUIRED_SMTP_VARS) {
    if (!process.env[varName]) {
      console.warn(
        `[EnvCheck] ⚠️  Missing environment variable: ${varName} — email notifications will not work.`
      )
    }
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    console.log(
      `[EnvCheck] ✅  SMTP credentials present (GMAIL_USER=${process.env.GMAIL_USER})`
    )
  }
}
