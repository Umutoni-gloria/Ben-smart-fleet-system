import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get('equipmentId')

    const warranties = await prisma.warranty.findMany({
      where: equipmentId ? { equipmentId } : undefined,
      orderBy: { endDate: 'asc' },
      include: { equipment: { select: { name: true, serialNumber: true } } }
    })
    
    return NextResponse.json({ success: true, data: warranties })
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { equipmentId, provider, startDate, endDate, terms } = body

    if (!equipmentId || !provider || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const warranty = await prisma.warranty.create({
      data: {
        equipmentId,
        provider,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        terms
      }
    })

    return NextResponse.json({ success: true, data: warranty })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create warranty' }, { status: 500 })
  }
}
