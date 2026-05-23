import { LazyStore } from '@tauri-apps/plugin-store'

const store = new LazyStore('calibration.json')

export interface CalibrationSettings {
  tvDiagonal: number
  tvWidth: number
  tvHeight: number
  gridColor: string
  lineWidth: number
  opacity: number
  originX: number
  originY: number
}

export const DEFAULT_CALIBRATION: CalibrationSettings = {
  tvDiagonal: 55,
  tvWidth: 1920,
  tvHeight: 1080,
  gridColor: '#ffffff',
  lineWidth: 1,
  opacity: 0.25,
  originX: 0,
  originY: 0,
}

export async function loadCalibration(): Promise<CalibrationSettings> {
  const saved = await store.get<CalibrationSettings>('data')
  return saved ?? { ...DEFAULT_CALIBRATION }
}

export async function saveCalibration(data: CalibrationSettings): Promise<void> {
  await store.set('data', data)
  await store.save()
}
