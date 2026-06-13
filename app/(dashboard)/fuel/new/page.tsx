'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, AlertTriangle, Fuel, TrendingUp } from 'lucide-react'

type Equipment = {
  id: string
  name: string
  type: string
  currentOdometer: number
  currentHours: number
}

type FuelRecommendation = {
  usageAmount: number
  usageUnit: 'km' | 'hrs'
  rate: number
  rateUnit: 'L/km' | 'L/hr'
  recommendedLiters: number
  rangeMin: number
  rangeMax: number
  rangeMinLiters: number
  rangeMaxLiters: number
  hasData: true
}

type FormContext = {
  recommendation: FuelRecommendation | null
  baseline: { min: number; max: number; unit: string }
}

export default function NewFuelPage() {
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formContext, setFormContext] = useState<FormContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    equipmentId: '',
    liters: '',
    costPerLiter: '',
    odometer: '',
    hours: '',
    fuelDate: today,
    projectSite: '',
    notes: '',
  })

  const selectedEquipment = equipment.find((e) => e.id === form.equipmentId)
  const isVehicle = selectedEquipment ? ['truck', 'tipper_truck'].includes(selectedEquipment.type) : false
  const totalCost =
    parseFloat(form.liters || '0') * parseFloat(form.costPerLiter || '0')

  // Calculate live fuel rate
  const rec = formContext?.recommendation
  const liveUsage = rec ? rec.usageAmount : 0
  const liveLiters = parseFloat(form.liters || '0')
  const liveRate = liveUsage > 0 && liveLiters > 0 ? liveLiters / liveUsage : null
  const isRateAnomaly = liveRate !== null && rec
    ? (liveRate < rec.rangeMin * 0.8 || liveRate > rec.rangeMax * 1.2)
    : false
  const isRateHigh = liveRate !== null && rec ? liveRate > rec.rangeMax : false

  useEffect(() => {
    async function fetchEquipment() {
      try {
        const res = await fetch('/api/equipment')
        const data = await res.json()
        if (data.success) {
          setEquipment(
            data.data.filter(
              (e: Equipment & { status: string }) =>
              e.status !== 'retired' && e.status !== 'under_maintenance'
            )
          )
        }
      } catch {
        console.error('Failed to fetch equipment')
      }
    }
    fetchEquipment()
  }, [])

  // Auto fill odometer/hours when equipment is selected
  useEffect(() => {
    if (selectedEquipment) {
      const isVeh = ['truck', 'tipper_truck'].includes(selectedEquipment.type)
      setForm((prev) => ({
        ...prev,
        odometer: isVeh ? String(selectedEquipment.currentOdometer) : '',
        hours: isVeh ? '' : String(selectedEquipment.currentHours),
      }))
    }
  }, [selectedEquipment])

  // Fetch fuel recommendation when equipment + date are both selected
  useEffect(() => {
    if (!form.equipmentId || !form.fuelDate) {
      setFormContext(null)
      return
    }
    async function fetchContext() {
      setContextLoading(true)
      try {
        const res = await fetch(
          `/api/fuel?context=fuel-form&equipmentId=${form.equipmentId}&date=${form.fuelDate}`
        )
        const data = await res.json()
        if (data.success) {
          setFormContext({
            recommendation: data.data.recommendation,
            baseline: data.data.baseline,
          })
        }
      } catch {
        console.error('Failed to fetch fuel context')
      } finally {
        setContextLoading(false)
      }
    }
    fetchContext()
  }, [form.equipmentId, form.fuelDate])

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

    try {
      const payload = {
        equipmentId: form.equipmentId,
        liters: parseFloat(form.liters),
        costPerLiter: parseFloat(form.costPerLiter),
        odometer: isVehicle ? parseFloat(form.odometer) : undefined,
        hours: isVehicle ? undefined : parseFloat(form.hours),
        fuelDate: form.fuelDate,
        projectSite: form.projectSite || undefined,
        notes: form.notes || undefined,
      }

      const res = await fetch('/api/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to log fuel')
        return
      }

      router.push('/fuel')
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
            <h1 className="text-2xl font-bold text-gray-900">Log Fuel</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Record a fuel refill
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Equipment */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Equipment
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
                Fuel Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="fuelDate"
                value={form.fuelDate}
                onChange={handleChange}
                required
                max={today}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
              />
            </div>

            <div>
              {!selectedEquipment ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Odometer / Engine Hours <span className="text-red-500">*</span>
                  </label>
                  <input
                    key="placeholder-input"
                    type="text"
                    disabled
                    placeholder="Select equipment first"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-400 bg-slate-50 cursor-not-allowed"
                  />
                </>
              ) : isVehicle ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Odometer Reading (km) <span className="text-red-500">*</span>
                  </label>
                  <input
                    key="odometer-input"
                    type="number"
                    name="odometer"
                    value={form.odometer}
                    onChange={handleChange}
                    required
                    min={selectedEquipment.currentOdometer}
                    placeholder="e.g. 45000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Must be ≥ current odometer ({selectedEquipment.currentOdometer.toLocaleString()} km)
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Engine Hours (hrs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    key="hours-input"
                    type="number"
                    name="hours"
                    value={form.hours}
                    onChange={handleChange}
                    required
                    min={selectedEquipment.currentHours}
                    step={0.1}
                    placeholder="e.g. 1250"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Must be ≥ current engine hours ({selectedEquipment.currentHours.toLocaleString()} hrs)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Fuel Recommendation Panel */}
          {form.equipmentId && form.fuelDate && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Fuel size={16} className="text-orange-500" />
                <h2 className="text-sm font-semibold text-gray-800">Fuel Recommendation</h2>
              </div>

              {contextLoading ? (
                <p className="text-xs text-gray-400 py-2">Fetching usage data for this date...</p>
              ) : rec ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl px-4 py-3">
                      <p className="text-xs text-blue-500 mb-0.5">Usage on {form.fuelDate}</p>
                      <p className="text-sm font-bold text-blue-800">
                        {rec.usageAmount.toFixed(1)} {rec.usageUnit}
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-xl px-4 py-3">
                      <p className="text-xs text-orange-500 mb-0.5">Recommended Liters</p>
                      <p className="text-sm font-bold text-orange-800">
                        ~{rec.recommendedLiters.toFixed(1)} L
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-500">
                      Expected range: <span className="font-semibold text-gray-700">
                        {rec.rangeMinLiters.toFixed(1)}–{rec.rangeMaxLiters.toFixed(1)} L
                      </span>
                      <span className="text-gray-400 ml-1">
                        ({rec.rangeMin}–{rec.rangeMax} {rec.rateUnit} × {rec.usageAmount.toFixed(1)} {rec.usageUnit})
                      </span>
                    </p>
                  </div>

                  {/* Live rate indicator */}
                  {liveRate !== null && (
                    <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                      isRateHigh ? 'bg-red-50' : isRateAnomaly ? 'bg-yellow-50' : 'bg-green-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className={isRateHigh ? 'text-red-500' : isRateAnomaly ? 'text-yellow-600' : 'text-green-600'} />
                        <p className={`text-xs font-medium ${isRateHigh ? 'text-red-700' : isRateAnomaly ? 'text-yellow-700' : 'text-green-700'}`}>
                          Current rate: {liveRate.toFixed(3)} {rec.rateUnit}
                        </p>
                      </div>
                      {isRateHigh && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Above range</span>
                      )}
                      {!isRateHigh && isRateAnomaly && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Unusual</span>
                      )}
                      {!isRateAnomaly && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Normal</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-4 py-3">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    No usage log found for <strong>{form.fuelDate}</strong> on this equipment.
                    Log a shift first to get a fuel recommendation, or enter liters manually.
                  </p>
                </div>
              )}

              {formContext && !rec && (
                <p className="text-xs text-gray-400">
                  Baseline range: {formContext.baseline.min}–{formContext.baseline.max} {formContext.baseline.unit}
                </p>
              )}
            </div>
          )}

          {/* Fuel details */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Fuel Details
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Liters <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="liters"
                  value={form.liters}
                  onChange={handleChange}
                  required
                  min={0.1}
                  step={0.1}
                  placeholder={rec ? `Rec: ~${rec.recommendedLiters.toFixed(1)} L` : 'e.g. 80'}
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none text-gray-900 ${
                    isRateHigh ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                />
                {isRateHigh && liveLiters > 0 && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> High — exceeds expected range
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cost Per Liter (RWF) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="costPerLiter"
                  value={form.costPerLiter}
                  onChange={handleChange}
                  required
                  min={0}
                  placeholder="e.g. 1200"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Live total cost */}
            {totalCost > 0 && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-orange-700">Total Fuel Cost</p>
                <p className="text-lg font-bold text-orange-700">
                  RWF {totalCost.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Optional info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Additional Info{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Site
              </label>
              <input
                type="text"
                name="projectSite"
                value={form.projectSite}
                onChange={handleChange}
                placeholder="e.g. Kigali Road Project"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional notes..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-gray-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium bg-orange-500 disabled:bg-orange-300"
            >
              {loading ? 'Saving...' : 'Save Fuel Log'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}