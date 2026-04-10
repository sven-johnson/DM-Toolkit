export const WIKI_CATEGORIES = [
  'npc', 'kingdom', 'city', 'location', 'faction',
  'deity', 'religion', 'lore_event', 'note', 'other',
] as const

export type WikiCategory = typeof WIKI_CATEGORIES[number]

export const CATEGORY_LABELS: Record<WikiCategory, string> = {
  npc: 'NPC',
  kingdom: 'Kingdom',
  city: 'City',
  location: 'Location',
  faction: 'Faction',
  deity: 'Deity',
  religion: 'Religion',
  lore_event: 'Lore Event',
  note: 'Note',
  other: 'Other',
}

export const CATEGORY_COLORS: Record<WikiCategory, string> = {
  npc: '#5b9bd5',
  kingdom: '#c9965a',
  city: '#9e9e9e',
  location: '#5ead7a',
  faction: '#9b72c0',
  deity: '#d4b84a',
  religion: '#c09a38',
  lore_event: '#e07848',
  note: '#7a9cb0',
  other: '#888888',
}
