import { Truck, Wrench, Settings } from 'lucide-react'

type Props = {
  type: string
  className?: string
}

export default function EquipmentIcon({ type, className = 'w-4 h-4' }: Props) {
  const t = type?.toLowerCase()
  if (t === 'truck' || t === 'tipper_truck') {
    return <Truck className={className} />
  }
  if (t === 'excavator' || t === 'bulldozer' || t === 'grader') {
    return <Wrench className={className} />
  }
  return <Settings className={className} />
}
