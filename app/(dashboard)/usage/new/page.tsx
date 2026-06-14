'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

type Equipment = {
  id: string
  name: string
  type: string
  currentHours: number
  currentOdometer: number
}

export default function NewUsagePage() {
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    equipmentId: '',
    startHours: '',
    endHours: '',
    startOdometer: '',
    endOdometer: '',
    idleHours: '0',
    projectSite: '',
    shiftDate: today,
    notes: '',
  })

  const selectedEquipment = equipment.find((e) => e.id === form.equipmentId)
  const isVehicle = selectedEquipment ? ['truck', 'tipper_truck'].includes(selectedEquipment.type) : false
  const totalHours =
    parseFloat(form.endHours || '0') - parseFloat(form.startHours || '0')
  const totalDistance =
    parseFloat(form.endOdometer || '0') - parseFloat(form.startOdometer || '0')

  useEffect(() => {
    async function fetchEquipment() {
      try {
        const res = await fetch('/api/equipment')
        const data = await res.json()
        if (data.success) {
          setEquipment(
            data.data.filter(
              (e: Equipment & { status: string }) => e.status !== 'retired'
            )
          )
        }
      } catch {
        console.error('Failed to fetch equipment')
      }
    }
    fetchEquipment()
  }, [])

  // Auto fill start readings when equipment is selected
  useEffect(() => {
    if (selectedEquipment) {
      const isVeh = ['truck', 'tipper_truck'].includes(selectedEquipment.type)
      setForm((prev) => ({
        ...prev,
        startHours: isVeh ? '0' : String(selectedEquipment.currentHours),
        startOdometer: isVeh ? String(selectedEquipment.currentOdometer) : '0',
        endHours: isVeh ? '0' : '',
        endOdometer: isVeh ? '' : '0',
      }))
    }
  }, [selectedEquipment])

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

    const isVeh = selectedEquipment ? ['truck', 'tipper_truck'].includes(selectedEquipment.type) : false

    if (isVeh) {
      if (parseFloat(form.endOdometer) <= parseFloat(form.startOdometer)) {
        setError('End odometer must be greater than start odometer')
        setLoading(false)
        return
      }
    } else {
      if (parseFloat(form.endHours) <= parseFloat(form.startHours)) {
        setError('End hours must be greater than start hours')
        setLoading(false)
        return
      }
    }

    try {
      const payload = {
        equipmentId: form.equipmentId,
        startHours: isVeh ? 0 : parseFloat(form.startHours),
        endHours: isVeh ? 0 : parseFloat(form.endHours),
        startOdometer: isVeh ? parseFloat(form.startOdometer) : undefined,
        endOdometer: isVeh ? parseFloat(form.endOdometer) : undefined,
        idleHours: isVeh ? 0 : parseFloat(form.idleHours || '0'),
        projectSite: form.projectSite,
        shiftDate: form.shiftDate,
        notes: form.notes || undefined,
      }

      const res = await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to log shift')
        return
      }

      router.push('/usage')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <span className="text-gray-300">/</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log Shift</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Record equipment usage for a shift
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Equipment */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Equipment & Shift Info
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Equipment <span className="text-red-500">*</span>
              </label>
              <select
                name="equipmentId"
                value={form.equipmentId}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 bg-white"
              >
                <option value="">— Select equipment —</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>

              {selectedEquipment && (
                <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                  {isVehicle ? (
                    <>
                      <p className="text-xs text-gray-400">Current Odometer</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {selectedEquipment.currentOdometer.toLocaleString()} km
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400">Current Engine Hours</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {selectedEquipment.currentHours.toLocaleString()} hrs
                      </p>
                    </>
                  )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isVehicle ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                    {isVehicle ? 'KM-based' : 'Hours-based'}
                  </span>
                </div>
              )}
            </div>

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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
              />
            </div>
          </div>

          {/* Engine Hours / Odometer */}
          {selectedEquipment && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">
                {isVehicle ? 'Odometer Readings' : 'Engine Hours'}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Autofill notice banner */}
                <div className="col-span-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                  <span className="text-blue-400" style={{fontSize: '15px'}}>ℹ️</span>
                  <p className="text-xs text-blue-700 font-medium">
                    <span className="font-semibold">Start {isVehicle ? 'Odometer' : 'Hours'}</span> is autofilled from the equipment&apos;s current reading — this field cannot be edited.
                  </p>
                </div>
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
                        readOnly
                        disabled
                        required
                        min={0}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-500 bg-slate-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                        <span>🔒</span> Auto-filled from current odometer
                      </p>
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
                        min={parseFloat(form.startOdometer || '0') + 1}
                        placeholder="e.g. 50150"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
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
                        readOnly
                        disabled
                        required
                        min={0}
                        step={0.1}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-500 bg-slate-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                        <span>🔒</span> Auto-filled from current hours
                      </p>
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
                        min={parseFloat(form.startHours || '0') + 0.1}
                        step={0.1}
                        placeholder="e.g. 1258"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                      />
                    </div>
                  </>
                )}
              </div>

              {!isVehicle && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
                    Idle Hours (Engine on but not operating)
                  </label>
                  <input
                    type="number"
                    name="idleHours"
                    value={form.idleHours}
                    onChange={handleChange}
                    min={0}
                    step={0.1}
                    placeholder="e.g. 1.5"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                  <p className="text-xs text-gray-400 mt-1">Included in total hours but tracked separately</p>
                </div>
              )}

              {/* Live totals */}
              {isVehicle ? (
                totalDistance > 0 && (
                  <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-orange-700">Distance Traveled This Shift</p>
                    <p className="text-lg font-bold text-orange-700">
                      {totalDistance.toLocaleString()} km
                    </p>
                  </div>
                )
              ) : (
                totalHours > 0 && (
                  <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-orange-700">Total Hours This Shift</p>
                    <p className="text-lg font-bold text-orange-700">
                      {totalHours.toFixed(1)} hrs
                    </p>
                  </div>
                )
              )}

              {/* Warnings */}
              {isVehicle ? (
                form.endOdometer &&
                parseFloat(form.endOdometer) <= parseFloat(form.startOdometer || '0') && (
                  <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">
                      End odometer must be greater than start odometer
                    </p>
                  </div>
                )
              ) : (
                form.endHours &&
                parseFloat(form.endHours) <= parseFloat(form.startHours || '0') && (
                  <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">
                      End hours must be greater than start hours
                    </p>
                  </div>
                )
              )}
            </div>
          )}

          {!selectedEquipment && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center text-gray-400 text-sm">
              Please select an equipment to enter shift readings.
            </div>
          )}

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
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium bg-orange-500 disabled:bg-orange-300"
            >
              {loading ? 'Saving...' : 'Save Shift'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}