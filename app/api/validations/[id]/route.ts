import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const validation = await prisma.userValidation.findUnique({
      where: { id },
    })

    if (!validation) {
      return NextResponse.json(
        { error: 'Validation not found' },
        { status: 404 }
      )
    }

    if (validation.isUsed) {
      return NextResponse.json(
        { error: 'Cannot delete a validation that has already been used' },
        { status: 400 }
      )
    }

    await prisma.userValidation.delete({
      where: { id },
    })

    await logAction(
      session.id,
      'DELETE_VALIDATION',
      'validations',
      `Removed ${validation.email} from validation table`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete validation error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}