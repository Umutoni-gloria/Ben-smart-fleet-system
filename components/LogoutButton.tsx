'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-colors bg-gray-900 text-white hover:bg-gray-800"
    >
      {loading ? 'Logging out...' : 'Log Out'}
    </button>
  )
}
