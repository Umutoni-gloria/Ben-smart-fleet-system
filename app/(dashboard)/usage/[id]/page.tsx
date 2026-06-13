'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Truck, Wrench } from 'lucide-react'
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
  createdAt: string
  equipment: { id: string; name: string; type: string }
  operator: { id: string; fullName: string; email: string }
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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
        isVehicle
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'bg-orange-100 text-orange-700 border border-orange-200'
      }`}
    >
      {isVehicle ? <Truck className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
      {isVehicle ? 'Vehicle' : 'Heavy Equipment'}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsageDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [log, setLog] = useState<UsageLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await fetch(`/api/usage/${id}`)
        const data = await res.json()
        if (data.success) setLog(data.data)
      } catch {
        console.error('Failed to fetch usage log')
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [id])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this usage log?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/usage/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/usage')
      } else {
        alert(data.error || 'Failed to delete')
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading usage log...</p>
        </div>
      </div>
    )
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Usage log not found</p>
          <button
            onClick={() => router.push('/usage')}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Back to Usage Logs
          </button>
        </div>
      </div>
    )
  }

  const isVehicle = isVehicleType(log.equipment.type)

  // ── Dynamic stat cards based on asset category ────────────────────────────
  const statCards = isVehicle
    ? [
        {
          label: 'Start Odometer',
          value: `${(log.startOdometer ?? 0).toLocaleString()} km`,
          bg: 'bg-slate-50 border border-slate-100',
          color: 'text-gray-800',
        },
        {
          label: 'End Odometer',
          value: `${(log.endOdometer ?? 0).toLocaleString()} km`,
          bg: 'bg-slate-50 border border-slate-100',
          color: 'text-gray-800',
        },
        {
          label: 'Distance Travelled',
          value: `${(log.distanceTraveled ?? 0).toLocaleString()} km`,
          bg: 'bg-blue-50 border border-blue-100',
          color: 'text-blue-700',
        },
        {
          label: 'Project Site',
          value: log.projectSite,
          bg: 'bg-green-50 border border-green-100',
          color: 'text-green-700',
        },
      ]
    : [
        {
          label: 'Start Hours',
          value: `${log.startHours.toLocaleString()} hrs`,
          bg: 'bg-slate-50 border border-slate-100',
          color: 'text-gray-800',
        },
        {
          label: 'End Hours',
          value: `${log.endHours.toLocaleString()} hrs`,
          bg: 'bg-slate-50 border border-slate-100',
          color: 'text-gray-800',
        },
        {
          label: 'Operating Hours',
          value: `${log.totalHours.toLocaleString()} hrs`,
          bg: 'bg-orange-50 border border-orange-100',
          color: 'text-orange-700',
        },
        {
          label: 'Idle Hours',
          value: `${(log.idleHours ?? 0).toLocaleString()} hrs`,
          bg: 'bg-amber-50 border border-amber-100',
          color: 'text-amber-700',
        },
      ]

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/usage')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Usage Logs
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">Shift Detail</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/usage/${id}/edit`)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-gray-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 transition-colors shadow-sm"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {/* ── Equipment card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className={`p-3 rounded-xl flex items-center justify-center ${
              isVehicle ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'
            }`}>
              <EquipmentIcon type={log.equipment.type} className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg font-bold text-gray-900">{log.equipment.name}</h2>
                <CategoryBadge type={log.equipment.type} />
              </div>
              <p className="text-sm text-gray-500">
                {formatEquipmentType(log.equipment.type)} · Operated by{' '}
                <span className="font-medium text-gray-700">{log.operator.fullName}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(log.shiftDate).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Measurement type indicator */}
          <div className={`mb-5 px-4 py-3 rounded-xl flex items-center justify-between ${
            isVehicle ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'
          }`}>
            <p className={`text-sm font-semibold ${isVehicle ? 'text-blue-700' : 'text-orange-700'}`}>
              {isVehicle ? '🚛 Vehicle — Tracked by Distance (KM)' : '🔧 Heavy Equipment — Tracked by Operating Hours'}
            </p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isVehicle ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'
            }`}>
              {isVehicle ? 'KM' : 'HRS'}
            </span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-xl p-4`}>
                <p className="text-xs text-gray-400 mb-1.5 font-medium">{stat.label}</p>
                <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Additional info ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Additional Information</h3>
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Operator</p>
              <p className="text-sm font-semibold text-gray-900">{log.operator.fullName}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Shift Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(log.shiftDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Project Site</p>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-sm font-semibold text-gray-900">{log.projectSite}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Logged At</p>
              <p className="text-sm text-gray-600">
                {new Date(log.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {log.notes && (
              <div className="pt-3.5 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1.5">Notes</p>
                <p className="text-sm text-gray-800 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5">
                  {log.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── View Equipment button ── */}
        <button
          onClick={() => router.push(`/equipment/${log.equipment.id}`)}
          className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-gray-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
        >
          View Equipment Profile →
        </button>

      </div>
    </div>
  )
}