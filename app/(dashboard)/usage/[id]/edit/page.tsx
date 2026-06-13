'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, AlertTriangle, Truck, Wrench } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EquipmentInfo = {
  id: string
  name: string
  type: string
  currentHours: number
  currentOdometer: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = new Set(['truck', 'tipper_truck', 'pickup', 'car'])

function isVehicleType(type: string): boolean {
  return VEHICLE_TYPES.has(type?.toLowerCase())
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditUsagePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [equipment, setEquipment] = useState<EquipmentInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    startHours: '',
    endHours: '',
    startOdometer: '',
    endOdometer: '',
    idleHours: '0',
    projectSite: '',
    shiftDate: '',
    notes: '',
  })

  const isVehicle = equipment ? isVehicleType(equipment.type) : false

  const totalHours =
    parseFloat(form.endHours || '0') - parseFloat(form.startHours || '0')
  const totalDistance =
    parseFloat(form.endOdometer || '0') - parseFloat(form.startOdometer || '0')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/usage/${id}`)
        const data = await res.json()

        if (data.success) {
          const log = data.data
          setForm({
            startHours: String(log.startHours ?? 0),
            endHours: String(log.endHours ?? 0),
            startOdometer: String(log.startOdometer ?? 0),
            endOdometer: String(log.endOdometer ?? 0),
            idleHours: String(log.idleHours ?? 0),
            projectSite: log.projectSite,
            shiftDate: new Date(log.shiftDate).toISOString().split('T')[0],
            notes: log.notes || '',
          })

          // Fetch equipment details
          const eqRes = await fetch(`/api/equipment/${log.equipment.id}`)
          const eqData = await eqRes.json()
          if (eqData.success) {
            setEquipment({
              id: eqData.data.id,
              name: eqData.data.name,
              type: eqData.data.type,
              currentHours: eqData.data.currentHours,
              currentOdometer: eqData.data.currentOdometer,
            })
          }
        }
      } catch {
        console.error('Failed to fetch usage log')
      } finally {
        setFetching(false)
      }
    }
    fetchData()
  }, [id])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (isVehicle) {
      if (parseFloat(form.endOdometer) < parseFloat(form.startOdometer)) {
        setError('End odometer must be greater than or equal to start odometer')
        setLoading(false)
        return
      }
    } else {
      if (parseFloat(form.endHours) < parseFloat(form.startHours)) {
        setError('End hours must be greater than or equal to start hours')
        setLoading(false)
        return
      }
    }

    try {
      const payload = isVehicle
        ? {
            startOdometer: parseFloat(form.startOdometer),
            endOdometer: parseFloat(form.endOdometer),
            projectSite: form.projectSite,
            shiftDate: form.shiftDate,
            notes: form.notes || undefined,
          }
        : {
            startHours: parseFloat(form.startHours),
            endHours: parseFloat(form.endHours),
            idleHours: parseFloat(form.idleHours || '0'),
            projectSite: form.projectSite,
            shiftDate: form.shiftDate,
            notes: form.notes || undefined,
          }

      const res = await fetch(`/api/usage/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update usage log')
        return
      }

      router.push(`/usage/${id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading usage log...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <span className="text-gray-300">/</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Shift Log</h1>
            <p className="text-sm text-gray-500 mt-0.5">Update shift details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Equipment info (read-only) */}
          {equipment && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Equipment</h2>
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                isVehicle ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isVehicle ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    {isVehicle
                      ? <Truck className="w-4 h-4 text-blue-600" />
                      : <Wrench className="w-4 h-4 text-orange-600" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{equipment.name}</p>
                    <p className={`text-xs font-medium ${isVehicle ? 'text-blue-600' : 'text-orange-600'}`}>
                      {isVehicle ? 'Vehicle — KM-tracked' : 'Heavy Equipment — Hours-tracked'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {isVehicle ? (
                    <>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Current Odometer</p>
                      <p className="text-sm font-bold text-gray-800">{equipment.currentOdometer.toLocaleString()} km</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Current Hours</p>
                      <p className="text-sm font-bold text-gray-800">{equipment.currentHours.toLocaleString()} hrs</p>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Equipment cannot be changed after creation</p>
            </div>
          )}

          {/* Shift info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Shift Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="shiftDate"
                value={form.shiftDate}
                onChange={handleChange}
                required
                max={today}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Site <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="projectSite"
                value={form.projectSite}
                onChange={handleChange}
                required
                placeholder="e.g. Kigali Road Project"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
              />
            </div>
          </div>

          {/* Readings section — adaptive based on category */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              {isVehicle ? 'Odometer Readings' : 'Engine Hours'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {isVehicle ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Odometer (km) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="startOdometer"
                      value={form.startOdometer}
                      onChange={handleChange}
                      required
                      min={0}
                      step={1}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Odometer (km) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="endOdometer"
                      value={form.endOdometer}
                      onChange={handleChange}
                      required
                      min={0}
                      step={1}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="startHours"
                      value={form.startHours}
                      onChange={handleChange}
                      required
                      min={0}
                      step={0.1}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="endHours"
                      value={form.endHours}
                      onChange={handleChange}
                      required
                      min={0}
                      step={0.1}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Idle hours — heavy equipment only */}
            {!isVehicle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idle Hours
                  <span className="ml-2 text-xs text-gray-400 font-normal">(engine on but not operating)</span>
                </label>
                <input
                  type="number"
                  name="idleHours"
                  value={form.idleHours}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 focus:border-orange-300 transition-colors"
                />
              </div>
            )}

            {/* Live total */}
            {isVehicle
              ? totalDistance > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-700">Distance Travelled This Shift</p>
                    <p className="text-lg font-bold text-blue-700">{totalDistance.toLocaleString()} km</p>
                  </div>
                )
              : totalHours > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-orange-700">Total Hours This Shift</p>
                    <p className="text-lg font-bold text-orange-700">{totalHours.toFixed(1)} hrs</p>
                  </div>
                )}

            {/* Validation warnings */}
            {isVehicle
              ? form.endOdometer &&
                parseFloat(form.endOdometer) < parseFloat(form.startOdometer || '0') && (
                  <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">End odometer must be greater than or equal to start odometer</p>
                  </div>
                )
              : form.endHours &&
                parseFloat(form.endHours) < parseFloat(form.startHours || '0') && (
                  <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">End hours must be greater than or equal to start hours</p>
                  </div>
                )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional notes about this shift..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 resize-none focus:border-orange-300 transition-colors"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-gray-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 transition-colors shadow-sm"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}