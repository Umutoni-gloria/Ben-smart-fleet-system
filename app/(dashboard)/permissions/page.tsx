'use client'

import { useState, useEffect, useCallback } from 'react'

export default function PermissionsMatrix() {
  const [permissions, setPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const roles = ['admin', 'manager', 'technician', 'operator']

  const fetchPermissions = useCallback(async () => {
    const res = await fetch('/api/permissions')
    const json = await res.json()
    if (json.success) setPermissions(json.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  async function togglePermission(permissionId: string, role: string, currentlyHas: boolean) {
    const action = currentlyHas ? 'revoke' : 'grant'
    // Optimistically update
    setPermissions(prev => prev.map(p => {
      if (p.id === permissionId) {
        if (action === 'grant') {
          return { ...p, roles: [...p.roles, { role, permissionId }] }
        } else {
          return { ...p, roles: p.roles.filter((r: any) => r.role !== role) }
        }
      }
      return p
    }))
    
    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionId, role, action })
    })
    
    if (!res.ok) {
      alert("Failed to update permission")
      fetchPermissions() // Revert
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Role Permissions Matrix</h1>
          <p className="text-sm text-gray-500 mt-1">Manage granular access controls for each role</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? <div className="p-6 text-gray-400 text-sm">Loading matrix...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100 uppercase text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-6 py-4 text-left">Permission</th>
                    <th className="px-6 py-4 text-left">Module</th>
                    {roles.map(r => (
                      <th key={r} className="px-6 py-4 text-center">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {permissions.map((p) => {
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">{p.module}</span>
                        </td>
                        {roles.map(r => {
                          const hasPerm = p.roles.some((rp: any) => rp.role === r)
                          return (
                            <td key={r} className="px-6 py-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={hasPerm}
                                onChange={() => togglePermission(p.id, r, hasPerm)}
                                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
