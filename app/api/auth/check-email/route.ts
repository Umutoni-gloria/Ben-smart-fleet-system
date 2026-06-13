import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const validation = await prisma.userValidation.findUnique({
      where: { email },
    })

    if (!validation || validation.isUsed) {
      return NextResponse.json({ role: null })
    }

    return NextResponse.json({ role: validation.role })
  } catch (error) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}