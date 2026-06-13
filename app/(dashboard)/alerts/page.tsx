'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Info, AlertTriangle, AlertCircle, Bell, MailOpen } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type Alert = {
  id: string
  title: string
  message: string
  type: string
  severity: string
  isRead: boolean
  createdAt: string
  equipment: { id: string; name: string; type: string } | null
}

const severityStyles: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
}

const severityIcons: Record<string, React.ReactNode> = {
  low: <Info className="w-5 h-5 text-blue-500" />,
  medium: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  high: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  critical: <AlertCircle className="w-5 h-5 text-red-500" />,
}

const typeLabels: Record<string, string> = {
  schedule_due: 'Schedule Due',
  schedule_overdue: 'Schedule Overdue',
  corrective_breakdown: 'Breakdown',
  fuel_anomaly: 'Fuel Anomaly',
  usage_threshold: 'Usage Threshold',
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterRead, setFilterRead] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  async function fetchAlerts() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterSeverity) params.append('severity', filterSeverity)
      if (filterRead !== '') params.append('isRead', filterRead)

      const res = await fetch(`/api/alerts?${params.toString()}`)
      const data = await res.json()
      if (data.success) setAlerts(data.data)
    } catch {
      console.error('Failed to fetch alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [filterSeverity, filterRead])

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/alerts/${id}`, { method: 'PATCH' })
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
      )
    } catch {
      console.error('Failed to mark alert as read')
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await fetch('/api/alerts', { method: 'PATCH' })
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))
    } catch {
      console.error('Failed to mark all alerts as read')
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this alert?')) return
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      console.error('Failed to delete alert')
    }
  }

  const unreadCount = alerts.filter((a) => !a.isRead).length
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const highCount = alerts.filter((a) => a.severity === 'high').length

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
            <p className="text-sm text-gray-500 mt-1">
              System notifications and maintenance alerts
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              {markingAll ? 'Marking...' : `Mark All Read (${unreadCount})`}
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Alerts',
              value: alerts.length,
              bg: 'bg-white border border-slate-100',
              color: 'text-gray-900',
              icon: <Bell className="w-5 h-5 text-slate-400" />,
            },
            {
              label: 'Unread',
              value: unreadCount,
              bg: 'bg-blue-50/50 border border-blue-100/50',
              color: 'text-blue-700',
              icon: <MailOpen className="w-5 h-5 text-blue-500" />,
            },
            {
              label: 'Critical',
              value: criticalCount,
              bg: 'bg-red-50/50 border border-red-100/50',
              color: 'text-red-700',
              icon: <AlertCircle className="w-5 h-5 text-red-500" />,
            },
            {
              label: 'High',
              value: highCount,
              bg: 'bg-orange-50/50 border border-orange-100/50',
              color: 'text-orange-700',
              icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
            },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl shadow-sm p-5`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{card.label}</p>
                {card.icon}
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-3">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white"
          >
            <option value="">All Alerts</option>
            <option value="false">Unread Only</option>
            <option value="true">Read Only</option>
          </select>
          {(filterSeverity || filterRead !== '') && (
            <button
              onClick={() => {
                setFilterSeverity('')
                setFilterRead('')
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-gray-500 hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Alerts list */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm px-6 py-16 text-center text-sm text-gray-400">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-16 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">No alerts found</p>
              <p className="text-xs text-gray-400 mt-1">
                All clear — no alerts at this time
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 border-l-4 ${
                  !alert.isRead ? 'border-l-orange-500' : 'border-l-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl mt-0.5">
                      {severityIcons[alert.severity]}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold ${!alert.isRead ? 'text-gray-900' : 'text-gray-500'}`}>
                          {alert.title}
                        </p>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${severityStyles[alert.severity]}`}>
                          {alert.severity}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {typeLabels[alert.type] || alert.type}
                        </span>
                        {!alert.isRead && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                            Unread
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {alert.equipment && (
                          <button
                            onClick={() => router.push(`/equipment/${alert.equipment!.id}`)}
                            className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-700 font-medium"
                          >
                            <EquipmentIcon type={alert.equipment.type} className="w-3.5 h-3.5 text-slate-500" />
                            <span>{alert.equipment.name}</span>
                          </button>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(alert.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!alert.isRead && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-gray-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}