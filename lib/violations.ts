/**
 * violations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Technician punishment logic agreed with supervisor:
 *
 *  Warning  (1st offence) → A violation record is created, technician is
 *                           notified, managers/admins are alerted.
 *
 *  Suspension (2nd offence) → Technician's account isActive is set to false
 *                             (temporary deactivation). Account can be
 *                             re-activated manually by an admin.
 *
 * Termination is NOT done by the system — that is handled by HR.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'

/**
 * Issue a punishment for a technician who missed/skipped an assigned schedule.
 *
 * - If the technician has NO unresolved violations → issue a WARNING.
 * - If the technician has 1+ unresolved WARNING → issue a SUSPENSION and
 *   deactivate the account (isActive = false).
 *
 * @param technicianId  - ID of the technician
 * @param scheduleId    - The overdue schedule that triggered this violation
 * @param scheduleTitle - Human-readable schedule title for messages
 * @param equipmentName - Equipment name for messages
 */
export async function issueTechnicianViolation(
  technicianId: string,
  scheduleId: string,
  scheduleTitle: string,
  equipmentName: string
): Promise<{ type: 'warning' | 'suspension'; violationId: string }> {
  // Check how many unresolved violations the technician already has
  const existingViolations = await prisma.technicianViolation.count({
    where: {
      technicianId,
      isResolved: false,
    },
  })

  const violationType: 'warning' | 'suspension' =
    existingViolations >= 1 ? 'suspension' : 'warning'

  const reason =
    violationType === 'warning'
      ? `Missed assigned maintenance schedule: "${scheduleTitle}" on ${equipmentName}. This is your first violation — please complete your duties on time.`
      : `Repeated failure to complete assigned schedules. Account has been temporarily deactivated. Please contact your manager to resolve this.`

  // Create the violation record
  const violation = await prisma.technicianViolation.create({
    data: {
      technicianId,
      scheduleId,
      type: violationType,
      reason,
    },
    select: { id: true },
  })

  if (violationType === 'suspension') {
    // Deactivate the technician's account
    await prisma.user.update({
      where: { id: technicianId },
      data: { isActive: false },
    })
  }

  // Notify the technician
  const technicianTitle =
    violationType === 'warning'
      ? 'Violation Warning Issued'
      : 'Account Suspended — Action Required'

  await sendNotification({ userId: technicianId, title: technicianTitle, message: reason, severity: 'high', type: 'schedule_overdue' })

  // Notify all managers and admins
  const managers = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager'] }, isActive: true },
    select: { id: true, email: true },
  })

  const managerTitle =
    violationType === 'warning'
      ? `Technician Warning: Missed Schedule`
      : `Technician Suspended: Repeated Missed Schedules`

  const managerMessage =
    violationType === 'warning'
      ? `A warning has been issued to a technician for missing schedule "${scheduleTitle}" on ${equipmentName}.`
      : `A technician's account has been temporarily deactivated due to repeated missed schedules. Schedule: "${scheduleTitle}" on ${equipmentName}.`

  const managerEmails = managers.map((m) => m.email)
  await sendNotification({ emails: managerEmails, title: managerTitle, message: managerMessage, severity: 'high', type: 'schedule_overdue' })

  return { type: violationType, violationId: violation.id }
}

/**
 * Check if a technician is suspended (account deactivated due to violations).
 */
export async function isTechnicianSuspended(
  technicianId: string
): Promise<boolean> {
  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
    select: { isActive: true },
  })
  return technician ? !technician.isActive : false
}
