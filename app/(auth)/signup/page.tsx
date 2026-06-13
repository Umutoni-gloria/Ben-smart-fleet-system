'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { translations, Locale } from '@/lib/translations'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<Locale>('en')

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )lang=([^;]*)/)
    if (match && (match[1] === 'en' || match[1] === 'fr' || match[1] === 'rw')) {
      setLang(match[1] as Locale)
    }
  }, [])

  const t = translations[lang] || translations.en

  function handleLanguageChange(newLang: Locale) {
    setLang(newLang)
    document.cookie = `lang=${newLang}; path=/; max-age=31536000; SameSite=Lax`
  }

  async function handleEmailBlur() {
    if (!email) return
    setError('')
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (data.role) {
        setRole(data.role)
        setError('')
      } else {
        setRole('')
        setError('This email is not registered. Contact your admin.')
      }
    } catch {
      setError('Could not verify email.')
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!role) {
      setError('This email is not pre-registered. Please enter a valid pre-registered email address to resolve your role first.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Signup failed')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans">
      {/* Left Panel: Form (45%) */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between bg-white px-6 py-8 md:px-12 lg:px-16 relative min-h-screen animate-fadeIn">
        {/* Top Header: Logo on Left, Language Switcher on Right */}
        <div className="flex justify-between items-center w-full select-none mb-12">
          {/* Logo at Top-Left */}
          <div className="flex items-center">
            <img src="/logo.png" alt="Ben Supply Ltd Logo" className="h-9 w-auto object-contain" />
            <div className="ml-2.5">
              <div className="text-base font-bold text-slate-900 leading-tight">Ben Supply Ltd</div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wide">Smart Fleet & Equipment Maintenance</div>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${lang === 'en' ? 'text-[#f97316] bg-orange-50 font-bold' : 'text-slate-450 hover:text-slate-700'}`}
            >
              EN
            </button>
            <span className="text-slate-200">/</span>
            <button
              type="button"
              onClick={() => handleLanguageChange('fr')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${lang === 'fr' ? 'text-[#f97316] bg-orange-50 font-bold' : 'text-slate-450 hover:text-slate-700'}`}
            >
              FR
            </button>
            <span className="text-slate-200">/</span>
            <button
              type="button"
              onClick={() => handleLanguageChange('rw')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${lang === 'rw' ? 'text-[#f97316] bg-orange-50 font-bold' : 'text-slate-450 hover:text-slate-700'}`}
            >
              RW
            </button>
          </div>
        </div>

        {/* Center Form Container */}
        <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-center">
          {/* Form Tabs */}
          <div className="flex border-b border-slate-100 mb-6">
            <Link
              href="/login"
              className="flex-1 text-center pb-2.5 text-xs font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-all"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex-1 text-center pb-2.5 text-xs font-bold border-b-2 border-[#f97316] text-[#f97316] uppercase tracking-wider transition-all"
            >
              Create account
            </Link>
          </div>

          {/* Headings */}
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create your account</h2>
            <p className="text-xs text-slate-450 mt-1">Fill in your details to get started</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Doe"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all duration-150 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                required
                placeholder="you@bensupply.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all duration-150 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Role</label>
              <input
                type="text"
                value={role ? role.charAt(0).toUpperCase() + role.slice(1) : ''}
                readOnly
                placeholder="Auto-filled from your email"
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none text-slate-500 cursor-not-allowed select-none placeholder:text-slate-400"
              />
            </div>

            {/* Passwords - 2 column grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all duration-150 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316] transition-all duration-150 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-xs text-red-700 bg-red-50 border border-red-200/60 p-3 rounded-lg font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-bold text-sm bg-[#f97316] hover:bg-orange-600 active:bg-orange-700 shadow-sm hover:shadow-md hover:shadow-orange-500/10 active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-60 mt-1"
            >
              {loading ? t.creatingAccount : 'Create Account'}
            </button>
          </form>

          {/* Bottom link */}
          <div className="mt-5 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="text-[#f97316] font-bold hover:underline transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Form Panel Footer */}
        <div className="text-center text-[10px] text-slate-400 mt-6 select-none">
          © {new Date().getFullYear()} Ben Supply Ltd. All rights reserved.
        </div>
      </div>

      {/* Right Panel: Clean, high-clarity background image (55%) */}
      <div 
        className="w-full lg:w-[55%] hidden lg:block relative overflow-hidden bg-slate-900"
      >
        <div 
          className="absolute inset-0 bg-no-repeat bg-cover bg-center select-none"
          style={{ 
            backgroundImage: "url('/truck.jpg')",
            filter: 'contrast(1.06) brightness(1.03) saturate(1.05)'
          }}
        />
        {/* Subtle, highly transparent gradient for visual depth only */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent pointer-events-none" />
      </div>
    </div>
  )
}