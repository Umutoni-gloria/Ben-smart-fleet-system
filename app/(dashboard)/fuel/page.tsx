'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Fuel, Gauge, Calendar, Plus, CreditCard } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type FuelLog = {
  id: string
  liters: number
  costPerLiter: number
  totalCost: number
  odometer: number | null
  hours: number | null
  fuelDate: string
  projectSite: string | null
  notes: string | null
  equipment: { id: string; name: string; type: string }
  loggedBy: { id: string; fullName: string }
}

function getFuelRateLabel(log: FuelLog): string {
  const isVehicle = ['truck', 'tipper_truck'].includes(log.equipment.type)
  // We can't compute the rate from a single log without the previous log's reading.
  // Show the reading type + value instead.
  if (isVehicle) {
    return log.odometer != null ? `${log.odometer.toLocaleString()} km` : '—'
  } else {
    return log.hours != null ? `${log.hours.toLocaleString()} hrs` : '—'
  }
}

const typeLabel: Record<string, string> = {
  excavator: 'Excavator',
  bulldozer: 'Bulldozer',
  grader: 'Grader',
  truck: 'Truck',
  tipper_truck: 'Tipper Truck',
}

export default function FuelLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.append('from', filterFrom)
      if (filterTo) params.append('to', filterTo)

      const res = await fetch(`/api/fuel?${params.toString()}`)
      const data = await res.json()
      if (data.success) setLogs(data.data)
    } catch {
      console.error('Failed to fetch fuel logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filterFrom, filterTo])

  const filtered = logs.filter(
    (log) =>
      log.equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      log.loggedBy.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (log.projectSite?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const totalLiters = filtered.reduce((sum, log) => sum + log.liters, 0)
  const totalCost = filtered.reduce((sum, log) => sum + log.totalCost, 0)
  const avgCostPerLiter =
    filtered.length > 0
      ? filtered.reduce((sum, log) => sum + log.costPerLiter, 0) / filtered.length
      : 0

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Fuel size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fuel Logs</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Track fuel consumption across all equipment
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/fuel/cards')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-orange-500 text-sm font-medium bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              <CreditCard size={16} />
              Fuel Cards
            </button>
            <button
              onClick={() => router.push('/fuel/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <Plus size={16} />
              Log Fuel
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Logs',
              value: filtered.length,
              icon: <Fuel size={18} className="text-gray-500" />,
              bg: 'bg-white',
              color: 'text-gray-900',
            },
            {
              label: 'Total Liters',
              value: `${totalLiters.toLocaleString()} L`,
              icon: <Gauge size={18} className="text-blue-500" />,
              bg: 'bg-blue-50',
              color: 'text-blue-700',
            },
            {
              label: 'Total Cost',
              value: `RWF ${totalCost.toLocaleString()}`,
              icon: <Fuel size={18} className="text-orange-500" />,
              bg: 'bg-orange-50',
              color: 'text-orange-700',
            },
            {
              label: 'Avg Cost / Liter',
              value: `RWF ${avgCostPerLiter.toFixed(0)}`,
              icon: <Calendar size={18} className="text-green-500" />,
              bg: 'bg-green-50',
              color: 'text-green-700',
            },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl shadow-sm p-5`}>
              <div className="flex items-center gap-2 mb-2">{card.icon}<p className="text-xs text-gray-500">{card.label}</p></div>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by equipment, operator, project site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none text-gray-800"
          />
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none text-gray-800"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none text-gray-800"
          />
          {(filterFrom || filterTo) && (
            <button
              onClick={() => {
                setFilterFrom('')
                setFilterTo('')
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Logs table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              Loading fuel logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3">
                <Fuel size={22} className="text-orange-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No fuel logs found</p>
              <p className="text-xs text-gray-400 mt-1">
                Start logging fuel to track consumption
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Equipment</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Liters</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cost/L</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Total Cost</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Odometer / Hours</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Site</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Operator</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((log) => {
                    const isVehicle = ['truck', 'tipper_truck'].includes(log.equipment.type)
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <EquipmentIcon type={log.equipment.type} className="w-4 h-4 text-slate-500" />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isVehicle ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {typeLabel[log.equipment.type] || log.equipment.type}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {log.equipment.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {new Date(log.fuelDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-900 font-medium">
                          {log.liters.toLocaleString()} L
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          RWF {log.costPerLiter.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                          RWF {log.totalCost.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {getFuelRateLabel(log)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {log.projectSite || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {log.loggedBy.fullName}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => router.push(`/fuel/${log.id}`)}
                            className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}