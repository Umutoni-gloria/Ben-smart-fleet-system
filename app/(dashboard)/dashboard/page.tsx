import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { translations, Locale } from '@/lib/translations'
import { 
  Truck, 
  Wrench, 
  AlertTriangle, 
  Users, 
  Coins, 
  Clock, 
  Bell, 
  Award, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Settings,
  HelpCircle,
  Briefcase,
  Fuel
} from 'lucide-react'
import EquipmentIcon from '@/components/ui/EquipmentIcon'

function getGreeting(t: any) {
  const hour = new Date().getHours()
  if (hour < 12) return t.goodMorning
  if (hour < 17) return t.goodAfternoon
  return t.goodEvening
}

function getFleetHealthScore(
  active: number,
  total: number,
  overdue: number,
  urgent: number
): { score: number; label: string; color: string; bg: string } {
  if (total === 0) return { score: 0, label: 'No Data', color: 'text-gray-500', bg: 'from-gray-400 to-gray-500' }
  const activeScore = (active / total) * 50
  const scheduleScore = Math.max(0, 50 - overdue * 10 - urgent * 5)
  const score = Math.min(100, Math.round(activeScore + scheduleScore))
  if (score >= 80) return { score, label: 'Excellent', color: 'text-green-600', bg: 'from-green-400 to-green-600' }
  if (score >= 60) return { score, label: 'Good', color: 'text-blue-600', bg: 'from-blue-400 to-blue-600' }
  if (score >= 40) return { score, label: 'Fair', color: 'text-orange-600', bg: 'from-orange-400 to-orange-600' }
  return { score, label: 'Critical', color: 'text-red-600', bg: 'from-red-400 to-red-600' }
}

function TrendIndicator({ current, previous, label, t }: { current: number; previous: number; label: string; t: any }) {
  const diff = current - previous
  const pct = previous > 0 ? Math.abs(Math.round((diff / previous) * 100)) : 0
  const up = diff > 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-red-500' : 'text-green-500'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {pct}% {t.lastMonth}
    </span>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value || 'en') as Locale
  const t = translations[lang] || translations.en

  const now = new Date()
  const greeting = getGreeting(t)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const endOfWeek = new Date(now)
  endOfWeek.setDate(now.getDate() + 7)

  const severityStyles: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  }

  const statusStyles: Record<string, string> = {
    upcoming: 'bg-green-100 text-green-700',
    due_soon: 'bg-blue-100 text-blue-700',
    urgent: 'bg-orange-100 text-orange-700',
    overdue: 'bg-red-100 text-red-700',
  }

  const typeIcons: Record<string, string> = {
    excavator: '🚜',
    bulldozer: '🏗️',
    grader: '🛣️',
    truck: '🚛',
    tipper_truck: '🚚',
  }

  // ─── ADMIN & MANAGER DASHBOARD ───────────────────────────────
  if (session.role === 'admin' || session.role === 'manager') {
    const [
      totalEquipment,
      activeEquipment,
      underMaintenance,
      overdueSchedules,
      urgentSchedules,
      maintenanceCostThisMonth,
      maintenanceCostLastMonth,
      fuelCostThisMonth,
      fuelCostLastMonth,
      upcomingThisWeek,
      recentMaintenance,
      recentAlerts,
      mostMaintained,
      usageThisMonth,
      totalUsers,
      upcomingCount,
      dueSoonCount,
      assetsRequiringMaintenance,
      completedThisMonth,
      overdueThisMonth,
    ] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: 'active' } }),
      prisma.equipment.count({ where: { status: 'under_maintenance' } }),
      prisma.serviceSchedule.findMany({
        where: { status: 'overdue' },
        include: { equipment: { select: { name: true, type: true } } },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.serviceSchedule.findMany({
        where: { status: 'urgent' },
        include: { equipment: { select: { name: true, type: true } } },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.maintenanceLog.aggregate({
        where: { serviceDate: { gte: startOfMonth } },
        _sum: { totalCost: true },
      }),
      prisma.maintenanceLog.aggregate({
        where: { serviceDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { totalCost: true },
      }),
      prisma.fuelLog.aggregate({
        where: { fuelDate: { gte: startOfMonth } },
        _sum: { totalCost: true },
      }),
      prisma.fuelLog.aggregate({
        where: { fuelDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { totalCost: true },
      }),
      prisma.serviceSchedule.findMany({
        where: {
          nextDueDate: { gte: now, lte: endOfWeek },
          status: { not: 'completed' },
        },
        include: {
          equipment: { select: { name: true, type: true } },
          technician: { select: { fullName: true } },
        },
        orderBy: { nextDueDate: 'asc' },
        take: 5,
      }),
      prisma.maintenanceLog.findMany({
        orderBy: { serviceDate: 'desc' },
        take: 5,
        include: {
          equipment: { select: { name: true, type: true } },
          technician: { select: { fullName: true } },
        },
      }),
      prisma.alert.findMany({
        where: { isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { equipment: { select: { name: true } } },
      }),
      prisma.maintenanceLog.groupBy({
        by: ['equipmentId'],
        _count: { id: true },
        _sum: { totalCost: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.usageLog.aggregate({
        where: { shiftDate: { gte: startOfMonth } },
        _sum: { totalHours: true, distanceTraveled: true },
      }),
      prisma.user.count({ where: { isActive: true } }),
      // New maintenance KPI queries
      prisma.serviceSchedule.count({ where: { status: 'upcoming' } }),
      prisma.serviceSchedule.count({ where: { status: 'due_soon' } }),
      prisma.equipment.count({
        where: {
          schedules: { some: { status: { in: ['due_soon', 'urgent', 'overdue'] } } },
        },
      }),
      prisma.serviceSchedule.count({
        where: { status: 'completed', updatedAt: { gte: startOfMonth } },
      }),
      prisma.serviceSchedule.count({
        where: { status: 'overdue', updatedAt: { gte: startOfMonth } },
      }),
    ])

    const mostMaintainedWithNames = await prisma.equipment.findMany({
      where: { id: { in: mostMaintained.map((m) => m.equipmentId) } },
      select: { id: true, name: true, type: true },
    })

    const health = getFleetHealthScore(
      activeEquipment,
      totalEquipment,
      overdueSchedules.length,
      urgentSchedules.length
    )

    const maintenanceThisMonthAmt = maintenanceCostThisMonth._sum.totalCost || 0
    const maintenanceLastMonthAmt = maintenanceCostLastMonth._sum.totalCost || 0
    const fuelThisMonthAmt = fuelCostThisMonth._sum.totalCost || 0
    const fuelLastMonthAmt = fuelCostLastMonth._sum.totalCost || 0

    // Compliance rate = completed / (completed + overdue) this month
    const complianceTotal = completedThisMonth + overdueThisMonth
    const complianceRate = complianceTotal > 0
      ? Math.round((completedThisMonth / complianceTotal) * 100)
      : 100

    const adminQuickActions = [
      { label: '+ Equipment', href: '/equipment/new', color: 'bg-blue-600 hover:bg-blue-700' },
      { label: '+ Maintenance', href: '/maintenance/new', color: 'bg-emerald-600 hover:bg-emerald-700' },
      { label: '+ Schedule', href: '/schedules/new', color: 'bg-purple-600 hover:bg-purple-700' },
      { label: '+ Fuel Log', href: '/fuel/new', color: 'bg-orange-600 hover:bg-orange-700' },
      { label: '+ Shift Log', href: '/usage/new', color: 'bg-pink-600 hover:bg-pink-700' },
      ...(session.role === 'admin'
        ? [{ label: 'Users', href: '/users', color: 'bg-slate-700 hover:bg-slate-800' }]
        : []),
    ]

    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Hero Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm border border-slate-800 gap-4">
            <div>
              <p className="text-orange-400 text-sm font-medium mb-1">
                {greeting}
              </p>
              <h1 className="text-2xl font-bold text-white">
                {session.role === 'admin' ? t.adminDashboard : t.managerDashboard}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {now.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right w-full md:w-auto">
              <div className={`inline-flex flex-col items-center bg-gradient-to-br ${health.bg} rounded-2xl px-6 py-3 shadow-sm w-full md:w-auto`}>
                <p className="text-white/80 text-xs font-medium">{t.fleetHealth}</p>
                <p className="text-white text-3xl font-bold">{health.score}%</p>
                <p className="text-white/90 text-xs font-semibold">{health.label}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {t.quickActions}
            </p>
            <div className="flex flex-wrap gap-2">
              {adminQuickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${action.color}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* KPI Cards Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: t.totalFleet,
                value: totalEquipment,
                icon: Truck,
                bg: 'bg-white border border-slate-100',
                iconBg: 'bg-slate-50 text-slate-600',
                color: 'text-slate-900',
                sub: `${activeEquipment} ${t.activeCount}`,
              },
              {
                label: t.inMaintenance,
                value: underMaintenance,
                icon: Wrench,
                bg: 'bg-amber-50/50 border border-amber-100',
                iconBg: 'bg-amber-100/50 text-amber-700',
                color: 'text-amber-800',
                sub: `${totalEquipment - activeEquipment - underMaintenance} ${t.retiredCount}`,
              },
              {
                label: t.overdueUrgent,
                value: overdueSchedules.length + urgentSchedules.length,
                icon: AlertTriangle,
                bg: overdueSchedules.length > 0 ? 'bg-rose-50/50 border border-rose-100' : 'bg-orange-50/50 border border-orange-100',
                iconBg: overdueSchedules.length > 0 ? 'bg-rose-100/50 text-rose-700' : 'bg-orange-100/50 text-orange-700',
                color: overdueSchedules.length > 0 ? 'text-rose-855' : 'text-orange-800',
                sub: `${overdueSchedules.length} ${t.overdueCount} · ${urgentSchedules.length} ${t.urgentCount}`,
              },
              {
                label: t.activeUsers,
                value: totalUsers,
                icon: Users,
                bg: 'bg-indigo-50/50 border border-indigo-100',
                iconBg: 'bg-indigo-100/50 text-indigo-700',
                color: 'text-indigo-800',
                sub: t.systemUsers,
              },
            ].map((card) => {
              const IconComponent = card.icon
              return (
                <div key={card.label} className={`${card.bg} rounded-2xl p-5 shadow-sm hover:-translate-y-0.5 transition-all duration-300`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                      <IconComponent size={16} />
                    </div>
                  </div>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{card.sub}</p>
                </div>
              )
            })}
          </div>

          {/* ── Maintenance Status KPI Row ──────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-800">Maintenance Schedule Status</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100">
              {[
                {
                  label: t.upcomingServices,
                  value: upcomingCount,
                  bg: 'bg-slate-50',
                  color: 'text-slate-800',
                  dot: 'bg-slate-400',
                },
                {
                  label: t.dueSoonServices,
                  value: dueSoonCount,
                  bg: dueSoonCount > 0 ? 'bg-blue-50' : 'bg-slate-50',
                  color: dueSoonCount > 0 ? 'text-blue-800' : 'text-slate-400',
                  dot: 'bg-blue-500',
                },
                {
                  label: t.urgentServices,
                  value: urgentSchedules.length,
                  bg: urgentSchedules.length > 0 ? 'bg-orange-50' : 'bg-slate-50',
                  color: urgentSchedules.length > 0 ? 'text-orange-800' : 'text-slate-400',
                  dot: 'bg-orange-500',
                },
                {
                  label: t.overdueServices,
                  value: overdueSchedules.length,
                  bg: overdueSchedules.length > 0 ? 'bg-rose-50' : 'bg-slate-50',
                  color: overdueSchedules.length > 0 ? 'text-rose-800' : 'text-slate-400',
                  dot: 'bg-rose-500',
                },
                {
                  label: t.assetsRequiringMaintenance,
                  value: assetsRequiringMaintenance,
                  bg: assetsRequiringMaintenance > 0 ? 'bg-amber-50' : 'bg-slate-50',
                  color: assetsRequiringMaintenance > 0 ? 'text-amber-800' : 'text-slate-400',
                  dot: 'bg-amber-500',
                },
                {
                  label: t.complianceRate,
                  value: `${complianceRate}%`,
                  bg: complianceRate >= 80 ? 'bg-emerald-50' : complianceRate >= 50 ? 'bg-yellow-50' : 'bg-rose-50',
                  color: complianceRate >= 80 ? 'text-emerald-800' : complianceRate >= 50 ? 'text-yellow-800' : 'text-rose-800',
                  dot: complianceRate >= 80 ? 'bg-emerald-500' : complianceRate >= 50 ? 'bg-yellow-500' : 'bg-rose-500',
                },
              ].map((kpi) => (
                <div key={kpi.label} className={`${kpi.bg} px-4 py-5 flex flex-col gap-1.5 hover:-translate-y-0.5 transition-all duration-200`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${kpi.dot}`} />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{kpi.label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Cards Row with Trend */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-2xl shadow-sm p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{t.maintenanceCost}</p>
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                  <Coins size={16} />
                </div>
              </div>
              <p className="text-2xl font-bold">
                RWF {maintenanceThisMonthAmt.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">{t.thisMonth}</p>
              <div className="mt-2">
                <TrendIndicator
                  current={maintenanceThisMonthAmt}
                  previous={maintenanceLastMonthAmt}
                  label="maintenance"
                  t={t}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-2xl shadow-sm p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{t.fuelCost}</p>
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                  <Fuel size={16} />
                </div>
              </div>
              <p className="text-2xl font-bold">
                RWF {fuelThisMonthAmt.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">{t.thisMonth}</p>
              <div className="mt-2">
                <TrendIndicator
                  current={fuelThisMonthAmt}
                  previous={fuelLastMonthAmt}
                  label="fuel"
                  t={t}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-2xl shadow-sm p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{t.usageHours} / Distance</p>
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                  <Clock size={16} />
                </div>
              </div>
              <p className="text-xl font-bold">
                {(usageThisMonth._sum.totalHours || 0).toLocaleString()} hrs
              </p>
              <p className="text-xl font-bold mt-1">
                {(usageThisMonth._sum.distanceTraveled || 0).toLocaleString()} km
              </p>
              <p className="text-xs text-slate-400 mt-2">{t.thisMonth}</p>
            </div>
          </div>

          {/* Overdue + Urgent list */}
          {(overdueSchedules.length > 0 || urgentSchedules.length > 0) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-l-4 border-l-rose-500">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    {t.overdueUrgentSchedules}
                  </h2>
                </div>
                <Link
                  href="/schedules"
                  className="text-xs font-semibold text-orange-500 hover:text-orange-700"
                >
                  {t.viewAll} →
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {[...overdueSchedules, ...urgentSchedules].map((s) => {
                  const due = new Date(s.nextDueDate)
                  const diff = Math.ceil(
                    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <div
                      key={s.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                          <EquipmentIcon type={s.equipment.type} className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {s.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {s.equipment.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusStyles[s.status]}`}
                        >
                          {s.status.replace('_', ' ')}
                        </span>
                        <p
                          className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-rose-500' : 'text-orange-500'}`}
                        >
                          {diff < 0
                            ? `${Math.abs(diff)}d ${t.overdueCount}`
                            : `${diff}d ${lang === 'rw' ? 'bisigaye' : lang === 'fr' ? 'restants' : 'left'}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Due This Week */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    {t.dueThisWeek}
                  </h2>
                </div>
                <Link
                  href="/schedules"
                  className="text-xs font-semibold text-orange-500 hover:text-orange-700"
                >
                  {t.viewAll} →
                </Link>
              </div>
              {upcomingThisWeek.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">
                    {t.noSchedules}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingThisWeek.map((s) => (
                    <div
                      key={s.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {s.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {s.equipment.name} · {s.technician.fullName}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                        {new Date(s.nextDueDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unread Alerts */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    {t.unreadAlerts}
                  </h2>
                  {recentAlerts.length > 0 && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                      {recentAlerts.length}
                    </span>
                  )}
                </div>
                <Link
                  href="/alerts"
                  className="text-xs font-semibold text-orange-500 hover:text-orange-700"
                >
                  {t.viewAll} →
                </Link>
              </div>
              {recentAlerts.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">
                    {t.noAlerts}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="px-6 py-4 flex items-start justify-between gap-2 hover:bg-slate-50/50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {alert.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {alert.equipment?.name || 'System'} ·{' '}
                          {new Date(alert.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${severityStyles[alert.severity]}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Recent Maintenance */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    {t.recentMaintenance}
                  </h2>
                </div>
                <Link
                  href="/maintenance"
                  className="text-xs font-semibold text-orange-500 hover:text-orange-700"
                >
                  {t.viewAll} →
                </Link>
              </div>
              {recentMaintenance.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-400 font-medium">
                  {t.noMaintenance}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentMaintenance.map((log) => (
                    <div
                      key={log.id}
                      className="px-6 py-4 flex items-start justify-between gap-2 hover:bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                          <EquipmentIcon type={log.equipment.type} className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {log.equipment.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {log.technician.fullName} ·{' '}
                            {new Date(log.serviceDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${log.type === 'preventive' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}
                        >
                          {log.type}
                        </span>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          RWF {log.totalCost.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most Maintained Equipment */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    {t.mostMaintained}
                  </h2>
                </div>
              </div>
              {mostMaintained.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-400 font-medium">
                  {t.noMostMaintained}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {mostMaintained.map((m, index) => {
                    const eq = mostMaintainedWithNames.find(
                      (e) => e.id === m.equipmentId
                    )
                    if (!eq) return null
                    const maxCount = mostMaintained[0]._count.id
                    const width = Math.round((m._count.id / maxCount) * 100)
                    return (
                      <div key={m.equipmentId} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-300">
                              #{index + 1}
                            </span>
                            <EquipmentIcon type={eq.type} className="w-4 h-4 text-slate-500" />
                            <p className="text-sm font-semibold text-slate-900">
                              {eq.name}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-slate-700">
                            RWF {(m._sum.totalCost || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-orange-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                          {m._count.id} {m._count.id > 1 ? t.servicesPlural : t.services}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ─── TECHNICIAN DASHBOARD ─────────────────────────────────────
  if (session.role === 'technician') {
    const [
      mySchedules,
      myOverdue,
      myUrgent,
      myDueSoon,
      myCompletedThisMonth,
      myUpcomingThisWeek,
      myRecentLogs,
    ] = await Promise.all([
      prisma.serviceSchedule.count({
        where: { technicianId: session.id, status: { not: 'completed' } },
      }),
      prisma.serviceSchedule.count({
        where: { technicianId: session.id, status: 'overdue' },
      }),
      prisma.serviceSchedule.count({
        where: { technicianId: session.id, status: 'urgent' },
      }),
      prisma.serviceSchedule.count({
        where: { technicianId: session.id, status: 'due_soon' },
      }),
      prisma.serviceSchedule.count({
        where: {
          technicianId: session.id,
          status: 'completed',
          updatedAt: { gte: startOfMonth },
        },
      }),
      prisma.serviceSchedule.findMany({
        where: {
          technicianId: session.id,
          nextDueDate: { gte: now, lte: endOfWeek },
          status: { not: 'completed' },
        },
        include: {
          equipment: { select: { name: true, type: true } },
        },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.maintenanceLog.findMany({
        where: { technicianId: session.id },
        orderBy: { serviceDate: 'desc' },
        take: 5,
        include: { equipment: { select: { name: true, type: true } } },
      }),
    ])

    const pendingTasks = [
      { label: t.overdueCount, count: myOverdue, color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50/50 border border-rose-100' },
      { label: t.urgentCount, count: myUrgent, color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50/50 border border-orange-100' },
      { label: lang === 'rw' ? 'Ibyo Gukorwa Vuba' : lang === 'fr' ? 'Prévu Bientôt' : 'Due Soon', count: myDueSoon, color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50/50 border border-blue-100' },
    ].filter((t) => t.count > 0)

    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Hero Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 shadow-sm border border-slate-800">
            <p className="text-orange-400 text-sm font-medium mb-1">
              {greeting}
            </p>
            <h1 className="text-2xl font-bold text-white">{t.techDashboard}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {now.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Pending Tasks with Priority Colors */}
          {pendingTasks.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {lang === 'rw' ? 'Gahunda zikwiye kwitabwaho vuba' : lang === 'fr' ? 'Tâches en attente nécessitant une attention' : 'Pending Tasks Requiring Attention'}
              </p>
              <div className="flex flex-wrap gap-3">
                {pendingTasks.map((task) => (
                  <Link
                    key={task.label}
                    href="/schedules"
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl ${task.bg} transition-all hover:opacity-80`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${task.color}`} />
                    <p className={`text-sm font-semibold ${task.text}`}>
                      {task.count} {task.label}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: lang === 'rw' ? 'Gahunda Zikora' : lang === 'fr' ? 'Calendriers Actifs' : 'Active Schedules', value: mySchedules, icon: Calendar, bg: 'bg-white border border-slate-100', iconBg: 'bg-slate-50 text-slate-600', color: 'text-slate-900' },
              { label: lang === 'rw' ? 'Byatinze' : lang === 'fr' ? 'En retard' : 'Overdue', value: myOverdue, icon: AlertCircle, bg: myOverdue > 0 ? 'bg-rose-50/50 border border-rose-100' : 'bg-white border border-slate-100', iconBg: myOverdue > 0 ? 'bg-rose-100/50 text-rose-700' : 'bg-slate-50 text-slate-400', color: myOverdue > 0 ? 'text-rose-800' : 'text-slate-400' },
              { label: lang === 'rw' ? 'Byihutirwa' : lang === 'fr' ? 'Urgent' : 'Urgent', value: myUrgent, icon: AlertTriangle, bg: myUrgent > 0 ? 'bg-orange-50/50 border border-orange-100' : 'bg-white border border-slate-100', iconBg: myUrgent > 0 ? 'bg-orange-100/50 text-orange-700' : 'bg-slate-50 text-slate-400', color: myUrgent > 0 ? 'text-orange-800' : 'text-slate-400' },
              { label: lang === 'rw' ? 'Byarangiye Uyu Kwezi' : lang === 'fr' ? 'Complété ce mois-ci' : 'Completed This Month', value: myCompletedThisMonth, icon: CheckCircle2, bg: 'bg-emerald-50/50 border border-emerald-100', iconBg: 'bg-emerald-100/50 text-emerald-700', color: 'text-emerald-800' },
            ].map((card) => {
              const IconComp = card.icon
              return (
                <div key={card.label} className={`${card.bg} rounded-2xl p-5 shadow-sm hover:-translate-y-0.5 transition-all duration-300`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                      <IconComp size={16} />
                    </div>
                  </div>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Tasks Due This Week */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    My Tasks Due This Week
                  </h2>
                </div>
                <Link
                  href="/schedules"
                  className="text-xs font-semibold text-orange-500 hover:text-orange-700"
                >
                  View all →
                </Link>
              </div>
              {myUpcomingThisWeek.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">
                    No tasks due this week — you are all caught up!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myUpcomingThisWeek.map((s) => (
                    <div
                      key={s.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                          <EquipmentIcon type={s.equipment.type} className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {s.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {s.equipment.name}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                        {new Date(s.nextDueDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Maintenance */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">
                    My Recent Maintenance
                  </h2>
                </div>
                <Link
                  href="/maintenance"
                  className="text-xs font-semibold text-orange-500 hover:text-orange-700"
                >
                  View all →
                </Link>
              </div>
              {myRecentLogs.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-400 font-medium">
                  No maintenance logged yet
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myRecentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                          <EquipmentIcon type={log.equipment.type} className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {log.equipment.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(log.serviceDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${log.type === 'preventive' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}
                      >
                        {log.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ─── OPERATOR DASHBOARD ───────────────────────────────────────
  const myEquipment = await prisma.equipment.findMany({
    where: { assignedOperatorId: session.id },
    include: {
      schedules: {
        where: { status: { not: 'completed' } },
        orderBy: { nextDueDate: 'asc' },
        take: 5,
      },
      fuelLogs: {
        orderBy: { fuelDate: 'desc' },
        take: 3,
      },
    },
  })

  // Helper: compute next-service info for an equipment card
  function getNextServiceInfo(eq: typeof myEquipment[number]) {
    const isVehicle = ['truck', 'tipper_truck'].includes(eq.type)
    const currentReading = isVehicle ? eq.currentOdometer : eq.currentHours

    // Pick the schedule with the least remaining usage (i.e. most urgent)
    let best: { schedule: typeof eq.schedules[number]; remaining: number } | null = null

    for (const s of eq.schedules) {
      const nextDue = isVehicle ? s.nextDueOdometer : s.nextDueHours
      if (nextDue === null) continue
      const remaining = nextDue - currentReading
      if (best === null || remaining < best.remaining) {
        best = { schedule: s, remaining }
      }
    }

    return { isVehicle, best }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 shadow-sm border border-slate-800">
          <p className="text-orange-400 text-sm font-medium mb-1">
            {greeting}
          </p>
          <h1 className="text-2xl font-bold text-white">
            {lang === 'rw' ? 'Ibikoresho Byanjye' : lang === 'fr' ? 'Mon Équipement' : 'My Equipment'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {now.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Quick Actions for Operator */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/fuel/new"
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all bg-orange-600 hover:bg-orange-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              + Log Fuel
            </Link>
            <Link
              href="/usage/new"
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              + Log Shift
            </Link>
          </div>
        </div>

        {myEquipment.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 py-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
              <Truck className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {lang === 'rw' ? 'Nta gikoresho wahawe kugeza ubu' : lang === 'fr' ? 'Aucun équipement ne vous est encore attribué' : 'No equipment assigned to you yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {lang === 'rw' ? 'Vugana n\'umuyobozi wawe kugira ngo uhabwe igikoresho' : lang === 'fr' ? 'Contactez votre responsable pour obtenir un équipement' : 'Contact your manager to get equipment assigned'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myEquipment.map((eq) => (
              <div
                key={eq.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="bg-slate-50/75 px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-600 shadow-sm">
                      <EquipmentIcon type={eq.type} className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{eq.name}</p>
                      <p className="text-xs text-slate-400 font-medium">
                        {eq.model} · {eq.year}
                      </p>
                    </div>
                    {/* Next Service Info */}
                    {(() => {
                      const { isVehicle, best } = getNextServiceInfo(eq)
                      if (!best) {
                        return (
                          <div className="text-right">
                            <p className="text-xs text-slate-400 font-medium">{t.nextService}</p>
                            <p className="text-xs text-slate-400">{t.noActiveSchedule}</p>
                          </div>
                        )
                      }
                      const { schedule, remaining } = best
                      const absRemaining = Math.abs(remaining)
                      const formattedRemaining = absRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })
                      const unit = isVehicle ? 'km' : 'hrs'
                      const statusColors: Record<string, string> = {
                        upcoming: 'bg-emerald-100 text-emerald-700',
                        due_soon: 'bg-blue-100 text-blue-700',
                        urgent: 'bg-orange-100 text-orange-700',
                        overdue: 'bg-rose-100 text-rose-700',
                      }
                      const statusColor = statusColors[schedule.status] || 'bg-slate-100 text-slate-500'
                      return (
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{t.nextService}</p>
                          <p className="text-sm font-bold text-slate-900 leading-tight">
                            {schedule.serviceType
                              ? schedule.serviceType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                              : schedule.title}
                          </p>
                          <p className={`text-xs font-semibold mt-0.5 ${remaining < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                            {remaining < 0
                              ? `${formattedRemaining} ${unit} overdue`
                              : `${formattedRemaining} ${unit} ${t.remaining}`}
                          </p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                            {schedule.status.replace('_', ' ')}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  <div className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      {lang === 'rw' ? 'Gahunda Zegereje' : lang === 'fr' ? 'Calendriers à venir' : 'Upcoming Schedules'}
                    </p>
                    {eq.schedules.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">
                        {lang === 'rw' ? 'Nta gahunda nshya zihari' : lang === 'fr' ? 'Aucun calendrier à venir' : 'No upcoming schedules'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {eq.schedules.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between"
                          >
                            <p className="text-xs text-slate-700 font-medium">{s.title}</p>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusStyles[s.status] || 'bg-slate-100 text-slate-500'}`}
                            >
                              {s.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      {lang === 'rw' ? 'Imikoreshereze ya Lisansi ya Vuba' : lang === 'fr' ? 'Carburants Récents' : 'Recent Fuel Logs'}
                    </p>
                    {eq.fuelLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">{lang === 'rw' ? 'Nta raporo za lisansi zihari' : lang === 'fr' ? 'Aucun registre de carburant' : 'No fuel logs yet'}</p>
                    ) : (
                      <div className="space-y-2">
                        {eq.fuelLogs.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between font-medium"
                          >
                            <p className="text-xs text-slate-700">
                              {f.liters}L ·{' '}
                              {new Date(f.fuelDate).toLocaleDateString()}
                            </p>
                            <p className="text-xs font-bold text-orange-600">
                              RWF {f.totalCost.toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}