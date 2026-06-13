'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Printer, Wrench, Calendar, Shield, Plus, ArrowLeft, AlertTriangle } from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

type Equipment = {
  id: string
  name: string
  type: string
  model: string
  serialNumber: string
  year: number
  status: string
  currentOdometer: number
  currentHours: number
  lastServiceDate: string | null
  nextServiceDate: string | null
  assignedOperator?: { id: string; fullName: string; email: string } | null
  defaultFuelRate?: number | null
  fuelTolerance?: number | null
  maintenanceLogs: {
    id: string
    type: string
    serviceType: string | null
    description: string
    serviceDate: string
    totalCost: number
    technician: { fullName: string }
  }[]
  warranties: {
    id: string
    provider: string
    startDate: string
    endDate: string
    terms: string | null
  }[]
  schedules: {
    id: string
    title: string
    serviceType: string
    nextDueDate: string
    status: string
  }[]
}

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  under_maintenance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  retired: 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400',
}

const scheduleStatusStyles: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-800',
  due_soon: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-orange-100 text-orange-800',
  overdue: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
}

export default function EquipmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [retiring, setRetiring] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false)
  const [warrantyForm, setWarrantyForm] = useState({ provider: '', startDate: '', endDate: '', terms: '' })
  const [warrantySaving, setWarrantySaving] = useState(false)

  async function handleAddWarranty(e: React.FormEvent) {
    e.preventDefault()
    setWarrantySaving(true)
    try {
      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId: id, ...warrantyForm })
      })
      if (res.ok) {
        setWarrantyModalOpen(false)
        setWarrantyForm({ provider: '', startDate: '', endDate: '', terms: '' })
        window.location.reload()
      }
    } catch {
      alert("Error saving warranty")
    } finally {
      setWarrantySaving(false)
    }
  }

  useEffect(() => {
    if (qrModalOpen && equipment) {
      const dataStr = JSON.stringify({
        id: equipment.id,
        name: equipment.name,
        serialNumber: equipment.serialNumber
      })
      QRCode.toDataURL(dataStr, { width: 300, margin: 2 })
        .then(setQrUrl)
        .catch(console.error)
    }
  }, [qrModalOpen, equipment])

  useEffect(() => {
    async function fetchEquipment() {
      try {
        const res = await fetch(`/api/equipment/${id}`)
        const data = await res.json()
        if (data.success) setEquipment(data.data)
      } catch {
        console.error('Failed to fetch equipment')
      } finally {
        setLoading(false)
      }
    }
    fetchEquipment()
  }, [id])

  async function handleRetire() {
    if (!confirm('Are you sure you want to retire this equipment? This action marks it as retired.')) return
    setRetiring(true)
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/equipment')
      } else {
        alert(data.error || 'Failed to retire equipment')
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setRetiring(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400 font-medium">Loading equipment...</p>
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">Equipment not found</p>
          <button
            onClick={() => router.push('/equipment')}
            className="mt-3 text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 mx-auto"
          >
            <ArrowLeft size={14} /> Back to Fleet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/equipment')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-all shadow-sm group cursor-pointer"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Fleet
            </button>
            <span className="text-slate-350 font-light">/</span>
            <h1 className="text-xl font-bold text-slate-900">{equipment.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setQrModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Printer size={14} /> QR Label
            </button>
            <button
              onClick={() => router.push(`/equipment/${id}/edit`)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
            >
              Edit
            </button>
            {equipment.status !== 'retired' && (
              <button
                onClick={handleRetire}
                disabled={retiring}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:bg-rose-350 transition-all cursor-pointer shadow-sm"
              >
                {retiring ? 'Retiring...' : 'Retire'}
              </button>
            )}
          </div>
        </div>

        {/* Main info card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200/50 flex items-center justify-center text-slate-500 shadow-sm">
              <EquipmentIcon type={equipment.type} className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h2 className="text-lg font-bold text-slate-900">{equipment.name}</h2>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusStyles[equipment.status]}`}>
                  {equipment.status === 'under_maintenance' ? 'Maintenance' : equipment.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium">{equipment.model} · {equipment.year} · S/N: {equipment.serialNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Odometer', value: `${equipment.currentOdometer.toLocaleString()} km` },
              { label: 'Engine Hours', value: `${equipment.currentHours.toLocaleString()} hrs` },
              {
                label: 'Last Service',
                value: equipment.lastServiceDate
                  ? new Date(equipment.lastServiceDate).toLocaleDateString()
                  : '—',
              },
              {
                label: 'Next Service',
                value: equipment.nextServiceDate
                  ? new Date(equipment.nextServiceDate).toLocaleDateString()
                  : '—',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 shadow-inner">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-sm font-bold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>

          {equipment.assignedOperator && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Assigned Operator</p>
              <p className="text-sm font-bold text-slate-900">
                {equipment.assignedOperator.fullName}
                <span className="text-slate-450 font-normal ml-2">({equipment.assignedOperator.email})</span>
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Standard Fuel Rate</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {equipment.defaultFuelRate !== null && equipment.defaultFuelRate !== undefined
                  ? `${equipment.defaultFuelRate} ${['truck', 'tipper_truck'].includes(equipment.type) ? 'L/km' : 'L/hr'}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anomaly Tolerance</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {equipment.fuelTolerance !== null && equipment.fuelTolerance !== undefined
                  ? `${equipment.fuelTolerance}%`
                  : '20%'}
              </p>
            </div>
          </div>
        </div>

        {/* Warranties */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Warranties</h3>
            <button
              onClick={() => setWarrantyModalOpen(true)}
              className="text-xs text-orange-500 hover:text-orange-700 font-bold bg-orange-50 border border-orange-100/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              + Add Warranty
            </button>
          </div>
          {equipment.warranties?.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400 font-medium bg-white">
              No active warranties recorded
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white">
              {equipment.warranties?.map(w => (
                <div key={w.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.provider}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Valid: {new Date(w.startDate).toLocaleDateString()} — {new Date(w.endDate).toLocaleDateString()}</p>
                    {w.terms && <p className="text-xs text-gray-400 mt-1 italic">{w.terms}</p>}
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${new Date(w.endDate) > new Date() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {new Date(w.endDate) > new Date() ? 'Active' : 'Expired'}
                  </span>
                </div>
              ))}
            </div>
          )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Recent maintenance logs */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Maintenance</h3>
              <button
                onClick={() => router.push(`/maintenance?equipment=${id}`)}
                className="text-xs text-orange-500 hover:text-orange-700 font-bold"
              >
                View all →
              </button>
            </div>
            {equipment.maintenanceLogs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-450 font-medium">
                No maintenance records yet
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {equipment.maintenanceLogs.map((log) => (
                  <div key={log.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{log.description}</p>
                        <p className="text-xs text-slate-450 mt-0.5 font-medium">
                          {log.technician.fullName} · {new Date(log.serviceDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${log.type === 'preventive' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {log.type}
                        </span>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          RWF {log.totalCost.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming schedules */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Upcoming Schedules</h3>
              <button
                onClick={() => router.push(`/schedules?equipment=${id}`)}
                className="text-xs text-orange-500 hover:text-orange-700 font-bold"
              >
                View all →
              </button>
            </div>
            {equipment.schedules.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-450 font-medium">
                No upcoming schedules
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {equipment.schedules.map((schedule) => (
                  <div key={schedule.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{schedule.title}</p>
                      <p className="text-xs text-slate-450 mt-0.5 font-medium">
                        Due: {new Date(schedule.nextDueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${scheduleStatusStyles[schedule.status]}`}>
                      {schedule.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {qrModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-sm w-full text-center shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Equipment QR Code</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Scan this code with the Field Technician App</p>
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="mx-auto mb-6 rounded-xl border border-slate-100 p-2 shadow-inner bg-slate-50" />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400 font-medium">Generating...</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setQrModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = qrUrl
                  a.download = `QR-${equipment?.serialNumber}.png`
                  a.click()
                }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-orange-500 hover:bg-orange-600 transition-all cursor-pointer shadow-sm"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {warrantyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Warranty</h3>
            <form onSubmit={handleAddWarranty} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Provider</label>
                <input required type="text" value={warrantyForm.provider} onChange={e => setWarrantyForm(prev => ({...prev, provider: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none text-slate-900 focus:border-slate-350" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
                  <input required type="date" value={warrantyForm.startDate} onChange={e => setWarrantyForm(prev => ({...prev, startDate: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none text-slate-900" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">End Date</label>
                  <input required type="date" value={warrantyForm.endDate} onChange={e => setWarrantyForm(prev => ({...prev, endDate: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none text-slate-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Terms (Optional)</label>
                <textarea rows={2} value={warrantyForm.terms} onChange={e => setWarrantyForm(prev => ({...prev, terms: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none text-slate-900 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setWarrantyModalOpen(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm">Cancel</button>
                <button type="submit" disabled={warrantySaving} className="flex-1 py-2 rounded-xl text-white text-sm font-semibold bg-orange-50 hover:bg-orange-600 disabled:opacity-50 transition-all cursor-pointer shadow-sm">{warrantySaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}