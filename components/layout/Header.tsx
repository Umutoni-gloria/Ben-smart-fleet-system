'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { translations, Locale } from '@/lib/translations'
import { Moon, Sun, Settings as SettingsIcon, LogOut } from 'lucide-react'

export default function Header({ user, lang = 'en' }: { user: any; lang: Locale }) {
  const [dark, setDark] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()

  const t = translations[lang] || translations.en

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  function toggleDark() {
    if (dark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setDark(true)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch {
      console.error('Logout failed')
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleLanguageChange(newLang: string) {
    try {
      // Optimistically update cookie
      document.cookie = `lang=${newLang}; path=/; max-age=31536000; SameSite=Lax`
      
      // Update in DB
      await fetch('/api/users/preferred-language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: newLang }),
      })
      
      // Refresh Next.js server components
      router.refresh()
    } catch (err) {
      console.error('Failed to save language preference:', err)
    }
  }

  return (
    <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-40 transition-colors shadow-sm">
      <div className="flex-1">
        {/* Can put breadcrumbs or search here */}
      </div>

      <div className="flex items-center gap-4">
        {/* Language Selector */}
        <select
          value={lang}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm outline-none bg-white text-gray-800 font-medium cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="rw">RW</option>
        </select>

        <button 
          onClick={toggleDark}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-100 text-gray-600"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <div className="relative">
          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-orange-100">
              {user.fullName.charAt(0)}
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 flex flex-col z-50">
              <div className="px-4 py-3 border-b border-gray-50 mb-1">
                <p className="text-xs font-semibold text-gray-900 truncate">{user.email}</p>
              </div>
              <button 
                onClick={() => router.push(`/settings`)}
                className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <SettingsIcon size={14} className="text-gray-500" /> {t.settings}
              </button>
              <button 
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <LogOut size={14} /> {loggingOut ? t.endingSession : t.signOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
