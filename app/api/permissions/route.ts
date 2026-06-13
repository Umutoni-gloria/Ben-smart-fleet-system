import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Seed basic permissions if none exist
    const count = await prisma.permission.count()
    if (count === 0) {
      await prisma.permission.createMany({
        data: [
          { name: 'create_equipment', module: 'equipment', description: 'Can create equipment' },
          { name: 'delete_equipment', module: 'equipment', description: 'Can delete equipment' },
          { name: 'approve_schedules', module: 'maintenance', description: 'Can approve maintenance schedules' },
          { name: 'view_reports', module: 'reports', description: 'Can view administrative reports' },
          { name: 'manage_users', module: 'users', description: 'Can manage system users' },
        ],
        skipDuplicates: true
      })
    }

    const permissions = await prisma.permission.findMany({
      include: { roles: true }
    })
    
    return NextResponse.json({ success: true, data: permissions })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { role, permissionId, action } = await req.json()
    
    if (action === 'grant') {
      await prisma.rolePermission.create({
        data: { role, permissionId }
      })
    } else {
      await prisma.rolePermission.delete({
        where: { role_permissionId: { role, permissionId } }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
