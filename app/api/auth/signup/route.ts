import { logAction } from '@/lib/audit'
import { signJWT } from '@/lib/auth'
import { hashPassword } from '@/lib/hash'
import prisma from '@/lib/prisma'
import { signupSchema } from '@/lib/validators'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { fullName, email, password, role } = parsed.data

    const validation = await prisma.userValidation.findUnique({
      where: { email },
    })

    if (!validation) {
      return NextResponse.json(
        { error: 'Your email is not registered. Please contact your admin.' },
        { status: 403 }
      )
    }

    if (validation.isUsed) {
      return NextResponse.json(
        { error: 'This email has already been used to create an account.' },
        { status: 403 }
      )
    }

    if (validation.role !== role) {
      return NextResponse.json(
        { error: 'The role you selected does not match your registration.' },
        { status: 403 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role,
      },
    })

    await prisma.userValidation.update({
      where: { email },
      data: { isUsed: true },
    })

    const token = await signJWT({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    await logAction(user.id, 'SIGNUP', 'auth', 'New user registered')

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    response.cookies.set('lang', 'en', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}