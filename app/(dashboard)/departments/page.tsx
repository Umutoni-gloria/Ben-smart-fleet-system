'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DepartmentsPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', description: '' })

  useEffect(() => {
    async function fetchDeps() {
      const res = await fetch('/api/departments')
      const json = await res.json()
      if (json.success) setDepartments(json.data)
      setLoading(false)
    }
    fetchDeps()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      window.location.reload()
    } else {
      alert("Failed to add department")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add Department</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none" />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600">Create</button>
              </form>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">All Departments</h2>
              </div>
              {loading ? <div className="p-6 text-sm text-gray-400">Loading...</div> : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3 text-center">Users</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {departments.map((dep) => (
                      <tr key={dep.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900 text-sm">{dep.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{dep.description || '—'}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
                          {dep._count.users}
                        </td>
                      </tr>
                    ))}
                    {departments.length === 0 && (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">No departments found</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
