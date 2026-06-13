'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, AlertTriangle, AlertCircle, Wrench, Hammer, Calendar, Route, Clock, Info } from 'lucide-react'

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

type MaintenanceLog = {
  id: string
  description: string
  serviceDate: string
  equipment: { name: string }
}

export default function NewSchedulePage() {
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    scheduleType: 'preventive',
    equipmentId: '',
    technicianId: '',
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
    linkedMaintenanceLogId: '',
  })

  const selectedEquipment = equipment.find((e) => e.id === form.equipmentId)

  useEffect(() => {
    async function fetchData() {
      try {
        const [eqRes, techRes, logsRes] = await Promise.all([
          fetch('/api/equipment'),
          fetch('/api/users?role=technician'),
          fetch('/api/maintenance'),
        ])
        const eqData = await eqRes.json()
        const techData = await techRes.json()
        const logsData = await logsRes.json()

        if (eqData.success) {
          setEquipment(
            eqData.data.filter(
              (e: Equipment & { status: string }) => e.status !== 'retired'
            )
          )
        }
        if (techData.success) setTechnicians(techData.data)
        if (logsData.success) setMaintenanceLogs(logsData.data)
      } catch {
        console.error('Failed to fetch data')
      }
    }
    fetchData()
  }, [])

  // Auto calculate due date when interval changes (days only)
  useEffect(() => {
    if (form.intervalType === 'days' && form.intervalValue) {
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
  }, [form.intervalValue, form.intervalType])

  // Auto fill title when service type changes
  useEffect(() => {
    if (form.scheduleType === 'preventive' && form.serviceType) {
      const titleMap: Record<string, string> = {
        oil_change: 'Oil Change Service',
        brake_check: 'Brake Inspection',
        tire: 'Tire Rotation & Check',
        battery: 'Battery Inspection',
        engine: 'Engine Service',
        hydraulic: 'Hydraulic System Check',
      }
      setForm((prev) => ({
        ...prev,
        title: titleMap[form.serviceType] || '',
      }))
    }
  }, [form.serviceType, form.scheduleType])

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
      const payload = {
        scheduleType: form.scheduleType,
        equipmentId: form.equipmentId,
        technicianId: form.technicianId,
        title: form.title,
        serviceType:
          form.scheduleType === 'preventive' ? form.serviceType : 'engine',
        intervalType:
          form.scheduleType === 'preventive' ? form.intervalType : undefined,
        intervalValue:
          form.scheduleType === 'preventive'
            ? parseFloat(form.intervalValue)
            : undefined,
        nextDueDate: form.nextDueDate,
        isRecurring:
          form.scheduleType === 'preventive' ? form.isRecurring : false,
        priority: form.priority,
        notes: form.notes || undefined,
        linkedMaintenanceLogId:
          form.scheduleType === 'follow_up'
            ? form.linkedMaintenanceLogId || undefined
            : undefined,
      }

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create schedule')
        return
      }

      router.push('/schedules')
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Schedule</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create a maintenance schedule
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Schedule Type Toggle */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">
              Schedule Type
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'preventive',
                  label: 'Preventive',
                  icon: <Wrench className="w-6 h-6" />,
                  desc: 'Planned recurring service',
                },
                {
                  value: 'follow_up',
                  label: 'Follow-up Repair',
                  icon: <Hammer className="w-6 h-6" />,
                  desc: 'One-time planned repair',
                },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, scheduleType: type.value }))
                  }
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.scheduleType === type.value
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {type.icon}
                    <p className="text-sm font-semibold text-gray-900">
                      {type.label}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Basic Information
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment <span className="text-red-500">*</span>
              </label>
              <select
                name="equipmentId"
                value={form.equipmentId}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
              >
                <option value="">— Select equipment —</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>

              {/* Show current readings when equipment is selected */}
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

            {form.scheduleType === 'preventive' && (
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
            )}

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
                placeholder="e.g. Oil Change Service"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

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

          {/* Preventive interval settings */}
          {form.scheduleType === 'preventive' && (
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
                          nextDueDate: '',
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

              {/* Days interval */}
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
                      placeholder="e.g. 30"
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

              {/* KM interval */}
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
                      placeholder="e.g. 500"
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
                      placeholder={
                        selectedEquipment
                          ? String(
                              selectedEquipment.currentOdometer +
                                parseFloat(form.intervalValue || '0')
                            )
                          : 'e.g. 45500'
                      }
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

              {/* Hours interval */}
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
                      placeholder="e.g. 250"
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
                      placeholder={
                        selectedEquipment
                          ? String(
                              selectedEquipment.currentHours +
                                parseFloat(form.intervalValue || '0')
                            )
                          : 'e.g. 1500'
                      }
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
          )}

          {/* Follow-up specific */}
          {form.scheduleType === 'follow_up' && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-orange-800">
                Follow-up Details
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="nextDueDate"
                  value={form.nextDueDate}
                  onChange={handleChange}
                  required
                  min={today}
                  className="w-full px-4 py-3 rounded-xl border border-orange-200 text-sm outline-none text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Linked Maintenance Log{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  name="linkedMaintenanceLogId"
                  value={form.linkedMaintenanceLogId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-orange-200 text-sm outline-none text-gray-900 bg-white"
                >
                  <option value="">— Select maintenance log —</option>
                  {maintenanceLogs.map((log) => (
                    <option key={log.id} value={log.id}>
                      {log.equipment.name} ·{' '}
                      {new Date(log.serviceDate).toLocaleDateString()} ·{' '}
                      {log.description.slice(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white border border-orange-100 rounded-xl p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">
                  Follow-up repairs are one-time schedules. They do not
                  repeat after completion.
                </p>
              </div>
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
              {loading ? 'Saving...' : 'Create Schedule'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}