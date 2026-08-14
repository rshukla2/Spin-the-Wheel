export type LabelSize = 'auto' | 'small' | 'medium' | 'large'

export interface Entry {
  id: string
  label: string
  weight: number
  color: string | null
}

export interface ResultRecord {
  id: string
  entryId: string
  label: string
  selectedAt: string
}

export interface WheelSettings {
  palette: [string, string, string, string, string, string, string]
  spinDuration: number
  labelSize: LabelSize
  autoRemove: boolean
  sound: boolean
  volume: number
  confetti: boolean
}

export interface Wheel {
  id: string
  name: string
  entries: Entry[]
  results: ResultRecord[]
  settings: WheelSettings
}

export interface WorkspaceV1 {
  version: 1
  activeWheelId: string
  wheels: Wheel[]
}

export interface WheelSlice {
  entry: Entry
  startAngle: number
  endAngle: number
  centerAngle: number
  color: string
}
