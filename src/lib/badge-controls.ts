import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CornerDownLeft, House } from 'lucide-react'

export const badgeControls = [
  { icon: ChevronLeft, name: 'Left', bit: 16 },
  { icon: ChevronRight, name: 'Right', bit: 8 },
  { icon: CornerDownLeft, name: 'Select', bit: 4 },
  { icon: ChevronUp, name: 'Up', bit: 2 },
  { icon: ChevronDown, name: 'Down', bit: 1 },
  { icon: House, name: 'Home', bit: 32 },
] as const
