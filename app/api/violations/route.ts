/**
 * /api/violations
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  → List violations (admin/manager see all; technician sees their own)
 * POST → Admin can manually resolve a violation and optionally re-activate
 *        a suspended technician's account
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const technicianId = searchParams.get('technician')
    const isResolved = searchParams.get('resolved')

    // Technicians can only see their own violations
    const effectiveTechnicianId =
      session.role === 'technician' ? session.id : technicianId

    const violations = await prisma.technicianViolation.findMany({
      where: {
        ...(effectiveTechnicianId && { technicianId: effectiveTechnicianId }),
        ...(isResolved !== null && {
          isResolved: isResolved === 'true',
        }),
      },
      include: {
        technician: { select: { id: true, fullName: true, email: true } },
        schedule: {
          select: { id: true, title: true, equipment: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: violations })
  } catch (error) {
    console.error('Get violations error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can resolve violations
    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only Admin can resolve violations' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { violationId, reactivateAccount } = body

    if (!violationId) {
      return NextResponse.json(
        { error: 'violationId is required' },
        { status: 400 }
      )
    }

    const violation = await prisma.technicianViolation.findUnique({
      where: { id: violationId },
      include: {
        technician: { select: { id: true, fullName: true, isActive: true } },
      },
    })

    if (!violation) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 })
    }

    if (violation.isResolved) {
      return NextResponse.json(
        { error: 'This violation is already resolved' },
        { status: 409 }
      )
    }

    // Mark violation as resolved
    const resolved = await prisma.technicianViolation.update({
      where: { id: violationId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById: session.id,
      },
    })

    // Optionally re-activate the technician's account
    if (reactivateAccount === true && !violation.technician.isActive) {
      await prisma.user.update({
        where: { id: violation.technicianId },
        data: { isActive: true },
      })

      await logAction(
        session.id,
        'REACTIVATE_TECHNICIAN',
        'violations',
        `Re-activated account for ${violation.technician.fullName} after resolving violation`
      )
    }

    await logAction(
      session.id,
      'RESOLVE_VIOLATION',
      'violations',
      `Resolved ${violation.type} violation for ${violation.technician.fullName}`
    )

    return NextResponse.json({
      success: true,
      data: resolved,
      message: reactivateAccount
        ? `Violation resolved and ${violation.technician.fullName}'s account has been re-activated.`
        : `Violation marked as resolved.`,
    })
  } catch (error) {
    console.error('Resolve violation error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
