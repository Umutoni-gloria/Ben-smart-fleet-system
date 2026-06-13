'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Crown, BarChart2, Wrench, Truck, ArrowLeft } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type User = {
  id: string
  fullName: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  notificationPrefs?: {
    email: boolean
    sms: boolean
    in_app: boolean
  }
  maintenanceLogs: {
    id: string
    type: string
    description: string
    serviceDate: string
    totalCost: number
    equipment: { name: string }
  }[]
  assignedSchedules: {
    id: string
    title: string
    status: string
    nextDueDate: string
    equipment: { name: string }
  }[]
  assignedEquipment: {
    id: string
    name: string
    type: string
    status: string
  }[]
  auditLogs: {
    id: string
    action: string
    module: string
    details: string | null
    createdAt: string
  }[]
}

const roleStyles: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  technician: 'bg-green-100 text-green-700 border-green-200',
  operator: 'bg-orange-100 text-orange-700 border-orange-200',
}

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Crown className="w-3.5 h-3.5" />,
  manager: <BarChart2 className="w-3.5 h-3.5" />,
  technician: <Wrench className="w-3.5 h-3.5" />,
  operator: <Truck className="w-3.5 h-3.5" />,
}

const statusStyles: Record<string, string> = {
  upcoming: 'bg-green-100 text-green-700',
  due_soon: 'bg-blue-100 text-blue-700',
  urgent: 'bg-orange-100 text-orange-700',
  overdue: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-500',
}

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`/api/users/${id}`)
        const data = await res.json()
        if (data.success) setUser(data.data)
      } catch {
        console.error('Failed to fetch user')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [id])

  async function handleToggleActive() {
    if (!user) return
    if (!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} this user?`)) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        setUser((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev)
      } else {
        alert(data.error || 'Failed to update user')
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setUpdating(false)
    }
  }

  async function handleChangeRole(role: string) {
    if (!user) return
    if (!confirm(`Change role to ${role}?`)) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (data.success) {
        setUser((prev) => prev ? { ...prev, role } : prev)
      } else {
        alert(data.error || 'Failed to update role')
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading user...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">User not found</p>
          <button
            onClick={() => router.push('/users')}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Back to Users
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/users')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Users
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">{user.fullName}</h1>
          </div>
          <button
            onClick={handleToggleActive}
            disabled={updating}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors shadow-sm ${
              user.isActive
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {updating
              ? 'Updating...'
              : user.isActive
              ? 'Deactivate User'
              : 'Activate User'}
          </button>
        </div>

        {/* Main info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-2xl font-bold text-orange-600">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {user.fullName}
                </h2>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${roleStyles[user.role]}`}>
                  {roleIcons[user.role]} {user.role}
                </span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Joined</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(user.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Maintenance Logs</p>
              <p className="text-sm font-semibold text-gray-900">
                {user.maintenanceLogs.length}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Active Schedules</p>
              <p className="text-sm font-semibold text-gray-900">
                {user.assignedSchedules.length}
              </p>
            </div>
          </div>

          {/* Change Role */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Change Role</p>
            <div className="flex flex-wrap gap-2">
              {['admin', 'manager', 'technician', 'operator'].map((role) => (
                <button
                  key={role}
                  onClick={() => handleChangeRole(role)}
                  disabled={updating || user.role === role}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    user.role === role
                      ? `${roleStyles[role]} cursor-default`
                      : 'border border-slate-200 text-gray-600 hover:bg-slate-50 transition-colors'
                  }`}
                >
                  {roleIcons[role]} {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4 p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Notification Preferences
          </h3>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={user.notificationPrefs?.email ?? true}
                onChange={async (e) => {
                  const prefs = { ...(user.notificationPrefs || { email: true, sms: false, in_app: true }), email: e.target.checked }
                  setUser({ ...user, notificationPrefs: prefs })
                  await fetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ notificationPrefs: prefs }) })
                }}
                className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={user.notificationPrefs?.sms ?? false}
                onChange={async (e) => {
                  const prefs = { ...(user.notificationPrefs || { email: true, sms: false, in_app: true }), sms: e.target.checked }
                  setUser({ ...user, notificationPrefs: prefs })
                  await fetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ notificationPrefs: prefs }) })
                }}
                className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">SMS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={user.notificationPrefs?.in_app ?? true}
                onChange={async (e) => {
                  const prefs = { ...(user.notificationPrefs || { email: true, sms: false, in_app: true }), in_app: e.target.checked }
                  setUser({ ...user, notificationPrefs: prefs })
                  await fetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ notificationPrefs: prefs }) })
                }}
                className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">In-App</span>
            </label>
          </div>
        </div>

        {/* Assigned Equipment */}
        {user.assignedEquipment.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-gray-800">
                Assigned Equipment ({user.assignedEquipment.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {user.assignedEquipment.map((eq) => (
                <div key={eq.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EquipmentIcon type={eq.type} className="w-4 h-4 text-slate-500" />
                    <p className="text-sm font-medium text-gray-900">{eq.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${eq.status === 'active' ? 'bg-green-100 text-green-700' : eq.status === 'under_maintenance' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {eq.status.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => router.push(`/equipment/${eq.id}`)}
                      className="text-xs text-orange-500 hover:text-orange-700"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">

          {/* Assigned Schedules */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-gray-800">
                Active Schedules
              </h3>
            </div>
            {user.assignedSchedules.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                No active schedules
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {user.assignedSchedules.map((s) => (
                  <div key={s.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.equipment.name} · {new Date(s.nextDueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[s.status]}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Maintenance */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-gray-800">
                Recent Maintenance
              </h3>
            </div>
            {user.maintenanceLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                No maintenance logs
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {user.maintenanceLogs.map((log) => (
                  <div key={log.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {log.equipment.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(log.serviceDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${log.type === 'preventive' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {log.type}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        RWF {log.totalCost.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Audit Logs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-gray-800">
              Recent Activity
            </h3>
          </div>
          {user.auditLogs.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No activity recorded
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {user.auditLogs.map((log) => (
                <div key={log.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {log.module} · {log.details}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}