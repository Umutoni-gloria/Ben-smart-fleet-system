import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'

export async function checkMaintenanceThresholds(equipmentId: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        schedules: {
          where: { status: { not: 'completed' } },
        },
      },
    })

    if (!equipment || equipment.status === 'retired') return

    // Get all configured intervals for this equipment type
    const intervals = await prisma.maintenanceInterval.findMany({
      where: { equipmentType: equipment.type },
    })


    const isVehicle = ['truck', 'tipper_truck'].includes(equipment.type)
    const currentReading = isVehicle ? equipment.currentOdometer : equipment.currentHours
    const readingUnit = isVehicle ? 'km' : 'hrs'

    for (const interval of intervals) {
      // Find active schedule for this service type
      let activeSchedule = equipment.schedules.find(
        (s) => s.serviceType === interval.serviceType
      )

      let thresholdReached = false
      let limitValue = 0

      if (activeSchedule) {
        if (interval.intervalType === 'km' && activeSchedule.nextDueOdometer !== null) {
          limitValue = activeSchedule.nextDueOdometer
          thresholdReached = equipment.currentOdometer >= activeSchedule.nextDueOdometer
        } else if (interval.intervalType === 'hours' && activeSchedule.nextDueHours !== null) {
          limitValue = activeSchedule.nextDueHours
          thresholdReached = equipment.currentHours >= activeSchedule.nextDueHours
        }
      } else {
        // No active schedule exists yet. Assume starting from 0 or last logged service
        const lastLog = await prisma.maintenanceLog.findFirst({
          where: {
            equipmentId,
            serviceType: interval.serviceType,
            type: 'preventive',
          },
          orderBy: { serviceDate: 'desc' },
        })

        // Find initial reading
        const startReading = 0
        limitValue = startReading + interval.intervalValue
        thresholdReached = currentReading >= limitValue

        if (thresholdReached) {
          // Find or assign to the first active technician
          const tech = await prisma.user.findFirst({
            where: { role: 'technician', isActive: true },
            select: { id: true },
          })

          if (tech) {
            // Create a pending recommendation schedule
            activeSchedule = await prisma.serviceSchedule.create({
              data: {
                equipmentId,
                technicianId: tech.id,
                title: `${interval.serviceType.replace('_', ' ').toUpperCase()} Service Recommendation`,
                serviceType: interval.serviceType,
                intervalType: interval.intervalType,
                intervalValue: interval.intervalValue,
                isRecurring: true,
                isApproved: false, // Unapproved = pending recommendation
                status: 'overdue',
                nextDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Recommended within 3 days
                lastOdometer: isVehicle ? 0 : null,
                nextDueOdometer: isVehicle ? limitValue : null,
                lastHours: !isVehicle ? 0 : null,
                nextDueHours: !isVehicle ? limitValue : null,
                notes: 'Automatically generated recommendation based on usage threshold.',
              },
            })
          }
        }
      }

      if (thresholdReached && activeSchedule) {
        // Update schedule status to overdue if not already overdue/urgent
        if (activeSchedule.status !== 'overdue') {
          await prisma.serviceSchedule.update({
            where: { id: activeSchedule.id },
            data: { status: 'overdue' },
          })
        }

        // Avoid duplicate alerts within last 24 hours
        const title = `Threshold Reached: ${interval.serviceType.replace('_', ' ')} due for ${equipment.name}`
        const existingAlert = await prisma.alert.findFirst({
          where: {
            equipmentId,
            title,
            isRead: false,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        })

        if (!existingAlert) {
          const recDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
          const message = `Equipment ${equipment.name} (${equipment.type}) has reached ${currentReading.toLocaleString()} ${readingUnit}, which exceeds the threshold of ${limitValue.toLocaleString()} ${readingUnit} for ${interval.serviceType.replace('_', ' ')} service. Recommended maintenance date: ${recDate}.`

          // 1. Create Dashboard Alert
          await prisma.alert.create({
            data: {
              title,
              message,
              severity: 'high',
              type: 'schedule_overdue',
              equipmentId,
            },
          })

          // 2. Notify admins/managers via email
          const managers = await prisma.user.findMany({
            where: { role: { in: ['admin', 'manager'] }, isActive: true },
            select: { email: true },
          })
          const managerEmails = managers.map((m) => m.email)

          await sendNotification({
            emails: managerEmails,
            title,
            message,
            severity: 'high',
            equipmentId,
            type: 'schedule_overdue',
          })
        }
      }
    }
  } catch (error) {
    console.error('Check maintenance thresholds error:', error)
  }
}
