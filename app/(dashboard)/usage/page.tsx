'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ClipboardList,
  Clock,
  Gauge,
  MapPin,
  Truck,
  Wrench,
  Search,
  ChevronDown,
  X,
} from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

// ─── Types ────────────────────────────────────────────────────────────────────

type UsageLog = {
  id: string
  startHours: number
  endHours: number
  totalHours: number
  idleHours: number
  startOdometer: number | null
  endOdometer: number | null
  distanceTraveled: number | null
  projectSite: string
  shiftDate: string
  notes: string | null
  equipment: { id: string; name: string; type: string }
  operator: { id: string; fullName: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = new Set(['truck', 'tipper_truck', 'pickup', 'car'])

function isVehicleType(type: string): boolean {
  return VEHICLE_TYPES.has(type?.toLowerCase())
}

function formatEquipmentType(type: string): string {
  const map: Record<string, string> = {
    excavator: 'Excavator',
    bulldozer: 'Bulldozer',
    grader: 'Grader',
    truck: 'Truck',
    tipper_truck: 'Tipper Truck',
    pickup: 'Pickup',
    car: 'Car',
    loader: 'Loader',
    roller: 'Roller',
    crane: 'Crane',
  }
  return map[type?.toLowerCase()] ?? type
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ type }: { type: string }) {
  const isVehicle = isVehicleType(type)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
        isVehicle
          ? 'bg-blue-50 text-blue-700 border border-blue-100'
          : 'bg-orange-50 text-orange-700 border border-orange-100'
      }`}
    >
      {isVehicle ? (
        <Truck className="w-2.5 h-2.5" />
      ) : (
        <Wrench className="w-2.5 h-2.5" />
      )}
      {isVehicle ? 'Vehicle' : 'Equipment'}
    </span>
  )
}

function MeasurementBadge({ type }: { type: string }) {
  const isVehicle = isVehicleType(type)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
        isVehicle
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      {isVehicle ? 'KM' : 'HRS'}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const router = useRouter()
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | 'vehicle' | 'equipment'>('all')
  const [filterSite, setFilterSite] = useState('')

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.append('from', filterFrom)
      if (filterTo) params.append('to', filterTo)

      const res = await fetch(`/api/usage?${params.toString()}`)
      const data = await res.json()
      if (data.success) setLogs(data.data)
    } catch {
      console.error('Failed to fetch usage logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo])

  // ─── Derived state ──────────────────────────────────────────────────────────

  const allSites = Array.from(new Set(logs.map((l) => l.projectSite))).sort()

  const filtered = logs.filter((log) => {
    const matchesSearch =
      log.equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      log.operator.fullName.toLowerCase().includes(search.toLowerCase()) ||
      log.projectSite.toLowerCase().includes(search.toLowerCase())

    const matchesCategory =
      filterCategory === 'all' ||
      (filterCategory === 'vehicle' && isVehicleType(log.equipment.type)) ||
      (filterCategory === 'equipment' && !isVehicleType(log.equipment.type))

    const matchesSite = !filterSite || log.projectSite === filterSite

    return matchesSearch && matchesCategory && matchesSite
  })

  const vehicleLogs = filtered.filter((l) => isVehicleType(l.equipment.type))
  const equipmentLogs = filtered.filter((l) => !isVehicleType(l.equipment.type))

  const totalKm = vehicleLogs.reduce((sum, l) => sum + (l.distanceTraveled ?? 0), 0)
  const totalHrs = equipmentLogs.reduce((sum, l) => sum + l.totalHours, 0)
  const uniqueSites = new Set(filtered.map((l) => l.projectSite)).size
  const activeVehicles = new Set(vehicleLogs.map((l) => l.equipment.id)).size
  const activeEquipment = new Set(equipmentLogs.map((l) => l.equipment.id)).size

  const hasActiveFilters = filterCategory !== 'all' || filterSite || filterFrom || filterTo

  function clearFilters() {
    setFilterCategory('all')
    setFilterSite('')
    setFilterFrom('')
    setFilterTo('')
    setSearch('')
  }

  // ─── Summary cards ──────────────────────────────────────────────────────────

  const summaryCards = [
    {
      label: 'Total KM Travelled',
      value: `${totalKm.toLocaleString()} km`,
      bg: 'bg-blue-50 border border-blue-100',
      color: 'text-blue-700',
      icon: <Gauge className="w-5 h-5 text-blue-500" />,
    },
    {
      label: 'Total Operating Hours',
      value: `${totalHrs.toLocaleString()} hrs`,
      bg: 'bg-orange-50 border border-orange-100',
      color: 'text-orange-700',
      icon: <Clock className="w-5 h-5 text-orange-500" />,
    },
    {
      label: 'Total Shifts',
      value: filtered.length,
      bg: 'bg-white border border-slate-100',
      color: 'text-gray-900',
      icon: <ClipboardList className="w-5 h-5 text-slate-400" />,
    },
    {
      label: 'Active Project Sites',
      value: uniqueSites,
      bg: 'bg-green-50 border border-green-100',
      color: 'text-green-700',
      icon: <MapPin className="w-5 h-5 text-green-500" />,
    },
    {
      label: 'Active Vehicles',
      value: activeVehicles,
      bg: 'bg-blue-50/60 border border-blue-100',
      color: 'text-blue-700',
      icon: <Truck className="w-5 h-5 text-blue-400" />,
    },
    {
      label: 'Active Equipment',
      value: activeEquipment,
      bg: 'bg-amber-50/60 border border-amber-100',
      color: 'text-amber-700',
      icon: <Wrench className="w-5 h-5 text-amber-400" />,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usage & Shift Logs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track vehicle kilometres and equipment operating hours across all project sites
            </p>
          </div>
          <button
            onClick={() => router.push('/usage/new')}
            className="shrink-0 px-5 py-2.5 rounded-xl text-white text-sm font-semibold bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
          >
            + Log Shift
          </button>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl shadow-sm p-4 hover:-translate-y-0.5 transition-transform duration-200`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{card.label}</p>
                {card.icon}
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search equipment, operator, site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 placeholder:text-slate-400 focus:border-orange-300 transition-colors"
              />
            </div>

            {/* Category filter */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as 'all' | 'vehicle' | 'equipment')}
                className="appearance-none pl-4 pr-8 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white focus:border-orange-300 transition-colors cursor-pointer"
              >
                <option value="all">All Assets</option>
                <option value="vehicle">Vehicles Only</option>
                <option value="equipment">Heavy Equipment Only</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Project site filter */}
            <div className="relative">
              <select
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 bg-white focus:border-orange-300 transition-colors cursor-pointer"
              >
                <option value="">All Sites</option>
                {allSites.map((site) => (
                  <option key={site} value={site}>{site}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Date range */}
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 focus:border-orange-300 transition-colors"
              title="From date"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-800 focus:border-orange-300 transition-colors"
              title="To date"
            />

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm text-gray-500 hover:bg-slate-50 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Active filter pills */}
          {filterCategory !== 'all' && (
            <div className="mt-3 flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-100 text-xs font-medium text-orange-700">
                {filterCategory === 'vehicle' ? '🚛 Vehicles Only' : '🔧 Heavy Equipment Only'}
                <button onClick={() => setFilterCategory('all')}>
                  <X className="w-3 h-3 ml-0.5" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="px-6 py-20 text-center">
              <div className="inline-block w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-400">Loading usage logs...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No usage logs found</p>
              <p className="text-xs text-gray-400 mt-1">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Start logging shifts to track utilisation'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Equipment</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Category</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Operator</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Measurement</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Start Reading</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">End Reading</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Usage</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Idle Hrs</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Project Site</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((log) => {
                    const isVehicle = isVehicleType(log.equipment.type)
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Equipment */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isVehicle ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'
                            }`}>
                              <EquipmentIcon type={log.equipment.type} className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {log.equipment.name}
                            </span>
                          </div>
                        </td>

                        {/* Category badge */}
                        <td className="px-5 py-4">
                          <CategoryBadge type={log.equipment.type} />
                        </td>

                        {/* Equipment type */}
                        <td className="px-5 py-4">
                          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                            {formatEquipmentType(log.equipment.type)}
                          </span>
                        </td>

                        {/* Operator */}
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-700 whitespace-nowrap">
                            {log.operator.fullName}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-600 whitespace-nowrap">
                            {new Date(log.shiftDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Measurement type */}
                        <td className="px-5 py-4">
                          <MeasurementBadge type={log.equipment.type} />
                        </td>

                        {/* Start reading */}
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-700 font-medium whitespace-nowrap">
                            {isVehicle
                              ? `${(log.startOdometer ?? 0).toLocaleString()} km`
                              : `${log.startHours.toLocaleString()} hrs`}
                          </span>
                        </td>

                        {/* End reading */}
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-700 font-medium whitespace-nowrap">
                            {isVehicle
                              ? `${(log.endOdometer ?? 0).toLocaleString()} km`
                              : `${log.endHours.toLocaleString()} hrs`}
                          </span>
                        </td>

                        {/* Total usage */}
                        <td className="px-5 py-4">
                          {isVehicle ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              {(log.distanceTraveled ?? 0).toLocaleString()} km
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                              {log.totalHours.toLocaleString()} hrs
                            </span>
                          )}
                        </td>

                        {/* Idle hours */}
                        <td className="px-5 py-4">
                          {isVehicle ? (
                            <span className="text-sm text-slate-300 font-medium">—</span>
                          ) : (
                            <span className="text-sm text-gray-600">
                              {(log.idleHours ?? 0) > 0
                                ? `${log.idleHours} hrs`
                                : <span className="text-slate-300">0 hrs</span>}
                            </span>
                          )}
                        </td>

                        {/* Project site */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
                            <span className="text-sm text-gray-600 whitespace-nowrap">{log.projectSite}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => router.push(`/usage/${log.id}`)}
                            className="text-xs font-semibold text-orange-500 hover:text-orange-700 opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Footer row */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-600">{filtered.length}</span> shift{filtered.length !== 1 ? 's' : ''}
                  {filterCategory !== 'all' && (
                    <> · {vehicleLogs.length} vehicle, {equipmentLogs.length} equipment</>
                  )}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {vehicleLogs.length > 0 && (
                    <span className="text-blue-600 font-semibold">{totalKm.toLocaleString()} km total</span>
                  )}
                  {equipmentLogs.length > 0 && (
                    <span className="text-orange-600 font-semibold">{totalHrs.toLocaleString()} hrs total</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}