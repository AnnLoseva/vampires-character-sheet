// Character data (attributes/skills/disciplines) is keyed by whatever trait names were
// active in rules.json/rules_eng.json when the character was saved — Russian or English,
// independent of the UI's *current* language. Code that needs a specific named trait (e.g.
// "Stamina" for the health formula) must therefore look up both possible key spellings
// rather than assuming one. Keyed by the Russian name (matches the i18n dictionary
// convention used elsewhere).
export const ATTRIBUTE_NAME_EN: Record<string, string> = {
  'Сила': 'Strength',
  'Ловкость': 'Dexterity',
  'Выносливость': 'Stamina',
  'Обаяние': 'Charisma',
  'Манипуляция': 'Manipulation',
  'Самообладание': 'Composure',
  'Интеллект': 'Intelligence',
  'Смекалка': 'Wits',
  'Упорство': 'Resolve',
}

/** Reads attributes[ruName], falling back to the English spelling if that key is absent. */
export function getAttributeDots(attributes: Record<string, unknown> | null | undefined, ruName: string): number {
  if (!attributes) return 0
  const enName = ATTRIBUTE_NAME_EN[ruName]
  const value = attributes[ruName] ?? (enName ? attributes[enName] : undefined)
  return Number(value) || 0
}
