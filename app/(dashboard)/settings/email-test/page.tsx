'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Loader2,
  Clock,
  MessageSquare,
  Server,
} from 'lucide-react'

interface SmtpStatus {
  smtpConfigured: boolean
  gmailUser: string | null
  adminEmail: string | null
  smtpVerified: boolean
  canSendEmail: boolean
  verificationError: string | null
}

interface EmailLog {
  id: string
  recipient: string
  subject: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  error: string | null
  messageId: string | null
  createdAt: string
}

interface LogSummary {
  total: number
  sent: number
  failed: number
  pending: number
}

export default function EmailTestPage() {
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null)
  const [smtpLoading, setSmtpLoading] = useState(true)
  const [smtpError, setSmtpError] = useState<string | null>(null)

  const [testRecipient, setTestRecipient] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    messageId?: string
    recipient?: string
    error?: string
  } | null>(null)

  const [logs, setLogs] = useState<EmailLog[]>([])
  const [summary, setSummary] = useState<LogSummary | null>(null)
  const [logsLoading, setLogsLoading] = useState(true)

  const fetchSmtpStatus = useCallback(async () => {
    setSmtpLoading(true)
    setSmtpError(null)
    try {
      const res = await fetch('/api/debug/email')
      const json = await res.json()
      if (json.success) {
        setSmtpStatus(json.data)
        setTestRecipient(json.data.adminEmail || '')
      } else {
        setSmtpError(json.error || 'Failed to fetch SMTP status')
      }
    } catch (err: any) {
      setSmtpError(err?.message || 'Network error')
    } finally {
      setSmtpLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/debug/email-logs')
      const json = await res.json()
      if (json.success) {
        setLogs(json.data)
        setSummary(json.summary)
      }
    } catch (err) {
      console.error('Failed to fetch email logs', err)
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSmtpStatus()
    fetchLogs()
  }, [fetchSmtpStatus, fetchLogs])

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault()
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/debug/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testRecipient }),
      })
      const json = await res.json()
      if (json.success) {
        setTestResult({
          success: true,
          messageId: json.data.messageId,
          recipient: json.data.recipient,
        })
        // Refresh logs after test
        setTimeout(fetchLogs, 1500)
      } else {
        setTestResult({ success: false, error: json.error })
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Network error' })
    } finally {
      setTestSending(false)
    }
  }

  const statusDot = (ok: boolean | undefined) =>
    ok ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
    )

  const statusBadge = (s: 'SENT' | 'FAILED' | 'PENDING') => {
    const styles = {
      SENT: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-red-100 text-red-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
    }
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[s]}`}
      >
        {s}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-6 h-6 text-orange-500" />
              Email Diagnostics
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify SMTP configuration, send test emails, and review email delivery logs.
            </p>
          </div>
          <button
            id="btn-refresh-smtp"
            onClick={() => { fetchSmtpStatus(); fetchLogs() }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* SMTP Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-800">SMTP Configuration Status</h2>
          </div>
          {smtpLoading ? (
            <div className="px-6 py-10 flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Verifying SMTP connection...</span>
            </div>
          ) : smtpError ? (
            <div className="px-6 py-6 flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{smtpError}</span>
            </div>
          ) : smtpStatus ? (
            <div className="divide-y divide-slate-100">
              {[
                {
                  label: 'SMTP Configured',
                  desc: 'GMAIL_USER and GMAIL_PASS are present in environment',
                  ok: smtpStatus.smtpConfigured,
                  value: smtpStatus.gmailUser || '(not set)',
                },
                {
                  label: 'SMTP Verified',
                  desc: 'Live connection to smtp.gmail.com:465 succeeded',
                  ok: smtpStatus.smtpVerified,
                  value: smtpStatus.smtpVerified
                    ? 'Connection successful'
                    : smtpStatus.verificationError || 'Failed',
                },
                {
                  label: 'Can Send Email',
                  desc: 'All checks passed — emails will be delivered',
                  ok: smtpStatus.canSendEmail,
                  value: smtpStatus.canSendEmail ? 'Yes' : 'No',
                },
                {
                  label: 'Admin Email',
                  desc: 'ADMIN_EMAIL recipient for system alerts',
                  ok: !!smtpStatus.adminEmail,
                  value: smtpStatus.adminEmail || '(not set)',
                },
              ].map((row) => (
                <div key={row.label} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {statusDot(row.ok)}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-400 truncate">{row.desc}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded-lg flex-shrink-0 max-w-xs truncate ${row.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Send Test Email */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-800">Send Test Email</h2>
          </div>
          <form onSubmit={handleSendTest} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Recipient Email
              </label>
              <input
                id="input-test-recipient"
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="e.g. admin@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
              />
              <p className="text-xs text-slate-400 mt-1">
                Pre-filled from ADMIN_EMAIL. You can change this to any address.
              </p>
            </div>

            <button
              id="btn-send-test-email"
              type="submit"
              disabled={testSending || !testRecipient}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              {testSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Test Email
                </>
              )}
            </button>

            {/* Result */}
            {testResult && (
              <div
                className={`rounded-xl p-4 flex items-start gap-3 ${testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  {testResult.success ? (
                    <>
                      <p className="text-sm font-bold text-emerald-700">Email delivered successfully!</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Recipient: <strong>{testResult.recipient}</strong>
                      </p>
                      {testResult.messageId && (
                        <p className="text-xs text-emerald-600 mt-0.5 font-mono break-all">
                          Message-ID: {testResult.messageId}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-red-700">Failed to send email</p>
                      <p className="text-xs text-red-600 mt-0.5 break-all">{testResult.error}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Email Log Summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Attempts', value: summary.total, color: 'text-slate-900', bg: 'bg-white border border-slate-100' },
              { label: 'Sent', value: summary.sent, color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-100' },
              { label: 'Failed', value: summary.failed, color: 'text-red-700', bg: 'bg-red-50 border border-red-100' },
              { label: 'Pending', value: summary.pending, color: 'text-yellow-700', bg: 'bg-yellow-50 border border-yellow-100' },
            ].map((card) => (
              <div key={card.label} className={`${card.bg} rounded-2xl p-4 shadow-sm`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
                <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Email Log Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-800">Email Delivery Log</h2>
              <span className="text-xs text-slate-400">(last 50 attempts)</span>
            </div>
            <button
              id="btn-refresh-logs"
              onClick={fetchLogs}
              className="text-xs font-semibold text-orange-500 hover:text-orange-700"
            >
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <div className="px-6 py-10 flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No email attempts logged yet.</p>
              <p className="text-xs text-slate-300 mt-1">
                Send a test email above or trigger a system notification to see logs here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Message-ID</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 whitespace-nowrap">{statusBadge(log.status)}</td>
                      <td className="px-6 py-3 text-slate-700 font-medium max-w-[180px] truncate">
                        {log.recipient}
                      </td>
                      <td className="px-6 py-3 text-slate-600 max-w-[240px] truncate">
                        {log.subject}
                        {log.error && (
                          <p className="text-xs text-red-500 mt-0.5 truncate" title={log.error}>
                            ↳ {log.error}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400 max-w-[160px] truncate">
                        {log.messageId || '—'}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
