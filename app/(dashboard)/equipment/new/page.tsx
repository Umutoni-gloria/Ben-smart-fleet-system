'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Operator = {
  id: string
  fullName: string
  email: string
}

export default function NewEquipmentPage() {
  const router = useRouter()
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    type: 'excavator',
    model: '',
    serialNumber: '',
    year: new Date().getFullYear(),
    assignedOperatorId: '',
    defaultFuelRate: '15',
    fuelTolerance: '20',
  })

  const defaultRates: Record<string, string> = {
    truck: '0.25',
    tipper_truck: '0.33',
    excavator: '15',
    bulldozer: '18',
    grader: '12',
  }

  useEffect(() => {
    async function fetchOperators() {
      try {
        const res = await fetch('/api/users?role=operator')
        const data = await res.json()
        if (data.success) setOperators(data.data)
      } catch {
        console.error('Failed to fetch operators')
      }
    }
    fetchOperators()
  }, [])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: name === 'year' ? parseInt(value) : value,
      } as any
      if (name === 'type') {
        next.defaultFuelRate = defaultRates[value] || '0.25'
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          assignedOperatorId: form.assignedOperatorId || undefined,
          defaultFuelRate: form.defaultFuelRate ? parseFloat(form.defaultFuelRate) : undefined,
          fuelTolerance: form.fuelTolerance ? parseFloat(form.fuelTolerance) : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to add equipment')
        return
      }

      router.push('/equipment')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
          ><svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>  Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Equipment</h1>
            <p className="text-sm text-gray-500 mt-0.5">Register a new vehicle or machine</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. CAT 320 Excavator Unit 01"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

            {/* Type and Year */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
                >
                  <option value="excavator">Excavator</option>
                  <option value="bulldozer">Bulldozer</option>
                  <option value="grader">Grader</option>
                  <option value="truck">Truck</option>
                  <option value="tipper_truck">Tipper Truck</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="year"
                  value={form.year}
                  onChange={handleChange}
                  required
                  min={1990}
                  max={2030}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={form.model}
                onChange={handleChange}
                required
                placeholder="e.g. CAT 320D"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

            {/* Serial Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="serialNumber"
                value={form.serialNumber}
                onChange={handleChange}
                required
                placeholder="e.g. CAT320-2021-001"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

            {/* Fuel Efficiency Standards */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Standard Fuel Rate ({['truck', 'tipper_truck'].includes(form.type) ? 'L/km' : 'L/hr'}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="defaultFuelRate"
                  value={form.defaultFuelRate}
                  onChange={handleChange}
                  required
                  step={0.01}
                  min={0}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anomaly Tolerance (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="fuelTolerance"
                  value={form.fuelTolerance}
                  onChange={handleChange}
                  required
                  min={0}
                  max={100}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Assigned Operator */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Operator <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                name="assignedOperatorId"
                value={form.assignedOperatorId}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
              >
                <option value="">— No operator assigned —</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.fullName} ({op.email})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
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
                {loading ? 'Saving...' : 'Add Equipment'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  )
}
