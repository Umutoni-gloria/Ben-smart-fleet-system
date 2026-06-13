'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type FuelLog = {
  id: string
  liters: number
  costPerLiter: number
  totalCost: number
  odometer: number
  fuelDate: string
  projectSite: string | null
  notes: string | null
  createdAt: string
  equipment: { id: string; name: string; type: string }
  loggedBy: { id: string; fullName: string; email: string }
}

export default function FuelLogDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [log, setLog] = useState<FuelLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await fetch(`/api/fuel/${id}`)
        const data = await res.json()
        if (data.success) setLog(data.data)
      } catch {
        console.error('Failed to fetch fuel log')
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [id])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this fuel log?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/fuel/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/fuel')
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
        <p className="text-sm text-gray-400">Loading fuel log...</p>
      </div>
    )
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Fuel log not found</p>
          <button
            onClick={() => router.push('/fuel')}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Back to Fuel Logs
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/fuel')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Fuel Logs
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">Fuel Log Detail</h1>
          </div>
         <button
            onClick={() => router.push(`/fuel/${id}/edit`)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 transition-colors shadow-sm"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        {/* Equipment info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <EquipmentIcon type={log.equipment.type} className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {log.equipment.name}
              </h2>
              <p className="text-sm text-gray-500">
                Logged by {log.loggedBy.fullName} ·{' '}
                {new Date(log.fuelDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Liters',
                value: `${log.liters.toLocaleString()} L`,
                color: 'text-blue-700',
                bg: 'bg-blue-50',
              },
              {
                label: 'Cost Per Liter',
                value: `RWF ${log.costPerLiter.toLocaleString()}`,
                color: 'text-gray-900',
                bg: 'bg-gray-50',
              },
              {
                label: 'Total Cost',
                value: `RWF ${log.totalCost.toLocaleString()}`,
                color: 'text-orange-700',
                bg: 'bg-orange-50',
              },
              {
                label: 'Odometer',
                value: `${log.odometer.toLocaleString()} km`,
                color: 'text-gray-900',
                bg: 'bg-gray-50',
              },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-xl p-4`}>
                <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                <p className={`text-sm font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Additional info */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Additional Information
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">Project Site</p>
              <p className="text-sm font-medium text-gray-900">
                {log.projectSite || '—'}
              </p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">Logged By</p>
              <p className="text-sm font-medium text-gray-900">
                {log.loggedBy.fullName}
              </p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">Fuel Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(log.fuelDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">Logged At</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(log.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {log.notes && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {log.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Back button */}
        <div className="mt-4">
          <button
            onClick={() => router.push(`/equipment/${log.equipment.id}`)}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Equipment →
          </button>
        </div>

      </div>
    </div>
  )
}