import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const validations = await prisma.userValidation.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: validations })
  } catch (error) {
    console.error('Get validations error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    const existing = await prisma.userValidation.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 409 }
      )
    }

    const validation = await prisma.userValidation.create({
      data: {
        email,
        role,
        createdById: session.id,
      },
    })

    await logAction(
      session.id,
      'CREATE_VALIDATION',
      'validations',
      `Added ${email} as ${role}`
    )

    return NextResponse.json({ success: true, data: validation })
  } catch (error) {
    console.error('Create validation error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}