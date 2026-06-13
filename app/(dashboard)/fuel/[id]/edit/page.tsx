'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Equipment = {
  id: string
  name: string
  currentOdometer: number
}

export default function EditFuelPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    liters: '',
    costPerLiter: '',
    odometer: '',
    fuelDate: '',
    projectSite: '',
    notes: '',
  })

  const totalCost =
    parseFloat(form.liters || '0') * parseFloat(form.costPerLiter || '0')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/fuel/${id}`)
        const data = await res.json()

        if (data.success) {
          const log = data.data
          setForm({
            liters: String(log.liters),
            costPerLiter: String(log.costPerLiter),
            odometer: String(log.odometer),
            fuelDate: new Date(log.fuelDate).toISOString().split('T')[0],
            projectSite: log.projectSite || '',
            notes: log.notes || '',
          })

          // Fetch equipment details
          const eqRes = await fetch(`/api/equipment/${log.equipment.id}`)
          const eqData = await eqRes.json()
          if (eqData.success) {
            setEquipment({
              id: eqData.data.id,
              name: eqData.data.name,
              currentOdometer: eqData.data.currentOdometer,
            })
          }
        }
      } catch {
        console.error('Failed to fetch fuel log')
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

    try {
      const res = await fetch(`/api/fuel/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liters: parseFloat(form.liters),
          costPerLiter: parseFloat(form.costPerLiter),
          odometer: parseFloat(form.odometer),
          fuelDate: form.fuelDate,
          projectSite: form.projectSite || undefined,
          notes: form.notes || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update fuel log')
        return
      }

      router.push(`/fuel/${id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading fuel log...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
          ><svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>  Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Fuel Log</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Update fuel log details
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Equipment — read only */}
          {equipment && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                Equipment
              </h2>
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {equipment.name}
                </p>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Current Odometer</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {equipment.currentOdometer.toLocaleString()} km
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Equipment cannot be changed after creation
              </p>
            </div>
          )}

          {/* Fuel details */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Fuel Details
            </h2>

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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Odometer Reading (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="odometer"
                value={form.odometer}
                onChange={handleChange}
                required
                min={0}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                />
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Live total */}
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
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 resize-none"
              />
            </div>
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
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium bg-orange-500 disabled:bg-orange-300"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}