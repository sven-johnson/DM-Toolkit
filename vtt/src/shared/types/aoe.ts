export type AoeShape = 'circle' | 'rectangle' | 'triangle'
export type AoeBlendMode = 'normal' | 'multiply' | 'add'
export type AoeColor = 'yellow' | 'red' | 'blue' | 'dark-blue' | 'orange' | 'green' | 'purple'

/** Full AOE marker — stored in the Zustand store and sent over IPC. */
export interface AoeMarker {
  id: string
  shape: AoeShape
  color: AoeColor
  blendMode: AoeBlendMode
  opacity: number      // 0.1 – 1.0
  gridX: number        // grid-intersection column (snap point)
  gridY: number        // grid-intersection row
  rotation: number     // degrees; triangles: 45° steps, rects: 90° steps
  // Circle
  radiusFt: number
  // Rectangle
  widthFt: number
  heightFt: number
  // Triangle (isosceles, apex at snap point, opens downward before rotation)
  legFt: number        // straight distance apex → base ("range")
  baseFt: number       // width of the base
  /** Triangle only: snap apex to intersection corner, edge midpoint, or whichever is nearest. */
  alignTo: 'intersection' | 'center' | 'either'
}

/** Configuration without placement coords — used for the panel and activeAoe state. */
export type AoeConfig = Omit<AoeMarker, 'id' | 'gridX' | 'gridY'>

export const AOE_COLORS: AoeColor[] = [
  'yellow', 'red', 'blue', 'dark-blue', 'orange', 'green', 'purple',
]

export const AOE_COLOR_LABELS: Record<AoeColor, string> = {
  yellow: 'Yellow', red: 'Red', blue: 'Blue', 'dark-blue': 'Dark Blue',
  orange: 'Orange', green: 'Green', purple: 'Purple',
}

export const AOE_COLOR_HEX: Record<AoeColor, string> = {
  yellow:      '#ffe040',
  red:         '#ff3030',
  blue:        '#3399ff',
  'dark-blue': '#1133bb',
  orange:      '#ff8800',
  green:       '#33cc55',
  purple:      '#aa33dd',
}

export const AOE_COLOR_NUM: Record<AoeColor, number> = {
  yellow:      0xffe040,
  red:         0xff3030,
  blue:        0x3399ff,
  'dark-blue': 0x1133bb,
  orange:      0xff8800,
  green:       0x33cc55,
  purple:      0xaa33dd,
}
