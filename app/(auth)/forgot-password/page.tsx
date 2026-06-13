'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative">
      <div className="absolute inset-0">
        <Image src="/truck.jpg" alt="background" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/65" />
      </div>
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image src="/logo.png" alt="Ben Supply Ltd" width={120} height={80} className="object-contain" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Forgot Password</h1>
            <p className="text-xs mt-1 text-gray-500">Enter your email and we will send you a reset link</p>
          </div>
          {success ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 text-green-700 px-4 py-4 rounded-xl text-sm">
                Password reset link sent! Check your email inbox.
              </div>
              <a href="/login" className="block text-sm font-medium text-orange-500">
                Back to Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@bensupply.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm outline-none text-gray-900"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm bg-orange-500 disabled:bg-orange-300"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center">
                <a href="/login" className="text-sm text-orange-500">
                  Back to Login
                </a>
              </div>
            </form>
          )}
        </div>
        <p className="text-center text-white text-xs mt-4 opacity-70">
          2024 Ben Supply Ltd - Service Makes Difference
        </p>
      </div>
    </div>
  )
}