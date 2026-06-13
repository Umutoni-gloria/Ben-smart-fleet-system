import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { language } = body

    if (!language || !['en', 'fr', 'rw'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { preferredLanguage: language },
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('lang', language, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('Update language error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
