'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Wrench, Clock, Settings, Plus, Search } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type MaintenanceLog = {
  id: string
  type: string
  serviceType: string | null
  description: string
  serviceDate: string
  laborCost: number
  partsCost: number
  totalCost: number
  downtimeHours: number | null
  equipment: { id: string; name: string; type: string }
  technician: { id: string; fullName: string }
  parts: { id: string; partName: string; quantity: number; unitCost: number; totalCost: number }[]
}

export default function MaintenancePage() {
  const router = useRouter()
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [search, setSearch] = useState('')

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType) params.append('type', filterType)
      if (filterFrom) params.append('from', filterFrom)
      if (filterTo) params.append('to', filterTo)

      const res = await fetch(`/api/maintenance?${params.toString()}`)
      const data = await res.json()
      if (data.success) setLogs(data.data)
    } catch {
      console.error('Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filterType, filterFrom, filterTo])

  const filtered = logs.filter(
    (log) =>
      log.equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      log.technician.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const totalCost = filtered.reduce((sum, log) => sum + log.totalCost, 0)
  const preventiveCount = filtered.filter((l) => l.type === 'preventive').length
  const correctiveCount = filtered.filter((l) => l.type === 'corrective').length

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Maintenance Logs</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Track all preventive and corrective maintenance
            </p>
          </div>
          <button
            onClick={() => router.push('/maintenance/new')}
            className="px-5 py-2.5 rounded-xl text-white font-semibold bg-orange-500 hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center gap-2"
          >
            <Plus size={16} /> Log Maintenance
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Logs', value: filtered.length, bg: 'bg-white border border-slate-100', color: 'text-slate-900' },
            { label: 'Preventive', value: preventiveCount, bg: 'bg-blue-50/50 border border-blue-100', color: 'text-blue-700' },
            { label: 'Corrective', value: correctiveCount, bg: 'bg-rose-50/50 border border-rose-100', color: 'text-rose-700' },
            {
              label: 'Total Cost',
              value: `RWF ${totalCost.toLocaleString()}`,
              bg: 'bg-orange-50/50 border border-orange-100',
              color: 'text-orange-700',
            },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-5 shadow-sm hover:-translate-y-0.5 transition-all duration-300`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search equipment, description, technician..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800 bg-white"
          >
            <option value="">All Types</option>
            <option value="preventive">Preventive</option>
            <option value="corrective">Corrective</option>
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800"
          />
          {(filterType || filterFrom || filterTo) && (
            <button
              onClick={() => {
                setFilterType('')
                setFilterFrom('')
                setFilterTo('')
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Logs table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500 font-medium">
              Loading maintenance logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
                <Wrench className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No maintenance logs found</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Log your first maintenance record to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/75 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Technician</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => router.push(`/maintenance/${log.id}`)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/40 flex items-center justify-center text-slate-500 shadow-sm">
                            <EquipmentIcon type={log.equipment.type} className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900">
                            {log.equipment.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            log.type === 'preventive'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700 max-w-xs truncate">
                          {log.description}
                        </p>
                        {log.downtimeHours && (
                          <p className="text-xs text-rose-500 font-semibold mt-0.5 flex items-center gap-1">
                            <Clock size={12} /> {log.downtimeHours}h downtime
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {log.technician.fullName}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {new Date(log.serviceDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">
                          RWF {log.totalCost.toLocaleString()}
                        </p>
                        {log.parts.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {log.parts.length} part{log.parts.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={(evt) => evt.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/maintenance/${log.id}`)}
                          className="text-xs text-orange-500 hover:text-orange-700 font-bold"
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