import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        notificationPrefs: true,
        updatedAt: true,
        maintenanceLogs: {
          orderBy: { serviceDate: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            description: true,
            serviceDate: true,
            totalCost: true,
            equipment: { select: { name: true } },
          },
        },
        assignedSchedules: {
          where: { status: { not: 'completed' } },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            nextDueDate: true,
            equipment: { select: { name: true } },
          },
        },
        assignedEquipment: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            action: true,
            module: true,
            details: true,
            createdAt: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    if (session.role !== 'admin' && session.id !== id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent admin from deactivating themselves
    if (id === session.id && body.isActive === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Prevent changing own role
    if (id === session.id && body.role && body.role !== session.role) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.role && session.role === 'admin' && { role: body.role as never }),
        ...(body.isActive !== undefined && session.role === 'admin' && { isActive: body.isActive }),
        ...(body.fullName && { fullName: body.fullName }),
        ...(body.notificationPrefs !== undefined && { notificationPrefs: body.notificationPrefs }),
        ...(body.preferredLanguage && { preferredLanguage: body.preferredLanguage }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        preferredLanguage: true,
      },
    })

    await logAction(
      session.id,
      'UPDATE_USER',
      'users',
      `Updated user ${existing.email} — ${JSON.stringify(body)}`
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    if (id === session.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Deactivate instead of hard delete to preserve data integrity
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    await logAction(
      session.id,
      'DEACTIVATE_USER',
      'users',
      `Deactivated user ${existing.email}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}