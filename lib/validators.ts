import { z } from 'zod'

export const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'manager', 'technician', 'operator']),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const equipmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['excavator', 'bulldozer', 'grader', 'truck', 'tipper_truck']),
  model: z.string().min(1, 'Model is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  year: z.number().min(1990).max(2030),
  assignedOperatorId: z.string().optional(),
  defaultFuelRate: z.number().min(0).optional(),
  fuelTolerance: z.number().min(0).optional(),
})

export const maintenanceLogSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment is required'),
  type: z.enum(['preventive', 'corrective']),
  serviceType: z.enum([
    'oil_change', 'brake_check', 'tire',
    'battery', 'engine', 'hydraulic'
  ]).optional(),
  description: z.string().min(1, 'Description is required'),
  failureCause: z.string().optional(),
  downtimeHours: z.number().optional(),
  wasAvoidable: z.boolean().optional(),
  laborCost: z.number().min(0).default(0),
  partsCost: z.number().min(0).default(0),
  serviceDate: z.string().min(1, 'Service date is required'),
  beforePhotoUrls: z.array(z.string()).optional(),
  afterPhotoUrls: z.array(z.string()).optional(),
  signatureUrl: z.string().nullable().optional(),
})

export const scheduleSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment is required'),
  technicianId: z.string().min(1, 'Technician is required'),
  title: z.string().min(1, 'Title is required'),
  scheduleType: z.enum(['preventive', 'follow_up']).default('preventive'),
  serviceType: z.enum([
    'oil_change', 'brake_check', 'tire',
    'battery', 'engine', 'hydraulic',
  ]).optional(),
  intervalType: z.enum(['days', 'km', 'hours']).optional(),
  intervalValue: z.number().min(1).optional(),
  nextDueDate: z.string().min(1, 'Due date is required'),
  isRecurring: z.boolean().default(true),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  notes: z.string().optional(),
})
 

export const fuelLogSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment is required'),
  liters: z.number().min(0.1, 'Liters must be greater than 0'),
  costPerLiter: z.number().min(0, 'Cost must be positive'),
  odometer: z.number().optional(),
  hours: z.number().optional(),
  fuelDate: z.string().min(1, 'Date is required'),
  projectSite: z.string().optional(),
  notes: z.string().optional(),
})

export const usageLogSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment is required'),
  startHours: z.number().min(0).optional(),
  endHours: z.number().min(0).optional(),
  startOdometer: z.number().min(0).optional(),
  endOdometer: z.number().min(0).optional(),
  idleHours: z.number().min(0).default(0),
  projectSite: z.string().min(1, 'Project site is required'),
  shiftDate: z.string().min(1, 'Shift date is required'),
  notes: z.string().optional(),
})