import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const equipmentId = searchParams.get('equipment')

    const now = new Date()
    const startDate = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const endDate = to ? new Date(to) : now

    // ── Maintenance Report ──────────────────────────────────────

    const maintenanceLogs = await prisma.maintenanceLog.findMany({
      where: {
        serviceDate: { gte: startDate, lte: endDate },
        ...(equipmentId && { equipmentId }),
      },
      select: {
        id: true,
        type: true,
        totalCost: true,
        laborCost: true,
        partsCost: true,
        serviceDate: true,
        downtimeHours: true,
        description: true,
        equipmentId: true,
        equipment: { select: { name: true, type: true } },
        technician: { select: { fullName: true } },
      },
    })

    // Group maintenance by month
    const maintenanceByMonth: Record<string, { preventive: number; corrective: number; total: number }> = {}
    maintenanceLogs.forEach((log) => {
      const month = new Date(log.serviceDate).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      })
      if (!maintenanceByMonth[month]) {
        maintenanceByMonth[month] = { preventive: 0, corrective: 0, total: 0 }
      }
      maintenanceByMonth[month].total += log.totalCost
      if (log.type === 'preventive') {
        maintenanceByMonth[month].preventive += log.totalCost
      } else {
        maintenanceByMonth[month].corrective += log.totalCost
      }
    })

    // Most expensive equipment
    const maintenanceCostByEquipment: Record<string, { name: string; cost: number; count: number }> = {}
    maintenanceLogs.forEach((log) => {
      if (!maintenanceCostByEquipment[log.equipmentId]) {
        maintenanceCostByEquipment[log.equipmentId] = {
          name: log.equipment.name,
          cost: 0,
          count: 0,
        }
      }
      maintenanceCostByEquipment[log.equipmentId].cost += log.totalCost
      maintenanceCostByEquipment[log.equipmentId].count += 1
    })

    const topMaintenanceEquipment = Object.values(maintenanceCostByEquipment)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)

    const totalMaintenanceCost = maintenanceLogs.reduce(
      (sum, log) => sum + log.totalCost, 0
    )
    const totalPreventiveCost = maintenanceLogs
      .filter((l) => l.type === 'preventive')
      .reduce((sum, log) => sum + log.totalCost, 0)
    const totalCorrectiveCost = maintenanceLogs
      .filter((l) => l.type === 'corrective')
      .reduce((sum, log) => sum + log.totalCost, 0)

    // ── Fuel Report ─────────────────────────────────────────────

    const fuelLogs = await prisma.fuelLog.findMany({
      where: {
        fuelDate: { gte: startDate, lte: endDate },
        ...(equipmentId && { equipmentId }),
      },
      select: {
        id: true,
        liters: true,
        costPerLiter: true,
        totalCost: true,
        fuelDate: true,
        odometer: true,
        projectSite: true,
        notes: true,
        equipmentId: true,
        equipment: { select: { name: true, type: true } },
        loggedBy: { select: { fullName: true } },
      },
    })

    // Group fuel by month
    const fuelByMonth: Record<string, { liters: number; cost: number }> = {}
    fuelLogs.forEach((log) => {
      const month = new Date(log.fuelDate).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      })
      if (!fuelByMonth[month]) {
        fuelByMonth[month] = { liters: 0, cost: 0 }
      }
      fuelByMonth[month].liters += log.liters
      fuelByMonth[month].cost += log.totalCost
    })

    // Most fuel consuming equipment
    const fuelByEquipment: Record<string, { name: string; liters: number; cost: number }> = {}
    fuelLogs.forEach((log) => {
      if (!fuelByEquipment[log.equipmentId]) {
        fuelByEquipment[log.equipmentId] = {
          name: log.equipment.name,
          liters: 0,
          cost: 0,
        }
      }
      fuelByEquipment[log.equipmentId].liters += log.liters
      fuelByEquipment[log.equipmentId].cost += log.totalCost
    })

    const topFuelEquipment = Object.values(fuelByEquipment)
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 5)

    const totalFuelLiters = fuelLogs.reduce((sum, log) => sum + log.liters, 0)
    const totalFuelCost = fuelLogs.reduce((sum, log) => sum + log.totalCost, 0)

    // ── Usage Report ─────────────────────────────────────────────

    const VEHICLE_TYPES = new Set(['truck', 'tipper_truck', 'pickup', 'car'])

    const usageLogs = await prisma.usageLog.findMany({
      where: {
        shiftDate: { gte: startDate, lte: endDate },
        ...(equipmentId && { equipmentId }),
      },
      select: {
        id: true,
        totalHours: true,
        startHours: true,
        endHours: true,
        idleHours: true,
        shiftDate: true,
        projectSite: true,
        equipmentId: true,
        startOdometer: true,
        endOdometer: true,
        distanceTraveled: true,
        equipment: { select: { name: true, type: true } },
        operator: { select: { fullName: true } },
      },
    })

    const vehicleLogs = usageLogs.filter((l) => VEHICLE_TYPES.has(l.equipment.type))
    const equipmentLogs = usageLogs.filter((l) => !VEHICLE_TYPES.has(l.equipment.type))

    // ── Vehicle utilization (by KM) ───────────────────────────────
    const vehicleUsageMap: Record<string, { name: string; km: number; shifts: number }> = {}
    vehicleLogs.forEach((log) => {
      if (!vehicleUsageMap[log.equipmentId]) {
        vehicleUsageMap[log.equipmentId] = { name: log.equipment.name, km: 0, shifts: 0 }
      }
      vehicleUsageMap[log.equipmentId].km += log.distanceTraveled ?? 0
      vehicleUsageMap[log.equipmentId].shifts += 1
    })

    const topVehiclesByDistance = Object.values(vehicleUsageMap)
      .sort((a, b) => b.km - a.km)
      .slice(0, 5)

    const totalKmTravelled = vehicleLogs.reduce(
      (sum, log) => sum + (log.distanceTraveled ?? 0), 0
    )
    const activeVehicleCount = new Set(vehicleLogs.map((l) => l.equipmentId)).size

    // ── Equipment utilization (by operating hours) ────────────────
    const equipmentUsageMap: Record<string, { name: string; hours: number; shifts: number }> = {}
    equipmentLogs.forEach((log) => {
      if (!equipmentUsageMap[log.equipmentId]) {
        equipmentUsageMap[log.equipmentId] = { name: log.equipment.name, hours: 0, shifts: 0 }
      }
      equipmentUsageMap[log.equipmentId].hours += log.totalHours
      equipmentUsageMap[log.equipmentId].shifts += 1
    })

    const topEquipmentByHours = Object.values(equipmentUsageMap)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)

    const totalOperatingHours = equipmentLogs.reduce(
      (sum, log) => sum + log.totalHours, 0
    )
    const activeEquipmentCount = new Set(equipmentLogs.map((l) => l.equipmentId)).size

    // Legacy aggregates (kept for backward compatibility)
    const usageByEquipment: Record<string, { name: string; hours: number; shifts: number }> = {}
    usageLogs.forEach((log) => {
      if (!usageByEquipment[log.equipmentId]) {
        usageByEquipment[log.equipmentId] = { name: log.equipment.name, hours: 0, shifts: 0 }
      }
      usageByEquipment[log.equipmentId].hours += log.totalHours
      usageByEquipment[log.equipmentId].shifts += 1
    })

    const topUsageEquipment = Object.values(usageByEquipment)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)

    const totalUsageHours = equipmentLogs.reduce(
      (sum, log) => sum + log.totalHours, 0
    )

    const totalUsageDistance = vehicleLogs.reduce(
      (sum, log) => sum + (log.distanceTraveled ?? 0), 0
    )

    // ── Schedule Compliance ──────────────────────────────────────
    const allSchedules = await prisma.serviceSchedule.findMany({
      select: { status: true },
    })

    const completed = allSchedules.filter((s) => s.status === 'completed').length
    const overdue = allSchedules.filter((s) => s.status === 'overdue').length
    const upcoming = allSchedules.filter((s) => s.status === 'upcoming').length
    const dueSoon = allSchedules.filter((s) => s.status === 'due_soon').length
    const urgent = allSchedules.filter((s) => s.status === 'urgent').length
    const total = allSchedules.length

    const complianceRate =
      total > 0 ? Math.round((completed / total) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        period: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        maintenance: {
          totalCost: totalMaintenanceCost,
          preventiveCost: totalPreventiveCost,
          correctiveCost: totalCorrectiveCost,
          totalLogs: maintenanceLogs.length,
          byMonth: maintenanceByMonth,
          topEquipment: topMaintenanceEquipment,
          logs: maintenanceLogs,
        },
        fuel: {
          totalLiters: totalFuelLiters,
          totalCost: totalFuelCost,
          totalLogs: fuelLogs.length,
          byMonth: fuelByMonth,
          topEquipment: topFuelEquipment,
          logs: fuelLogs,
        },
        usage: {
          // Legacy fields (backward-compat)
          totalHours: totalUsageHours,
          totalDistance: totalUsageDistance,
          totalShifts: usageLogs.length,
          topEquipment: topUsageEquipment,
          logs: usageLogs,
          // Split vehicle vs. equipment
          vehicles: {
            totalKmTravelled,
            activeVehicles: activeVehicleCount,
            topVehiclesByDistance,
            shifts: vehicleLogs.length,
          },
          equipment: {
            totalOperatingHours,
            activeEquipment: activeEquipmentCount,
            topEquipmentByHours,
            shifts: equipmentLogs.length,
          },
        },
        scheduleCompliance: {
          total,
          completed,
          overdue,
          upcoming,
          dueSoon,
          urgent,
          complianceRate,
        },
      },
    })
  } catch (error) {
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}