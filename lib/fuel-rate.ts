/**
 * fuel-rate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility functions for fuel consumption rate (L/km) logic.
 *
 * Business rules agreed with supervisor:
 *  1. The system auto-calculates L/km from past FuelLog records.
 *  2. Admin can set a manual defaultFuelRate override per vehicle.
 *  3. If fewer than 2 logs exist, fall back to the admin default; if that is
 *     also absent, return null (no rate available yet).
 *  4. The daily km target is derived from the vehicle's UsageLog for that day
 *     (odometer diff), NOT a fixed per-vehicle value.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '@/lib/prisma'

/** Minimum number of fuel logs needed to trust the auto-calculated rate. */
const MIN_LOGS_FOR_AUTO_RATE = 2

/**
 * Calculate the effective fuel consumption rate (L/km) for a vehicle.
 *
 * Steps:
 *  1. Fetch the last N ordered fuel logs.
 *  2. Compute L/km for each consecutive pair (delta liters / delta km).
 *  3. Average those rates → auto rate.
 *  4. If not enough data, fall back to the admin-set defaultFuelRate.
 *
 * @returns The effective rate in L/km, or null if no data is available.
 */
export async function getEffectiveFuelRate(
  equipmentId: string
): Promise<number | null> {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { defaultFuelRate: true, fuelRateL_per_km: true },
  })

  if (!equipment) return null

  // Fetch recent logs ordered by odometer ascending so we can calculate diff
  const logs = await prisma.fuelLog.findMany({
    where: { equipmentId },
    orderBy: { odometer: 'asc' },
    select: { liters: true, odometer: true },
  })

  if (logs.length >= MIN_LOGS_FOR_AUTO_RATE) {
    const rates: number[] = []

    for (let i = 1; i < logs.length; i++) {
      const currentOdo = logs[i].odometer
      const prevOdo = logs[i - 1].odometer
      if (currentOdo !== null && prevOdo !== null) {
        const kmDiff = currentOdo - prevOdo
        if (kmDiff > 0) {
          rates.push(logs[i].liters / kmDiff)
        }
      }
    }

    if (rates.length > 0) {
      const autoRate = rates.reduce((sum, r) => sum + r, 0) / rates.length
      // Persist the auto-calculated rate back to the equipment record
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { fuelRateL_per_km: parseFloat(autoRate.toFixed(4)) },
      })
      return autoRate
    }
  }

  // Fall back to admin default if auto-calculation is not possible
  return equipment.defaultFuelRate ?? null
}

/**
 * Get the total km driven by a vehicle on a specific date from usage logs.
 * This is used as the "daily km target" to calculate expected fuel consumption.
 *
 * Uses odometer readings from FuelLog on that same day (start vs end readings),
 * since UsageLogs track hours, not km. Falls back to odometer diff in FuelLogs.
 *
 * @param equipmentId - the vehicle
 * @param date        - the date to check (any time during that day)
 * @returns km driven that day, or null if no data
 */
export async function getDailyKmDriven(
  equipmentId: string,
  date: Date
): Promise<number | null> {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  // Get all fuel logs for this vehicle on this date, ordered by odometer
  const todaysLogs = await prisma.fuelLog.findMany({
    where: {
      equipmentId,
      fuelDate: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { odometer: 'asc' },
    select: { odometer: true },
  })

  if (todaysLogs.length < 2) return null

  const minOdo = todaysLogs[0].odometer
  const maxOdo = todaysLogs[todaysLogs.length - 1].odometer
  if (minOdo === null || maxOdo === null) return null
  return maxOdo - minOdo
}

/**
 * Calculate the expected fuel consumption for a vehicle on a given day.
 *
 * expected_liters = effective_rate (L/km) × daily_km_driven
 *
 * @returns Expected liters, or null if insufficient data.
 */
export async function getExpectedDailyFuel(
  equipmentId: string,
  date: Date
): Promise<number | null> {
  const rate = await getEffectiveFuelRate(equipmentId)
  const km = await getDailyKmDriven(equipmentId, date)

  if (rate === null || km === null) return null
  return rate * km
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuel Recommendation Logic (for the fuel log form)
// ─────────────────────────────────────────────────────────────────────────────

export type EquipmentType = 'truck' | 'tipper_truck' | 'excavator' | 'bulldozer' | 'grader'

export interface BaselineRateRange {
  min: number
  max: number
  unit: 'L/km' | 'L/hr'
  isVehicle: boolean
}

/**
 * Returns the hard-coded baseline fuel consumption range for an equipment type.
 * Vehicles use L/km; heavy equipment uses L/hr.
 */
export function getBaselineRateRange(equipmentType: string): BaselineRateRange {
  const ranges: Record<string, BaselineRateRange> = {
    truck:        { min: 0.10, max: 0.20, unit: 'L/km', isVehicle: true },
    tipper_truck: { min: 0.17, max: 0.33, unit: 'L/km', isVehicle: true },
    excavator:    { min: 10,   max: 20,   unit: 'L/hr', isVehicle: false },
    bulldozer:    { min: 12,   max: 25,   unit: 'L/hr', isVehicle: false },
    grader:       { min: 10,   max: 20,   unit: 'L/hr', isVehicle: false },
  }
  return ranges[equipmentType] ?? { min: 0.10, max: 0.25, unit: 'L/km', isVehicle: true }
}

/**
 * Returns the usage amount (km or hours) logged for a specific equipment on a date.
 * For vehicles: returns km driven (from UsageLog.distanceTraveled).
 * For heavy equipment: returns hours worked (from UsageLog.totalHours).
 */
export async function getUsageForDate(
  equipmentId: string,
  equipmentType: string,
  date: Date
): Promise<{ usageAmount: number; unit: 'km' | 'hrs' } | null> {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const isVehicle = ['truck', 'tipper_truck'].includes(equipmentType)

  const usageLogs = await prisma.usageLog.findMany({
    where: {
      equipmentId,
      shiftDate: { gte: dayStart, lte: dayEnd },
    },
    select: {
      totalHours: true,
      distanceTraveled: true,
    },
  })

  if (usageLogs.length === 0) return null

  if (isVehicle) {
    const totalKm = usageLogs.reduce((sum, log) => sum + (log.distanceTraveled ?? 0), 0)
    if (totalKm <= 0) return null
    return { usageAmount: totalKm, unit: 'km' }
  } else {
    const totalHrs = usageLogs.reduce((sum, log) => sum + (log.totalHours ?? 0), 0)
    if (totalHrs <= 0) return null
    return { usageAmount: totalHrs, unit: 'hrs' }
  }
}

export interface FuelRecommendation {
  usageAmount: number
  usageUnit: 'km' | 'hrs'
  rate: number
  rateUnit: 'L/km' | 'L/hr'
  recommendedLiters: number
  rangeMin: number
  rangeMax: number
  rangeMinLiters: number
  rangeMaxLiters: number
  hasData: true
}

/**
 * Computes the full fuel recommendation for the fuel log form.
 *
 * For vehicles:  recommendedLiters = kmDriven × effectiveRate (L/km)
 * For machines:  recommendedLiters = hoursWorked × effectiveRate (L/hr)
 *
 * Falls back to the midpoint of the baseline range if no historical rate exists.
 */
export async function getRecommendedFuel(
  equipmentId: string,
  equipmentType: string,
  date: Date
): Promise<FuelRecommendation | null> {
  const usage = await getUsageForDate(equipmentId, equipmentType, date)
  if (!usage) return null

  const baseline = getBaselineRateRange(equipmentType)
  const isVehicle = baseline.isVehicle

  // Use effective rate from history if available, else midpoint of baseline
  let rate: number
  if (isVehicle) {
    const historicalRate = await getEffectiveFuelRate(equipmentId)
    rate = historicalRate ?? (baseline.min + baseline.max) / 2
  } else {
    // For heavy equipment: use defaultFuelRate from DB, else midpoint
    const eq = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { defaultFuelRate: true },
    })
    rate = eq?.defaultFuelRate ?? (baseline.min + baseline.max) / 2
  }

  const recommendedLiters = rate * usage.usageAmount

  return {
    usageAmount: usage.usageAmount,
    usageUnit: usage.unit,
    rate,
    rateUnit: baseline.unit,
    recommendedLiters,
    rangeMin: baseline.min,
    rangeMax: baseline.max,
    rangeMinLiters: baseline.min * usage.usageAmount,
    rangeMaxLiters: baseline.max * usage.usageAmount,
    hasData: true,
  }
}

