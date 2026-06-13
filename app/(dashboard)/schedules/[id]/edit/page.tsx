'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Calendar, Route, Clock } from 'lucide-react'

type Equipment = {
  id: string
  name: string
  type: string
  currentOdometer: number
  currentHours: number
}

type Technician = {
  id: string
  fullName: string
  email: string
}

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    title: '',
    serviceType: 'oil_change',
    intervalType: 'days',
    intervalValue: '30',
    nextDueDate: '',
    targetOdometer: '',
    targetHours: '',
    isRecurring: true,
    priority: 'medium',
    notes: '',
    technicianId: '',
    equipmentId: '',
  })

  const selectedEquipment = equipment.find((e) => e.id === form.equipmentId)

  useEffect(() => {
    async function fetchData() {
      try {
        const [scheduleRes, eqRes, techRes] = await Promise.all([
          fetch(`/api/schedules/${id}`),
          fetch('/api/equipment'),
          fetch('/api/users?role=technician'),
        ])

        const scheduleData = await scheduleRes.json()
        const eqData = await eqRes.json()
        const techData = await techRes.json()

        if (scheduleData.success) {
          const s = scheduleData.data
          const priorityReverseMap: Record<number, string> = {
            1: 'low',
            2: 'medium',
            3: 'high',
            4: 'critical',
          }
          setForm({
            title: s.title,
            serviceType: s.serviceType,
            intervalType: s.intervalType,
            intervalValue: String(s.intervalValue),
            nextDueDate: new Date(s.nextDueDate).toISOString().split('T')[0],
            targetOdometer: '',
            targetHours: '',
            isRecurring: s.isRecurring,
            priority: priorityReverseMap[s.priority] || 'medium',
            notes: s.notes || '',
            technicianId: s.technician.id,
            equipmentId: s.equipment.id,
          })
        }

        if (eqData.success) {
          setEquipment(
            eqData.data.filter(
              (e: Equipment & { status: string }) => e.status !== 'retired'
            )
          )
        }
        if (techData.success) setTechnicians(techData.data)
      } catch {
        console.error('Failed to fetch data')
      } finally {
        setFetching(false)
      }
    }
    fetchData()
  }, [id])

  // Auto recalculate due date when interval days change
  useEffect(() => {
    if (form.intervalType === 'days' && form.intervalValue && !fetching) {
      const days = parseInt(form.intervalValue)
      if (days > 0) {
        const due = new Date()
        due.setDate(due.getDate() + days)
        setForm((prev) => ({
          ...prev,
          nextDueDate: due.toISOString().split('T')[0],
        }))
      }
    }
  }, [form.intervalValue, form.intervalType, fetching])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setForm((prev) => ({ ...prev, [name]: checked }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const priorityMap: Record<string, number> = {
        low: 1, medium: 2, high: 3, critical: 4,
      }

      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          serviceType: form.serviceType,
          intervalType: form.intervalType,
          intervalValue: parseFloat(form.intervalValue),
          nextDueDate: form.nextDueDate,
          isRecurring: form.isRecurring,
          priority: priorityMap[form.priority],
          notes: form.notes || undefined,
          technicianId: form.technicianId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update schedule')
        return
      }

      router.push(`/schedules/${id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading schedule...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Schedule</h1>
            <p className="text-sm text-gray-500 mt-0.5">Update schedule details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Basic Info */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Basic Information</h2>

            {/* Equipment read only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment
              </label>
              <select
                name="equipmentId"
                value={form.equipmentId}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Equipment cannot be changed after creation
              </p>

              {/* Show current readings */}
              {selectedEquipment && (
                <div className="mt-2 flex gap-4 bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-gray-400">Current Odometer</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedEquipment.currentOdometer.toLocaleString()} km
                    </p>
                  </div>
                  <div className="border-l border-gray-200 pl-4">
                    <p className="text-xs text-gray-400">Current Hours</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedEquipment.currentHours.toLocaleString()} hrs
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Technician */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Technician <span className="text-red-500">*</span>
              </label>
              <select
                name="technicianId"
                value={form.technicianId}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
              >
                <option value="">— Select technician —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                name="serviceType"
                value={form.serviceType}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
              >
                <option value="oil_change">Oil Change</option>
                <option value="brake_check">Brake Check</option>
                <option value="tire">Tire</option>
                <option value="battery">Battery</option>
                <option value="engine">Engine</option>
                <option value="hydraulic">Hydraulic</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Interval Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Interval & Due Date
            </h2>

            {/* Interval Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interval Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'days', label: 'Days', icon: <Calendar className="w-5 h-5 mx-auto" /> },
                  { value: 'km', label: 'Kilometers', icon: <Route className="w-5 h-5 mx-auto" /> },
                  { value: 'hours', label: 'Engine Hours', icon: <Clock className="w-5 h-5 mx-auto" /> },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        intervalType: t.value,
                        targetOdometer: '',
                        targetHours: '',
                      }))
                    }
                    className={`py-3 rounded-xl border-2 text-center transition-all ${
                      form.intervalType === t.value
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500'
                    }`}
                  >
                    <div className="mb-1 text-slate-500">{t.icon}</div>
                    <p className="text-xs font-semibold mt-1">
                      {t.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Days */}
            {form.intervalType === 'days' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Every how many days?
                  </label>
                  <input
                    type="number"
                    name="intervalValue"
                    value={form.intervalValue}
                    onChange={handleChange}
                    min={1}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                    <span className="text-gray-400 font-normal ml-1">
                      (auto-calculated · you can adjust)
                    </span>
                  </label>
                  <input
                    type="date"
                    name="nextDueDate"
                    value={form.nextDueDate}
                    onChange={handleChange}
                    required
                    min={today}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                  {form.nextDueDate && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1 font-medium">
                      ✓ Scheduled for{' '}
                      {new Date(form.nextDueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* KM */}
            {form.intervalType === 'km' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Every how many kilometers?
                  </label>
                  <input
                    type="number"
                    name="intervalValue"
                    value={form.intervalValue}
                    onChange={handleChange}
                    min={1}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
                {selectedEquipment && (
                  <div className="bg-blue-50 border border-blue-100/50 rounded-xl px-4 py-3">
                    <p className="text-xs text-blue-700">
                      Current odometer:{' '}
                      <strong>
                        {selectedEquipment.currentOdometer.toLocaleString()} km
                      </strong>{' '}
                      → Next service at:{' '}
                      <strong>
                        {(
                          selectedEquipment.currentOdometer +
                          parseFloat(form.intervalValue || '0')
                        ).toLocaleString()}{' '}
                        km
                      </strong>
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Odometer (km)
                  </label>
                  <input
                    type="number"
                    name="targetOdometer"
                    value={form.targetOdometer}
                    onChange={handleChange}
                    min={selectedEquipment?.currentOdometer || 0}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Date to Reach Target
                  </label>
                  <input
                    type="date"
                    name="nextDueDate"
                    value={form.nextDueDate}
                    onChange={handleChange}
                    required
                    min={today}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
              </div>
            )}

            {/* Hours */}
            {form.intervalType === 'hours' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Every how many engine hours?
                  </label>
                  <input
                    type="number"
                    name="intervalValue"
                    value={form.intervalValue}
                    onChange={handleChange}
                    min={1}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
                {selectedEquipment && (
                  <div className="bg-blue-50 border border-blue-100/50 rounded-xl px-4 py-3">
                    <p className="text-xs text-blue-700">
                      Current hours:{' '}
                      <strong>
                        {selectedEquipment.currentHours.toLocaleString()} hrs
                      </strong>{' '}
                      → Next service at:{' '}
                      <strong>
                        {(
                          selectedEquipment.currentHours +
                          parseFloat(form.intervalValue || '0')
                        ).toLocaleString()}{' '}
                        hrs
                      </strong>
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Engine Hours
                  </label>
                  <input
                    type="number"
                    name="targetHours"
                    value={form.targetHours}
                    onChange={handleChange}
                    min={selectedEquipment?.currentHours || 0}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Date to Reach Target Hours
                  </label>
                  <input
                    type="date"
                    name="nextDueDate"
                    value={form.nextDueDate}
                    onChange={handleChange}
                    required
                    min={today}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none text-gray-900"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isRecurring"
                id="isRecurring"
                checked={form.isRecurring}
                onChange={handleChange}
                className="w-4 h-4 accent-orange-500"
              />
              <label htmlFor="isRecurring" className="text-sm text-gray-700">
                Recurring — automatically reset after completion
              </label>
            </div>
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
              placeholder="Any additional notes or instructions..."
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
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 transition-colors shadow-sm"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}