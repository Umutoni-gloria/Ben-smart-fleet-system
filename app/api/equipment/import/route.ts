import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data } = await req.json()
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    let imported = 0
    let errors = 0
    
    for (const item of data) {
      if (!item.name || !item.type || !item.serialNumber || !item.year) {
        errors++
        continue
      }
      
      const existing = await prisma.equipment.findUnique({
        where: { serialNumber: String(item.serialNumber) }
      })
      if (!existing) {
        await prisma.equipment.create({
          data: {
            name: String(item.name),
            type: String(item.type).toLowerCase() as any,
            model: String(item.model || 'Unknown'),
            serialNumber: String(item.serialNumber),
            year: Number(item.year) || new Date().getFullYear(),
          }
        })
        imported++
      } else {
        errors++
      }
    }

    await logAction(session.id, 'IMPORT_EQUIPMENT', 'equipment', `Imported ${imported} equipment records`)

    return NextResponse.json({ success: true, imported, errors })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
