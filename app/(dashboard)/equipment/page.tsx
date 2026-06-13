'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, Download, Plus, Search, Wrench } from 'lucide-react'
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
  assignedOperator?: { fullName: string } | null
}

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  under_maintenance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  retired: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export default function EquipmentPage() {
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<any>(null)

  async function fetchEquipment() {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (filterType) params.append('type', filterType)

      const res = await fetch(`/api/equipment?${params.toString()}`)
      const data = await res.json()
      if (data.success) setEquipment(data.data)
    } catch {
      console.error('Failed to fetch equipment')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me')
        const json = await res.json()
        if (json.success) setUser(json.data || json.user)
      } catch (err) {
        console.error('Failed to fetch user:', err)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    fetchEquipment()
  }, [filterStatus, filterType])

  const filtered = equipment.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.model.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    total: equipment.length,
    active: equipment.filter((e) => e.status === 'active').length,
    maintenance: equipment.filter((e) => e.status === 'under_maintenance').length,
    retired: equipment.filter((e) => e.status === 'retired').length,
  }

  const handleExportCSV = () => {
    const csv = Papa.unparse(filtered.map(e => ({
      ID: e.id,
      Name: e.name,
      Type: e.type,
      Model: e.model,
      'Serial Number': e.serialNumber,
      Year: e.year,
      Status: e.status,
      'Odometer (km)': e.currentOdometer,
      'Engine (hrs)': e.currentHours,
      Operator: e.assignedOperator?.fullName || 'Unassigned'
    })))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'fleet_export.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/equipment/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: results.data.map((row: any) => ({
                name: row.Name || row.name,
                type: row.Type || row.type || 'excavator',
                model: row.Model || row.model,
                serialNumber: row['Serial Number'] || row.serialNumber,
                year: parseInt(row.Year || row.year) || new Date().getFullYear()
              }))
            })
          })
          const payload = await res.json()
          if (payload.success) {
            alert(`Imported ${payload.imported} items. Errors/Duplicates: ${payload.errors}`)
            fetchEquipment()
          } else {
            alert(payload.error || 'Import failed')
          }
        } catch {
          alert('Network or import error')
        } finally {
          setImporting(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fleet & Equipment</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Manage all vehicles and heavy equipment</p>
          </div>
          {user && user.role !== 'operator' && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold bg-white hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Upload size={16} /> {importing ? 'Importing...' : 'Import CSV'}
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold bg-white hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                onClick={() => router.push('/equipment/new')}
                className="px-5 py-2.5 rounded-xl text-white font-semibold bg-orange-500 hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center gap-2"
              >
                <Plus size={16} /> Add Equipment
              </button>
            </div>
          )}
          {user && user.role === 'operator' && (
            <div className="flex gap-3 text-sm">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold bg-white hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Fleet', value: counts.total, color: 'text-slate-900', bg: 'bg-white border border-slate-100' },
            { label: 'Active', value: counts.active, color: 'text-emerald-700', bg: 'bg-emerald-50/50 border border-emerald-100' },
            { label: 'In Maintenance', value: counts.maintenance, color: 'text-amber-700', bg: 'bg-amber-50/50 border border-amber-100' },
            { label: 'Retired', value: counts.retired, color: 'text-slate-500', bg: 'bg-slate-50 border border-slate-100' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-5 shadow-sm hover:-translate-y-0.5 transition-all duration-300`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, model or serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="under_maintenance">Under Maintenance</option>
            <option value="retired">Retired</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-slate-800 bg-white"
          >
            <option value="">All Types</option>
            <option value="excavator">Excavator</option>
            <option value="bulldozer">Bulldozer</option>
            <option value="grader">Grader</option>
            <option value="truck">Truck</option>
            <option value="tipper_truck">Tipper Truck</option>
          </select>
        </div>

        {/* Equipment list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400 font-medium">Loading equipment...</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
                <Wrench className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No equipment found</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Add your first piece of equipment to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/75 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Serial No.</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Odometer</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Operator</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => router.push(`/equipment/${e.id}`)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/40 flex items-center justify-center text-slate-500 shadow-sm">
                            <EquipmentIcon type={e.type} className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{e.name}</p>
                            <p className="text-xs text-slate-400 font-medium">{e.model} · {e.year}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-650">{e.serialNumber}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusStyles[e.status]}`}>
                          {e.status === 'under_maintenance' ? 'Maintenance' : e.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-650">{e.currentOdometer.toLocaleString()} km</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-650">{e.currentHours.toLocaleString()} hrs</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-650">
                        {e.assignedOperator?.fullName || <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="px-6 py-4" onClick={(evt) => evt.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/equipment/${e.id}`)}
                          className="text-xs text-orange-500 hover:text-orange-700 font-bold"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}