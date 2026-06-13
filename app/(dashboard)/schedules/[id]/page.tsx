'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, AlertTriangle, AlertCircle } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type Schedule = {
  id: string
  title: string
  serviceType: string
  intervalType: string
  intervalValue: number
  nextDueDate: string
  status: string
  priority: number
  isRecurring: boolean
  notes: string | null
  createdAt: string
  equipment: { id: string; name: string; type: string }
  technician: { id: string; fullName: string; email: string }
  maintenanceLogs: {
    id: string
    description: string
    serviceDate: string
    totalCost: number
    technician: { fullName: string }
  }[]
  history: {
    id: string
    changeReason: string | null
    createdAt: string
    changedBy: { fullName: string }
  }[]
}

const statusStyles: Record<string, string> = {
  upcoming: 'bg-green-100 text-green-700',
  due_soon: 'bg-blue-100 text-blue-700',
  urgent: 'bg-orange-100 text-orange-700',
  overdue: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-500',
}

const priorityLabels: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
}

const priorityStyles: Record<number, string> = {
  1: 'bg-gray-100 text-gray-500',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

export default function ScheduleDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch(`/api/schedules/${id}`)
        const data = await res.json()
        if (data.success) setSchedule(data.data)
      } catch {
        console.error('Failed to fetch schedule')
      } finally {
        setLoading(false)
      }
    }
    fetchSchedule()
  }, [id])

  async function handleComplete() {
    if (!confirm('Mark this schedule as completed?')) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      const data = await res.json()
      if (data.success) {
        if (schedule?.isRecurring) {
          alert('Schedule completed! Next due date has been automatically calculated.')
        }
        router.push('/schedules')
      } else {
        alert(data.error || 'Failed to complete schedule')
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setCompleting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/schedules')
      } else {
        alert(data.error || 'Failed to delete schedule')
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  function getDaysUntilDue(dateStr: string) {
    const due = new Date(dateStr)
    const now = new Date()
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)} days overdue`
    if (diff === 0) return 'Due today'
    return `${diff} days remaining`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading schedule...</p>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Schedule not found</p>
          <button
            onClick={() => router.push('/schedules')}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Back to Schedules
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/schedules')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Schedules
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">{schedule.title}</h1>
          </div>
          <div className="flex gap-2">
              <button
              onClick={() => router.push(`/schedules/${id}/edit`)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
            >
              Edit
            </button>
            {schedule.status !== 'completed' && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:bg-green-300 transition-colors shadow-sm"
              >
                {completing ? 'Saving...' : '✓ Mark Complete'}
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 transition-colors shadow-sm"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Main info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <EquipmentIcon type={schedule.equipment.type} className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {schedule.title}
                </h2>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusStyles[schedule.status]}`}>
                  {schedule.status.replace('_', ' ')}
                </span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${priorityStyles[schedule.priority]}`}>
                  {priorityLabels[schedule.priority]} Priority
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {schedule.equipment.name} ·{' '}
                {schedule.serviceType.replace('_', ' ')} ·{' '}
                {schedule.isRecurring ? 'Recurring' : 'One-time'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Due Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(schedule.nextDueDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Countdown</p>
              <p className={`text-sm font-semibold ${
                schedule.status === 'overdue' ? 'text-red-600' :
                schedule.status === 'urgent' ? 'text-orange-600' :
                'text-gray-900'
              }`}>
                {getDaysUntilDue(schedule.nextDueDate)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Interval</p>
              <p className="text-sm font-semibold text-gray-900">
                Every {schedule.intervalValue} {schedule.intervalType}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Logs Completed</p>
              <p className="text-sm font-semibold text-gray-900">
                {schedule.maintenanceLogs.length}
              </p>
            </div>
          </div>

          {/* Technician */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Assigned Technician</p>
            <p className="text-sm font-medium text-gray-900">
              {schedule.technician.fullName}
              <span className="text-gray-400 font-normal ml-2">
                ({schedule.technician.email})
              </span>
            </p>
          </div>

          {/* Notes */}
          {schedule.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {schedule.notes}
              </p>
            </div>
          )}
        </div>

        {/* Overdue / Urgent warning */}
        {(schedule.status === 'overdue' || schedule.status === 'urgent') && (
          <div className={`rounded-2xl p-4 mb-4 border ${
            schedule.status === 'overdue'
              ? 'bg-red-50 border-red-200'
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className={`flex items-center gap-2 text-sm font-semibold ${
              schedule.status === 'overdue' ? 'text-red-700' : 'text-orange-700'
            }`}>
              {schedule.status === 'overdue' ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>This schedule is overdue! Immediate action required.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                  <span>This schedule is urgent. Please act within 3 days.</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Schedule History */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Version History</h3>
          </div>
          {(!schedule.history || schedule.history.length === 0) ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No version history recorded yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {schedule.history.map((h) => (
                <div key={h.id} className="px-6 py-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{h.changeReason || 'Schedule updated'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">By {h.changedBy.fullName}</p>
                  </div>
                  <span className="text-gray-400 text-xs">{new Date(h.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Maintenance history */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Maintenance History ({schedule.maintenanceLogs.length})
            </h3>
            <button
              onClick={() => router.push('/maintenance/new')}
              className="text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors"
            >
              + Log Maintenance
            </button>
          </div>

          {schedule.maintenanceLogs.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-400">
                No maintenance logged for this schedule yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {schedule.maintenanceLogs.map((log) => (
                <div key={log.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {log.technician.fullName} ·{' '}
                      {new Date(log.serviceDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      RWF {log.totalCost.toLocaleString()}
                    </p>
                    <button
                      onClick={() => router.push(`/maintenance/${log.id}`)}
                      className="text-xs text-orange-500 hover:text-orange-700 mt-0.5 transition-colors font-medium"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}