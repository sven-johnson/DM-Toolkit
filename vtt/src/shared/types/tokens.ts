export type TokenSize = 1 | 2 | 3

export interface TokenDef {
  id: string
  name: string
  src: string        // asset:// URL
  defaultSize: TokenSize
  shape?: 'square' | 'circle' | 'rounded'
}

export interface EffectDef {
  id: string
  name: string
  src: string
  shape: 'square' | 'circle'
  defaultSize: TokenSize
  defaultOpacity: number
}

export interface Token {
  id: string
  defId: string
  name: string
  src: string
  gridX: number
  gridY: number
  size: TokenSize
  rotation?: number
  outlineColor?: string            // undefined = no outline; '#000000' = default black
  outlineShape?: 'square' | 'circle' | 'rounded'  // mirrors def shape at placement time
}

export interface Effect {
  id: string
  defId: string
  name: string
  src: string
  /** For square effects: top-left cell column.
   *  For circle effects: the grid intersection column at the center. */
  gridX: number
  gridY: number
  size: TokenSize
  opacity: number
  shape: 'square' | 'circle'
  rotation?: number
}
