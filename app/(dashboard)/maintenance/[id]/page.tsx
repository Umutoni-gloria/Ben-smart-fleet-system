'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type MaintenanceLog = {
  id: string
  type: string
  serviceType: string | null
  description: string
  failureCause: string | null
  downtimeHours: number | null
  wasAvoidable: boolean | null
  laborCost: number
  partsCost: number
  totalCost: number
  serviceDate: string
  createdAt: string
  equipment: { id: string; name: string; type: string }
  technician: { id: string; fullName: string; email: string }
  parts: {
    id: string
    partName: string
    quantity: number
    unitCost: number
    totalCost: number
  }[]
  schedule: { id: string; title: string } | null
}

export default function MaintenanceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [log, setLog] = useState<MaintenanceLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await fetch(`/api/maintenance/${id}`)
        const data = await res.json()
        if (data.success) setLog(data.data)
      } catch {
        console.error('Failed to fetch log')
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [id])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this maintenance log?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/maintenance')
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
        <p className="text-sm text-gray-400">Loading maintenance log...</p>
      </div>
    )
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Log not found</p>
          <button
            onClick={() => router.push('/maintenance')}
            className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Back to Maintenance
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
              onClick={() => router.push('/maintenance')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Maintenance
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">Log Detail</h1>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        {/* Main info */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4 border border-slate-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <EquipmentIcon type={log.equipment.type} className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {log.equipment.name}
                </h2>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    log.type === 'preventive'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {log.type}
                </span>
                {log.serviceType && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {log.serviceType.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Logged by {log.technician.fullName} ·{' '}
                {new Date(log.serviceDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1 uppercase font-medium">Description</p>
            <p className="text-sm text-gray-800 leading-relaxed">{log.description}</p>
          </div>

          {log.schedule && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-gray-400 mb-1 uppercase font-medium">
                Linked Schedule
              </p>
              <p className="text-sm text-gray-800">{log.schedule.title}</p>
            </div>
          )}
        </div>

        {/* Corrective details */}
        {log.type === 'corrective' && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-4">
            <h3 className="text-sm font-semibold text-red-800 mb-4">
              Breakdown Details
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Downtime</p>
                <p className="text-sm font-semibold text-gray-900">
                  {log.downtimeHours != null ? `${log.downtimeHours} hours` : '—'}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Was Avoidable?</p>
                <p className="text-sm font-semibold text-gray-900">
                  {log.wasAvoidable === true
                    ? 'Yes'
                    : log.wasAvoidable === false
                    ? 'No'
                    : '—'}
                </p>
              </div>
            </div>
            {log.failureCause && (
              <div>
                <p className="text-xs text-gray-400 mb-1 uppercase font-medium">
                  Failure Cause
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {log.failureCause}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Parts */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-gray-800">
              Parts Used ({log.parts.length})
            </h3>
          </div>
          {log.parts.length === 0 ? (
            <div className="px-6 py-6 text-center text-sm text-gray-400">
              No parts recorded for this maintenance
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Part Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {log.parts.map((part: { id: string; partName: string; quantity: number; unitCost: number; totalCost: number }) => (
                    <tr key={part.id}>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {part.partName}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {part.quantity}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        RWF {part.unitCost.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        RWF {part.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cost summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Cost Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Labor Cost</span>
              <span>RWF {log.laborCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Parts Cost</span>
              <span>RWF {log.partsCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-slate-100">
              <span>Total Cost</span>
              <span>RWF {log.totalCost.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}