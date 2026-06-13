'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Calendar, CalendarRange } from 'lucide-react'
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
  equipment: { id: string; name: string; type: string }
  technician: { id: string; fullName: string; email: string }
}

const statusStyles: Record<string, string> = {
  upcoming: 'bg-green-100 text-green-700',
  due_soon: 'bg-blue-100 text-blue-700',
  urgent: 'bg-orange-100 text-orange-700',
  overdue: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-500',
}

const priorityStyles: Record<number, string> = {
  1: 'bg-gray-100 text-gray-500',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
}

const priorityLabels: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
}

export default function SchedulesPage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  async function fetchSchedules() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      const res = await fetch(`/api/schedules?${params.toString()}`)
      const data = await res.json()
      if (data.success) setSchedules(data.data)
    } catch {
      console.error('Failed to fetch schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [filterStatus])

  const filtered = schedules.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      s.technician.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    total: schedules.length,
    upcoming: schedules.filter((s) => s.status === 'upcoming').length,
    due_soon: schedules.filter((s) => s.status === 'due_soon').length,
    urgent: schedules.filter((s) => s.status === 'urgent').length,
    overdue: schedules.filter((s) => s.status === 'overdue').length,
  }

  function getDaysUntilDue(dateStr: string) {
    const due = new Date(dateStr)
    const now = new Date()
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)}d overdue`
    if (diff === 0) return 'Due today'
    return `${diff}d remaining`
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Schedules</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage preventive and follow-up maintenance plans
            </p>
          </div>
          <button
            onClick={() => router.push('/schedules/new')}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            + New Schedule
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total', value: counts.total, bg: 'bg-white border border-slate-100', color: 'text-gray-900' },
            { label: 'Upcoming', value: counts.upcoming, bg: 'bg-green-50 border border-green-100', color: 'text-green-700' },
            { label: 'Due Soon', value: counts.due_soon, bg: 'bg-blue-50 border border-blue-100', color: 'text-blue-700' },
            { label: 'Urgent', value: counts.urgent, bg: 'bg-orange-50 border border-orange-100', color: 'text-orange-700' },
            { label: 'Overdue', value: counts.overdue, bg: 'bg-red-50 border border-red-100', color: 'text-red-700' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl shadow-sm p-5`}>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by title, equipment or technician..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="due_soon">Due Soon</option>
            <option value="urgent">Urgent</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </select>
          {filterStatus && (
            <button
              onClick={() => setFilterStatus('')}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              Loading schedules...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center flex flex-col items-center justify-center">
              <CalendarRange className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">No schedules found</p>
              <p className="text-xs text-gray-400 mt-1">
                Create your first maintenance schedule to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Technician</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interval</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{s.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.serviceType.replace('_', ' ')}
                          {s.isRecurring ? ' · Recurring' : ' · One-time'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <EquipmentIcon type={s.equipment.type} className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-gray-700">{s.equipment.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {s.technician.fullName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        Every {s.intervalValue} {s.intervalType}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">
                          {new Date(s.nextDueDate).toLocaleDateString()}
                        </p>
                        <p className={`text-xs mt-0.5 ${
                          s.status === 'overdue' ? 'text-red-500' :
                          s.status === 'urgent' ? 'text-orange-500' : 'text-gray-400'
                        }`}>
                          {getDaysUntilDue(s.nextDueDate)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusStyles[s.status]}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${priorityStyles[s.priority]}`}>
                          {priorityLabels[s.priority]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/schedules/${s.id}`)}
                          className="text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors"
                        >
                          View →
                        </button>
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
