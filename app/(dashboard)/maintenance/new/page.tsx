'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { ArrowLeft } from 'lucide-react'

type Equipment = {
  id: string
  name: string
  type: string
}

type Part = {
  partName: string
  quantity: number
  unitCost: number
}

export default function NewMaintenancePage() {
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [beforePhotos, setBeforePhotos] = useState<string[]>([])
  const [afterPhotos, setAfterPhotos] = useState<string[]>([])
  const sigCanvas = useRef<any>(null)

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before'|'after') => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          if (type === 'before') setBeforePhotos(prev => [...prev, ev.target!.result as string])
          else setAfterPhotos(prev => [...prev, ev.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const [form, setForm] = useState({
    equipmentId: '',
    type: 'preventive',
    serviceType: 'oil_change',
    description: '',
    failureCause: '',
    downtimeHours: '',
    wasAvoidable: '',
    laborCost: '0',
    serviceDate: new Date().toISOString().split('T')[0],
  })

  const [parts, setParts] = useState<Part[]>([])

  useEffect(() => {
    async function fetchEquipment() {
      try {
        const res = await fetch('/api/equipment')
        const data = await res.json()
        if (data.success) {
          setEquipment(data.data.filter((e: Equipment & { status: string }) => e.status !== 'retired'))
        }
      } catch {
        console.error('Failed to fetch equipment')
      }
    }
    fetchEquipment()
  }, [])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function addPart() {
    setParts((prev) => [...prev, { partName: '', quantity: 1, unitCost: 0 }])
  }

  function updatePart(index: number, field: keyof Part, value: string | number) {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    )
  }

  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index))
  }

  const partsCost = parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0)
  const totalCost = parseFloat(form.laborCost || '0') + partsCost

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        equipmentId: form.equipmentId,
        type: form.type,
        serviceType: form.type === 'preventive' ? form.serviceType : undefined,
        description: form.description,
        failureCause: form.type === 'corrective' ? form.failureCause : undefined,
        downtimeHours:
          form.type === 'corrective' && form.downtimeHours
            ? parseFloat(form.downtimeHours)
            : undefined,
        wasAvoidable:
          form.type === 'corrective' && form.wasAvoidable !== ''
            ? form.wasAvoidable === 'true'
            : undefined,
        laborCost: parseFloat(form.laborCost || '0'),
        serviceDate: form.serviceDate,
        parts: parts.filter((p) => p.partName.trim() !== ''),
        beforePhotoUrls: beforePhotos,
        afterPhotoUrls: afterPhotos,
        signatureUrl: sigCanvas.current && !sigCanvas.current.isEmpty() ? sigCanvas.current.getTrimmedCanvas().toDataURL('image/png') : null,
      }

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create log')
        return
      }

      router.push('/maintenance')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log Maintenance</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Record a new maintenance activity
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Equipment + Date */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Basic Information</h2>

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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 bg-white"
                >
                  <option value="preventive">Preventive</option>
                  <option value="corrective">Corrective</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="serviceDate"
                  value={form.serviceDate}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                />
              </div>
            </div>

            {form.type === 'preventive' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
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
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Describe what was done..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900 resize-none"
              />
            </div>
          </div>

          {/* Corrective fields */}
          {form.type === 'corrective' && (
            <div className="bg-red-50 rounded-2xl shadow-sm p-6 space-y-4 border border-red-100">
              <h2 className="text-sm font-semibold text-red-800">Breakdown Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Failure Cause
                </label>
                <textarea
                  name="failureCause"
                  value={form.failureCause}
                  onChange={handleChange}
                  rows={2}
                  placeholder="What caused the failure?"
                  className="w-full px-4 py-3 rounded-xl border border-red-200 text-sm outline-none text-gray-900 resize-none bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Downtime Hours
                  </label>
                  <input
                    type="number"
                    name="downtimeHours"
                    value={form.downtimeHours}
                    onChange={handleChange}
                    min={0}
                    step={0.5}
                    placeholder="e.g. 4.5"
                    className="w-full px-4 py-3 rounded-xl border border-red-200 text-sm outline-none text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Was it Avoidable?
                  </label>
                  <select
                    name="wasAvoidable"
                    value={form.wasAvoidable}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-red-200 text-sm outline-none text-gray-900 bg-white"
                  >
                    <option value="">— Select —</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Photos and Signature */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Documentation</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Before Photos</label>
                <input type="file" multiple accept="image/*" onChange={e => handlePhotoUpload(e, 'before')} className="mb-2 text-sm text-gray-500" />
                <div className="flex gap-2 flex-wrap overflow-x-auto">
                  {beforePhotos.map((p, i) => <img key={i} src={p} className="h-16 w-16 object-cover rounded-lg border border-gray-200" alt="Before" />)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">After Photos</label>
                <input type="file" multiple accept="image/*" onChange={e => handlePhotoUpload(e, 'after')} className="mb-2 text-sm text-gray-500" />
                <div className="flex gap-2 flex-wrap overflow-x-auto">
                  {afterPhotos.map((p, i) => <img key={i} src={p} className="h-16 w-16 object-cover rounded-lg border border-gray-200" alt="After" />)}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Technician Signature</label>
              <div className="border border-gray-200 rounded-xl bg-gray-50 h-32 relative">
                <SignatureCanvas 
                  ref={sigCanvas} 
                  penColor="black"
                  canvasProps={{ className: 'w-full h-full rounded-xl' }}
                />
              </div>
              <button type="button" onClick={() => sigCanvas.current?.clear()} className="mt-2 text-xs text-orange-500 hover:text-orange-700">Clear Signature</button>
            </div>
          </div>

          {/* Parts */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Parts Used</h2>
              <button
                type="button"
                onClick={addPart}
                className="text-xs text-orange-500 hover:text-orange-700 font-medium"
              >
                + Add Part
              </button>
            </div>

            {parts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No parts added yet. Click Add Part if parts were used.
              </p>
            ) : (
              <div className="space-y-3">
                {parts.map((part, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={part.partName}
                      onChange={(e) => updatePart(index, 'partName', e.target.value)}
                      placeholder="Part name"
                      className="col-span-5 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                    />
                    <input
                      type="number"
                      value={part.quantity}
                      onChange={(e) => updatePart(index, 'quantity', parseInt(e.target.value) || 1)}
                      min={1}
                      placeholder="Qty"
                      className="col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                    />
                    <input
                      type="number"
                      value={part.unitCost}
                      onChange={(e) => updatePart(index, 'unitCost', parseFloat(e.target.value) || 0)}
                      min={0}
                      placeholder="Unit cost"
                      className="col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
                    />
                    <div className="col-span-1 text-xs text-gray-400 text-right">
                      {(part.quantity * part.unitCost).toLocaleString()}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePart(index)}
                      className="col-span-1 text-red-400 hover:text-red-600 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Costs */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Cost Summary</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labor Cost (RWF)
              </label>
              <input
                type="number"
                name="laborCost"
                value={form.laborCost}
                onChange={handleChange}
                min={0}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none text-gray-900"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Labor Cost</span>
                <span>RWF {parseFloat(form.laborCost || '0').toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Parts Cost</span>
                <span>RWF {partsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total Cost</span>
                <span>RWF {totalCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Buttons */}
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
              {loading ? 'Saving...' : 'Save Log'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}