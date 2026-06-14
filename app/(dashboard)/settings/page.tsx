'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { translations, Locale } from '@/lib/translations'
import { User, Bell, Shield, Wrench, Mail, Inbox } from 'lucide-react'

interface UserProfile {
  id: string
  fullName: string
  role: string
  email: string
  preferredLanguage: string
  notificationPrefs: Record<string, boolean>
}

interface EmailLog {
  id: string
  status: string
  recipient: string
  subject: string
  createdAt: string
  error?: string | null
}

interface EmailLogSummary {
  total: number
  sent: number
  failed: number
  pending: number
}

interface MaintenanceInterval {
  id: string
  equipmentType: string
  serviceType: string
  intervalValue: number
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profile')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [emailLogSummary, setEmailLogSummary] = useState<EmailLogSummary | null>(null)
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false)

  // Determine current language from cookie or default to en
  const [lang, setLang] = useState<Locale>('en')

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )lang=([^;]*)/)
    if (match && (match[1] === 'en' || match[1] === 'fr' || match[1] === 'rw')) {
      setLang(match[1] as Locale)
    }
  }, [successMsg]) // Re-run when settings change to update labels dynamically

  const t = translations[lang] || translations.en

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me')
        const json = await res.json()
        if (json.success) {
          setUser(json.data || json.user) 
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  const [intervals, setIntervals] = useState<MaintenanceInterval[]>([])
  const [loadingIntervals, setLoadingIntervals] = useState(false)

  useEffect(() => {
    if (activeTab === 'intervals' && intervals.length === 0) {
      setLoadingIntervals(true)
      fetch('/api/settings/intervals')
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setIntervals(json.data)
          }
        })
        .catch((err) => console.error('Failed to fetch intervals:', err))
        .finally(() => setLoadingIntervals(false))
    }
  }, [activeTab, intervals.length])

  useEffect(() => {
    if (activeTab === 'email-logs') {
      setLoadingEmailLogs(true)
      fetch('/api/debug/email-logs')
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setEmailLogs(json.data)
            setEmailLogSummary(json.summary)
          }
        })
        .catch((err) => console.error('Failed to fetch email logs:', err))
        .finally(() => setLoadingEmailLogs(false))
    }
  }, [activeTab])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccessMsg('')
    try {
      if (activeTab === 'intervals') {
        const res = await fetch('/api/settings/intervals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervals }),
        })
        const data = await res.json()
        if (!res.ok) {
          alert(data.error || 'Failed to save intervals')
          return
        }
        setSuccessMsg('Intervals saved successfully!')
        setTimeout(() => setSuccessMsg(''), 3000)
        return
      }

      if (user?.id) {
         const res = await fetch(`/api/users/${user.id}`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             fullName: user.fullName,
             notificationPrefs: user.notificationPrefs,
             preferredLanguage: user.preferredLanguage,
           })
         })
         const data = await res.json()
         if (!res.ok) {
           alert(data.error || "Failed to save settings")
           return
         }
         
         // Update language cookie as well
         document.cookie = `lang=${user.preferredLanguage}; path=/; max-age=31536000; SameSite=Lax`
         setLang(user.preferredLanguage)
         
         // Refresh router to update Layout and Sidebar
         router.refresh()
         
         setSuccessMsg(t.settingsSuccess)
         setTimeout(() => setSuccessMsg(''), 3000)
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', label: t.profileInfo, icon: User, href: null },
    { id: 'notifications', label: t.alerts, icon: Bell, href: null },
    { id: 'security', label: 'Security', icon: Shield, href: null },
    ...(user?.role === 'admin' || user?.role === 'manager'
      ? [{ id: 'intervals', label: 'Maintenance Intervals', icon: Wrench, href: null }]
      : []),
    ...(user?.role === 'admin' || user?.role === 'manager'
      ? [{ id: 'email-logs', label: 'Email Logs', icon: Inbox, href: null }]
      : []),
    ...(user?.role === 'admin'
      ? [{ id: 'email-test', label: 'Email Diagnostics', icon: Mail, href: '/settings/email-test' }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t.settingsTitle}</h1>
        <p className="text-sm text-slate-500 mb-6">{t.settingsSubtitle}</p>
 
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              if (tab.href) {
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className="w-full text-left px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </Link>
                )
              }
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2.5 ${
                    activeTab === tab.id 
                      ? 'bg-orange-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
 
          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading settings...</div>
              ) : (
                <form onSubmit={handleSave}>
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 capitalize">
                      {activeTab === 'profile' ? t.profileInfo : activeTab === 'notifications' ? t.alerts : activeTab === 'intervals' ? 'Maintenance Intervals' : activeTab === 'email-logs' ? 'Email Logs' : 'Security'}
                    </h2>
                    {successMsg && <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">{successMsg}</span>}
                  </div>
 
                  <div className="p-6 space-y-6">
                    {activeTab === 'profile' && user && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <button type="button" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-medium rounded-xl transition-colors">Change Photo</button>
                            <p className="text-xs text-slate-500 mt-2">JPG, GIF or PNG. Max size of 800K</p>
                          </div>
                        </div>
 
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.fullNameLabel}</label>
                            <input 
                              type="text" 
                              value={user.fullName || ''} 
                              onChange={e => setUser({...user, fullName: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-sm text-slate-900" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.roleLabel}</label>
                            <input 
                              type="text" 
                              value={user.role || ''} 
                              disabled
                              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500 text-sm cursor-not-allowed uppercase font-semibold" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.emailLabel}</label>
                            <input 
                              type="email" 
                              value={user.email || ''} 
                              disabled
                              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500 text-sm cursor-not-allowed" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.langLabel}</label>
                            <select
                              value={user.preferredLanguage || 'en'}
                              onChange={e => setUser({...user, preferredLanguage: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white font-medium text-slate-800 cursor-pointer shadow-sm"
                            >
                              <option value="en">English (EN)</option>
                              <option value="fr">Français (FR)</option>
                              <option value="rw">Kinyarwanda (RW)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
 
                    {activeTab === 'notifications' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-500 mb-4">Choose how you want to be notified about urgent system alerts and overdues.</p>
                        
                        {['in_app', 'email', 'sms'].map((channel) => (
                          <label key={channel} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:border-slate-200 transition-colors">
                            <div>
                               <p className="text-sm font-semibold text-slate-900 capitalize">{channel.replace('_', ' ')} Notifications</p>
                               <p className="text-xs text-slate-500 mt-0.5">Receive immediate ping via {channel}</p>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={user?.notificationPrefs?.[channel] ?? true}
                              onChange={e => setUser({
                                ...user, 
                                notificationPrefs: { ...(user.notificationPrefs || {}), [channel]: e.target.checked }
                              })}
                              className="w-5 h-5 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer focus:ring-offset-0"
                            />
                          </label>
                        ))}
                      </div>
                    )}
 
                    {activeTab === 'security' && (
                      <div className="space-y-4">
                         <p className="text-sm text-slate-500 mb-4">Protect your account with a strong password.</p>
                         
                         <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                          <input type="password" placeholder="••••••••" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-sm text-slate-900" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                          <input type="password" placeholder="" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-sm text-slate-900" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                          <input type="password" placeholder="" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none text-sm text-slate-900" />
                        </div>
                      </div>
                    )}

                    {activeTab === 'intervals' && (
                      <div className="space-y-6">
                        <p className="text-sm text-slate-500 mb-4">
                          Customize preventive maintenance thresholds. For Trucks and Tipper Trucks, thresholds are in kilometers (km). For Excavators, Bulldozers, and Graders, thresholds are in engine hours (hrs).
                        </p>
                        {loadingIntervals ? (
                          <div className="text-center py-8 text-sm text-slate-400">Loading intervals...</div>
                        ) : (
                          <div className="space-y-6">
                            <div>
                              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                                Vehicles (Trucks & Tipper Trucks) - km
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {intervals
                                  .filter((int) => ['truck', 'tipper_truck'].includes(int.equipmentType))
                                  .map((int, index) => (
                                    <div key={int.id || index} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                      <div>
                                        <span className="text-xs font-semibold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded mr-2">
                                          {int.equipmentType.replace('_', ' ')}
                                        </span>
                                        <p className="text-sm font-medium text-slate-900 mt-1 capitalize">
                                          {int.serviceType.replace('_', ' ')}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={int.intervalValue}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0
                                            setIntervals((prev) =>
                                              prev.map((item) =>
                                                item.id === int.id ? { ...item, intervalValue: val } : item
                                              )
                                            )
                                          }}
                                          className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-sm font-semibold text-right text-slate-800"
                                        />
                                        <span className="text-xs text-slate-400 font-medium">km</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                                Heavy Equipment (Excavator, Bulldozer, Grader) - hrs
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {intervals
                                  .filter((int) => ['excavator', 'bulldozer', 'grader'].includes(int.equipmentType))
                                  .map((int, index) => (
                                    <div key={int.id || index} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                      <div>
                                        <span className="text-xs font-semibold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded mr-2">
                                          {int.equipmentType}
                                        </span>
                                        <p className="text-sm font-medium text-slate-900 mt-1 capitalize">
                                          {int.serviceType.replace('_', ' ')}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={int.intervalValue}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0
                                            setIntervals((prev) =>
                                              prev.map((item) =>
                                                item.id === int.id ? { ...item, intervalValue: val } : item
                                              )
                                            )
                                          }}
                                          className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-sm font-semibold text-right text-slate-800"
                                        />
                                        <span className="text-xs text-slate-400 font-medium">hrs</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'email-logs' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-500">
                          Shows the last 50 email attempts. Use this to verify which users are receiving notifications.
                        </p>

                        {/* Summary pills */}
                        {emailLogSummary && (
                          <div className="flex gap-3 flex-wrap">
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                              Total: {emailLogSummary.total}
                            </span>
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              ✅ Sent: {emailLogSummary.sent}
                            </span>
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              ❌ Failed: {emailLogSummary.failed}
                            </span>
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                              ⏳ Pending: {emailLogSummary.pending}
                            </span>
                          </div>
                        )}

                        {loadingEmailLogs ? (
                          <div className="text-center py-8 text-sm text-slate-400">Loading email logs...</div>
                        ) : emailLogs.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 text-sm">
                            <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            No email logs yet
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Recipient</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Subject</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Time</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Error</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {emailLogs.map((log: EmailLog) => (
                                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                        log.status === 'SENT'
                                          ? 'bg-green-100 text-green-700'
                                          : log.status === 'FAILED'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {log.status === 'SENT' ? '✅' : log.status === 'FAILED' ? '❌' : '⏳'} {log.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-800 font-medium">{log.recipient}</td>
                                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={log.subject}>{log.subject}</td>
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                                      {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-red-500 text-xs max-w-xs truncate" title={log.error || ''}>
                                      {log.error || <span className="text-slate-300">—</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setLoadingEmailLogs(true)
                            fetch('/api/debug/email-logs')
                              .then(r => r.json())
                              .then(json => { if (json.success) { setEmailLogs(json.data); setEmailLogSummary(json.summary) } })
                              .catch(console.error)
                              .finally(() => setLoadingEmailLogs(false))
                          }}
                          className="text-xs text-orange-500 hover:text-orange-700 font-medium flex items-center gap-1"
                        >
                          ↻ Refresh
                        </button>
                      </div>
                    )}
                  </div>
 
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end rounded-b-2xl">
                     <button 
                       type="submit" 
                       disabled={saving}
                       className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                     >
                       {saving ? t.savingSettings : t.saveSettings}
                     </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
 
      </div>
    </div>
  )
}
