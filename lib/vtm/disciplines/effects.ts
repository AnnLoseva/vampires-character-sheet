import { getAttributeDots } from '@/lib/i18n/ruleNames'
import {
  normalizeCharacterDisciplines,
  type NormalizedCharacterDisciplines,
} from './character-disciplines'
import {
  loadDisciplineRules,
  type LoadedDisciplinePower,
  type LoadedDisciplineRules,
} from './rules-loader'

type JsonObject = Record<string, unknown>

export type PassiveTrackerModifier = {
  tracker: 'health' | 'willpower'
  operation: 'add_max'
  value: number
  source: {
    discipline: string
    power: string
    path?: string
    level: number
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getCharacterData(characterData: unknown): JsonObject {
  if (!isObject(characterData)) return {}
  return isObject(characterData.data) ? characterData.data : characterData
}

function getDisciplineRating(
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  return Object.values(normalized.disciplines[disciplineName] || {})
    .reduce((total, value) => total + (Number(value) || 0), 0)
}

function isPassiveActivation(mechanics: JsonObject) {
  const activation = mechanics.activation
  if (typeof activation === 'string') {
    return activation === 'passive'
  }
  if (!isObject(activation)) return false
  return activation.passive === true
    || activation.type === 'passive'
    || activation.mode === 'passive'
    || activation.kind === 'passive'
}

function resolveTraitValue(
  trait: string,
  characterData: JsonObject,
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  const normalizedTrait = trait.trim().toLocaleLowerCase('ru')
  if (
    normalizedTrait === 'discipline'
    || normalizedTrait === 'discipline_rating'
    || normalizedTrait === disciplineName.toLocaleLowerCase('ru')
  ) {
    return getDisciplineRating(normalized, disciplineName)
  }

  const attributes = isObject(characterData.attributes)
    ? characterData.attributes
    : {}
  const attributeValue = getAttributeDots(attributes, trait)
  if (attributeValue > 0 || Object.prototype.hasOwnProperty.call(attributes, trait)) {
    return attributeValue
  }

  return getDisciplineRating(normalized, trait)
}

function applyFormulaBounds(value: number, formula: JsonObject) {
  const multiplier = Number(formula.multiplier)
  const offset = Number(formula.offset)
  const min = Number(formula.min)
  const max = Number(formula.max)
  let result = value

  if (Number.isFinite(multiplier)) result *= multiplier
  if (Number.isFinite(offset)) result += offset
  if (Number.isFinite(min)) result = Math.max(min, result)
  if (Number.isFinite(max)) result = Math.min(max, result)
  return result
}

function resolveFormulaValue(
  value: unknown,
  characterData: JsonObject,
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  if (value === undefined) {
    return getDisciplineRating(normalized, disciplineName)
  }

  if (typeof value === 'number') return value

  if (typeof value === 'string') {
    const number = Number(value)
    if (Number.isFinite(number)) return number
    return resolveTraitValue(value, characterData, normalized, disciplineName)
  }

  if (!isObject(value)) return 0

  if (value.formula === 'discipline_rating') {
    const formulaDiscipline = typeof value.discipline === 'string'
      ? value.discipline
      : disciplineName
    return getDisciplineRating(normalized, formulaDiscipline)
  }

  if (value.type === 'trait' && typeof value.trait === 'string') {
    return applyFormulaBounds(
      resolveTraitValue(
        value.trait,
        characterData,
        normalized,
        disciplineName,
      ),
      value,
    )
  }

  if (value.type === 'formula' && typeof value.expression === 'string') {
    const expression = value.expression.trim()
    const number = Number(expression)
    if (Number.isFinite(number)) return number
    return resolveTraitValue(
      expression,
      characterData,
      normalized,
      disciplineName,
    )
  }

  return 0
}

function getLearnedPowers(
  disciplineName: string,
  rules: LoadedDisciplineRules,
  normalized: NormalizedCharacterDisciplines,
) {
  const discipline = rules[disciplineName]
  if (!discipline) return []

  const selectedPowerNames = normalized.powers[disciplineName] || []
  if (selectedPowerNames.length > 0) {
    const selected = new Set(selectedPowerNames)
    return discipline.powers.filter((power) => selected.has(power.name))
  }

  const rating = getDisciplineRating(normalized, disciplineName)
  return discipline.powers.filter((power) => power.level <= rating)
}

function getPassivePowerEffects(power: LoadedDisciplinePower) {
  const mechanics = isObject(power.raw.mechanics)
    ? power.raw.mechanics
    : null
  if (!mechanics || !isObject(mechanics.automation)) return []
  if (mechanics.automation.status !== 'auto') return []
  if (!isPassiveActivation(mechanics)) return []
  return Array.isArray(mechanics.effects) ? mechanics.effects : []
}

export function getPassiveTrackerModifiers(
  characterData: unknown,
  rulesJson: unknown,
): PassiveTrackerModifier[] {
  const data = getCharacterData(characterData)
  const normalized = normalizeCharacterDisciplines(data)
  const rules = loadDisciplineRules(rulesJson)
  const modifiers: PassiveTrackerModifier[] = []

  for (const disciplineName of Object.keys(normalized.disciplines)) {
    const learnedPowers = getLearnedPowers(
      disciplineName,
      rules,
      normalized,
    )

    for (const power of learnedPowers) {
      for (const effect of getPassivePowerEffects(power)) {
        if (!isObject(effect) || effect.type !== 'tracker_modifier') continue
        if (effect.operation !== 'add_max') continue
        if (effect.tracker !== 'health' && effect.tracker !== 'willpower') {
          continue
        }

        const value = resolveFormulaValue(
          effect.value ?? effect.amount,
          data,
          normalized,
          disciplineName,
        )
        if (!Number.isFinite(value) || value === 0) continue

        modifiers.push({
          tracker: effect.tracker,
          operation: 'add_max',
          value,
          source: {
            discipline: disciplineName,
            power: power.name,
            path: power.path,
            level: power.level,
          },
        })
      }
    }
  }

  return modifiers
}
