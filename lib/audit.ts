import prisma from './prisma'

export async function logAction(
  userId: string,
  action: string,
  module: string,
  details?: string,
  ipAddress?: string
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      module,
      details,
      ipAddress,
    },
  })
}