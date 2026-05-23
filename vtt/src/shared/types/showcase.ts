export interface ShowcaseDef {
  id: string
  name: string
  src: string  // asset:// URL
}

export interface ShowcaseInstance {
  defId: string
  rotation: number      // 0 | 90 | 180 | 270
  darkenAmount: number  // 0–100 (percent), default 20
}
