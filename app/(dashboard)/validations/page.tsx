'use client'

import { useEffect, useState } from 'react'

type Validation = {
  id: string
  email: string
  role: string
  isUsed: boolean
  createdAt: string
}

export default function ValidationsPage() {
  const [validations, setValidations] = useState<Validation[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('technician')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function fetchValidations() {
    try {
      const res = await fetch('/api/validations')
      const data = await res.json()
      if (data.success) setValidations(data.data)
    } catch {
      console.error('Failed to fetch validations')
    }
  }

  useEffect(() => {
    fetchValidations()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      setSuccess(`${email} added successfully as ${role}`)
      setEmail('')
      setRole('technician')
      fetchValidations()
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Remove ${email} from the validation table?`)) return
    try {
      const res = await fetch(`/api/validations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Could not delete')
        return
      }
      fetchValidations()
    } catch {
      alert('Something went wrong')
    }
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    technician: 'bg-green-100 text-green-800',
    operator: 'bg-orange-100 text-orange-800',
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Pre-Registration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add employee emails here before they sign up. The system will auto-fill their role on signup.
          </p>
        </div>

        {/* Add form */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Add New User</h2>
          <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="employee@bensupply.com"
              className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none text-gray-900"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none text-gray-900 bg-white"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="technician">Technician</option>
              <option value="operator">Operator</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-medium bg-orange-500 disabled:bg-orange-300"
            >
              {loading ? 'Adding...' : 'Add User'}
            </button>
          </form>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-3 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-xl">
              {success}
            </div>
          )}
        </div>

        {/* Validations table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Registered Emails ({validations.length})
            </h2>
          </div>
          {validations.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">
              No users pre-registered yet. Add one above.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validations.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{v.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${roleColors[v.role]}`}>
                        {v.role.charAt(0).toUpperCase() + v.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {v.isUsed ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Signed up
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!v.isUsed && (
                        <button
                          onClick={() => handleDelete(v.id, v.email)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
