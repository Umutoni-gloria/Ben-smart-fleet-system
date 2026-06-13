 import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Admin@1234', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'gloriaumutoni765@gmail.com' },
    update: {},
    create: {
      fullName: 'System Admin',
      email: 'gloriaumutoni765@gmail.com',
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  })

  await prisma.userValidation.upsert({
    where: { email: 'gloriaumutoni765@gmail.com' },
    update: {},
    create: {
      email: 'gloriaumutoni765@gmail.com',
      role: 'admin',
      isUsed: true,
    },
  })

  console.log('Admin user created:', admin.email)
  console.log('Password: Admin@1234')
  console.log('Please change this password after first login!')

  // Seed default maintenance intervals
  const defaultIntervals = [
    // Vehicles
    { equipmentType: 'truck', serviceType: 'oil_change', intervalValue: 5000, intervalType: 'km' },
    { equipmentType: 'truck', serviceType: 'brake_check', intervalValue: 10000, intervalType: 'km' },
    { equipmentType: 'truck', serviceType: 'tire', intervalValue: 8000, intervalType: 'km' },
    { equipmentType: 'truck', serviceType: 'battery', intervalValue: 15000, intervalType: 'km' },
    { equipmentType: 'truck', serviceType: 'engine', intervalValue: 20000, intervalType: 'km' },

    { equipmentType: 'tipper_truck', serviceType: 'oil_change', intervalValue: 5000, intervalType: 'km' },
    { equipmentType: 'tipper_truck', serviceType: 'brake_check', intervalValue: 10000, intervalType: 'km' },
    { equipmentType: 'tipper_truck', serviceType: 'tire', intervalValue: 8000, intervalType: 'km' },
    { equipmentType: 'tipper_truck', serviceType: 'battery', intervalValue: 15000, intervalType: 'km' },
    { equipmentType: 'tipper_truck', serviceType: 'engine', intervalValue: 20000, intervalType: 'km' },

    // Heavy Equipment
    { equipmentType: 'excavator', serviceType: 'oil_change', intervalValue: 250, intervalType: 'hours' },
    { equipmentType: 'excavator', serviceType: 'hydraulic', intervalValue: 500, intervalType: 'hours' },
    { equipmentType: 'excavator', serviceType: 'brake_check', intervalValue: 500, intervalType: 'hours' },
    { equipmentType: 'excavator', serviceType: 'battery', intervalValue: 1000, intervalType: 'hours' },
    { equipmentType: 'excavator', serviceType: 'engine', intervalValue: 2000, intervalType: 'hours' },

    { equipmentType: 'bulldozer', serviceType: 'oil_change', intervalValue: 250, intervalType: 'hours' },
    { equipmentType: 'bulldozer', serviceType: 'hydraulic', intervalValue: 500, intervalType: 'hours' },
    { equipmentType: 'bulldozer', serviceType: 'brake_check', intervalValue: 500, intervalType: 'hours' },
    { equipmentType: 'bulldozer', serviceType: 'battery', intervalValue: 1000, intervalType: 'hours' },
    { equipmentType: 'bulldozer', serviceType: 'engine', intervalValue: 2000, intervalType: 'hours' },

    { equipmentType: 'grader', serviceType: 'oil_change', intervalValue: 250, intervalType: 'hours' },
    { equipmentType: 'grader', serviceType: 'hydraulic', intervalValue: 500, intervalType: 'hours' },
    { equipmentType: 'grader', serviceType: 'brake_check', intervalValue: 500, intervalType: 'hours' },
    { equipmentType: 'grader', serviceType: 'battery', intervalValue: 1000, intervalType: 'hours' },
    { equipmentType: 'grader', serviceType: 'engine', intervalValue: 2000, intervalType: 'hours' },
  ]

  for (const interval of defaultIntervals) {
    await prisma.maintenanceInterval.upsert({
      where: {
        equipmentType_serviceType: {
          equipmentType: interval.equipmentType as any,
          serviceType: interval.serviceType as any,
        },
      },
      update: {},
      create: {
        equipmentType: interval.equipmentType as any,
        serviceType: interval.serviceType as any,
        intervalValue: interval.intervalValue,
        intervalType: interval.intervalType as any,
      },
    })
  }
  console.log('Default maintenance intervals seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
