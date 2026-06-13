import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const cards = await prisma.fuelCard.findMany({
      include: { assignedUser: { select: { fullName: true } } }
    })
    return NextResponse.json({ success: true, data: cards })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fuel cards' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await req.json()
    const { cardNumber, provider, assignedUserId } = body
    if (!cardNumber || !provider || !assignedUserId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const card = await prisma.fuelCard.create({
      data: { cardNumber, provider, assignedUserId }
    })
    return NextResponse.json({ success: true, data: card })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create fuel card' }, { status: 500 })
  }
}
