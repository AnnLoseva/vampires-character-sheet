export type FormulaValue =
  | number
  | {
      type: 'trait'
      trait: string
      multiplier?: number
      offset?: number
      min?: number
      max?: number
    }
  | {
      type: 'formula'
      expression: string
    }

export type DerivedStats = {
  healthMax?: number
  willpowerMax?: number
  defenseDice?: number
  armor?: number
  movementSpeed?: number
  unarmedDamage?: number
  weaponDamageBonus?: number
  initiative?: number
  [stat: string]: number | undefined
}

export type RollMatcher = {
  kinds?: string[]
  poolTypes?: string[]
  traits?: string[]
  actions?: string[]
  sources?: string[]
  weaponTags?: string[]
  conditions?: string[]
}

export type DamageMatcher = {
  targets?: Array<'health' | 'willpower'>
  severities?: Array<'superficial' | 'aggravated'>
  sources?: string[]
  attackTypes?: string[]
  weaponTags?: string[]
  creatureTypes?: string[]
  conditions?: string[]
}

type BaseDisciplineEffect = {
  id?: string
  label?: string
  description?: string
}

export type TrackerModifierEffect = BaseDisciplineEffect & {
  type: 'tracker_modifier'
  tracker: 'health' | 'willpower' | 'humanity' | 'hunger' | string
  field?: 'current' | 'max' | 'superficial' | 'aggravated' | string
  operation: 'add' | 'subtract' | 'set' | 'min' | 'max'
  value: FormulaValue
}

export type RollModifierEffect = BaseDisciplineEffect & {
  type: 'roll_modifier'
  matcher?: RollMatcher
  operation?: 'add' | 'subtract' | 'set' | 'multiply'
  value: FormulaValue
}

export type DamageModifierEffect = BaseDisciplineEffect & {
  type: 'damage_modifier'
  matcher?: DamageMatcher
  operation?: 'add' | 'subtract' | 'set' | 'multiply'
  value?: FormulaValue
  setSeverity?: 'superficial' | 'aggravated'
  ignoreHalving?: boolean
}

export type WeaponEffect = BaseDisciplineEffect & {
  type: 'weapon_effect'
  weaponTags?: string[]
  damageBonus?: FormulaValue
  damageSeverity?: 'superficial' | 'aggravated'
  grantedTags?: string[]
  properties?: Record<string, string | number | boolean>
}

export type ConditionEffect = BaseDisciplineEffect & {
  type: 'condition'
  condition: string
  action?: 'apply' | 'remove'
  stacks?: FormulaValue
}

export type TransformationEffect = BaseDisciplineEffect & {
  type: 'transformation'
  form: string
  derivedStats?: Partial<DerivedStats>
  grantedTraits?: string[]
  suppressedTraits?: string[]
}

export type MovementEffect = BaseDisciplineEffect & {
  type: 'movement'
  mode: 'walk' | 'climb' | 'swim' | 'fly' | 'burrow' | 'teleport' | string
  speed?: FormulaValue
  multiplier?: FormulaValue
  ignoreTerrain?: boolean
}

export type SenseEffect = BaseDisciplineEffect & {
  type: 'sense'
  sense: string
  range?: FormulaValue
  rollModifier?: FormulaValue
  tags?: string[]
}

export type ManualPromptEffect = BaseDisciplineEffect & {
  type: 'manual_prompt'
  message: string
  choices?: Array<{
    id: string
    label: string
    value?: string | number | boolean
  }>
  requiresStoryteller?: boolean
}

export type DisciplineEffect =
  | TrackerModifierEffect
  | RollModifierEffect
  | DamageModifierEffect
  | WeaponEffect
  | ConditionEffect
  | TransformationEffect
  | MovementEffect
  | SenseEffect
  | ManualPromptEffect

export type DisciplinePowerMechanics = {
  version?: 1
  effects?: DisciplineEffect[]
  deactivateEffects?: DisciplineEffect[]
  notes?: string[]
}

export type ActiveEffect = {
  id: string
  source: {
    discipline: string
    power: string
    path?: string
    level?: number
  }
  effect: DisciplineEffect
  targetCharacterId?: string
  startedAt: string
  expiresAt?: string | null
  remainingUses?: number | null
  active: boolean
}
