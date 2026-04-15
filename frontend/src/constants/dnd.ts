import type { Character } from '../types'

export const SKILLS = [
  { key: 'acrobatics', name: 'Acrobatics', ability: 'DEX' },
  { key: 'animal_handling', name: 'Animal Handling', ability: 'WIS' },
  { key: 'arcana', name: 'Arcana', ability: 'INT' },
  { key: 'athletics', name: 'Athletics', ability: 'STR' },
  { key: 'deception', name: 'Deception', ability: 'CHA' },
  { key: 'history', name: 'History', ability: 'INT' },
  { key: 'insight', name: 'Insight', ability: 'WIS' },
  { key: 'intimidation', name: 'Intimidation', ability: 'CHA' },
  { key: 'investigation', name: 'Investigation', ability: 'INT' },
  { key: 'medicine', name: 'Medicine', ability: 'WIS' },
  { key: 'nature', name: 'Nature', ability: 'INT' },
  { key: 'perception', name: 'Perception', ability: 'WIS' },
  { key: 'performance', name: 'Performance', ability: 'CHA' },
  { key: 'persuasion', name: 'Persuasion', ability: 'CHA' },
  { key: 'religion', name: 'Religion', ability: 'INT' },
  { key: 'sleight_of_hand', name: 'Sleight of Hand', ability: 'DEX' },
  { key: 'stealth', name: 'Stealth', ability: 'DEX' },
  { key: 'survival', name: 'Survival', ability: 'WIS' },
] as const

export const SAVES = [
  { key: 'str_save', name: 'Strength', ability: 'STR' },
  { key: 'dex_save', name: 'Dexterity', ability: 'DEX' },
  { key: 'con_save', name: 'Constitution', ability: 'CON' },
  { key: 'int_save', name: 'Intelligence', ability: 'INT' },
  { key: 'wis_save', name: 'Wisdom', ability: 'WIS' },
  { key: 'cha_save', name: 'Charisma', ability: 'CHA' },
] as const

export const ABILITIES = [
  { key: 'str', name: 'Strength', scoreField: 'str_score', modField: 'str_mod' },
  { key: 'dex', name: 'Dexterity', scoreField: 'dex_score', modField: 'dex_mod' },
  { key: 'con', name: 'Constitution', scoreField: 'con_score', modField: 'con_mod' },
  { key: 'int', name: 'Intelligence', scoreField: 'int_score', modField: 'int_mod' },
  { key: 'wis', name: 'Wisdom', scoreField: 'wis_score', modField: 'wis_mod' },
  { key: 'cha', name: 'Charisma', scoreField: 'cha_score', modField: 'cha_mod' },
] as const

export type SkillKey = typeof SKILLS[number]['key']
export type SaveKey = typeof SAVES[number]['key']

export function calcModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function getCheckModifier(character: Character, checkType: string, subtype: string): number {
  if (checkType === 'skill') {
    return (character as unknown as Record<string, number>)[subtype] ?? 0
  }
  return (character as unknown as Record<string, number>)[subtype] ?? 0
}

export function calcSuccessPercent(modifier: number, dc: number): number {
  const needed = dc - modifier
  const successes = 21 - Math.max(1, Math.min(21, needed))
  return Math.round(Math.max(0, Math.min(20, successes)) / 20 * 100)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
