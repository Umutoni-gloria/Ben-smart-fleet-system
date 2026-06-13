'use client'

import { translations, Locale } from '@/lib/translations'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Truck,
  Wrench,
  CalendarDays,
  Fuel,
  Clock,
  Bell,
  BarChart3,
  Users,
  Building2,
  Shield,
  CheckSquare,
  Settings,
  ChevronsRight,
  ChevronsLeft,
  LucideIcon,
} from 'lucide-react'

type NavItem = {
  label: string
  translationKey: keyof typeof translations.en
  path: string
  icon: LucideIcon
  roles: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard',       translationKey: 'dashboard',       path: '/dashboard',   icon: LayoutDashboard, roles: ['admin', 'manager', 'technician', 'operator'] },
  { label: 'Fleet & Equipment', translationKey: 'fleetEquipment', path: '/equipment',   icon: Truck,           roles: ['admin', 'manager', 'technician', 'operator'] },
  { label: 'Maintenance Logs', translationKey: 'maintenanceLogs', path: '/maintenance', icon: Wrench,          roles: ['admin', 'manager', 'technician'] },
  { label: 'Service Schedules', translationKey: 'serviceSchedules', path: '/schedules', icon: CalendarDays,    roles: ['admin', 'manager', 'technician'] },
  { label: 'Fuel Logs',       translationKey: 'fuelLogs',        path: '/fuel',         icon: Fuel,            roles: ['admin', 'manager', 'operator'] },
  { label: 'Usage / Shifts',  translationKey: 'usageShifts',     path: '/usage',        icon: Clock,           roles: ['admin', 'manager', 'operator'] },
  { label: 'Alerts',          translationKey: 'alerts',          path: '/alerts',       icon: Bell,            roles: ['admin', 'manager'] },
  { label: 'Reports',         translationKey: 'reports',         path: '/reports',      icon: BarChart3,       roles: ['admin', 'manager'] },
  { label: 'User Management', translationKey: 'userManagement',  path: '/users',        icon: Users,           roles: ['admin'] },
  { label: 'Departments',     translationKey: 'departments',     path: '/departments',  icon: Building2,       roles: ['admin'] },
  { label: 'Permissions',     translationKey: 'permissions',     path: '/permissions',  icon: Shield,          roles: ['admin'] },
  { label: 'Pre-Registration', translationKey: 'preRegistration', path: '/validations', icon: CheckSquare,     roles: ['admin'] },
  { label: 'Settings',        translationKey: 'settings',        path: '/settings',     icon: Settings,        roles: ['admin', 'manager', 'technician', 'operator'] },
]

type Props = {
  role: string
  lang: Locale
}

export default function Sidebar({ role, lang = 'en' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const filtered = navItems.filter((item) => item.roles.includes(role))
  const t = translations[lang] || translations.en

  return (
    <div
      className="flex flex-col h-screen sticky top-0 transition-all duration-300"
      style={{
        width: collapsed ? '72px' : '240px',
        backgroundColor: '#1a1a2e',
        minWidth: collapsed ? '72px' : '240px',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Ben Supply"
              width={36}
              height={36}
              className="object-contain rounded"
            />
            <div>
              <p className="text-white text-xs font-bold leading-tight">Ben Supply</p>
              <p className="text-white/40 text-xs leading-tight">Fleet System</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/50 hover:text-white ml-auto p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronsRight size={18} />
            : <ChevronsLeft size={18} />
          }
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {filtered.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
          const translatedLabel = t[item.translationKey] || item.label
          const Icon = item.icon

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
              style={{
                backgroundColor: isActive ? '#f97316' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title={collapsed ? translatedLabel : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{translatedLabel}</span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}