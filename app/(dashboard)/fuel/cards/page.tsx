'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, CreditCard } from 'lucide-react'

export default function FuelCardsPage() {
  const router = useRouter()
  const [cards, setCards] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ cardNumber: '', provider: '', assignedUserId: '' })

  useEffect(() => {
    async function fetchData() {
      const [crds, usrs] = await Promise.all([
        fetch('/api/fuel-cards').then(r => r.json()),
        fetch('/api/users').then(r => r.json())
      ])
      if (crds.success) setCards(crds.data)
      if (usrs.success) setUsers(usrs.data.filter((u: any) => u.status === 'active'))
      setLoading(false)
    }
    fetchData()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/fuel-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      window.location.reload()
    } else {
      alert("Failed to add fuel card")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Cards</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Card</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                  <input required value={form.cardNumber} onChange={e => setForm({...form, cardNumber: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <input required value={form.provider} onChange={e => setForm({...form, provider: e.target.value})} placeholder="e.g SP, Shell" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign User</label>
                  <select required value={form.assignedUserId} onChange={e => setForm({...form, assignedUserId: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none bg-white text-gray-900">
                    <option value="">- Select user -</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl text-white text-sm font-medium bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm">Assign Card</button>
              </form>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Active Fuel Cards</h2>
              {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
                cards.length === 0 ? <p className="text-sm text-gray-400">No fuel cards assigned.</p> : (
                  <div className="divide-y divide-slate-100">
                    {cards.map(c => (
                      <div key={c.id} className="py-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{c.cardNumber} <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">{c.provider}</span></p>
                          <p className="text-sm text-slate-500 mt-1">Assigned to: {c.assignedUser?.fullName || 'Unknown'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
