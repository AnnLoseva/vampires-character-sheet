import { getAttributeDots } from '@/lib/i18n/ruleNames'
import { getActiveEffects } from './active-effects'
import {
  normalizeCharacterDisciplines,
  type NormalizedCharacterDisciplines,
} from './character-disciplines'
import {
  loadDisciplineRules,
  type LoadedDisciplinePower,
  type LoadedDisciplineRules,
} from './rules-loader'
import type {
  ActiveEffect,
  DisciplineEffect,
  RollMatcher,
  RollModifierEffect,
} from './schema'

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

export type DisciplineRollPenalty = {
  id: string
  label: string
  diceDelta: number
  kind?: string
}

export type DisciplineRollEffectContext = {
  characterData: unknown
  rulesJson?: unknown
  baseDiceCount: number
  poolType?: string
  kind?: string
  action?: string
  source?: string
  traits?: string[]
  weaponTags?: string[]
  conditions?: string[]
  penalties?: DisciplineRollPenalty[]
  disabledModifierIds?: string[]
}

export type AppliedDisciplineRollModifier = {
  id: string
  sourceKind: 'active' | 'passive' | 'penalty'
  operation: 'add_dice' | 'remove_dice' | 'difficulty_modifier' | 'ignore_penalty'
  label: string
  sourceLabel: string
  discipline?: string
  power?: string
  path?: string
  level?: number
  diceDelta: number
  difficultyDelta: number
  ignoredPenaltyIds?: string[]
  active: boolean
  canDisable: boolean
}

export type DisciplineRollEffectResult = {
  baseDiceCount: number
  finalDiceCount: number
  diceDelta: number
  difficultyDelta: number
  modifiers: AppliedDisciplineRollModifier[]
  ignoredPenaltyIds: string[]
}

type RollModifierCandidate = {
  id: string
  sourceKind: 'active' | 'passive'
  source: {
    discipline: string
    power: string
    path?: string
    level?: number
  }
  effect: RollModifierEffect
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
    return applyFormulaBounds(
      getDisciplineRating(normalized, formulaDiscipline),
      value,
    )
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

function normalizeText(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLocaleLowerCase('ru')
    : ''
}

function hasMatcherValues(
  expected: string[] | undefined,
  actual: Array<string | undefined>,
) {
  if (!expected || expected.length === 0) return true
  const actualSet = new Set(actual.map(normalizeText).filter(Boolean))
  return expected.some((value) => actualSet.has(normalizeText(value)))
}

function matchesRollMatcher(
  matcher: RollMatcher | undefined,
  context: DisciplineRollEffectContext,
) {
  if (!matcher) return true
  return hasMatcherValues(matcher.poolTypes, [context.poolType])
    && hasMatcherValues(matcher.kinds, [context.kind])
    && hasMatcherValues(matcher.actions, [context.action])
    && hasMatcherValues(matcher.sources, [context.source])
    && hasMatcherValues(matcher.traits, context.traits || [])
    && hasMatcherValues(matcher.weaponTags, context.weaponTags || [])
    && hasMatcherValues(matcher.conditions, context.conditions || [])
}

function isRollModifierEffect(effect: DisciplineEffect | unknown): effect is RollModifierEffect {
  return isObject(effect) && effect.type === 'roll_modifier'
}

function normalizeRollOperation(
  effect: RollModifierEffect,
): AppliedDisciplineRollModifier['operation'] {
  if (effect.operation === 'remove_dice' || effect.operation === 'subtract') {
    return 'remove_dice'
  }
  if (effect.operation === 'difficulty_modifier') return 'difficulty_modifier'
  if (effect.operation === 'ignore_penalty') return 'ignore_penalty'
  return 'add_dice'
}

function getRollEffectAmount(
  effect: RollModifierEffect,
  data: JsonObject,
  normalized: NormalizedCharacterDisciplines,
  disciplineName: string,
) {
  return resolveFormulaValue(
    effect.value ?? effect.amount,
    data,
    normalized,
    disciplineName,
  )
}

function getEffectSourceLabel(candidate: RollModifierCandidate) {
  return candidate.effect.label
    || candidate.source.power
    || candidate.source.discipline
}

function getPenaltyMatcherValues(effect: RollModifierEffect) {
  const values = [
    effect.penalty,
    ...(Array.isArray(effect.penalties) ? effect.penalties : []),
    typeof effect.value === 'string' ? effect.value : '',
  ]
  return values.map(normalizeText).filter(Boolean)
}

function getIgnoredPenaltyIds(
  effect: RollModifierEffect,
  penalties: DisciplineRollPenalty[],
) {
  const matcherValues = getPenaltyMatcherValues(effect)
  if (matcherValues.length === 0) return penalties.map((penalty) => penalty.id)

  return penalties
    .filter((penalty) => {
      const values = [
        penalty.id,
        penalty.kind,
        penalty.label,
      ].map(normalizeText)
      return matcherValues.some((matcherValue) => values.includes(matcherValue))
    })
    .map((penalty) => penalty.id)
}

function createRollModifierApplication(
  candidate: RollModifierCandidate,
  operation: AppliedDisciplineRollModifier['operation'],
  active: boolean,
  diceDelta = 0,
  difficultyDelta = 0,
  ignoredPenaltyIds: string[] = [],
): AppliedDisciplineRollModifier {
  return {
    id: candidate.id,
    sourceKind: candidate.sourceKind,
    operation,
    label: candidate.effect.label || candidate.source.power,
    sourceLabel: getEffectSourceLabel(candidate),
    discipline: candidate.source.discipline,
    power: candidate.source.power,
    path: candidate.source.path,
    level: candidate.source.level,
    diceDelta,
    difficultyDelta,
    ignoredPenaltyIds,
    active,
    canDisable: true,
  }
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

function getPassiveRollModifierCandidates(
  data: JsonObject,
  rulesJson: unknown,
  normalized: NormalizedCharacterDisciplines,
): RollModifierCandidate[] {
  const rules = loadDisciplineRules(rulesJson)
  const candidates: RollModifierCandidate[] = []

  for (const disciplineName of Object.keys(normalized.disciplines)) {
    const learnedPowers = getLearnedPowers(
      disciplineName,
      rules,
      normalized,
    )

    for (const power of learnedPowers) {
      getPassivePowerEffects(power).forEach((effect, index) => {
        if (!isRollModifierEffect(effect)) return
        candidates.push({
          id: `passive:${disciplineName}:${power.path || ''}:${power.name}:${effect.id || index}`,
          sourceKind: 'passive',
          source: {
            discipline: disciplineName,
            power: power.name,
            path: power.path,
            level: power.level,
          },
          effect,
        })
      })
    }
  }

  return candidates
}

function getActiveRollModifierCandidates(
  characterData: unknown,
): RollModifierCandidate[] {
  return getActiveEffects(characterData)
    .filter((activeEffect: ActiveEffect) => activeEffect.active)
    .filter((activeEffect) => isRollModifierEffect(activeEffect.effect))
    .map((activeEffect) => ({
      id: `active:${activeEffect.id}`,
      sourceKind: 'active',
      source: activeEffect.source,
      effect: activeEffect.effect as RollModifierEffect,
    }))
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

export function applyDisciplineEffectsToRoll(
  rollContext: DisciplineRollEffectContext,
  _derivedStats?: unknown,
): DisciplineRollEffectResult {
  const data = getCharacterData(rollContext.characterData)
  const normalized = normalizeCharacterDisciplines(data)
  const penalties = rollContext.penalties || []
  const disabled = new Set(rollContext.disabledModifierIds || [])
  const candidates = [
    ...getPassiveRollModifierCandidates(
      data,
      rollContext.rulesJson,
      normalized,
    ),
    ...getActiveRollModifierCandidates(data),
  ]

  const modifiers: AppliedDisciplineRollModifier[] = []
  const ignoredPenaltyIds = new Set<string>()

  for (const candidate of candidates) {
    const operation = normalizeRollOperation(candidate.effect)
    if (operation !== 'ignore_penalty') continue
    if (!matchesRollMatcher(candidate.effect.matcher, rollContext)) continue

    const ignoredByEffect = getIgnoredPenaltyIds(candidate.effect, penalties)
    const isActive = !disabled.has(candidate.id)
    if (isActive) {
      ignoredByEffect.forEach((id) => ignoredPenaltyIds.add(id))
    }
    modifiers.push(createRollModifierApplication(
      candidate,
      operation,
      isActive,
      0,
      0,
      ignoredByEffect,
    ))
  }

  for (const penalty of penalties) {
    const active = !ignoredPenaltyIds.has(penalty.id)
    modifiers.push({
      id: `penalty:${penalty.id}`,
      sourceKind: 'penalty',
      operation: penalty.diceDelta < 0 ? 'remove_dice' : 'add_dice',
      label: penalty.label,
      sourceLabel: penalty.label,
      diceDelta: penalty.diceDelta,
      difficultyDelta: 0,
      active,
      canDisable: false,
    })
  }

  for (const candidate of candidates) {
    const operation = normalizeRollOperation(candidate.effect)
    if (operation === 'ignore_penalty') continue
    if (!matchesRollMatcher(candidate.effect.matcher, rollContext)) continue

    const amount = getRollEffectAmount(
      candidate.effect,
      data,
      normalized,
      candidate.source.discipline,
    )
    if (!Number.isFinite(amount) || amount === 0) continue

    const active = !disabled.has(candidate.id)
    const diceDelta = operation === 'add_dice'
      ? Math.floor(Math.abs(amount))
      : operation === 'remove_dice'
        ? -Math.floor(Math.abs(amount))
        : 0
    const difficultyDelta = operation === 'difficulty_modifier'
      ? Math.floor(amount)
      : 0

    modifiers.push(createRollModifierApplication(
      candidate,
      operation,
      active,
      diceDelta,
      difficultyDelta,
    ))
  }

  const activeModifiers = modifiers.filter((modifier) => modifier.active)
  const diceDelta = activeModifiers.reduce(
    (total, modifier) => total + modifier.diceDelta,
    0,
  )
  const difficultyDelta = activeModifiers.reduce(
    (total, modifier) => total + modifier.difficultyDelta,
    0,
  )
  const baseDiceCount = Math.max(
    0,
    Math.floor(Number(rollContext.baseDiceCount) || 0),
  )
  const finalDiceCount = Math.max(
    0,
    Math.min(20, baseDiceCount + diceDelta),
  )

  return {
    baseDiceCount,
    finalDiceCount,
    diceDelta,
    difficultyDelta,
    modifiers,
    ignoredPenaltyIds: [...ignoredPenaltyIds],
  }
}
