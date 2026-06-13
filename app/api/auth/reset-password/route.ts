import { logAction } from '@/lib/audit'
import { hashPassword } from '@/lib/hash'
import prisma from '@/lib/prisma'
import { resetPasswordSchema } from '@/lib/validators'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link.' },
        { status: 400 }
      )
    }

    if (resetToken.isUsed) {
      return NextResponse.json(
        { error: 'This reset link has already been used.' },
        { status: 400 }
      )
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    })

    await prisma.passwordResetToken.update({
      where: { token },
      data: { isUsed: true },
    })

    await logAction(
      resetToken.userId,
      'PASSWORD_RESET',
      'auth',
      'User reset their password'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}