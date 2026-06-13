export type Role = 'admin' | 'manager' | 'technician' | 'operator'

export type EquipmentStatus = 'active' | 'under_maintenance' | 'retired'

export type EquipmentType =
  | 'excavator'
  | 'bulldozer'
  | 'grader'
  | 'truck'
  | 'tipper_truck'

export type MaintenanceType = 'preventive' | 'corrective'

export type ServiceType =
  | 'oil_change'
  | 'brake_check'
  | 'tire'
  | 'battery'
  | 'engine'
  | 'hydraulic'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export type SessionUser = {
  id: string
  email: string
  role: Role
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}