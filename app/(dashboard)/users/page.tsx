'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Crown, BarChart2, Wrench, Truck, Users } from 'lucide-react'

type User = {
  id: string
  fullName: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
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

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) setUsers(data.data)
    } catch {
      console.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleToggleActive(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, isActive: !current } : u))
        )
      } else {
        alert(data.error || 'Failed to update user')
      }
    } catch {
      console.error('Failed to toggle user status')
    }
  }

  async function handleChangeRole(id: string, role: string) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role } : u))
        )
      } else {
        alert(data.error || 'Failed to update role')
      }
    } catch {
      console.error('Failed to change role')
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole ? u.role === filterRole : true
    const matchStatus =
      filterStatus === ''
        ? true
        : filterStatus === 'active'
        ? u.isActive
        : !u.isActive
    return matchSearch && matchRole && matchStatus
  })

  const counts = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    admin: users.filter((u) => u.role === 'admin').length,
    manager: users.filter((u) => u.role === 'manager').length,
    technician: users.filter((u) => u.role === 'technician').length,
    operator: users.filter((u) => u.role === 'operator').length,
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage all system users and their roles
            </p>
          </div>
          <button
            onClick={() => router.push('/validations')}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600"
          >
            + Pre-register User
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Users', value: counts.total, bg: 'bg-white border border-slate-100', color: 'text-gray-900' },
            { label: 'Active', value: counts.active, bg: 'bg-green-50/50 border border-green-100/50', color: 'text-green-700' },
            { label: 'Inactive', value: counts.inactive, bg: 'bg-slate-50 border border-slate-100', color: 'text-gray-500' },
            { label: 'Admins', value: counts.admin, bg: 'bg-purple-50/50 border border-purple-100/50', color: 'text-purple-700' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl shadow-sm p-5`}>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Role breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Admins', value: counts.admin, icon: <Crown className="w-6 h-6 text-purple-500" />, color: 'text-purple-700' },
            { label: 'Managers', value: counts.manager, icon: <BarChart2 className="w-6 h-6 text-blue-500" />, color: 'text-blue-700' },
            { label: 'Technicians', value: counts.technician, icon: <Wrench className="w-6 h-6 text-green-500" />, color: 'text-green-700' },
            { label: 'Operators', value: counts.operator, icon: <Truck className="w-6 h-6 text-orange-500" />, color: 'text-orange-700' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
              {card.icon}
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="technician">Technician</option>
            <option value="operator">Operator</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(filterRole || filterStatus) && (
            <button
              onClick={() => {
                setFilterRole('')
                setFilterStatus('')
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-gray-500 hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Users table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              Loading users...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.fullName}
                          </p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${roleStyles[user.role]}`}>
                        {roleIcons[user.role]} {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none text-gray-800 bg-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="technician">Technician</option>
                        <option value="operator">Operator</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/users/${user.id}`)}
                          className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                        >
                          View →
                        </button>
                        <button
                          onClick={() => handleToggleActive(user.id, user.isActive)}
                          className={`text-xs font-medium ${user.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
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