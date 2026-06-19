export const WIKI_CATEGORIES = [
  'npc', 'kingdom', 'city', 'location', 'faction', 'faction_org',
  'deity', 'religion', 'lore_event', 'note', 'other',
] as const

export type WikiCategory = typeof WIKI_CATEGORIES[number]

export const CATEGORY_LABELS: Record<WikiCategory, string> = {
  npc: 'NPC',
  kingdom: 'Kingdom',
  city: 'City',
  location: 'Location',
  faction: 'Faction',
  faction_org: 'Faction/Organization',
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
  faction_org: '#b058a0',
  deity: '#d4b84a',
  religion: '#c09a38',
  lore_event: '#e07848',
  note: '#7a9cb0',
  other: '#888888',
}

export const LOCATION_SUBTYPES = [
  'world', 'kingdom', 'city', 'district', 'scene',
] as const

export type LocationSubtype = typeof LOCATION_SUBTYPES[number]

export interface LocationLevel {
  subtype: LocationSubtype
  label: string
  plural: string
  /** Association label used when this subtype is the CHILD (Parent → this_label → Child) */
  childLabel: string
}

export const LOCATION_HIERARCHY: LocationLevel[] = [
  { subtype: 'world',    label: 'World',                  plural: 'Worlds',                  childLabel: 'world' },
  { subtype: 'kingdom',  label: 'Kingdom',                plural: 'Kingdoms',                childLabel: 'kingdom' },
  { subtype: 'city',     label: 'City',                   plural: 'Cities',                  childLabel: 'city' },
  { subtype: 'district', label: 'Neighborhood/District',  plural: 'Neighborhoods/Districts', childLabel: 'district' },
  { subtype: 'scene',    label: 'Scene Location',         plural: 'Scene Locations',         childLabel: 'scene location' },
]

export const LOCATION_SUBTYPE_INDEX: Record<LocationSubtype, number> = {
  world: 0,
  kingdom: 1,
  city: 2,
  district: 3,
  scene: 4,
}
