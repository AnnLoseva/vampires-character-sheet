'use client'

import { ChangeEvent, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { ATTRIBUTE_NAME_EN, findCrossLanguageName, getAttributeDots, resolveSkillValue, SKILL_NAME_EN } from '@/lib/i18n/ruleNames'
import { useLang } from '@/lib/i18n/LanguageProvider'
import MusicPanel from '../music/MusicPanel'
import type { DiceOverlayGroup, DiceOverlayRoll } from './DiceRollOverlay'
import GameTableStyles from './GameTableStyles'
import LayerManager from './LayerManager'
import TableCanvas from './TableCanvas'
import TableLeftPanel from './TableLeftPanel'
import TableRightPanel from './TableRightPanel'
import SceneManager from './SceneManager'
import MediaLibrary from './MediaLibrary'
import ChatPanel from './ChatPanel'
import JournalPanel from './JournalPanel'
import MasterPanel from './MasterPanel'
import defaultRules from '@/public/rules.json'
import {
  broadcastMusicChannel,
  getMusicProvider,
  isMissingColumnError,
  parseYouTubeUrl,
  safeStorageName as safeMusicStorageName,
  TABLE_MUSIC,
  TABLE_MUSIC_BUCKET,
  toLegacyMusicDbRow,
  toMusicDbRow,
} from '../music/utils'
import {
  DEFAULT_SCENE_NAME,
  MASTER_PASSWORD_KEY,
  ROOT_LAYER_DROP_ID,
  TABLE_CHAT_MESSAGES,
  TABLE_IMAGE_BUCKET,
  TABLE_IMAGES,
  TABLE_ROLLS,
  TABLE_SCENE_MUSIC,
  TABLE_SCENES,
} from '@/lib/table/constants'
import {
  mapCharacterRow,
  mapChatRow,
  mapLayerRow,
  mapRollRow,
  mapSceneMusicRow,
  mapSceneRow,
  getCharacterType,
  getDefaultDamageProfile,
  normalizeWillpowerTracker,
  normalizeInventory,
  toDbPatch,
} from '@/lib/table/mappers'
import {
  extractImageUrlsFromHtml,
  extractVideoUrlsFromHtml,
  getDocumentEmbedUrl,
  getDroppedMediaUrls,
  getEmbeddableVideoUrl,
  getFileLayerMeta,
  getFileText,
  getImageNameFromUrl,
  getMediaSize,
  getMediaUrlsFromText,
  getStoragePathFromPublicUrl,
  getTextLayerData,
  isReadableTextFile,
  isWordLikeFile,
  safeStorageName,
} from '@/lib/table/media-utils'
import {
  createEditorState,
  getEditorImageStyle,
  getLayerCrop,
  getLayerMediaStyle,
  getSmartFloatingPosition,
  mergeChatMessage,
  mergeRoll,
  sortLayers,
  upsertLayer,
} from '@/lib/table/layer-utils'
import { sortSceneMusic, sortScenes, upsertScene } from '@/lib/table/scene-utils'
import {
  applyHealthDamage,
  calculateConflictDamage,
  getHealthImpairmentPenalty,
  getHealthMetaState,
  getHealthWarning,
  getSuperficialMendAmount,
  normalizeDamageProfile,
  normalizeHealthTracker,
  recoverHealthDamage,
  toHealthTracker,
} from '@/lib/vtm/health'
import { getDerivedStats } from '@/lib/vtm/derived-stats'
import { removeActiveEffect as removeActiveEffectFromData } from '@/lib/vtm/disciplines/active-effects'
import {
  applyDisciplineEffectsToDamage,
  applyDisciplineEffectsToRoll,
  type AppliedDisciplineRollModifier,
  type DisciplineRollEffectResult,
  type DisciplineRollPenalty,
} from '@/lib/vtm/disciplines/effects'
import {
  payDisciplineCost,
  resolveDisciplineCost,
} from '@/lib/vtm/disciplines/costs'
import type {
  DisciplineCost,
  DisciplineCostMechanics,
  DisciplineCostPayment,
} from '@/lib/vtm/disciplines/costs'
import {
  activateDisciplinePower,
  deactivateDisciplinePower,
  isDisciplinePowerActive,
} from '@/lib/vtm/disciplines/engine'
import { getDisciplineDurationLabel } from '@/lib/vtm/disciplines/durations'
import type {
  ActiveEffect,
  DisciplinePowerInputField,
  DisciplinePowerMechanics,
} from '@/lib/vtm/disciplines/schema'
import type { DamageSeverity, HealthDamageOptions } from '@/lib/vtm/health'
import {
  addHumanityStains as addHumanityStainsState,
  getHumanityState,
  getHumanityStatus,
  getRemorseDice,
} from '@/lib/vtm/humanity'
import type { HumanityState, HumanityStainSource } from '@/lib/vtm/humanity'
import type {
  ActiveParticipant,
  BlendMode,
  CharacterOption,
  CharacterRow,
  ChatMessage,
  ChatMessageRow,
  ChatPanelTab,
  ChatUser,
  Die,
  DragState,
  ImageEditorDraft,
  ImageEditorState,
  InventoryItem,
  JournalEntry,
  LayerContextMenu,
  LayerDropPlacement,
  LayerDropTarget,
  LayerPatch,
  LayerTreeNode,
  LeftToolbarTab,
  MasterReveal,
  MasterWhisper,
  NormalizedHealth,
  NormalizedWillpower,
  MediaTab,
  OpposedRollResult,
  OpposedRollSide,
  RollMeta,
  RollMode,
  RightRailTab,
  RollMessage,
  RollRow,
  RouseCheckResult,
  SceneMusicRow,
  SceneMusicTrack,
  SelectionRect,
  TableLayer,
  TableLayerRow,
  TableRole,
  TableScene,
  TableSceneRow,
  TouchGestureState,
  VoiceParticipant,
  VoiceQuality,
  VoiceSignal,
} from '@/lib/table/types'

const DiceRollOverlay = dynamic(() => import('./DiceRollOverlay'), { ssr: false })

let supportsExtendedTableMusicSchema = true

const ATTRIBUTE_GROUPS = [
  { name: 'Физические', traits: ['Сила', 'Ловкость', 'Выносливость'] },
  { name: 'Социальные', traits: ['Обаяние', 'Манипуляция', 'Самообладание'] },
  { name: 'Ментальные', traits: ['Интеллект', 'Смекалка', 'Упорство'] },
] as const

const SKILL_GROUPS = [
  { name: 'Физические', traits: ['Атлетика', 'Вождение', 'Воровство', 'Выживание', 'Драка', 'Ремесло', 'Скрытность', 'Стрельба', 'Фехтование'] },
  { name: 'Социальные', traits: ['Запугивание', 'Исполнение', 'Лидерство', 'Обращение с животными', 'Проницательность', 'Убеждение', 'Уличное чутьё', 'Хитрость', 'Этикет'] },
  { name: 'Ментальные', traits: ['Гуманитарные науки', 'Естественные науки', 'Медицина', 'Наблюдательность', 'Оккультизм', 'Политика', 'Расследование', 'Техника', 'Финансы'] },
] as const

const INVENTORY_CATEGORIES = ['Оружие', 'Одежда', 'Документы', 'Деньги', 'Артефакты', 'Расходники', 'Другое'] as const

type DisciplinePowerRule = {
  description?: string
  pool?: string
  roll?: string
  extra_roll?: string
  control_roll?: string
  resistance?: string
  difficulty?: string | number
  difficulty_for_victim?: string | number
  soak_difficulty?: string | number
  cost?: string
  mechanics?: DisciplinePowerMechanics & DisciplineCostMechanics & {
    humanity?: {
      risk?: boolean
      suggestedStains?: number
      requiresStorytellerConfirm?: boolean
      reason?: string
    }
  }
  effect?: string
  duration?: string
}

type DisciplineRule = {
  description?: string
  system?: Record<string, unknown>
  powers?: Record<string, Record<string, DisciplinePowerRule>>
  paths?: Record<string, {
    description?: string
    powers?: Record<string, Record<string, DisciplinePowerRule>>
  }>
}

const defaultDisciplineRules = (
  defaultRules as unknown as { disciplines?: Record<string, DisciplineRule> }
).disciplines || {}

type DisciplinePowerEntry = {
  level: number
  name: string
  path?: string
  rule: DisciplinePowerRule
}

type DisciplineRollContext = {
  name: string
  power: string
  level: number
  cost: string
}

function getDisciplineCostLabel(
  cost: DisciplineCost,
  legacyCost?: string,
  t: (ru: string) => string = ru => ru,
  tf: (ru: string, vars: Record<string, string | number>) => string = (ru, vars) =>
    Object.entries(vars).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), ru),
) {
  if (legacyCost?.trim()) return legacyCost
  const parts = [
    cost.rouseChecks > 0
      ? tf('{n} испытание Крови', { n: cost.rouseChecks })
      : '',
    cost.willpowerSpend > 0
      ? tf('{n} пункт Воли', { n: cost.willpowerSpend })
      : '',
  ].filter(Boolean)
  return parts.join(' + ') || t('нет')
}

type QuickRollOptions = {
  hidden?: boolean
  useBloodSurge?: boolean
  skipHungerDice?: boolean
  source?: RollMeta['source']
  disciplineContext?: DisciplineRollContext
  rouseChecks?: RouseCheckResult[]
  warnings?: string[]
  willpowerBefore?: RollMeta['willpowerBefore']
  willpowerAfter?: RollMeta['willpowerAfter']
  spentWillpower?: number
  recoveredWillpower?: number
  impairmentPenaltyApplied?: number
  healthImpairmentPenaltyApplied?: number
  rollTraits?: string[]
  rollAction?: string
  rollKind?: string
  rollPenalties?: DisciplineRollPenalty[]
  disabledRollModifierIds?: string[]
}

type WillpowerRerollDraft = {
  rollId: string
  selectedDieIds: string[]
}

type PowerPoolChoice = {
  source: string
  options: string[]
}

type RollPoolBuilder = {
  attribute: string
  attributeTwo: string
  skill: string
  discipline: string
  modifier: number
}

type ContestedOpponentOption = {
  id: string
  label: string
  actorKind: 'player' | 'npc'
  characterId: string | null
  userId?: string
}

type OpposedRollProposal = {
  id: string
  room: string
  fromUserId: string
  fromUsername: string
  toUserId: string
  createdAt: string
  initiator: OpposedRollSide
}

const DEFAULT_OPPOSED_RESPONSE: RollPoolBuilder = {
  attribute: '',
  attributeTwo: '',
  skill: '',
  discipline: '',
  modifier: 0,
}

const DIE_IMAGES: Record<Die['kind'], { src: string; label: string }> = {
  fail: { src: '/static/dice/fail.png', label: 'провал' },
  success: { src: '/static/dice/success.png', label: 'успех' },
  critical: { src: '/static/dice/critical-success.png', label: 'критический успех' },
  botch: { src: '/static/dice/fail.png', label: 'провал' },
  'hunger-fail': { src: '/static/dice/hunger-fail.png', label: 'провал Голода' },
  'hunger-success': { src: '/static/dice/hunger-success.png', label: 'успех Голода' },
  'hunger-critical-success': { src: '/static/dice/hunger-critical-success.png', label: 'критический успех Голода' },
  'hunger-critical-fail': { src: '/static/dice/hunger-critical-fail.png', label: 'критический провал Голода' },
}

const ATTRIBUTE_NAMES = ATTRIBUTE_GROUPS.flatMap(group => [...group.traits])
const SKILL_NAMES = SKILL_GROUPS.flatMap(group => [...group.traits])
const WILLPOWER_IMPAIRED_ATTRIBUTES = ['Обаяние', 'Манипуляция', 'Самообладание', 'Интеллект', 'Смекалка', 'Упорство']

function getSkillDotValue(value: unknown) {
  if (typeof value === 'number') return value
  if (!value || typeof value !== 'object') return 0
  return Number((value as { dots?: number }).dots || 0)
}

function getCharacterPoolPartDots(character: CharacterOption, name: string) {
  const attributeName = findCrossLanguageName(name, Object.keys(character.attributes))
  if (attributeName) return getAttributeDots(character.attributes, attributeName)
  const skillName = findCrossLanguageName(name, Object.keys(character.skills))
  if (skillName) return getSkillDotValue(character.skills[skillName])
  const disciplineName = findCrossLanguageName(name, Object.keys(character.disciplines))
  if (disciplineName) return Object.values(character.disciplines[disciplineName] || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
  return 0
}

function getDisciplinePowerEntries(rule?: DisciplineRule): DisciplinePowerEntry[] {
  if (!rule) return []
  const directPowers: DisciplinePowerEntry[] = Object.entries(rule.powers || {})
    .flatMap(([level, powers]) => Object.entries(powers || {}).map(([name, powerRule]) => ({
      level: Number(level) || 0,
      name,
      path: undefined,
      rule: powerRule,
    })))
  const pathPowers: DisciplinePowerEntry[] = Object.entries(rule.paths || {})
    .flatMap(([pathName, path]) => Object.entries(path.powers || {})
      .flatMap(([level, powers]) => Object.entries(powers || {}).map(([name, powerRule]) => ({
        level: Number(level) || 0,
        name,
        path: pathName,
        rule: powerRule,
      }))))
  return [...directPowers, ...pathPowers]
    .sort((a, b) =>
      a.level - b.level
      || (a.path || '').localeCompare(b.path || '', 'ru')
      || a.name.localeCompare(b.name, 'ru'))
}

function getDisciplinePowerEntryKey(power: Pick<DisciplinePowerEntry, 'name' | 'path'>) {
  return power.path ? `${power.path} / ${power.name}` : power.name
}

// rules.json pool text uses "как <power name>" (Russian); rules_eng.json uses
// "as <power name>" (English) — matches whichever language is currently loaded.
function resolvePowerPool(pool: string, rules: Record<string, DisciplineRule>) {
  const trimmed = pool.trim()
  const reference = trimmed.match(/^(?:как|as)\s+(.+)$/i)?.[1]?.trim()
  const normalizedReference = reference?.toLocaleLowerCase('ru')
  if (!reference || normalizedReference === 'применяемая сила' || normalizedReference === 'the power being applied') return trimmed
  for (const discipline of Object.values(rules)) {
    const referencedPower = getDisciplinePowerEntries(discipline).find(power => power.name.toLocaleLowerCase('ru') === reference.toLocaleLowerCase('ru'))
    if (referencedPower?.rule.pool) return referencedPower.rule.pool
  }
  return trimmed
}

function getPowerRollFormula(rule?: DisciplinePowerRule | null) {
  return rule?.pool || rule?.roll || ''
}

function getPowerRollSummary(rule: DisciplinePowerRule | null | undefined, tf: (ru: string, vars: Record<string, string | number>) => string) {
  const rows = [
    getPowerRollFormula(rule),
    rule?.extra_roll ? tf('Дополнительно: {value}', { value: rule.extra_roll }) : '',
    rule?.control_roll ? tf('Контроль: {value}', { value: rule.control_roll }) : '',
    rule?.resistance ? tf('Сопротивление: {value}', { value: rule.resistance }) : '',
  ].filter(Boolean)
  return rows.join(' · ')
}

function getPowerDifficultySummary(rule: DisciplinePowerRule | null | undefined, tf: (ru: string, vars: Record<string, string | number>) => string) {
  const rows = [
    rule?.difficulty ? formatRuleValue(rule.difficulty) : '',
    rule?.difficulty_for_victim ? tf('для цели: {value}', { value: formatRuleValue(rule.difficulty_for_victim) }) : '',
    rule?.soak_difficulty ? tf('прочность: {value}', { value: formatRuleValue(rule.soak_difficulty) }) : '',
  ].filter(Boolean)
  return rows.join(' · ')
}

function getDieKind(value: number, isHunger: boolean): Die['kind'] {
  if (isHunger) {
    if (value === 1) return 'hunger-critical-fail'
    if (value === 10) return 'hunger-critical-success'
    return value >= 6 ? 'hunger-success' : 'hunger-fail'
  }
  return value === 10 ? 'critical' : value >= 6 ? 'success' : 'fail'
}

function makeDieId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function rollD10Pool(diceCount: number, hungerDiceCount = 0) {
  const safeDiceCount = Math.max(1, Math.min(20, diceCount))
  const safeHungerDiceCount = Math.max(0, Math.min(5, safeDiceCount, hungerDiceCount))
  return Array.from({ length: safeDiceCount }, (_, index) => {
    const value = Math.floor(Math.random() * 10) + 1
    const isHunger = index < safeHungerDiceCount
    return {
      id: makeDieId(),
      value,
      kind: getDieKind(value, isHunger),
    } as Die
  })
}

function countD10Successes(dice: Die[]) {
  const criticals = dice.filter(die => die.value === 10).length
  return dice.filter(die => die.value >= 6).length + Math.floor(criticals / 2) * 2
}

function getRollOutcomeMeta(dice: Die[], successes: number) {
  const criticals = dice.filter(die => die.value === 10).length
  const hungerCriticals = dice.filter(die => die.value === 10 && die.kind.startsWith('hunger')).length
  const hungerOnes = dice.filter(die => die.value === 1 && die.kind.startsWith('hunger')).length
  return {
    messyCritical: successes > 0 && criticals >= 2 && hungerCriticals > 0,
    bestialFailure: successes <= 0 && hungerOnes > 0,
  }
}

function getCharacterHunger(character?: CharacterOption | null) {
  if (character && !['vampire', 'thinblood'].includes(character.characterType)) return 0
  return Math.max(0, Math.min(5, Number(character?.vitalTrackers?.hunger || 0) || 0))
}

function getCharacterBloodPotency(character?: CharacterOption | null) {
  if (character && !['vampire', 'thinblood'].includes(character.characterType)) return 0
  return Math.max(0, Math.min(10, Number(character?.bloodPotency || 0) || 0))
}

function getCharacterWillpower(character?: CharacterOption | null): NormalizedWillpower {
  if (!character) return { superficial: 0, aggravated: 0, max: 0, current: 0, impaired: false }
  return character.willpower || normalizeWillpowerTracker(
    character.vitalTrackers?.willpower,
    character.derivedStats.willpower.totalMax,
  )
}

function getCharacterDamageProfile(character?: CharacterOption | null): NonNullable<CharacterOption['damageProfile']> {
  return character?.damageProfile || getDefaultDamageProfile(character?.characterType || 'vampire')
}

function getCharacterHealth(character?: CharacterOption | null): NormalizedHealth {
  if (!character) {
    return {
      superficial: 0,
      aggravated: 0,
      bonusMax: 0,
      maxOverride: null,
      max: 0,
      current: 0,
      impaired: false,
      defeated: false,
      physicalState: 'healthy',
    }
  }
  return character.health || normalizeHealthTracker(
    character.vitalTrackers?.health,
    getAttributeDots(character.attributes, 'Выносливость')
      + character.derivedStats.health.passiveBonus,
    getCharacterDamageProfile(character),
  )
}

function getCharacterHealthStamina(character: CharacterOption) {
  return getAttributeDots(character.attributes, 'Выносливость')
    + character.derivedStats.health.passiveBonus
}

function getWillpowerMetaState(willpower: NormalizedWillpower): NonNullable<RollMeta['willpowerBefore']> {
  return {
    max: willpower.max,
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
    current: willpower.current,
  }
}

function applyWillpowerStressValue(willpower: NormalizedWillpower, amount = 1) {
  const next = {
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
  }
  let applied = 0
  const warnings: string[] = []

  for (let index = 0; index < amount; index += 1) {
    if (next.aggravated >= willpower.max) {
      warnings.push('Воля полностью заполнена тяжёлым стрессом: потратить Волю нельзя.')
      break
    }
    if (next.superficial + next.aggravated < willpower.max) {
      next.superficial += 1
      applied += 1
      continue
    }
    if (next.superficial > 0) {
      next.superficial -= 1
      next.aggravated += 1
      applied += 1
      warnings.push('Трек Воли был заполнен: один поверхностный стресс превращён в тяжёлый.')
      continue
    }
    warnings.push('Воля полностью заполнена: потратить Волю нельзя.')
    break
  }

  const normalized = normalizeWillpowerTracker(next, willpower.max)
  if (normalized.impaired) warnings.push('Трек Воли заполнен: ментальные и социальные проверки получают -2к10.')
  return { tracker: normalized, applied, warnings }
}

function recoverWillpowerStressValue(willpower: NormalizedWillpower, amount = 1, severity: 'superficial' | 'aggravated' = 'superficial') {
  const next = {
    superficial: willpower.superficial,
    aggravated: willpower.aggravated,
  }
  let recovered = 0
  for (let index = 0; index < amount; index += 1) {
    if (severity === 'aggravated') {
      if (next.aggravated <= 0) break
      next.aggravated -= 1
      recovered += 1
      continue
    }
    if (next.superficial <= 0) break
    next.superficial -= 1
    recovered += 1
  }
  return { tracker: normalizeWillpowerTracker(next, willpower.max), recovered }
}

function getWillpowerRecoveryPool(character?: CharacterOption | null) {
  if (!character) return 0
  return Math.max(
    getAttributeDots(character.attributes, 'Самообладание'),
    getAttributeDots(character.attributes, 'Упорство'),
  )
}

function getWillpowerImpairmentPenalty(parts: string[], character?: CharacterOption | null) {
  const willpower = getCharacterWillpower(character)
  if (!willpower.impaired) return 0
  return parts.some(part => WILLPOWER_IMPAIRED_ATTRIBUTES.includes(part)) ? -2 : 0
}

function isWillpowerRerollExcluded(roll: RollMessage) {
  const text = `${roll.poolType} ${roll.poolName}`.toLocaleLowerCase('ru')
  return roll.poolType === 'rouse-check'
    || roll.poolType === 'willpower'
    || roll.poolType === 'willpower-check'
    || roll.poolType === 'humanity-check'
    || roll.poolType === 'remorse-check'
    || roll.meta?.rollKind === 'humanity_check'
    || roll.meta?.rollKind === 'remorse_check'
    || /проверка воли|вол[яи]|человеч|willpower|humanity/.test(text)
}

function getBloodSurgeBonus(bloodPotency: number) {
  const potency = Math.max(0, Math.min(10, Math.floor(Number(bloodPotency) || 0)))
  if (potency <= 0) return 1
  if (potency <= 2) return 2
  if (potency <= 4) return 3
  if (potency <= 6) return 4
  if (potency <= 8) return 5
  return 6
}

function getRouseWarning(result: RouseCheckResult) {
  if (!result.maxHungerWarning) return ''
  return 'Голод уже 5. Неудачное Испытание Крови на максимальном Голоде: нужна реакция Рассказчика / риск голодной ярости.'
}

function getDieImage(die: Die) {
  return DIE_IMAGES[die.kind] || DIE_IMAGES.fail
}

function parsePowerPool(pool: string, disciplineNames: string[]) {
  const normalizedPool = pool.trim()
  if (!normalizedPool || normalizedPool === '—' || /^(зависит|как применяемая|depends|as\s)/i.test(normalizedPool)) return []
  // pool text uses "vs." in English (rules_eng.json) and "против" (no period) in Russian.
  const playerSide = normalizedPool.split(/\s+(?:vs\.?|против)\s+/i)[0].split(';')[0].replace(/\s*\([^)]*\)\s*/g, '').trim()
  if (!playerSide) return []
  const knownNames = [...ATTRIBUTE_NAMES, ...SKILL_NAMES, ...disciplineNames]

  const choices = playerSide.split(/\s*\+\s*/).map(source => {
    const options = source
      .split(/\s+(?:или|or)\s+|\//i)
      .map(option => findCrossLanguageName(option, knownNames))
      .filter(Boolean)
    return { source: source.trim(), options } as PowerPoolChoice
  })
  return choices.every(choice => choice.options.length > 0) ? choices : []
}

function getSelectedPowerNames(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map(power => {
      if (typeof power === 'string') return power
      if (!power || typeof power !== 'object') return ''
      const record = power as Record<string, unknown>
      return String(record.name || record['название'] || '')
    })
    .filter(Boolean)
}

function getSelectedPathPowerNames(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([pathName, powers]) => {
      const names = getSelectedPowerNames(powers)
      return names.length ? [[pathName, names]] : []
    }),
  ) as Record<string, string[]>
}

function getSelectedPathPowerLabels(value: unknown) {
  return Object.entries(getSelectedPathPowerNames(value))
    .flatMap(([pathName, powers]) => powers.map(power => `${pathName} / ${power}`))
}

function getPathPowerNameSet(value: unknown) {
  return new Set(
    Object.values(getSelectedPathPowerNames(value)).flat(),
  )
}

function getStandaloneSelectedPowerNames(
  selectedPowers: unknown,
  selectedPathPowers: unknown,
) {
  const pathPowerNames = getPathPowerNameSet(selectedPathPowers)
  return getSelectedPowerNames(selectedPowers)
    .filter(name => !pathPowerNames.has(name))
}

function getSelectedDisciplinePowerLabels(
  selectedPowers: unknown,
  selectedPathPowers: unknown,
) {
  return [
    ...getStandaloneSelectedPowerNames(selectedPowers, selectedPathPowers),
    ...getSelectedPathPowerLabels(selectedPathPowers),
  ]
}

function hasSelectedPathPowers(value: unknown) {
  return getSelectedPathPowerLabels(value).length > 0
}

function isPowerEntrySelected(
  power: DisciplinePowerEntry,
  selectedPowerNames: string[],
  selectedPathPowers: Record<string, string[]>,
) {
  if (selectedPowerNames.includes(power.name)) return true
  return Boolean(power.path && selectedPathPowers[power.path]?.includes(power.name))
}

function getDisciplinePowerDots(
  character: CharacterOption,
  disciplineName: string,
  pathName?: string,
) {
  const sources = character.disciplines[disciplineName] || {}
  if (pathName && Number(sources[pathName]) > 0) {
    return Number(sources[pathName]) || 0
  }
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

function getActiveEffectTitle(
  activeEffect: CharacterOption['activeEffects'][number],
) {
  return activeEffect.effect.label
    || activeEffect.source.power
    || activeEffect.effect.type
}

function getPayloadValueLabel(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const payloadLabels: Record<string, string> = {
    commandText: 'команда',
    memoryGap: 'провал',
    falseMemory: 'ложная память',
    triggerText: 'триггер',
    groupTarget: 'группа',
    disguiseText: 'маскировка',
    objectText: 'объект',
    senseTarget: 'цель',
    questionText: 'вопрос',
    telepathyMessage: 'мысль',
    possessionTarget: 'носитель',
    areaText: 'место',
    famulusName: 'фамулус',
    animalSpecies: 'вид',
    animalCommand: 'приказ',
    swarmTarget: 'цель роя',
    frenzyTarget: 'цель ярости',
    feedingSource: 'питание',
    targetName: 'цель',
    bloodSample: 'образец крови',
    weaponName: 'оружие',
    deliveryMethod: 'способ',
    ritualTarget: 'цель ритуала',
    ritualComponents: 'компоненты',
    alchemyMethod: 'метод',
    alchemyFormula: 'формула',
    formulaTarget: 'цель формулы',
    alchemyResonance: 'резонанс',
    alchemyIngredients: 'ингредиенты',
    imitatedDiscipline: 'дисциплина',
    imitatedPower: 'сила',
  }
  const label = payloadLabels[key] || key
  return `${label}: ${String(value)}`
}

function getActiveEffectPayloadDescription(
  activeEffect: CharacterOption['activeEffects'][number],
) {
  const payload = activeEffect.effect.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ''
  }

  return Object.entries(payload)
    .map(([key, value]) => getPayloadValueLabel(key, value))
    .filter(Boolean)
    .join(' · ')
}

function getActiveEffectDescription(
  activeEffect: CharacterOption['activeEffects'][number],
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  return [
    activeEffect.effect.description,
    getActiveEffectPayloadDescription(activeEffect),
    activeEffect.source.path,
    activeEffect.source.level
      ? tf('уровень {level}', { level: activeEffect.source.level })
      : '',
    getDisciplineDurationLabel(activeEffect.duration, t, tf),
  ].filter(Boolean).join(' · ')
}

function getExtraTraitNames(values: Record<string, unknown>, groups: ReadonlyArray<{ traits: readonly string[] }>) {
  // groups list Russian trait names only; include each one's English spelling too so
  // characters whose data was saved in English mode aren't all misfiled as "extra".
  const known = new Set(groups.flatMap(group => group.traits.flatMap(name => [name, ATTRIBUTE_NAME_EN[name] || SKILL_NAME_EN[name] || name])))
  return Object.keys(values).filter(name => !known.has(name)).sort((a, b) => a.localeCompare(b, 'ru'))
}

function getDotDisplay(value: number) {
  const dots = Math.max(0, Math.min(5, Math.floor(Number(value) || 0)))
  return `${'●'.repeat(dots)}${'○'.repeat(5 - dots)}`
}

function formatRuleValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatRuleValue).join(' · ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key.replaceAll('_', ' ')}: ${formatRuleValue(nestedValue)}`)
      .join(' · ')
  }
  return String(value)
}

function getDisciplinePowerInputFields(
  mechanics: DisciplinePowerRule['mechanics'] | undefined,
): DisciplinePowerInputField[] {
  const fields = mechanics?.input?.fields
  if (!Array.isArray(fields)) return []

  return fields.flatMap(field => {
    if (!field || typeof field !== 'object' || typeof field.id !== 'string' || !field.id.trim()) {
      return []
    }
    return [{
      ...field,
      id: field.id.trim(),
      type: field.type || 'text',
    }]
  })
}

function getDisciplineManualPrompts(
  mechanics: DisciplinePowerRule['mechanics'] | undefined,
) {
  const effects = mechanics?.effects
  if (!Array.isArray(effects)) return []

  return effects.flatMap(effect => {
    if (!effect || typeof effect !== 'object') return []
    const record = effect as Record<string, unknown>
    if (record.type !== 'manual_prompt') return []
    const label = typeof record.label === 'string' ? record.label : ''
    const description = typeof record.description === 'string' ? record.description : ''
    const message = typeof record.message === 'string' ? record.message : ''
    if (!label && !description && !message) return []
    return [{ label, description, message }]
  })
}

function getRoomFromLocation() {
  if (typeof window === 'undefined') return 'campaign-666'
  return new URLSearchParams(window.location.search).get('room') || window.localStorage.getItem('vtm-table-room') || 'campaign-666'
}

function getRoleFromLocation() {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'master' || role === 'player' ? role : null
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function getJournalReferencedMediaUrls(currentEntries: JournalEntry[]) {
  if (typeof window === 'undefined') return new Set<string>()
  const entries = [...currentEntries]

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith('vtm-journal:')) continue
      const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
      if (Array.isArray(parsed)) entries.push(...parsed)
    }
  } catch (error) {
    console.warn('Не удалось проверить ссылки дневника перед удалением медиа:', error)
  }

  const urls = new Set<string>()
  entries.forEach(entry => {
    extractImageUrlsFromHtml(entry.text || '').forEach(url => urls.add(url))
    entry.attachments?.forEach(attachment => {
      if (attachment.kind === 'image' && attachment.url) urls.add(attachment.url)
    })
  })
  return urls
}

function isMediaUrlReferencedInJournal(url: string, journalUrls: Set<string>) {
  if (!url) return false
  if (journalUrls.has(url)) return true
  const storagePath = getStoragePathFromPublicUrl(url)
  if (!storagePath) return false
  for (const journalUrl of journalUrls) {
    if (getStoragePathFromPublicUrl(journalUrl) === storagePath) return true
  }
  return false
}

// ─── Self-measuring context menu positioner ────────────────────────────────
// Renders initially hidden, measures its real size, then snaps to the best
// position near the cursor so it never clips off the screen edges.

function SmartContextMenu({
  x,
  y,
  children,
  onClick,
}: {
  x: number
  y: number
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = x + width + margin > vw ? Math.max(margin, x - width - margin) : x + margin
    const top  = y + height + margin > vh ? Math.max(margin, vh - height - margin) : y
    setPos({ left, top })
  }, [x, y])

  return (
    <div
      ref={ref}
      className="layer-context-menu"
      style={pos
        ? { left: pos.left, top: pos.top }
        : { left: x, top: y, visibility: 'hidden' }
      }
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export default function VampireTable() {
  const { t, tf, lang } = useLang()
  const d10 = (n: number) => lang === 'en' ? `${n}d10` : `${n}к10`
  const [room, setRoom] = useState('campaign-666')
  const [tableRole, setTableRole] = useState<TableRole | null>(null)
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [diceOverlayQueue, setDiceOverlayQueue] = useState<DiceOverlayRoll[]>([])
  const shownDiceOverlayIdsRef = useRef<Set<string>>(new Set())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [chatCharacters, setChatCharacters] = useState<CharacterOption[]>([])
  const [selectedChatCharacterId, setSelectedChatCharacterId] = useState('')
  const [roomParticipants, setRoomParticipants] = useState<ActiveParticipant[]>([])
  const [previewCharacter, setPreviewCharacter] = useState<CharacterOption | null>(null)
  const [previewCharacterTab, setPreviewCharacterTab] = useState<'mechanics' | 'inventory'>('mechanics')
  const [previewRollAttribute, setPreviewRollAttribute] = useState('')
  const [previewRollAttributeTwo, setPreviewRollAttributeTwo] = useState('')
  const [previewRollSkill, setPreviewRollSkill] = useState('')
  const [previewRollDiscipline, setPreviewRollDiscipline] = useState('')
  const [previewRollModifier, setPreviewRollModifier] = useState(0)
  const [disabledPreviewRollModifierIds, setDisabledPreviewRollModifierIds] = useState<string[]>([])
  const [previewRollMode, setPreviewRollMode] = useState<RollMode>('normal')
  const [previewContestedOpponentId, setPreviewContestedOpponentId] = useState('')
  const [selectedMasterRollCharacterId, setSelectedMasterRollCharacterId] = useState('')
  const [masterRollVisibility, setMasterRollVisibility] = useState<'public' | 'hidden'>('hidden')
  const [masterRollAttribute, setMasterRollAttribute] = useState('')
  const [masterRollAttributeTwo, setMasterRollAttributeTwo] = useState('')
  const [masterRollSkill, setMasterRollSkill] = useState('')
  const [masterRollDiscipline, setMasterRollDiscipline] = useState('')
  const [masterRollModifier, setMasterRollModifier] = useState(0)
  const [disabledMasterRollModifierIds, setDisabledMasterRollModifierIds] = useState<string[]>([])
  const [masterRollMode, setMasterRollMode] = useState<RollMode>('normal')
  const [masterContestedOpponentId, setMasterContestedOpponentId] = useState('')
  const [incomingOpposedProposal, setIncomingOpposedProposal] = useState<OpposedRollProposal | null>(null)
  const [opposedResponseSide, setOpposedResponseSide] = useState<RollPoolBuilder>({ ...DEFAULT_OPPOSED_RESPONSE })
  const [previewDisciplineName, setPreviewDisciplineName] = useState('')
  const [disciplineRules, setDisciplineRules] = useState<Record<string, DisciplineRule> | null>(null)
  const [disciplineRulesStatus, setDisciplineRulesStatus] = useState('')
  const [previewPowerName, setPreviewPowerName] = useState('')
  const [previewPowerPoolSelections, setPreviewPowerPoolSelections] = useState<string[]>([])
  const [previewPowerModifier, setPreviewPowerModifier] = useState(0)
  const [disabledPreviewPowerModifierIds, setDisabledPreviewPowerModifierIds] = useState<string[]>([])
  const [previewPowerInputValues, setPreviewPowerInputValues] = useState<Record<string, string>>({})
  const [previewUseBloodSurge, setPreviewUseBloodSurge] = useState(false)
  const [masterUseBloodSurge, setMasterUseBloodSurge] = useState(false)
  const [willpowerRerollDraft, setWillpowerRerollDraft] = useState<WillpowerRerollDraft | null>(null)
  const [quickInventoryName, setQuickInventoryName] = useState('')
  const [quickInventoryCategory, setQuickInventoryCategory] = useState<(typeof INVENTORY_CATEGORIES)[number]>('Другое')
  const [quickInventoryQuantity, setQuickInventoryQuantity] = useState(1)
  const [quickInventoryStatus, setQuickInventoryStatus] = useState('')
  const [isQuickInventoryBusy, setIsQuickInventoryBusy] = useState(false)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState('')
  const [journalSearch, setJournalSearch] = useState('')
  const [journalSaveStatus, setJournalSaveStatus] = useState('Сохранено')
  const [masterReveals, setMasterReveals] = useState<MasterReveal[]>([])
  const [masterWhispers, setMasterWhispers] = useState<MasterWhisper[]>([])
  const [masterChatDraft, setMasterChatDraft] = useState('')
  const [selectedMasterChatUserId, setSelectedMasterChatUserId] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [chatUsernameDraft, setChatUsernameDraft] = useState('')
  const [chatPasswordDraft, setChatPasswordDraft] = useState('')
  const [chatAuthMode, setChatAuthMode] = useState<'login' | 'register'>('login')
  const [chatStatus, setChatStatus] = useState('Чат подключается...')
  const [isChatBusy, setIsChatBusy] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Голос выключен')
  const [voiceMasterVolume, setVoiceMasterVolume] = useState(1)
  const [voiceQuality, setVoiceQuality] = useState<VoiceQuality>('clear')
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([])
  const [scenes, setScenes] = useState<TableScene[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [sceneMusic, setSceneMusic] = useState<SceneMusicTrack[]>([])
  const [sceneMusicDraft, setSceneMusicDraft] = useState('')
  const [sceneStatus, setSceneStatus] = useState('Сцены загружаются...')
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set())
  const [previewLayerId, setPreviewLayerId] = useState<string | null>(null)
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [handNotice, setHandNotice] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [mediaUrlDraft, setMediaUrlDraft] = useState('')
  const [mediaSearchDraft, setMediaSearchDraft] = useState('')
  const [textMaterialDraft, setTextMaterialDraft] = useState('')
  const [textMaterialNameDraft, setTextMaterialNameDraft] = useState('')
  const [masterPasswordDraft, setMasterPasswordDraft] = useState('')
  const [masterPasswordEdit, setMasterPasswordEdit] = useState('1234')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [layerContextMenu, setLayerContextMenu] = useState<LayerContextMenu>(null)
  const [imageEditor, setImageEditor] = useState<ImageEditorDraft | null>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [layerDropTarget, setLayerDropTarget] = useState<LayerDropTarget>(null)
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('rolls')
  const [mediaTab, setMediaTab] = useState<MediaTab>('layers')
  const [leftToolbarTab, setLeftToolbarTab] = useState<LeftToolbarTab>('scenes')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [musicPanelOpen, setMusicPanelOpen] = useState(true)
  const [chatPanelTab, setChatPanelTab] = useState<ChatPanelTab>('text')
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const backgroundFileInputRef = useRef<HTMLInputElement>(null)
  const sceneMusicFileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const dragAnimationFrameRef = useRef<number | null>(null)
  const pendingDragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const dragLayerElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const dragPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragPreviewBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const touchGestureRef = useRef<TouchGestureState | null>(null)
  const layersRef = useRef<TableLayer[]>([])
  const scenesRef = useRef<TableScene[]>([])
  const activeSceneIdRef = useRef<string | null>(null)
  const sceneMusicRef = useRef<SceneMusicTrack[]>([])
  const panRef = useRef(pan)
  const roomRef = useRef(room)
  const chatUserRef = useRef<ChatUser | null>(null)
  const chatCharactersRef = useRef<CharacterOption[]>([])
  const selectedChatCharacterIdRef = useRef('')
  const journalEntriesRef = useRef<JournalEntry[]>([])
  const voiceEnabledRef = useRef(false)
  const voiceMutedRef = useRef(false)

  useEffect(() => {
    const folderInput = folderInputRef.current
    if (!folderInput) return
    folderInput.setAttribute('webkitdirectory', '')
    folderInput.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    setPreviewCharacterTab('mechanics')
    setPreviewRollAttribute('')
    setPreviewRollAttributeTwo('')
    setPreviewRollSkill('')
    setPreviewRollDiscipline('')
    setPreviewRollModifier(0)
    setDisabledPreviewRollModifierIds([])
    setPreviewRollMode('normal')
    setPreviewContestedOpponentId('')
    setPreviewDisciplineName('')
    setPreviewPowerName('')
    setDisabledPreviewPowerModifierIds([])
    setPreviewUseBloodSurge(false)
    setQuickInventoryName('')
    setQuickInventoryCategory('Другое')
    setQuickInventoryQuantity(1)
    setQuickInventoryStatus('')
  }, [previewCharacter?.id])

  useEffect(() => {
    const shouldLoadDisciplineRules = Boolean(
      previewDisciplineName
      || previewCharacter?.id
      || selectedMasterRollCharacterId,
    )
    if (!shouldLoadDisciplineRules || disciplineRules) return
    const controller = new AbortController()
    setDisciplineRulesStatus('Загружаю описание дисциплины...')
    Promise.all([
      fetch('/rules.json', { signal: controller.signal }),
      fetch('/rules_eng.json', { signal: controller.signal }),
    ])
      .then(async ([ruResponse, enResponse]) => {
        if (!ruResponse.ok) throw new Error('rules.json не найден')
        const ruRules = await ruResponse.json() as { disciplines?: Record<string, DisciplineRule> }
        const enRules = enResponse.ok
          ? await enResponse.json() as { disciplines?: Record<string, DisciplineRule> }
          : {}
        return {
          ...(ruRules.disciplines || {}),
          ...(enRules.disciplines || {}),
        }
      })
      .then(disciplines => {
        setDisciplineRules(disciplines)
        setDisciplineRulesStatus('')
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Не удалось загрузить правила дисциплин:', error)
        setDisciplineRulesStatus('Не удалось загрузить описание дисциплины.')
      })
    return () => controller.abort()
  }, [previewDisciplineName, previewCharacter?.id, selectedMasterRollCharacterId, disciplineRules])
  const voiceQualityRef = useRef<VoiceQuality>('clear')
  const voiceParticipantsRef = useRef<VoiceParticipant[]>([])
  const localVoiceStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const voiceAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const suppressNextContextMenuRef = useRef(false)
  const isMaster = tableRole === 'master'

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => () => {
    if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current)
  }, [])

  useEffect(() => {
    scenesRef.current = scenes
  }, [scenes])

  useEffect(() => {
    activeSceneIdRef.current = activeSceneId
  }, [activeSceneId])

  useEffect(() => {
    sceneMusicRef.current = sceneMusic
  }, [sceneMusic])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useEffect(() => {
    roomRef.current = room
  }, [room])

  useEffect(() => {
    chatUserRef.current = chatUser
  }, [chatUser])

  useEffect(() => {
    chatCharactersRef.current = chatCharacters
  }, [chatCharacters])

  useEffect(() => {
    selectedChatCharacterIdRef.current = selectedChatCharacterId
  }, [selectedChatCharacterId])

  useEffect(() => {
    journalEntriesRef.current = journalEntries
  }, [journalEntries])

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
  }, [voiceEnabled])

  useEffect(() => {
    voiceMutedRef.current = voiceMuted
  }, [voiceMuted])

  useEffect(() => {
    voiceQualityRef.current = voiceQuality
  }, [voiceQuality])

  useEffect(() => {
    voiceParticipantsRef.current = voiceParticipants
    voiceParticipants.forEach(participant => {
      const audio = voiceAudioRefs.current.get(participant.id)
      if (audio) audio.volume = Math.max(0, Math.min(1, participant.volume * voiceMasterVolume))
    })
  }, [voiceParticipants, voiceMasterVolume])

  useEffect(() => {
    const savedMasterPassword = window.localStorage.getItem(MASTER_PASSWORD_KEY) || '1234'
    setMasterPasswordEdit(savedMasterPassword)
    const savedRole = window.localStorage.getItem('vtm-table-role')
    const urlRole = getRoleFromLocation()
    if (urlRole === 'player') {
      window.localStorage.setItem('vtm-table-role', urlRole)
      setTableRole(urlRole)
    } else if (urlRole === 'master') {
      window.localStorage.removeItem('vtm-table-role')
    } else if (savedRole === 'master' || savedRole === 'player') setTableRole(savedRole)

    const savedUser = window.localStorage.getItem('vtm-chat-user')
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as ChatUser
        if (parsed?.id && parsed?.username) setChatUser(parsed)
      } catch {
        window.localStorage.removeItem('vtm-chat-user')
      }
    }
  }, [])

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight })
  }, [chatMessages, rightRailTab, chatPanelTab])

  useEffect(() => {
    if (!chatUser) {
      setChatCharacters([])
      setSelectedChatCharacterId('')
      setSelectedMasterRollCharacterId('')
      return
    }

    let cancelled = false
    createClient()
      .from('characters')
      .select('id, name, clan, data')
      .eq('user_id', chatUser.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить персонажей:', error)
          setChatStatus('Персонажи не загрузились')
          return
        }

        const characters = (data || []).map(row => mapCharacterRow(row as CharacterRow))
        setChatCharacters(characters)
        const savedId = window.localStorage.getItem(`vtm-chat-character:${chatUser.id}:${roomRef.current}`)
          || window.localStorage.getItem(`vtm-chat-character:${chatUser.id}`)
        const nextId = savedId && characters.some(character => character.id === savedId)
          ? savedId
          : characters[0]?.id || ''
        const savedMasterRollId = window.localStorage.getItem(`vtm-master-roll-character:${chatUser.id}:${roomRef.current}`)
          || window.localStorage.getItem(`vtm-master-roll-character:${chatUser.id}`)
        const nextMasterRollId = savedMasterRollId && characters.some(character => character.id === savedMasterRollId)
          ? savedMasterRollId
          : nextId
        setSelectedChatCharacterId(nextId)
        setSelectedMasterRollCharacterId(nextMasterRollId)
        if (nextId) {
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}:${roomRef.current}`, nextId)
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, nextId)
        }
        if (nextMasterRollId) {
          window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}:${roomRef.current}`, nextMasterRollId)
          window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}`, nextMasterRollId)
        }
      })

    return () => {
      cancelled = true
    }
  }, [chatUser])

  useEffect(() => {
    if (!layerContextMenu) return
    const closeMenu = () => setLayerContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('keydown', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('keydown', closeMenu)
    }
  }, [layerContextMenu])

  useEffect(() => {
    const handleHotkeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setRightRailTab('media')
        setMediaTab('library')
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-media-search]')?.focus(), 0)
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setRightRailTab('media')
        setMediaTab('layers')
        setRightPanelOpen(true)
      }
    }

    window.addEventListener('keydown', handleHotkeys)
    return () => window.removeEventListener('keydown', handleHotkeys)
  }, [])

  const chooseTableRole = (role: TableRole) => {
    window.localStorage.setItem('vtm-table-role', role)
    setTableRole(role)
  }

  const enterAsMaster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const currentPassword = window.localStorage.getItem(MASTER_PASSWORD_KEY) || '1234'
    if (masterPasswordDraft !== currentPassword) {
      window.alert(t('Пароль мастера не подошёл.'))
      return
    }
    setMasterPasswordDraft('')
    chooseTableRole('master')
  }

  const saveMasterPassword = () => {
    window.localStorage.setItem(MASTER_PASSWORD_KEY, masterPasswordEdit)
    window.alert(t('Пароль мастера обновлён.'))
  }

  const resetTableRole = () => {
    window.localStorage.removeItem('vtm-table-role')
    setTableRole(null)
  }

  const getSelectedSceneId = () => selectedSceneId || activeSceneId || scenes[0]?.id || null

  const loadLayersForScene = async (targetRoom: string, sceneId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE_IMAGES)
      .select('id, room, scene_id, layer_type, owner_role, owner_id, parent_id, name, image_data, x, y, width, height, crop_x, crop_y, crop_width, crop_height, z_index, visible, locked, opacity, blend_mode, rotation, flip_x, flip_y, brightness, contrast, saturation, on_table, created_at')
      .eq('room', targetRoom)
      .eq('scene_id', sceneId)
      .order('z_index', { ascending: true })
      .limit(160)

    if (error) {
      console.error('Не удалось загрузить слои сцены:', error)
      setTableStatus('Слои сцены не загрузились')
      return
    }

    const next = sortLayers((data || []).map(row => mapLayerRow(row as TableLayerRow)))
    layersRef.current = next
    setLayers(next)
    setSelectedLayerId(null)
    setSelectedLayerIds(new Set())
    setTableStatus(next.length ? 'Сцена онлайн' : 'Пустая сцена')
  }

  const loadSceneMusic = async (targetRoom: string, sceneId: string) => {
    const { data, error } = await createClient()
      .from(TABLE_SCENE_MUSIC)
      .select('id, room, scene_id, title, url, source_type, order_index, is_default, autoplay, created_at, updated_at')
      .eq('room', targetRoom)
      .eq('scene_id', sceneId)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Не удалось загрузить музыку сцены:', error)
      setSceneMusic([])
      sceneMusicRef.current = []
      return
    }
    const loadedTracks = sortSceneMusic((data || []).map(row => mapSceneMusicRow(row as SceneMusicRow)))
    sceneMusicRef.current = loadedTracks
    setSceneMusic(loadedTracks)
  }

  const ensureDefaultScene = async (targetRoom: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE_SCENES)
      .select('id, room, name, thumbnail_url, is_active, created_by, created_at, updated_at')
      .eq('room', targetRoom)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Не удалось загрузить сцены:', error)
      setSceneStatus('Нужно применить SQL для сцен')
      return null
    }

    let nextScenes = sortScenes((data || []).map(row => mapSceneRow(row as TableSceneRow)))

    if (nextScenes.length === 0) {
      const now = new Date().toISOString()
      const scene: TableScene = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: targetRoom,
        name: t(DEFAULT_SCENE_NAME),
        thumbnailUrl: '',
        isActive: true,
        createdBy: 'master',
        createdAt: now,
        updatedAt: now,
      }
      const { error: insertError } = await supabase.from(TABLE_SCENES).insert({
        id: scene.id,
        room: scene.room,
        name: scene.name,
        thumbnail_url: scene.thumbnailUrl,
        is_active: scene.isActive,
        created_by: scene.createdBy,
        created_at: scene.createdAt,
        updated_at: scene.updatedAt,
      })
      if (insertError) {
        console.error('Не удалось создать дефолтную сцену:', insertError)
        setSceneStatus('Дефолтная сцена не создана')
        return null
      }
      nextScenes = [scene]
      await supabase.from(TABLE_IMAGES).update({ scene_id: scene.id }).eq('room', targetRoom).is('scene_id', null)
    }

    const active = nextScenes.find(scene => scene.isActive) || nextScenes[0]
    await supabase.from(TABLE_IMAGES).update({ scene_id: active.id }).eq('room', targetRoom).is('scene_id', null)
    setScenes(nextScenes.map(scene => ({ ...scene, isActive: scene.id === active.id })))
    setActiveSceneId(active.id)
    activeSceneIdRef.current = active.id
    setSelectedSceneId(prev => (prev && nextScenes.some(scene => scene.id === prev) ? prev : active.id))
    setSceneStatus('Сцены онлайн')
    return active.id
  }

  const createScene = async () => {
    if (!isMaster) return
    const name = window.prompt(t('Название сцены'), t('Новая сцена'))?.trim()
    if (!name) return
    const now = new Date().toISOString()
    const scene: TableScene = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      name,
      thumbnailUrl: '',
      isActive: scenes.length === 0,
      createdBy: currentOwnerId,
      createdAt: now,
      updatedAt: now,
    }
    const { error } = await createClient().from(TABLE_SCENES).insert({
      id: scene.id,
      room: scene.room,
      name: scene.name,
      thumbnail_url: scene.thumbnailUrl,
      is_active: scene.isActive,
      created_by: scene.createdBy,
      created_at: scene.createdAt,
      updated_at: scene.updatedAt,
    })
    if (error) {
      console.error('Не удалось создать сцену:', error)
      setSceneStatus('Сцена не создана')
      return
    }
    setScenes(prev => upsertScene(prev, scene))
    setSelectedSceneId(scene.id)
    broadcast('scene', scene)
  }

  const renameScene = async () => {
    if (!isMaster || !selectedScene) return
    const name = window.prompt(t('Новое название сцены'), selectedScene.name)?.trim()
    if (!name || name === selectedScene.name) return
    const updatedAt = new Date().toISOString()
    const next = { ...selectedScene, name, updatedAt }
    setScenes(prev => upsertScene(prev, next))
    const { error } = await createClient().from(TABLE_SCENES).update({ name, updated_at: updatedAt }).eq('id', selectedScene.id)
    if (error) {
      console.error('Не удалось переименовать сцену:', error)
      setSceneStatus('Название сцены не сохранилось')
      return
    }
    broadcast('scene', next)
  }

  const publishSceneTrack = async (track: SceneMusicTrack, options: { play?: boolean } = { play: true }) => {
    const now = new Date().toISOString()
    const provider = getMusicProvider(track.url)
    const youtube = provider === 'youtube' ? parseYouTubeUrl(track.url) : { videoId: '', playlistId: undefined }
    const payload = {
      room: roomRef.current,
      url: track.url,
      activeUri: provider === 'youtube' ? youtube.playlistId || youtube.videoId : track.url,
      isPlaying: Boolean(options.play),
      positionSeconds: 0,
      updatedAt: now,
      provider,
      playlistId: youtube.playlistId,
      playlistIndex: youtube.playlistId ? Math.max(0, track.orderIndex) : undefined,
      trackId: youtube.videoId || undefined,
      sourceType: provider,
    }
    const nextMusic = toMusicDbRow(payload)

    let persistLegacyMusic = !supportsExtendedTableMusicSchema
    if (supportsExtendedTableMusicSchema) {
      const { error } = await createClient().from(TABLE_MUSIC).upsert(nextMusic)
      if (isMissingColumnError(error)) {
        supportsExtendedTableMusicSchema = false
        persistLegacyMusic = true
      } else if (error) {
        console.error('Не удалось сохранить расширенное состояние музыки сцены:', error)
        persistLegacyMusic = true
      }
    }

    if (persistLegacyMusic) {
      await createClient().from(TABLE_MUSIC).upsert(toLegacyMusicDbRow(payload))
    }
    window.dispatchEvent(new CustomEvent('vtm-music-state', { detail: payload }))
    broadcastMusicChannel(channelRef.current, 'music', payload)
  }

  const raiseHand = () => {
    const character = chatCharacters.find(item => item.id === selectedChatCharacterId)
    const name = character?.name || chatUser?.username || (isMaster ? t('Мастер') : t('Игрок'))
    const payload = { room, name, at: new Date().toISOString() }
    setHandNotice(tf('{name} поднял руку', { name }))
    window.setTimeout(() => setHandNotice(''), 5200)
    broadcast('hand-raise', payload)
  }

  const playSceneAutoplayMusic = async (sceneId: string) => {
    const tracks = sceneId === activeSceneIdRef.current
      ? sceneMusicRef.current
      : await createClient()
        .from(TABLE_SCENE_MUSIC)
        .select('id, room, scene_id, title, url, source_type, order_index, is_default, autoplay, created_at, updated_at')
        .eq('room', roomRef.current)
        .eq('scene_id', sceneId)
        .then(({ data }) => (data || []).map(row => mapSceneMusicRow(row as SceneMusicRow)))
    const track = sortSceneMusic(tracks).find(item => item.autoplay && item.isDefault) || sortSceneMusic(tracks).find(item => item.autoplay)
    if (!track?.url) return
    await publishSceneTrack(track, { play: true })
  }

  const activateScene = async (sceneId: string) => {
    if (!isMaster) return
    const scene = scenesRef.current.find(item => item.id === sceneId)
    if (!scene) return
    const supabase = createClient()
    await supabase.from(TABLE_SCENES).update({ is_active: false, updated_at: new Date().toISOString() }).eq('room', room).neq('id', sceneId)
    const { error } = await supabase.from(TABLE_SCENES).update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', sceneId)
    if (error) {
      console.error('Не удалось переключить сцену:', error)
      setSceneStatus('Сцена не переключилась')
      return
    }
    setActiveSceneId(sceneId)
    activeSceneIdRef.current = sceneId
    setSelectedSceneId(sceneId)
    setScenes(prev => prev.map(item => ({ ...item, isActive: item.id === sceneId })))
    await loadLayersForScene(room, sceneId)
    await loadSceneMusic(room, sceneId)
    broadcast('scene-active', { room, sceneId })
    void playSceneAutoplayMusic(sceneId)
  }

  const deleteScene = async () => {
    if (!isMaster || !selectedScene) return
    if (scenes.length <= 1) {
      window.alert(t('Нельзя удалить единственную сцену.'))
      return
    }
    const ok = window.confirm(tf('Удалить сцену "{name}" вместе с её слоями, медиа и музыкой?', { name: selectedScene.name }))
    if (!ok) return
    const nextActive = selectedScene.isActive ? scenes.find(scene => scene.id !== selectedScene.id) : activeScene
    const supabase = createClient()
    await supabase.from(TABLE_SCENE_MUSIC).delete().eq('scene_id', selectedScene.id)
    await supabase.from(TABLE_IMAGES).delete().eq('scene_id', selectedScene.id)
    const { error } = await supabase.from(TABLE_SCENES).delete().eq('id', selectedScene.id)
    if (error) {
      console.error('Не удалось удалить сцену:', error)
      setSceneStatus('Сцена не удалена')
      return
    }
    setScenes(prev => prev.filter(scene => scene.id !== selectedScene.id))
    broadcast('scene-delete', { room, id: selectedScene.id, nextActiveSceneId: nextActive?.id })
    if (nextActive?.id && selectedScene.isActive) await activateScene(nextActive.id)
    else setSelectedSceneId(nextActive?.id || null)
  }

  const setSceneThumbnailFromSelection = async () => {
    if (!isMaster || !selectedScene) return
    const layer = layers.find(item => selectedLayerIds.has(item.id) && item.layerType === 'image')
    if (!layer) {
      window.alert(t('Выдели картинку на активной сцене, чтобы сделать её preview.'))
      return
    }
    const updatedAt = new Date().toISOString()
    const next = { ...selectedScene, thumbnailUrl: layer.imageData, updatedAt }
    setScenes(prev => upsertScene(prev, next))
    await createClient().from(TABLE_SCENES).update({ thumbnail_url: layer.imageData, updated_at: updatedAt }).eq('id', selectedScene.id)
    broadcast('scene', next)
  }

  const saveSelectionAsGroup = async () => {
    if (!isMaster || selectedLayerIds.size === 0) return
    const name = window.prompt(t('Название группы'), t('Группа сцены'))?.trim()
    if (!name) return
    const folderId = await createFolder(null, name, true, false)
    if (!folderId) return
    const selected = [...selectedLayerIds]
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => layer.layerType !== 'folder')
    for (const [index, layer] of selected.entries()) {
      const createdId = await addMediaLayer(
        layer.imageData,
        layer.name,
        { width: layer.width, height: layer.height },
        layer.layerType === 'folder' ? 'file' : layer.layerType,
        index,
        { x: layer.x, y: layer.y },
        false
      )
      if (createdId) await patchLayer(createdId, { parentId: folderId })
    }
    setExpandedFolders(prev => new Set(prev).add(folderId))
  }

  const fetchYouTubeTitle = async (url: string): Promise<string | null> => {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const response = await fetch(oembedUrl)
      if (!response.ok) return null
      const data = await response.json() as { title?: string }
      return data.title || null
    } catch {
      return null
    }
  }

  const addSceneMusic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isMaster || !selectedScene) return
    const urls = sceneMusicDraft.split(/\s+/).map(item => item.trim()).filter(Boolean)
    if (urls.length === 0) return
    const supabase = createClient()
    const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
    for (const [index, url] of urls.entries()) {
      const now = new Date().toISOString()
      const provider = getMusicProvider(url)
      const defaultTitle = tf('Трек {n}', { n: baseOrder + index + 2 })
      const youtubeTitle = provider === 'youtube' ? await fetchYouTubeTitle(url) : null
      const track: SceneMusicTrack = {
        id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        room,
        sceneId: selectedScene.id,
        title: youtubeTitle || defaultTitle,
        url,
        sourceType: provider,
        orderIndex: baseOrder + index + 1,
        isDefault: selectedSceneMusic.length === 0 && index === 0,
        autoplay: selectedSceneMusic.length === 0 && index === 0,
        createdAt: now,
        updatedAt: now,
      }
      const { error } = await supabase.from(TABLE_SCENE_MUSIC).insert({
        id: track.id,
        room: track.room,
        scene_id: track.sceneId,
        title: track.title,
        url: track.url,
        source_type: track.sourceType,
        order_index: track.orderIndex,
        is_default: track.isDefault,
        autoplay: track.autoplay,
        created_at: track.createdAt,
        updated_at: track.updatedAt,
      })
      if (!error) {
        setSceneMusic(prev => sortSceneMusic([...prev, track]))
        broadcast('scene-music', track)
      }
    }
    setSceneMusicDraft('')
  }

  const patchSceneMusic = async (track: SceneMusicTrack, patch: Partial<SceneMusicTrack>) => {
    if (!isMaster) return
    const updatedAt = new Date().toISOString()
    const next = { ...track, ...patch, updatedAt }
    let nextTracks = sceneMusicRef.current.map(item => (item.id === track.id ? next : item))
    if (patch.isDefault) {
      nextTracks = nextTracks.map(item => item.sceneId === track.sceneId ? { ...item, isDefault: item.id === track.id } : item)
      await createClient().from(TABLE_SCENE_MUSIC).update({ is_default: false }).eq('scene_id', track.sceneId).neq('id', track.id)
    }
    setSceneMusic(sortSceneMusic(nextTracks))
    const { error } = await createClient().from(TABLE_SCENE_MUSIC).update({
      title: next.title,
      url: next.url,
      source_type: next.sourceType,
      order_index: next.orderIndex,
      is_default: next.isDefault,
      autoplay: next.autoplay,
      updated_at: updatedAt,
    }).eq('id', track.id)
    if (error) console.error('Не удалось обновить музыку сцены:', error)
    broadcast('scene-music', next)
  }

  const renameSceneMusic = async (track: SceneMusicTrack) => {
    const title = window.prompt(t('Название трека'), track.title)?.trim()
    if (!title || title === track.title) return
    await patchSceneMusic(track, { title })
  }

  const deleteSceneMusic = async (track: SceneMusicTrack) => {
    if (!isMaster) return
    setSceneMusic(prev => prev.filter(item => item.id !== track.id))
    await createClient().from(TABLE_SCENE_MUSIC).delete().eq('id', track.id)
    broadcast('scene-music-delete', { room, sceneId: track.sceneId, id: track.id })
  }

  const uploadSceneMusicFiles = async (files: FileList | File[]) => {
    if (!isMaster || !selectedScene) return
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'))
    if (audioFiles.length === 0) {
      window.alert(t('Для музыки сцены можно загрузить только аудиофайлы.'))
      return
    }

    setIsUploading(true)
    try {
      const supabase = createClient()
      const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
      for (const [index, file] of audioFiles.entries()) {
        const id = `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
        const storagePath = `${room}/scenes/${selectedScene.id}/${id}-${safeMusicStorageName(file.name)}`
        const { error: uploadError } = await supabase.storage.from(TABLE_MUSIC_BUCKET).upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'audio/mpeg',
        })

        if (uploadError) {
          console.error('Не удалось загрузить музыку сцены:', uploadError)
          window.alert(t('Аудиофайл не загрузился. Проверь bucket table-music и policies из SQL.'))
          continue
        }

        const { data: publicUrlData } = supabase.storage.from(TABLE_MUSIC_BUCKET).getPublicUrl(storagePath)
        const now = new Date().toISOString()
        const track: SceneMusicTrack = {
          id,
          room,
          sceneId: selectedScene.id,
          title: file.name,
          url: publicUrlData.publicUrl,
          sourceType: 'file',
          orderIndex: baseOrder + index + 1,
          isDefault: selectedSceneMusic.length === 0 && index === 0,
          autoplay: selectedSceneMusic.length === 0 && index === 0,
          createdAt: now,
          updatedAt: now,
        }

        const { error } = await supabase.from(TABLE_SCENE_MUSIC).insert({
          id: track.id,
          room: track.room,
          scene_id: track.sceneId,
          title: track.title,
          url: track.url,
          source_type: track.sourceType,
          order_index: track.orderIndex,
          is_default: track.isDefault,
          autoplay: track.autoplay,
          created_at: track.createdAt,
          updated_at: track.updatedAt,
        })

        if (!error) {
          setSceneMusic(prev => sortSceneMusic([...prev, track]))
          broadcast('scene-music', track)
        }
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleSceneMusicUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadSceneMusicFiles(event.target.files)
      event.target.value = ''
    }
  }

  const reorderSceneMusic = async (track: SceneMusicTrack, direction: 'up' | 'down') => {
    const tracks = sortSceneMusic(selectedSceneMusic)
    const index = tracks.findIndex(item => item.id === track.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const swap = tracks[swapIndex]
    if (!swap) return
    await patchSceneMusic(track, { orderIndex: swap.orderIndex })
    await patchSceneMusic(swap, { orderIndex: track.orderIndex })
  }

  useEffect(() => {
    const currentRoom = getRoomFromLocation()
    const supabase = createClient()
    let cancelled = false

    setRoom(currentRoom)
    window.localStorage.setItem('vtm-table-room', currentRoom)

    const loadRollHistory = async () => {
      const initialResult = await supabase
        .from(TABLE_ROLLS)
        .select('id, room, character_name, pool_name, pool_type, dice_count, dice, successes, meta, created_at')
        .eq('room', currentRoom)
        .order('created_at', { ascending: false })
        .limit(80)
      let rollRows: unknown[] | null = initialResult.data
      let error = initialResult.error

      if (error && /meta/i.test(error.message || '')) {
        const fallback = await supabase
          .from(TABLE_ROLLS)
          .select('id, room, character_name, pool_name, pool_type, dice_count, dice, successes, created_at')
          .eq('room', currentRoom)
          .order('created_at', { ascending: false })
          .limit(80)
        rollRows = fallback.data
        error = fallback.error
      }

      if (cancelled) return
      if (error) {
        console.error('Не удалось загрузить историю бросков:', error)
        setConnectionText('Нет общей истории')
        return
      }

      setRolls((rollRows || []).map(row => mapRollRow(row as RollRow)))
      setConnectionText('Онлайн')
    }

    void loadRollHistory()

    ensureDefaultScene(currentRoom).then(sceneId => {
      if (cancelled || !sceneId) return
      void loadLayersForScene(currentRoom, sceneId)
      void loadSceneMusic(currentRoom, sceneId)
    })

    supabase
      .from(TABLE_CHAT_MESSAGES)
      .select('id, room, user_id, username, character_id, character_name, character_image, message, created_at')
      .eq('room', currentRoom)
      .order('created_at', { ascending: false })
      .limit(120)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить чат:', error)
          setChatStatus('Нет общей истории чата')
          return
        }

        setChatMessages((data || []).map(row => mapChatRow(row as ChatMessageRow)).reverse())
        setChatStatus('Чат онлайн')
      })


    const channel = supabase
      .channel(`table-room:${currentRoom}`)
      .on('broadcast', { event: 'roll' }, payload => {
        const roll = payload.payload as RollMessage
        if (!roll || roll.room !== currentRoom) return
        setRolls(prev => mergeRoll(prev, roll))
        triggerDiceOverlay(roll)
        setConnectionText('Онлайн')
      })
      .on('broadcast', { event: 'opposed-roll-proposal' }, payload => {
        const proposal = payload.payload as OpposedRollProposal
        const currentUser = chatUserRef.current
        if (!proposal || proposal.room !== currentRoom || !currentUser) return
        if (proposal.toUserId !== currentUser.id || proposal.fromUserId === currentUser.id) return
        setIncomingOpposedProposal(proposal)
        setRightRailTab('rolls')
      })
      .on('broadcast', { event: 'layer' }, payload => {
        const layer = payload.payload as TableLayer
        if (!layer || layer.room !== currentRoom || layer.sceneId !== activeSceneIdRef.current) return
        setLayers(prev => {
          const next = upsertLayer(prev, layer)
          layersRef.current = next
          return next
        })
        setTableStatus('Сцена онлайн')
      })
      .on('broadcast', { event: 'layer-update' }, payload => {
        const update = payload.payload as { id?: string; room?: string; patch?: LayerPatch }
        if (!update.id || update.room !== currentRoom || !update.patch) return
        if (update.patch.sceneId && update.patch.sceneId !== activeSceneIdRef.current) return
        const patch = update.patch
        setLayers(prev => {
          const patched = prev.map(layer => (layer.id === update.id ? { ...layer, ...patch } : layer))
          const next = patch.zIndex !== undefined || patch.parentId !== undefined ? sortLayers(patched) : patched
          layersRef.current = next
          return next
        })
      })
      .on('broadcast', { event: 'layer-move' }, payload => {
        const update = payload.payload as { room?: string; updates?: Array<{ id: string; x: number; y: number }> }
        if (update.room !== currentRoom || !Array.isArray(update.updates) || update.updates.length === 0) return
        const positions = new Map(update.updates.map(item => [item.id, item]))
        setLayers(prev => {
          const next = prev.map(layer => {
            const position = positions.get(layer.id)
            return position ? { ...layer, x: position.x, y: position.y } : layer
          })
          layersRef.current = next
          return next
        })
      })
      .on('broadcast', { event: 'layer-delete' }, payload => {
        const id = String((payload.payload as { id?: string })?.id || '')
        if (!id) return
        setLayers(prev => {
          const next = prev.filter(layer => layer.id !== id)
          layersRef.current = next
          return next
        })
        setSelectedLayerId(prev => (prev === id ? null : prev))
        setSelectedLayerIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
      .on('broadcast', { event: 'scene-active' }, payload => {
        const scene = payload.payload as { room?: string; sceneId?: string }
        if (scene.room !== currentRoom || !scene.sceneId) return
        setActiveSceneId(scene.sceneId)
        setSelectedSceneId(scene.sceneId)
        setScenes(prev => prev.map(item => ({ ...item, isActive: item.id === scene.sceneId })))
        void loadLayersForScene(currentRoom, scene.sceneId)
        void loadSceneMusic(currentRoom, scene.sceneId)
      })
      .on('broadcast', { event: 'scene' }, payload => {
        const scene = payload.payload as TableScene
        if (!scene || scene.room !== currentRoom) return
        setScenes(prev => upsertScene(prev, scene))
      })
      .on('broadcast', { event: 'scene-delete' }, payload => {
        const deleted = payload.payload as { room?: string; id?: string; nextActiveSceneId?: string }
        if (deleted.room !== currentRoom || !deleted.id) return
        setScenes(prev => prev.filter(scene => scene.id !== deleted.id))
        if (deleted.nextActiveSceneId) {
          setActiveSceneId(deleted.nextActiveSceneId)
          setSelectedSceneId(deleted.nextActiveSceneId)
          void loadLayersForScene(currentRoom, deleted.nextActiveSceneId)
          void loadSceneMusic(currentRoom, deleted.nextActiveSceneId)
        }
      })
      .on('broadcast', { event: 'scene-music' }, payload => {
        const track = payload.payload as SceneMusicTrack
        if (!track || track.room !== currentRoom || track.sceneId !== activeSceneIdRef.current) return
        setSceneMusic(prev => sortSceneMusic([...prev.filter(item => item.id !== track.id), track]))
      })
      .on('broadcast', { event: 'scene-music-delete' }, payload => {
        const deleted = payload.payload as { room?: string; sceneId?: string; id?: string }
        if (deleted.room !== currentRoom || deleted.sceneId !== activeSceneIdRef.current || !deleted.id) return
        setSceneMusic(prev => prev.filter(track => track.id !== deleted.id))
      })
      .on('broadcast', { event: 'chat-message' }, payload => {
        const message = payload.payload as ChatMessage
        if (!message || message.room !== currentRoom) return
        setChatMessages(prev => mergeChatMessage(prev, message))
        setChatStatus('Чат онлайн')
      })
      .on('broadcast', { event: 'hand-raise' }, payload => {
        const notice = payload.payload as { room?: string; name?: string; at?: string }
        if (notice.room !== currentRoom || !notice.name) return
        setHandNotice(tf('{name} поднял руку', { name: notice.name }))
        window.setTimeout(() => setHandNotice(''), 5200)
      })
      .on('broadcast', { event: 'active-character' }, payload => {
        const update = payload.payload as { room?: string; participant?: ActiveParticipant }
        if (update.room !== currentRoom || !update.participant?.userId) return
        setRoomParticipants(prev => {
          const participant = update.participant as ActiveParticipant
          const exists = prev.some(item => item.userId === participant.userId)
          return exists
            ? prev.map(item => item.userId === participant.userId ? participant : item)
            : [...prev, participant]
        })
      })
      .on('broadcast', { event: 'master-reveal' }, payload => {
        const reveal = payload.payload as MasterReveal
        if (!reveal || reveal.room !== currentRoom) return
        setMasterReveals(prev => [{ ...reveal, id: reveal.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` }, ...prev].slice(0, 40))
      })
      .on('broadcast', { event: 'master-whisper' }, payload => {
        const message = payload.payload as MasterWhisper
        if (!message || message.room !== currentRoom) return
        setMasterWhispers(prev => [...prev.filter(item => item.id !== message.id), message].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-160))
      })
      .on('broadcast', { event: 'voice-signal' }, payload => {
        handleVoiceSignal(payload.payload as VoiceSignal)
      })



      .on('broadcast', { event: 'viewport-focus' }, payload => {
        const focus = payload.payload as { room?: string; pan?: { x: number; y: number }; zoom?: number }
        if (focus.room !== currentRoom || !focus.pan || typeof focus.zoom !== 'number') return
        setZoom(focus.zoom)
        setPan(focus.pan)
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_ROLLS,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          const roll = mapRollRow(payload.new as RollRow)
          setRolls(prev => mergeRoll(prev, roll))
          triggerDiceOverlay(roll)
          setConnectionText('Онлайн')
        }
      )

      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_CHAT_MESSAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          setChatMessages(prev => mergeChatMessage(prev, mapChatRow(payload.new as ChatMessageRow)))
          setChatStatus('Чат онлайн')
        }
      )


      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_IMAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          const layer = mapLayerRow(payload.new as TableLayerRow)
          if (layer.sceneId !== activeSceneIdRef.current) return
          setLayers(prev => {
            const next = upsertLayer(prev, layer)
            layersRef.current = next
            return next
          })
          setTableStatus('Сцена онлайн')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: TABLE_IMAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          const layer = mapLayerRow(payload.new as TableLayerRow)
          if (layer.sceneId !== activeSceneIdRef.current) return
          setLayers(prev => {
            const next = upsertLayer(prev, layer)
            layersRef.current = next
            return next
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_SCENES, filter: `room=eq.${currentRoom}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string }
            if (!deleted.id) return
            setScenes(prev => prev.filter(scene => scene.id !== deleted.id))
            return
          }
          const scene = mapSceneRow(payload.new as TableSceneRow)
          setScenes(prev => upsertScene(prev, scene).map(item => ({ ...item, isActive: item.id === scene.id ? scene.isActive : scene.isActive ? false : item.isActive })))
          if (scene.isActive && scene.id !== activeSceneIdRef.current) {
            setActiveSceneId(scene.id)
            setSelectedSceneId(scene.id)
            void loadLayersForScene(currentRoom, scene.id)
            void loadSceneMusic(currentRoom, scene.id)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_SCENE_MUSIC, filter: `room=eq.${currentRoom}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string; scene_id?: string }
            if (!deleted.id || deleted.scene_id !== activeSceneIdRef.current) return
            setSceneMusic(prev => prev.filter(track => track.id !== deleted.id))
            return
          }
          const track = mapSceneMusicRow(payload.new as SceneMusicRow)
          if (track.sceneId !== activeSceneIdRef.current) return
          setSceneMusic(prev => sortSceneMusic([...prev.filter(item => item.id !== track.id), track]))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: TABLE_IMAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          const deleted = payload.old as { id?: string }
          if (deleted.id) {
            setLayers(prev => {
              const next = prev.filter(layer => layer.id !== deleted.id)
              layersRef.current = next
              return next
            })
            setSelectedLayerId(prev => (prev === deleted.id ? null : prev))
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnectionText('Онлайн')
        if (status === 'CHANNEL_ERROR') setConnectionText('Realtime недоступен')
        if (status === 'TIMED_OUT') setConnectionText('Повтор подключения')
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [])

  const selectedActiveCharacter = chatCharacters.find(item => item.id === selectedChatCharacterId) || null
  const selectedMasterRollCharacter = chatCharacters.find(item => item.id === selectedMasterRollCharacterId) || selectedActiveCharacter
  const journalStorageKey = chatUser ? `vtm-journal:${chatUser.id}:${room}` : ''
  const selectedJournalEntry = journalEntries.find(entry => entry.id === selectedJournalEntryId) || journalEntries[0] || null
  const filteredJournalEntries = journalEntries.filter(entry => {
    const query = journalSearch.trim().toLowerCase()
    if (!query) return true
    return `${entry.title} ${entry.text}`.toLowerCase().includes(query)
  })
  const masterChatPlayers = roomParticipants.filter(participant => participant.userId !== chatUser?.id)
  const getContestedOpponentOptions = (initiator: CharacterOption | null) => {
    const options: ContestedOpponentOption[] = []
    const seen = new Set<string>()
    const addOption = (option: ContestedOpponentOption) => {
      if (seen.has(option.id)) return
      seen.add(option.id)
      options.push(option)
    }

    roomParticipants
      .filter(participant => participant.userId !== chatUser?.id && participant.characterId !== initiator?.id)
      .forEach(participant => {
        const characterName = participant.characterId && participant.characterName !== 'без персонажа'
          ? `${participant.characterName} · `
          : ''
        addOption({
          id: `player:${participant.userId}`,
          label: `${characterName}${participant.username}`,
          actorKind: 'player',
          characterId: participant.characterId,
          userId: participant.userId,
        })
      })

    if (isMaster) {
      chatCharacters.forEach(character => {
        if (character.id === initiator?.id) return
        addOption({
          id: `npc:${character.id}`,
          label: tf('{name} · НПС', { name: character.name }),
          actorKind: 'npc',
          characterId: character.id,
        })
      })
    }

    return options
  }
  const visibleMasterWhispers = masterWhispers.filter(message => {
    if (!chatUser) return false
    if (isMaster) return !selectedMasterChatUserId
      ? true
      : message.fromUserId === selectedMasterChatUserId || message.toUserId === selectedMasterChatUserId
    return message.fromUserId === chatUser.id || message.toUserId === chatUser.id
  })
  const getSkillDots = (value: unknown) => getSkillDotValue(value)
  const getSkillSpecs = (value: unknown) => {
    if (!value || typeof value !== 'object') return []
    const specs = (value as { specs?: unknown }).specs
    return Array.isArray(specs) ? specs.filter((spec): spec is string => typeof spec === 'string') : []
  }
  const getDisciplineDots = (sources: Record<string, number>) => Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const getRollTraits = (...parts: string[]) => parts.map(part => part.trim()).filter(Boolean)
  const getRollPenalties = (
    willpowerPenalty: number,
    healthPenalty: number,
  ): DisciplineRollPenalty[] => {
    const penalties: DisciplineRollPenalty[] = []
    if (willpowerPenalty) {
      penalties.push({
        id: 'willpower_impairment',
        kind: 'willpower_impairment',
        label: t('истощения Воли'),
        diceDelta: willpowerPenalty,
      })
    }
    if (healthPenalty) {
      penalties.push({
        id: 'health_impairment',
        kind: 'health_impairment',
        label: t('изнурения'),
        diceDelta: healthPenalty,
      })
    }
    return penalties
  }
  const getActivePenaltyDelta = (
    result: DisciplineRollEffectResult | null | undefined,
    penaltyId: string,
  ) => result?.modifiers.find(
    modifier => modifier.sourceKind === 'penalty'
      && modifier.id === `penalty:${penaltyId}`
      && modifier.active,
  )?.diceDelta || 0
  const getActiveRollModifierWarnings = (
    result: DisciplineRollEffectResult | null | undefined,
  ) => [
    ...(getActivePenaltyDelta(result, 'willpower_impairment')
      ? ['Трек Воли заполнен: ментальная или социальная проверка получает -2к10.']
      : []),
    ...(getActivePenaltyDelta(result, 'health_impairment')
      ? ['Шкала здоровья заполнена: физическая проверка получает -2к10.']
      : []),
  ]
  const masterRollAttributeDots = selectedMasterRollCharacter ? getAttributeDots(selectedMasterRollCharacter.attributes, masterRollAttribute) : 0
  const masterRollAttributeTwoDots = selectedMasterRollCharacter ? getAttributeDots(selectedMasterRollCharacter.attributes, masterRollAttributeTwo) : 0
  const masterRollSkillDots = selectedMasterRollCharacter ? getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, masterRollSkill)) : 0
  const masterRollDisciplineDots = selectedMasterRollCharacter ? getDisciplineDots(selectedMasterRollCharacter.disciplines[masterRollDiscipline] || {}) : 0
  const masterRollPoolBeforeLimit = masterRollAttributeDots + masterRollAttributeTwoDots + masterRollSkillDots + masterRollDisciplineDots + masterRollModifier
  const masterWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty([masterRollAttribute, masterRollAttributeTwo], selectedMasterRollCharacter)
  const masterHealthImpairmentPenalty = getHealthImpairmentPenalty([masterRollAttribute, masterRollAttributeTwo], getCharacterHealth(selectedMasterRollCharacter))
  const masterRollEffectResult = selectedMasterRollCharacter
    ? applyDisciplineEffectsToRoll({
        characterData: selectedMasterRollCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: masterRollPoolBeforeLimit,
        poolType: 'master-character',
        kind: 'roll',
        action: masterRollMode,
        source: masterUseBloodSurge ? 'blood_surge' : 'manual',
        traits: getRollTraits(masterRollAttribute, masterRollAttributeTwo, masterRollSkill, masterRollDiscipline),
        penalties: getRollPenalties(masterWillpowerImpairmentPenalty, masterHealthImpairmentPenalty),
        disabledModifierIds: disabledMasterRollModifierIds,
      }, selectedMasterRollCharacter.derivedStats)
    : null
  const masterRollDiceCount = masterRollEffectResult?.finalDiceCount || 0
  const masterBloodPotency = getCharacterBloodPotency(selectedMasterRollCharacter)
  const masterBloodSurgeBonus = getBloodSurgeBonus(masterBloodPotency)
  const masterRollExtraAttributes = selectedMasterRollCharacter ? getExtraTraitNames(selectedMasterRollCharacter.attributes, ATTRIBUTE_GROUPS) : []
  const masterRollExtraSkills = selectedMasterRollCharacter ? getExtraTraitNames(selectedMasterRollCharacter.skills, SKILL_GROUPS) : []
  const masterRollDisciplineNames = selectedMasterRollCharacter
    ? Array.from(new Set([
        ...Object.keys(selectedMasterRollCharacter.disciplines),
        ...Object.keys(selectedMasterRollCharacter.selectedPowers),
        ...Object.keys(selectedMasterRollCharacter.selectedPathPowers),
      ])).sort((a, b) => a.localeCompare(b, 'ru'))
    : []
  const masterRollPoolParts = [
    masterRollAttribute ? `${t(masterRollAttribute)} ${masterRollAttributeDots}` : '',
    masterRollAttributeTwo ? `${t(masterRollAttributeTwo)} ${masterRollAttributeTwoDots}` : '',
    masterRollSkill ? `${t(masterRollSkill)} ${masterRollSkillDots}` : '',
    masterRollDiscipline ? `${masterRollDiscipline} ${masterRollDisciplineDots}` : '',
    masterRollModifier ? `${t('модификатор')} ${masterRollModifier > 0 ? '+' : ''}${masterRollModifier}` : '',
  ].filter(Boolean)
  const masterRollPoolName = masterRollPoolParts.join(' + ') || d10(masterRollDiceCount || 1)
  const masterRollHidden = masterRollVisibility === 'hidden'
  const masterContestedOpponentOptions = getContestedOpponentOptions(selectedMasterRollCharacter)
  const selectedMasterContestedOpponent = masterContestedOpponentOptions.find(option => option.id === masterContestedOpponentId) || null

  useEffect(() => {
    if (!incomingOpposedProposal) return
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
  }, [incomingOpposedProposal?.id, selectedActiveCharacter?.id])

  const previewAttributeDots = previewCharacter ? getAttributeDots(previewCharacter.attributes, previewRollAttribute) : 0
  const previewAttributeTwoDots = previewCharacter ? getAttributeDots(previewCharacter.attributes, previewRollAttributeTwo) : 0
  const previewSkillDots = previewCharacter ? getSkillDots(resolveSkillValue(previewCharacter.skills, previewRollSkill)) : 0
  const previewDisciplineDots = previewCharacter ? getDisciplineDots(previewCharacter.disciplines[previewRollDiscipline] || {}) : 0
  const previewPoolBeforeLimit = previewAttributeDots + previewAttributeTwoDots + previewSkillDots + previewDisciplineDots + previewRollModifier
  const previewWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty([previewRollAttribute, previewRollAttributeTwo], previewCharacter)
  const previewHealth = getCharacterHealth(previewCharacter)
  const previewSheetFixed = previewCharacter?.sheetFixed ?? true
  const previewHealthImpairmentPenalty = getHealthImpairmentPenalty([previewRollAttribute, previewRollAttributeTwo], previewHealth)
  const previewRollEffectResult = previewCharacter
    ? applyDisciplineEffectsToRoll({
        characterData: previewCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: previewPoolBeforeLimit,
        poolType: 'character-sheet',
        kind: 'roll',
        action: previewRollMode,
        source: previewUseBloodSurge ? 'blood_surge' : 'manual',
        traits: getRollTraits(previewRollAttribute, previewRollAttributeTwo, previewRollSkill, previewRollDiscipline),
        penalties: getRollPenalties(previewWillpowerImpairmentPenalty, previewHealthImpairmentPenalty),
        disabledModifierIds: disabledPreviewRollModifierIds,
      }, previewCharacter.derivedStats)
    : null
  const previewDiceCount = previewRollEffectResult?.finalDiceCount || 0
  const previewBloodPotency = getCharacterBloodPotency(previewCharacter)
  const previewBloodSurgeBonus = getBloodSurgeBonus(previewBloodPotency)
  const previewHunger = getCharacterHunger(previewCharacter)
  const previewWillpower = getCharacterWillpower(previewCharacter)
  const previewHealthDerived = previewCharacter?.derivedStats.health
  const previewWillpowerDerived = previewCharacter?.derivedStats.willpower
  const previewDamageProfile = getCharacterDamageProfile(previewCharacter)
  const previewUsesVampireResources = Boolean(previewCharacter && ['vampire', 'thinblood'].includes(previewCharacter.characterType))
  const previewBloodSurgeEnabled = previewUsesVampireResources && previewUseBloodSurge
  const previewHumanity = previewCharacter?.humanity || {
    value: 7,
    stains: 0,
    stainEvents: [],
    lastRemorseCheckAt: null,
    lastHumanityLossAt: null,
    freeBoxes: 3,
    status: 'normal' as const,
  }
  const canRollPreview = Boolean(previewCharacter?.id && (isMaster || previewCharacter.id === selectedActiveCharacter?.id))
  const previewContestedOpponentOptions = getContestedOpponentOptions(previewCharacter)
  const selectedPreviewContestedOpponent = previewContestedOpponentOptions.find(option => option.id === previewContestedOpponentId) || null
  const canEditPreviewInventory = Boolean(chatUser && previewCharacter?.id && previewCharacter.id === selectedActiveCharacter?.id)
  const canEditPreviewActiveEffects = canEditPreviewInventory
  const previewExtraAttributes = previewCharacter ? getExtraTraitNames(previewCharacter.attributes, ATTRIBUTE_GROUPS) : []
  const previewExtraSkills = previewCharacter ? getExtraTraitNames(previewCharacter.skills, SKILL_GROUPS) : []
  const previewDisciplineNames = previewCharacter
    ? Array.from(new Set([
        ...Object.keys(previewCharacter.disciplines),
        ...Object.keys(previewCharacter.selectedPowers),
        ...Object.keys(previewCharacter.selectedPathPowers),
      ])).sort((a, b) => a.localeCompare(b, 'ru'))
    : []
  const previewDisciplineRule = previewDisciplineName && disciplineRules ? disciplineRules[previewDisciplineName] : undefined
  const previewOpenedDisciplineDots = previewCharacter && previewDisciplineName
    ? getDisciplineDots(previewCharacter.disciplines[previewDisciplineName] || {})
    : 0
  const previewLearnedPathPowers = previewCharacter && previewDisciplineName
    ? getSelectedPathPowerNames(previewCharacter.selectedPathPowers[previewDisciplineName])
    : {}
  const previewLearnedPowers = previewCharacter && previewDisciplineName
    ? getStandaloneSelectedPowerNames(
        previewCharacter.selectedPowers[previewDisciplineName],
        previewCharacter.selectedPathPowers[previewDisciplineName],
      )
    : []
  const allPreviewDisciplinePowers = getDisciplinePowerEntries(previewDisciplineRule)
  const hasPreviewLearnedPathPowers = hasSelectedPathPowers(previewLearnedPathPowers)
  const previewDisciplinePowers = previewLearnedPowers.length || hasPreviewLearnedPathPowers
    ? allPreviewDisciplinePowers.filter(power => isPowerEntrySelected(
        power,
        previewLearnedPowers,
        previewLearnedPathPowers,
      ))
    : allPreviewDisciplinePowers.filter(power => power.level <= (
        previewCharacter && previewDisciplineName
          ? getDisciplinePowerDots(previewCharacter, previewDisciplineName, power.path)
          : previewOpenedDisciplineDots
      ))
  const selectedPreviewPower = previewDisciplinePowers.find(power => getDisciplinePowerEntryKey(power) === previewPowerName) || null
  const selectedPreviewPowerRollFormula = getPowerRollFormula(selectedPreviewPower?.rule)
  const selectedPreviewPowerRollSummary = getPowerRollSummary(selectedPreviewPower?.rule, tf)
  const selectedPreviewPowerDifficultySummary = getPowerDifficultySummary(selectedPreviewPower?.rule, tf)
  const resolvedPreviewPowerPool = selectedPreviewPowerRollFormula && disciplineRules
    ? resolvePowerPool(selectedPreviewPowerRollFormula, disciplineRules)
    : selectedPreviewPowerRollFormula
  const previewPowerPoolChoices = parsePowerPool(resolvedPreviewPowerPool, previewDisciplineNames)
  const previewPowerOpposition = resolvedPreviewPowerPool.split(/\s+(?:vs\.?|против)\s+/i)[1]?.trim() || ''
  const previewPowerPoolBeforeLimit = previewCharacter
    ? previewPowerPoolSelections.reduce((sum, name) => sum + getCharacterPoolPartDots(previewCharacter, name), 0) + previewPowerModifier
    : 0
  const previewPowerWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty(previewPowerPoolSelections, previewCharacter)
  const previewPowerHealthImpairmentPenalty = getHealthImpairmentPenalty(previewPowerPoolSelections, previewHealth)
  const previewPowerRollEffectResult = previewCharacter
    ? applyDisciplineEffectsToRoll({
        characterData: previewCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: previewPowerPoolBeforeLimit,
        poolType: 'discipline-power',
        kind: 'roll',
        action: selectedPreviewPower?.name || 'discipline-power',
        source: 'discipline',
        traits: getRollTraits(...previewPowerPoolSelections, previewDisciplineName),
        penalties: getRollPenalties(previewPowerWillpowerImpairmentPenalty, previewPowerHealthImpairmentPenalty),
        disabledModifierIds: disabledPreviewPowerModifierIds,
      }, previewCharacter.derivedStats)
    : null
  const previewPowerDiceCount = previewPowerRollEffectResult?.finalDiceCount || 0
  const selectedPreviewPowerCost = resolveDisciplineCost({
    mechanics: selectedPreviewPower?.rule.mechanics,
    legacyCost: selectedPreviewPower?.rule.cost,
  })
  const selectedPreviewPowerCostLabel = getDisciplineCostLabel(
    selectedPreviewPowerCost,
    selectedPreviewPower?.rule.cost,
    t,
    tf,
  )
  const selectedPreviewPowerInputFields = getDisciplinePowerInputFields(
    selectedPreviewPower?.rule.mechanics,
  )
  const selectedPreviewPowerManualPrompts = getDisciplineManualPrompts(
    selectedPreviewPower?.rule.mechanics,
  )
  const hasMissingPreviewPowerInput = selectedPreviewPowerInputFields.some(
    field => field.required && !previewPowerInputValues[field.id]?.trim(),
  )
  const selectedPreviewPowerIsActiveKind = selectedPreviewPower?.rule.mechanics?.activation?.kind === 'active'
  const selectedPreviewPowerIsActive = Boolean(
    previewCharacter
    && selectedPreviewPower
    && selectedPreviewPowerIsActiveKind
    && isDisciplinePowerActive(
      previewCharacter,
      selectedPreviewPower.rule.mechanics || {},
      {
        discipline: previewDisciplineName,
        path: selectedPreviewPower.path,
        power: selectedPreviewPower.name,
        level: selectedPreviewPower.level,
      },
    ),
  )

  useEffect(() => {
    if (!previewDisciplineName || !disciplineRules) return
    const disciplineRule = disciplineRules[previewDisciplineName]
    const allPowers = getDisciplinePowerEntries(disciplineRule)
    const learnedPathPowers = previewCharacter ? getSelectedPathPowerNames(previewCharacter.selectedPathPowers[previewDisciplineName]) : {}
    const learnedPowers = previewCharacter
      ? getStandaloneSelectedPowerNames(
          previewCharacter.selectedPowers[previewDisciplineName],
          previewCharacter.selectedPathPowers[previewDisciplineName],
        )
      : []
    const hasLearnedPathPowers = hasSelectedPathPowers(learnedPathPowers)
    const visiblePowers = learnedPowers.length || hasLearnedPathPowers
      ? allPowers.filter(power => isPowerEntrySelected(
          power,
          learnedPowers,
          learnedPathPowers,
        ))
      : allPowers.filter(power => power.level <= (
          previewCharacter
            ? getDisciplinePowerDots(previewCharacter, previewDisciplineName, power.path)
            : previewOpenedDisciplineDots
        ))
    setPreviewPowerName(current => visiblePowers.some(power => getDisciplinePowerEntryKey(power) === current) ? current : visiblePowers[0] ? getDisciplinePowerEntryKey(visiblePowers[0]) : '')
  }, [previewDisciplineName, disciplineRules, previewCharacter, previewOpenedDisciplineDots])

  useEffect(() => {
    setPreviewPowerPoolSelections(previewPowerPoolChoices.map(choice => choice.options[0] || ''))
    setPreviewPowerModifier(0)
    setDisabledPreviewPowerModifierIds([])
    setPreviewPowerInputValues({})
  }, [previewPowerName, resolvedPreviewPowerPool])

  useEffect(() => {
    setMasterRollAttribute('')
    setMasterRollAttributeTwo('')
    setMasterRollSkill('')
    setMasterRollDiscipline('')
    setMasterRollModifier(0)
    setDisabledMasterRollModifierIds([])
    setMasterRollMode('normal')
    setMasterContestedOpponentId('')
  }, [selectedMasterRollCharacterId])

  const saveJournalEntries = (entries: JournalEntry[], status = 'Сохранено') => {
    setJournalEntries(entries)
    if (journalStorageKey) window.localStorage.setItem(journalStorageKey, JSON.stringify(entries))
    setJournalSaveStatus(status)
  }

  const createJournalEntry = () => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: t('Новая запись'),
      text: '',
      createdAt: now,
      updatedAt: now,
    }
    saveJournalEntries([entry, ...journalEntries], 'Сохранено')
    setSelectedJournalEntryId(entry.id)
  }

  const updateJournalEntry = (patch: Partial<Pick<JournalEntry, 'title' | 'text'>>) => {
    if (!selectedJournalEntry) return
    const now = new Date().toISOString()
    const next = journalEntries.map(entry => entry.id === selectedJournalEntry.id ? { ...entry, ...patch, updatedAt: now } : entry)
    setJournalEntries(next)
    setJournalSaveStatus('Есть несохранённые изменения')
  }

  const persistCurrentJournal = () => {
    if (!journalStorageKey) return
    window.localStorage.setItem(journalStorageKey, JSON.stringify(journalEntries))
    setJournalSaveStatus('Сохранено')
  }

  const deleteJournalEntry = () => {
    if (!selectedJournalEntry) return
    if (!window.confirm(tf('Удалить запись "{title}"?', { title: selectedJournalEntry.title || t('Без названия') }))) return
    const next = journalEntries.filter(entry => entry.id !== selectedJournalEntry.id)
    saveJournalEntries(next, 'Сохранено')
    setSelectedJournalEntryId(next[0]?.id || '')
  }

  const chooseActiveCharacter = (characterId: string) => {
    setSelectedChatCharacterId(characterId)
    if (!chatUser) return
    window.localStorage.setItem(`vtm-chat-character:${chatUser.id}:${room}`, characterId)
    window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, characterId)
    window.localStorage.setItem(`vtm-home-character:${chatUser.id}`, characterId)
  }

  const chooseMasterRollCharacter = (characterId: string) => {
    setSelectedMasterRollCharacterId(characterId)
    if (!chatUser) return
    window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}:${room}`, characterId)
    window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}`, characterId)
  }

  const openCharacterPreview = async (character: CharacterOption, username?: string) => {
    setPreviewCharacter({ ...character, username: username || character.username })
    if (!character.id) return
    const { data, error } = await createClient()
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', character.id)
      .single()
    if (error || !data) return
    const fresh = { ...mapCharacterRow(data as CharacterRow), username: username || character.username }
    setPreviewCharacter(fresh)
    setChatCharacters(current => current.map(item => item.id === fresh.id ? { ...fresh, username: item.username || fresh.username } : item))
  }

  const openParticipantPreview = async (participant: ActiveParticipant) => {
    const local = chatCharacters.find(character => character.id === participant.characterId)
    if (local) {
      await openCharacterPreview(local, participant.username)
      return
    }
    if (!participant.characterId) {
      setPreviewCharacter({
        id: '',
        name: t('Без персонажа'),
        clan: null,
        image: '',
        username: participant.username,
        characterType: 'vampire',
        inventory: [],
        attributes: {},
        skills: {},
        disciplines: {},
        selectedPowers: {},
        selectedPathPowers: {},
        derivedStats: getDerivedStats({}, {}),
        activeEffects: [],
      })
      return
    }
    const { data, error } = await createClient()
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', participant.characterId)
      .single()
    if (error || !data) {
      setPreviewCharacter({
        id: participant.characterId,
        name: participant.characterName === 'без персонажа' ? t('без персонажа') : participant.characterName,
        clan: participant.characterClan,
        image: participant.characterImage,
        username: participant.username,
        characterType: 'vampire',
        inventory: [],
        attributes: {},
        skills: {},
        disciplines: {},
        selectedPowers: {},
        selectedPathPowers: {},
        derivedStats: getDerivedStats({}, {}),
        activeEffects: [],
      })
      return
    }
    setPreviewCharacter({ ...mapCharacterRow(data as CharacterRow), username: participant.username })
  }

  const updateOpposedResponseSide = (patch: Partial<RollPoolBuilder>) => {
    setOpposedResponseSide(current => ({ ...current, ...patch }))
  }

  const getOpposedCharacterPool = (character: CharacterOption | null, sideState: RollPoolBuilder) => {
    const attributeDots = character ? getAttributeDots(character.attributes, sideState.attribute) : 0
    const attributeTwoDots = character ? getAttributeDots(character.attributes, sideState.attributeTwo) : 0
    const skillDots = character ? getSkillDots(resolveSkillValue(character.skills, sideState.skill)) : 0
    const disciplineDots = character ? getDisciplineDots(character.disciplines[sideState.discipline] || {}) : 0
    const willpowerPenalty = getWillpowerImpairmentPenalty([sideState.attribute, sideState.attributeTwo], character)
    const healthPenalty = getHealthImpairmentPenalty([sideState.attribute, sideState.attributeTwo], getCharacterHealth(character))
    const baseDiceCount = attributeDots + attributeTwoDots + skillDots + disciplineDots + sideState.modifier
    const rollEffectResult = character
      ? applyDisciplineEffectsToRoll({
          characterData: character,
          rulesJson: disciplineRules,
          baseDiceCount,
          poolType: 'opposed-response',
          kind: 'roll',
          action: 'contested',
          source: 'manual',
          traits: getRollTraits(sideState.attribute, sideState.attributeTwo, sideState.skill, sideState.discipline),
          penalties: getRollPenalties(willpowerPenalty, healthPenalty),
        }, character.derivedStats)
      : null
    const diceCount = rollEffectResult?.finalDiceCount || 0
    const poolParts = [
      sideState.attribute ? `${t(sideState.attribute)} ${attributeDots}` : '',
      sideState.attributeTwo ? `${t(sideState.attributeTwo)} ${attributeTwoDots}` : '',
      sideState.skill ? `${t(sideState.skill)} ${skillDots}` : '',
      sideState.discipline ? `${sideState.discipline} ${disciplineDots}` : '',
      sideState.modifier ? `${t('модификатор')} ${sideState.modifier > 0 ? '+' : ''}${sideState.modifier}` : '',
      willpowerPenalty ? t('Истощение Воли -2') : '',
      healthPenalty ? t('Изнурение по здоровью -2') : '',
    ].filter(Boolean)

    return {
      diceCount,
      poolName: poolParts.join(' + ') || d10(diceCount || 0),
      poolParts,
      rollEffectResult,
      extraAttributes: character ? getExtraTraitNames(character.attributes, ATTRIBUTE_GROUPS) : [],
      extraSkills: character ? getExtraTraitNames(character.skills, SKILL_GROUPS) : [],
      disciplineNames: character
        ? Array.from(new Set([
            ...Object.keys(character.disciplines),
            ...Object.keys(character.selectedPowers),
            ...Object.keys(character.selectedPathPowers),
          ])).sort((a, b) => a.localeCompare(b, 'ru'))
        : [],
    }
  }

  const queueDiceOverlayRoll = (overlayRoll: DiceOverlayRoll) => {
    setDiceOverlayQueue(prev => [...prev, overlayRoll])
  }

  const buildDiceOverlaySummary = (successes: number, meta?: RollMeta) => {
    if (meta?.bestialFailure) return { text: t('Звериный провал'), tone: 'bad' as const }
    if (meta?.messyCritical) return { text: tf('Грязный критический успех · {n}', { n: successes }), tone: 'good' as const }
    if (successes > 0) return { text: tf('Успехов: {n}', { n: successes }), tone: 'good' as const }
    return { text: t('Провал'), tone: 'bad' as const }
  }

  // Fires the 3D overlay for any freshly-arrived roll, own or remote. Dedupes by roll id so the
  // broadcast listener and the postgres_changes listener never show the same roll twice, and so a
  // contested-roll request (dice already rolled, but deliberately hidden until answered) only
  // animates once it resolves into `roll.opposed` — never at the moment the request is sent.
  const triggerDiceOverlay = (roll: RollMessage) => {
    if (shownDiceOverlayIdsRef.current.has(roll.id)) return
    if (roll.meta?.rollMode === 'contested' && roll.meta.contested?.status !== 'resolved' && !roll.opposed) return

    if (roll.opposed) {
      const totalDice = roll.opposed.sides.reduce((sum, side) => sum + side.dice.length, 0)
      if (totalDice === 0) return
      shownDiceOverlayIdsRef.current.add(roll.id)
      const groups: DiceOverlayGroup[] = roll.opposed.sides.map(side => ({
        key: side.id,
        label: `${side.actorName} · ${t(side.poolName)}`,
        dice: side.dice.map(die => ({ value: die.value, kind: die.kind })),
      }))
      queueDiceOverlayRoll({
        id: roll.id,
        title: t(roll.poolName),
        groups,
        summary: roll.opposed.summary,
        summaryTone: roll.opposed.winnerSideId ? 'good' : 'neutral',
      })
      return
    }

    if (!roll.dice.length) return
    shownDiceOverlayIdsRef.current.add(roll.id)
    const summary = buildDiceOverlaySummary(roll.successes, roll.meta)
    queueDiceOverlayRoll({
      id: roll.id,
      title: `${roll.characterName} · ${t(roll.poolName)}`,
      groups: [{ key: 'main', label: '', dice: roll.dice.map(die => ({ value: die.value, kind: die.kind })) }],
      summary: summary.text,
      summaryTone: summary.tone,
    })
  }

  const publishRoll = async (roll: RollMessage) => {
    setRolls(prev => mergeRoll(prev, roll))
    triggerDiceOverlay(roll)
    if (roll.hidden) {
      setConnectionText('Скрытый бросок')
      return
    }

    broadcast('roll', roll)
    const payload = {
      id: roll.id,
      room: roll.room,
      character_name: roll.characterName,
      pool_name: roll.poolName,
      pool_type: roll.poolType,
      dice_count: roll.diceCount,
      dice: roll.dice,
      successes: roll.successes,
      meta: roll.meta || {},
      created_at: roll.createdAt,
    }

    let { error } = await createClient().from(TABLE_ROLLS).insert(payload)
    if (error && /meta/i.test(error.message || '')) {
      const { meta, ...legacyPayload } = payload
      const fallback = await createClient().from(TABLE_ROLLS).insert(legacyPayload)
      error = fallback.error
    }

    if (error) setConnectionText('Бросок отправлен онлайн, но не сохранился')
    else setConnectionText('Онлайн')
  }

  const updateCharacterHunger = async (characterId: string, nextHunger: number, reason = 'Голод обновлён') => {
    const safeHunger = Math.max(0, Math.min(5, Math.floor(Number(nextHunger) || 0)))
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', characterId)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Голода:', error)
      setConnectionText('Голод не сохранился')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const nextData = {
      ...characterData,
      bloodPotency: Number(characterData.bloodPotency ?? characterData.blood?.potency ?? 0) || 0,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        hunger: safeHunger,
      },
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: nextData })
      .eq('id', characterId)

    if (updateError) {
      console.error('Не удалось сохранить Голод персонажа:', updateError)
      setConnectionText('Голод не сохранился')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    setChatCharacters(current => current.map(character => (
      character.id === characterId ? { ...updatedCharacter, username: character.username } : character
    )))
    setPreviewCharacter(current => current?.id === characterId ? { ...updatedCharacter, username: current.username } : current)

    if (chatUser && selectedActiveCharacter?.id === characterId) {
      const participant: ActiveParticipant = {
        userId: chatUser.id,
        username: chatUser.username,
        characterId,
        characterName: updatedCharacter.name || 'без персонажа',
        characterClan: updatedCharacter.clan || null,
        characterImage: updatedCharacter.image || '',
        updatedAt: new Date().toISOString(),
      }
      broadcast('active-character', { room, participant })
    }

    setConnectionText(reason)
    return updatedCharacter
  }

  const updateCharacterHumanity = async (
    characterId: string,
    nextHumanity: HumanityState,
    reason = 'Человечность сохранена',
  ) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', characterId)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Человечности:', error)
      setConnectionText('Человечность не сохранилась')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const normalized = getHumanityState({ humanity: nextHumanity })
    const previousHumanity = characterData.humanity && typeof characterData.humanity === 'object'
      ? characterData.humanity
      : {}
    const nextData: NonNullable<CharacterRow['data']> = {
      ...characterData,
      humanity: {
        ...previousHumanity,
        ...normalized,
      },
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        humanity: normalized.value,
      },
      status: {
        ...(characterData.status || {}),
        humanityState: normalized.value <= 0 ? 'lost_to_beast' : undefined,
      },
    }

    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: { ...nextData, timestamp: new Date().toISOString() } })
      .eq('id', characterId)

    if (updateError) {
      console.error('Не удалось сохранить Человечность персонажа:', updateError)
      setConnectionText('Человечность не сохранилась')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    setChatCharacters(current => current.map(character => (
      character.id === characterId ? { ...updatedCharacter, username: character.username } : character
    )))
    setPreviewCharacter(current => current?.id === characterId ? { ...updatedCharacter, username: current.username } : current)
    setConnectionText(reason)
    return updatedCharacter
  }

  const addHumanityStains = async (
    character: CharacterOption,
    amount: number,
    reason = 'ручное решение',
    options: {
      source?: HumanityStainSource
      reasonText?: string
    } = {},
  ) => {
    const result = addHumanityStainsState(
      { humanity: character.humanity || { value: 7, stains: 0 } },
      amount,
      reason,
      {
        source: options.source || 'manual',
        reasonText: options.reasonText,
      },
    )
    const updated = await updateCharacterHumanity(character.id, result.humanity, 'Сомнения сохранены')
    if (!updated) return null

    const state = updated.humanity || {
      ...result.humanity,
      freeBoxes: Math.max(0, 10 - result.humanity.value - result.humanity.stains),
      status: getHumanityStatus(result.humanity),
    }
    await publishRoll({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName: tf('{name} получает {applied} Сомнение: {sourceText}. Человечность: {value}, Сомнения: {stains}/{remaining}.', {
        name: character.name, applied: result.applied, sourceText: options.reasonText || t(reason),
        value: state.value, stains: state.stains, remaining: 10 - state.value
      }),
      poolType: 'humanity-event',
      diceCount: 0,
      dice: [],
      successes: 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'humanity',
        rollKind: 'humanity_check',
        hungerDice: 0,
        humanityBefore: result.before.value,
        humanityAfter: state.value,
        stainsBefore: result.before.stains,
        stainsAfter: state.stains,
        stainEvents: [result.event],
        warnings: result.warning ? [result.warning] : [],
      },
    })
    setConnectionText(result.warning || 'Сомнения сохранены')
    return updated
  }

  const performRemorseCheck = async (character: CharacterOption) => {
    const before = getHumanityState({ humanity: character.humanity || { value: 7, stains: 0 } })
    if (before.stains <= 0) {
      setConnectionText('Нет Сомнений для проверки')
      return null
    }

    const remorseDice = getRemorseDice(before)
    const automaticFailure = remorseDice <= 0
    const dice = automaticFailure ? [] : rollD10Pool(remorseDice, 0)
    const successes = dice.filter(die => die.value >= 6).length
    const success = !automaticFailure && successes > 0
    const now = new Date().toISOString()
    const humanityAfter = success ? before.value : Math.max(0, before.value - 1)
    const nextState: HumanityState = {
      ...before,
      value: humanityAfter,
      stains: 0,
      lastRemorseCheckAt: now,
      lastHumanityLossAt: success ? before.lastHumanityLossAt : now,
    }
    const updated = await updateCharacterHumanity(character.id, nextState, 'Проверка мук совести сохранена')
    if (!updated) return null

    const poolName = automaticFailure
      ? tf('Проверка мук совести: свободных ячеек нет. Результат: автоматический провал. Человечность: {before} → {after}. Сомнения очищены.', { before: before.value, after: humanityAfter })
      : success
        ? tf('Проверка мук совести: {dice}d10. Результат: успех. Человечность остаётся {after}. Сомнения очищены: {stains} → 0.', { dice: remorseDice, after: humanityAfter, stains: before.stains })
        : tf('Проверка мук совести: {dice}d10. Результат: провал. Человечность: {before} → {after}. Сомнения очищены: {stains} → 0.', { dice: remorseDice, before: before.value, after: humanityAfter, stains: before.stains })
    const warnings = [
      'Проверка мук совести не использует кубики Голода, Прилив Крови и переброс Воли.',
      ...(humanityAfter <= 0 ? ['Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.'] : []),
    ]
    await publishRoll({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName,
      poolType: 'remorse-check',
      diceCount: dice.length,
      dice,
      successes,
      createdAt: now,
      meta: {
        source: 'humanity',
        rollKind: 'remorse_check',
        hungerDice: 0,
        humanityBefore: before.value,
        humanityAfter,
        stainsBefore: before.stains,
        stainsAfter: 0,
        remorseDice,
        automaticFailure,
        humanityLost: !success,
        stainEvents: before.stainEvents || [],
        warnings,
      },
    })
    return updated
  }

  const updateCharacterWillpower = async (
    characterId: string,
    nextTracker: { superficial: number; aggravated: number },
    reason = 'Воля обновлена',
  ) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', characterId)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Воли:', error)
      setConnectionText('Воля не сохранилась')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const willpowerMax = mapCharacterRow(data as CharacterRow)
      .derivedStats.willpower.totalMax
    const normalized = normalizeWillpowerTracker(nextTracker, willpowerMax)
    const nextData = {
      ...characterData,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        willpower: {
          superficial: normalized.superficial,
          aggravated: normalized.aggravated,
        },
      },
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: nextData })
      .eq('id', characterId)

    if (updateError) {
      console.error('Не удалось сохранить Волю персонажа:', updateError)
      setConnectionText('Воля не сохранилась')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    setChatCharacters(current => current.map(character => (
      character.id === characterId ? { ...updatedCharacter, username: character.username } : character
    )))
    setPreviewCharacter(current => current?.id === characterId ? { ...updatedCharacter, username: current.username } : current)

    setConnectionText(reason)
    return updatedCharacter
  }

  const syncHealthCharacter = (characterId: string, updatedCharacter: CharacterOption) => {
    setChatCharacters(current => current.map(character => (
      character.id === characterId ? { ...updatedCharacter, username: character.username } : character
    )))
    setPreviewCharacter(current => current?.id === characterId ? { ...updatedCharacter, username: current.username } : current)
  }

  const updateCharacterHealth = async (
    characterId: string,
    nextTracker: NormalizedHealth,
    reason = 'Здоровье сохранено',
    options: {
      lastAggravatedMendAt?: string
    } = {},
  ) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', characterId)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для обновления Здоровья:', error)
      setConnectionText('Здоровье не сохранилось')
      return null
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const characterType = getCharacterType(characterData)
    const profile = normalizeDamageProfile(
      characterData.damageProfile || getDefaultDamageProfile(characterType),
    )
    const stamina = getAttributeDots(characterData.attributes, 'Выносливость')
      + mapCharacterRow(data as CharacterRow)
        .derivedStats.health.passiveBonus
    const normalized = normalizeHealthTracker(toHealthTracker(nextTracker), stamina, profile)
    const nextData = {
      ...characterData,
      characterType,
      damageProfile: profile,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        health: toHealthTracker(normalized),
      },
      status: {
        ...(characterData.status || {}),
        physicalState: normalized.physicalState,
      },
      healthState: {
        ...(characterData.healthState || {}),
        ...(options.lastAggravatedMendAt ? { lastAggravatedMendAt: options.lastAggravatedMendAt } : {}),
      },
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: nextData })
      .eq('id', characterId)

    if (updateError) {
      console.error('Не удалось сохранить Здоровье персонажа:', updateError)
      setConnectionText('Здоровье не сохранилось')
      return null
    }

    const updatedCharacter = mapCharacterRow({ ...(data as CharacterRow), data: nextData })
    syncHealthCharacter(characterId, updatedCharacter)
    setConnectionText(reason)
    return updatedCharacter
  }

  const publishHealthEvent = async (
    character: CharacterOption,
    reason: string,
    before: NormalizedHealth,
    after: NormalizedHealth,
    meta: Partial<RollMeta> = {},
  ) => {
    const roll: RollMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName: reason,
      poolType: 'health',
      diceCount: 0,
      dice: [],
      successes: 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'health',
        characterId: character.id,
        healthBefore: getHealthMetaState(before),
        healthAfter: getHealthMetaState(after),
        healthImpaired: after.impaired,
        physicalState: after.physicalState,
        ...meta,
      },
    }
    await publishRoll(roll)
  }

  const applyCharacterHealthDamage = async (
    character: CharacterOption,
    amount: number,
    severity: DamageSeverity,
    options: HealthDamageOptions = {},
  ) => {
    const before = getCharacterHealth(character)
    const profile = getCharacterDamageProfile(character)
    const damageEffectResult = applyDisciplineEffectsToDamage({
      targetCharacterData: character,
      sourceCharacterData: options.sourceCharacterData,
      rulesJson: disciplineRules || defaultDisciplineRules,
      baseAmount: amount,
      severity,
      target: 'health',
      source: options.source,
      attackType: options.attackType || options.source,
      attackTypes: [options.attackType, options.source].filter((value): value is string => typeof value === 'string'),
      weaponTags: options.weaponTags,
      creatureType: character.characterType,
      armor: options.armor,
      halveSuperficial: severity === 'superficial'
        && options.halveSuperficial !== false
        && !options.ignoreHalving,
    }, character.derivedStats)
    const result = applyHealthDamage(
      before,
      damageEffectResult.finalAmount,
      damageEffectResult.severity,
      {
        ...options,
        halveSuperficial: false,
        ignoreHalving: true,
      },
      profile,
      t,
      tf,
    )
    const updatedCharacter = await updateCharacterHealth(character.id, result.tracker, 'Здоровье сохранено')
    if (!updatedCharacter) return null
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, 'Урон здоровью', before, after, {
      damage: {
        source: options.source || 'manual',
        originalAmount: damageEffectResult.originalAmount,
        finalAmount: damageEffectResult.finalAmount,
        severity: damageEffectResult.severity,
        halved: damageEffectResult.halved,
        amountBeforeHalving: damageEffectResult.amountBeforeHalving,
        originalSeverity: damageEffectResult.originalSeverity,
        prevented: damageEffectResult.prevented,
        armorIgnored: damageEffectResult.armorIgnored,
        armorValue: damageEffectResult.armorValue,
        modifiers: damageEffectResult.modifiers.filter(modifier => modifier.active),
        chain: damageEffectResult.chain,
        weaponModifier: options.weaponModifier,
        margin: options.margin,
        targetCharacterId: updatedCharacter.id,
        targetCharacterName: updatedCharacter.name,
      },
      warnings: result.warnings,
    })
    return { character: updatedCharacter, before, after, ...result }
  }

  const recoverCharacterHealth = async (
    character: CharacterOption,
    amount: number,
    severity: DamageSeverity,
    reason: string,
    healingType: NonNullable<RollMeta['healing']>['type'] = 'manual',
  ) => {
    const before = getCharacterHealth(character)
    const result = recoverHealthDamage(before, amount, severity, getCharacterDamageProfile(character))
    if (result.recovered < 1) return null
    const updatedCharacter = await updateCharacterHealth(character.id, result.tracker, 'Здоровье сохранено')
    if (!updatedCharacter) return null
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, reason, before, after, {
      healing: {
        type: healingType,
        amountSuperficial: severity === 'superficial' ? result.recovered : 0,
        amountAggravated: severity === 'aggravated' ? result.recovered : 0,
      },
    })
    return updatedCharacter
  }

  const mendVampireSuperficial = async (character: CharacterOption) => {
    const before = getCharacterHealth(character)
    if (before.superficial < 1) return
    const result = await performRouseCheck(character, 'Заживление лёгких повреждений')
    const mendAmount = getSuperficialMendAmount(getCharacterBloodPotency(character))
    const recovered = recoverHealthDamage(before, mendAmount, 'superficial', getCharacterDamageProfile(character))
    const updatedCharacter = await updateCharacterHealth(character.id, recovered.tracker, 'Здоровье и Голод сохранены')
    if (!updatedCharacter) return
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, 'Заживление лёгких повреждений', before, after, {
      hungerBefore: result.hungerBefore,
      hungerAfter: result.hungerAfter,
      rouseChecks: [result],
      healing: {
        type: 'vampire_superficial',
        amountSuperficial: recovered.recovered,
        rouseChecks: [result],
      },
      warnings: [getRouseWarning(result)].filter(Boolean),
    })
  }

  const mendVampireAggravated = async (character: CharacterOption) => {
    const before = getCharacterHealth(character)
    if (before.aggravated < 1) return
    if (!window.confirm(t('По правилам это можно делать не чаще одного раза за ночь и требует 3 Испытания Крови. Продолжить?'))) return
    const lastMendDate = character.lastAggravatedMendAt ? new Date(character.lastAggravatedMendAt) : null
    const mendedTonight = Boolean(
      lastMendDate
      && !Number.isNaN(lastMendDate.getTime())
      && lastMendDate.toDateString() === new Date().toDateString(),
    )
    if (mendedTonight && !window.confirm(t('Тяжёлый урон уже лечили этой ночью. Применить мастерский override?'))) return
    const checks: RouseCheckResult[] = []
    let hunger = getCharacterHunger(character)
    for (let index = 0; index < 3; index += 1) {
      const result = await performRouseCheck(character, tf('Заживление тяжёлого повреждения {n}/3', { n: index + 1 }), hunger)
      checks.push(result)
      hunger = result.hungerAfter
    }
    const recovered = recoverHealthDamage(before, 1, 'aggravated', getCharacterDamageProfile(character))
    const updatedCharacter = await updateCharacterHealth(character.id, recovered.tracker, 'Здоровье и Голод сохранены', {
      lastAggravatedMendAt: new Date().toISOString(),
    })
    if (!updatedCharacter) return
    const after = getCharacterHealth(updatedCharacter)
    await publishHealthEvent(updatedCharacter, 'Заживление тяжёлого повреждения', before, after, {
      hungerBefore: checks[0]?.hungerBefore,
      hungerAfter: checks[checks.length - 1]?.hungerAfter,
      rouseChecks: checks,
      healing: {
        type: 'vampire_aggravated',
        amountAggravated: recovered.recovered,
        rouseChecks: checks,
      },
      warnings: checks.map(getRouseWarning).filter(Boolean),
    })
  }

  const recoverMortalHealth = async (character: CharacterOption) => {
    const amount = getAttributeDots(character.attributes, 'Выносливость')
    await recoverCharacterHealth(character, amount, 'superficial', 'Восстановление смертного', 'mortal_superficial')
  }

  const treatMortalHealth = async (character: CharacterOption) => {
    const medicine = Number(window.prompt(t('Медицина лекаря:'), '1') || 0)
    if (medicine < 1) return
    const success = window.confirm(tf('Проверка Интеллект + Медицина успешна? Сложность: {difficulty}.', { difficulty: getCharacterHealth(character).aggravated }))
    const before = getCharacterHealth(character)
    const converted = success ? Math.min(before.aggravated, Math.ceil(medicine / 2)) : 0
    const next = normalizeHealthTracker({
      ...toHealthTracker(before),
      aggravated: before.aggravated - converted,
      superficial: before.superficial + converted,
    }, getCharacterHealthStamina(character), getCharacterDamageProfile(character))
    const updatedCharacter = await updateCharacterHealth(character.id, next, 'Лечение смертного сохранено')
    if (!updatedCharacter) return
    await publishHealthEvent(updatedCharacter, 'Лечение смертного', before, getCharacterHealth(updatedCharacter), {
      healing: { type: 'mortal_aggravated_medicine', amountAggravated: converted },
      warnings: success
        ? ['Тяжёлые повреждения превращены в лёгкие. Восстановление занимает ночь.']
        : ['Проверка лечения провалена: здоровье не изменилось.'],
    })
  }

  const publishWillpowerEvent = async (
    character: CharacterOption,
    reason: string,
    before: NormalizedWillpower,
    after: NormalizedWillpower,
    meta: Partial<RollMeta> = {},
  ) => {
    const roll: RollMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName: reason,
      poolType: 'willpower',
      diceCount: 0,
      dice: [],
      successes: 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'willpower',
        characterId: character.id,
        willpowerBefore: getWillpowerMetaState(before),
        willpowerAfter: getWillpowerMetaState(after),
        willpowerImpaired: after.impaired,
        ...meta,
      },
    }
    await publishRoll(roll)
  }

  const spendWillpower = async (character: CharacterOption, amount = 1, reason = 'Воля: трата') => {
    const before = getCharacterWillpower(character)
    const result = applyWillpowerStressValue(before, amount)
    if (result.applied < amount) {
      window.alert(result.warnings[0] ? t(result.warnings[0]) : t('Волю сейчас потратить нельзя.'))
      return null
    }
    const updatedCharacter = await updateCharacterWillpower(character.id, result.tracker, 'Воля сохранена')
    if (!updatedCharacter) return null
    const after = getCharacterWillpower(updatedCharacter)
    await publishWillpowerEvent(updatedCharacter, reason, before, after, {
      spentWillpower: result.applied,
      warnings: result.warnings,
    })
    return { character: updatedCharacter, before, after, spent: result.applied, warnings: result.warnings }
  }

  const recoverWillpower = async (
    character: CharacterOption,
    amount: number,
    severity: 'superficial' | 'aggravated',
    reason: string,
  ) => {
    const before = getCharacterWillpower(character)
    const result = recoverWillpowerStressValue(before, amount, severity)
    if (result.recovered < 1) return null
    const updatedCharacter = await updateCharacterWillpower(character.id, result.tracker, 'Воля сохранена')
    if (!updatedCharacter) return null
    const after = getCharacterWillpower(updatedCharacter)
    await publishWillpowerEvent(updatedCharacter, reason, before, after, {
      recoveredWillpower: result.recovered,
    })
    return { character: updatedCharacter, before, after, recovered: result.recovered }
  }

  const adjustWillpowerStress = async (character: CharacterOption, severity: 'superficial' | 'aggravated', delta: number) => {
    const before = getCharacterWillpower(character)
    const next = { superficial: before.superficial, aggravated: before.aggravated }
    if (severity === 'aggravated') {
      next.aggravated = Math.max(0, Math.min(before.max, next.aggravated + delta))
      if (next.superficial + next.aggravated > before.max) next.superficial = Math.max(0, before.max - next.aggravated)
    } else {
      next.superficial = Math.max(0, Math.min(Math.max(0, before.max - next.aggravated), next.superficial + delta))
    }
    await updateCharacterWillpower(character.id, next, 'Воля сохранена')
  }

  const rollWillpowerCheck = async (character: CharacterOption) => {
    const willpower = getCharacterWillpower(character)
    if (willpower.current < 1) {
      window.alert(t('Доступной Воли нет: проверку Воли бросить нельзя.'))
      return
    }
    await rollQuickDice(willpower.current, 'Проверка Воли', character, 'willpower-check', {
      skipHungerDice: true,
      source: 'willpower',
      warnings: ['Проверка Воли бросает текущую доступную Волю и не использует кубики Голода.'],
    })
  }

  const performRouseCheck = async (
    character: CharacterOption,
    reason: string,
    hungerBefore = getCharacterHunger(character),
  ): Promise<RouseCheckResult> => {
    const safeBefore = Math.max(0, Math.min(5, Math.floor(Number(hungerBefore) || 0)))
    const value = Math.floor(Math.random() * 10) + 1
    const success = value >= 6
    const hungerAfter = success ? safeBefore : Math.max(0, Math.min(5, safeBefore + 1))
    const result: RouseCheckResult = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      reason,
      value,
      success,
      hungerBefore: safeBefore,
      hungerAfter,
      maxHungerWarning: !success && safeBefore >= 5,
    }

    if (hungerAfter !== safeBefore) {
      await updateCharacterHunger(character.id, hungerAfter, 'Голод сохранён')
    }

    return result
  }

  const rollRouseCheck = async (character: CharacterOption, reason = 'Испытание Крови / Проверка Голода') => {
    const result = await performRouseCheck(character, reason)
    const die = { value: result.value, kind: getDieKind(result.value, false) } as Die
    const warning = getRouseWarning(result)
    const roll: RollMessage = {
      id: result.id,
      room,
      characterName: character.name,
      poolName: reason,
      poolType: 'rouse-check',
      diceCount: 1,
      dice: [die],
      successes: result.success ? 1 : 0,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'rouse_check',
        hungerBefore: result.hungerBefore,
        hungerAfter: result.hungerAfter,
        bloodPotency: getCharacterBloodPotency(character),
        rouseChecks: [result],
        warnings: warning ? [warning] : [],
      },
    }
    await publishRoll(roll)
  }

  const quenchHunger = async (character: CharacterOption, amount: number = 1) => {
    const current = getCharacterHunger(character)
    const delta = Math.max(1, Math.floor(Number(amount) || 1))
    const next = Math.max(0, Math.min(5, current - delta))
    if (next === current) return
    await updateCharacterHunger(character.id, next, 'Голод утолён')
  }

  const publishOpposedRoll = async (roll: RollMessage, opposed: OpposedRollResult) => {
    setRolls(prev => mergeRoll(prev, roll))
    triggerDiceOverlay(roll)
    broadcast('roll', roll)
    const payload = {
      id: roll.id,
      room: roll.room,
      character_name: roll.characterName,
      pool_name: roll.poolName,
      pool_type: roll.poolType,
      dice_count: roll.diceCount,
      dice: opposed,
      successes: roll.successes,
      meta: roll.meta || {},
      created_at: roll.createdAt,
    }
    let { error } = await createClient().from(TABLE_ROLLS).insert(payload)
    if (error && /meta/i.test(error.message || '')) {
      const { meta, ...legacyPayload } = payload
      const fallback = await createClient().from(TABLE_ROLLS).insert(legacyPayload)
      error = fallback.error
    }
    if (error) setConnectionText('Встречная проверка отправлена онлайн, но не сохранилась')
    else setConnectionText('Онлайн')
  }

  const answerOpposedProposal = async () => {
    const proposal = incomingOpposedProposal
    if (!proposal || !chatUser || proposal.toUserId !== chatUser.id) return
    if (!selectedActiveCharacter) {
      window.alert(t('Сначала выбери активного персонажа.'))
      return
    }

    const responsePool = getOpposedCharacterPool(selectedActiveCharacter, opposedResponseSide)
    if (responsePool.diceCount < 1) {
      window.alert(t('Твой ответный пул должен быть хотя бы 1к10.'))
      return
    }

    const rightDice = rollD10Pool(responsePool.diceCount, getCharacterHunger(selectedActiveCharacter))
    const rightSide: OpposedRollSide = {
      id: 'right',
      actorName: selectedActiveCharacter.name || t('Ответчик'),
      actorKind: 'player',
      poolName: responsePool.poolName,
      diceCount: rightDice.length,
      dice: rightDice,
      successes: countD10Successes(rightDice),
    }
    const leftSide = proposal.initiator
    const winnerSideId: OpposedRollSide['id'] | null = leftSide.successes === rightSide.successes
      ? null
      : leftSide.successes > rightSide.successes
        ? 'left'
        : 'right'
    const outcome: OpposedRollResult['outcome'] = winnerSideId ?? 'tie'
    const summary = winnerSideId === 'left'
      ? tf('Победа: {name}', { name: leftSide.actorName })
      : winnerSideId === 'right'
        ? tf('Победа: {name}', { name: rightSide.actorName })
        : t('Ничья')
    const opposed: OpposedRollResult = { sides: [leftSide, rightSide], winnerSideId, outcome, summary }
    const responseRollModifiers = responsePool.rollEffectResult?.modifiers.filter(modifier => (
      modifier.active
      && (
        modifier.diceDelta !== 0
        || modifier.difficultyDelta !== 0
        || modifier.operation === 'ignore_penalty'
        || modifier.operation === 'auto_success'
      )
    ))
    const roll: RollMessage = {
      id: proposal.id,
      room,
      characterName: t('Встречная проверка'),
      poolName: tf('{left} против {right}', { left: leftSide.actorName, right: rightSide.actorName }),
      poolType: 'opposed',
      diceCount: leftSide.diceCount + rightSide.diceCount,
      dice: [],
      successes: Math.max(leftSide.successes, rightSide.successes),
      createdAt: new Date().toISOString(),
      opposed,
      meta: {
        rollMode: 'contested',
        contested: {
          requestId: proposal.id,
          initiatorCharacterName: leftSide.actorName,
          initiatorPoolName: leftSide.poolName,
          initiatorDiceCount: leftSide.diceCount,
          opponentUserId: chatUser.id,
          opponentCharacterId: selectedActiveCharacter.id,
          opponentName: rightSide.actorName,
          status: 'resolved',
          initiatorSuccesses: leftSide.successes,
          opponentSuccesses: rightSide.successes,
          margin: Math.abs(leftSide.successes - rightSide.successes),
          winner: winnerSideId === 'left' ? 'initiator' : winnerSideId === 'right' ? 'opponent' : 'tie',
        },
        rollModifiers: responseRollModifiers?.length ? responseRollModifiers : undefined,
        rollDifficultyModifier: responsePool.rollEffectResult?.difficultyDelta || undefined,
        warnings: getActiveRollModifierWarnings(responsePool.rollEffectResult),
      },
    }

    setIncomingOpposedProposal(null)
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
    await publishOpposedRoll(roll, opposed)
  }

  const dismissOpposedProposal = () => {
    setIncomingOpposedProposal(null)
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
  }

  const buildQuickRoll = async (
    diceCount: number,
    poolName: string,
    character: CharacterOption,
    poolType: string,
    options: QuickRollOptions = {},
  ): Promise<RollMessage> => {
    const usesVampireResources = ['vampire', 'thinblood'].includes(character.characterType)
    const useBloodSurge = usesVampireResources && Boolean(options.useBloodSurge)
    const hungerBefore = options.rouseChecks?.[0]?.hungerBefore
      ?? getCharacterHunger(character)
    const willpowerBefore = getCharacterWillpower(character)
    let currentHunger = hungerBefore
    const rouseChecks: RouseCheckResult[] = [...(options.rouseChecks || [])]
    if (rouseChecks.length) {
      currentHunger = rouseChecks[rouseChecks.length - 1]?.hungerAfter ?? currentHunger
    }

    const bloodPotency = getCharacterBloodPotency(character)
    const bloodSurgeBonus = useBloodSurge ? getBloodSurgeBonus(bloodPotency) : 0
    if (useBloodSurge) {
      const result = await performRouseCheck(character, 'Прилив Крови', currentHunger)
      rouseChecks.push(result)
      currentHunger = result.hungerAfter
    }

    const rollSource = useBloodSurge
      ? 'blood_surge'
      : options.source === 'blood_surge'
        ? 'manual'
        : options.source || 'manual'
    const rollEffectResult = applyDisciplineEffectsToRoll({
      characterData: character,
      rulesJson: disciplineRules,
      baseDiceCount: Math.floor(Number(diceCount) || 0),
      poolType,
      kind: options.rollKind || 'roll',
      action: options.rollAction || poolType,
      source: rollSource,
      traits: options.rollTraits || [],
      penalties: options.rollPenalties || [],
      disabledModifierIds: options.disabledRollModifierIds,
    }, character.derivedStats)
    const activeRollModifiers = rollEffectResult.modifiers.filter(modifier => (
      modifier.active
      && (
        modifier.diceDelta !== 0
        || modifier.difficultyDelta !== 0
        || modifier.operation === 'ignore_penalty'
        || modifier.operation === 'auto_success'
      )
    ))
    const willpowerPenaltyApplied = getActivePenaltyDelta(rollEffectResult, 'willpower_impairment')
    const healthPenaltyApplied = getActivePenaltyDelta(rollEffectResult, 'health_impairment')
    const finalDiceCount = Math.max(1, Math.min(20, rollEffectResult.finalDiceCount + bloodSurgeBonus))
    const hungerDice = options.skipHungerDice ? 0 : Math.min(currentHunger, finalDiceCount)
    const dice = rollD10Pool(finalDiceCount, hungerDice)
    const successes = countD10Successes(dice)
    const outcomeMeta = getRollOutcomeMeta(dice, successes)
    const willpowerAfter = getCharacterWillpower(character)
    const warnings = [
      ...(options.warnings || []),
      ...getActiveRollModifierWarnings(rollEffectResult),
      ...rouseChecks.map(getRouseWarning).filter(Boolean),
    ]
    const meta: RollMeta = {
      characterId: character.id,
      rollMode: 'normal',
      source: rollSource,
      hungerBefore,
      hungerAfter: currentHunger,
      hungerDice,
      bloodPotency,
      willpowerBefore: options.willpowerBefore || getWillpowerMetaState(willpowerBefore),
      willpowerAfter: options.willpowerAfter || getWillpowerMetaState(willpowerAfter),
      spentWillpower: options.spentWillpower,
      recoveredWillpower: options.recoveredWillpower,
      willpowerImpaired: willpowerAfter.impaired,
      impairmentPenaltyApplied: (options.impairmentPenaltyApplied ?? willpowerPenaltyApplied) || undefined,
      healthImpaired: getCharacterHealth(character).impaired,
      healthImpairmentPenaltyApplied: (options.healthImpairmentPenaltyApplied ?? healthPenaltyApplied) || undefined,
      physicalState: getCharacterHealth(character).physicalState,
      rollModifiers: activeRollModifiers.length ? activeRollModifiers : undefined,
      rollDifficultyModifier: rollEffectResult.difficultyDelta || undefined,
      rouseChecks,
      bloodSurge: useBloodSurge ? {
        enabled: true,
        bonusDice: bloodSurgeBonus,
      } : undefined,
      discipline: options.disciplineContext,
      warnings,
      ...outcomeMeta,
    }
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName,
      poolType,
      diceCount: dice.length,
      dice,
      successes,
      createdAt: new Date().toISOString(),
      hidden: options.hidden && isMaster ? true : undefined,
      meta,
    }
  }

  const rollQuickDice = async (
    diceCount = 1,
    poolName = t('Быстрый бросок'),
    characterOverride?: CharacterOption,
    poolType = 'quick',
    options: QuickRollOptions = {},
  ) => {
    const character = characterOverride || selectedActiveCharacter
    if (!character) {
      window.alert(t('Сначала выбери активного персонажа.'))
      return
    }
    const roll = await buildQuickRoll(diceCount, poolName, character, poolType, options)
    await publishRoll(roll)
  }

  const sendContestedRollRequest = async (
    diceCount: number,
    poolName: string,
    character: CharacterOption,
    opponent: ContestedOpponentOption | null,
    poolType: string,
    options: QuickRollOptions = {},
  ) => {
    if (!chatUser) {
      window.alert(t('Сначала войди в чат стола.'))
      return
    }
    if (!opponent) {
      window.alert(t('Выбери оппонента для встречного броска.'))
      return
    }
    if (opponent.actorKind === 'player' && (!opponent.userId || opponent.userId === chatUser.id)) {
      window.alert(t('Выбери другого игрока для встречного броска.'))
      return
    }

    const initiatorRoll = await buildQuickRoll(diceCount, poolName, character, poolType, {
      ...options,
      hidden: false,
    })
    const requestId = initiatorRoll.id
    const contestedMeta: NonNullable<RollMeta['contested']> = {
      requestId,
      initiatorCharacterId: character.id,
      initiatorCharacterName: character.name,
      initiatorPoolName: poolName,
      initiatorDiceCount: initiatorRoll.diceCount,
      opponentUserId: opponent.userId,
      opponentCharacterId: opponent.characterId || undefined,
      opponentName: opponent.label,
      status: 'requested',
      initiatorSuccesses: initiatorRoll.successes,
    }
    const requestRoll: RollMessage = {
      id: `${requestId}-request`,
      room,
      characterName: character.name,
      poolName: tf('{left} против {right}', { left: character.name, right: opponent.label }),
      poolType: 'contested-request',
      diceCount: initiatorRoll.diceCount,
      dice: [],
      successes: 0,
      createdAt: initiatorRoll.createdAt,
      meta: {
        ...(initiatorRoll.meta || {}),
        rollMode: 'contested',
        contested: contestedMeta,
      },
    }

    await publishRoll(requestRoll)

    if (opponent.actorKind === 'player' && opponent.userId) {
      const proposal: OpposedRollProposal = {
        id: requestId,
        room,
        fromUserId: chatUser.id,
        fromUsername: chatUser.username,
        toUserId: opponent.userId,
        createdAt: initiatorRoll.createdAt,
        initiator: {
          id: 'left',
          actorName: character.name,
          actorKind: isMaster ? 'npc' : 'player',
          poolName,
          diceCount: initiatorRoll.diceCount,
          dice: initiatorRoll.dice,
          successes: initiatorRoll.successes,
        },
      }
      await broadcast('opposed-roll-proposal', proposal)
    }

    setConnectionText(`Встречный бросок запрошен: ${opponent.label}`)
  }

  const getRollDieId = (roll: RollMessage, index: number) => roll.dice[index]?.id || `${roll.id}:${index}`

  const getRollCharacter = (roll: RollMessage) => {
    const characterId = roll.meta?.characterId
    if (characterId) return chatCharacters.find(character => character.id === characterId) || null
    return chatCharacters.find(character => character.name === roll.characterName) || null
  }

  const applyRollDamage = async (roll: RollMessage) => {
    if (!chatCharacters.length) {
      window.alert(t('На столе нет доступных целей.'))
      return
    }
    const targetList = chatCharacters.map((character, index) => `${index + 1}. ${character.name}`).join('\n')
    const targetIndex = Number(window.prompt(tf('Выбери цель:\n{list}', { list: targetList }), '1') || 0) - 1
    const target = chatCharacters[targetIndex]
    if (!target) return
    const sourceCharacter = getRollCharacter(roll)
    const opposedMargin = roll.opposed
      ? Math.abs((roll.opposed.sides[0]?.successes || 0) - (roll.opposed.sides[1]?.successes || 0))
      : roll.successes
    const margin = Math.max(0, Number(window.prompt(t('Разница успехов:'), String(opposedMargin)) || 0))
    const weaponModifier = Number(window.prompt(t('Модификатор оружия:'), '0') || 0)
    const severity: DamageSeverity = window.confirm(t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'))
      ? 'aggravated'
      : 'superficial'
    const halveSuperficial = severity === 'superficial'
      ? window.confirm(t('Делить лёгкий урон пополам с округлением вверх?'))
      : false
    const amount = calculateConflictDamage({ margin, weaponModifier })
    if (amount < 1) {
      window.alert(t('Итоговый урон равен нулю.'))
      return
    }
    await applyCharacterHealthDamage(target, amount, severity, {
      source: 'physical_conflict',
      sourceCharacterData: sourceCharacter || undefined,
      attackType: 'physical_conflict',
      margin,
      weaponModifier,
      halveSuperficial,
      ignoreHalving: severity === 'superficial' && !halveSuperficial,
      notes: [tf('Урон применён из броска «{poolName}».', { poolName: t(roll.poolName) })],
    })
  }

  const promptCharacterHealthDamage = async (character: CharacterOption) => {
    const amount = Math.max(0, Number(window.prompt(t('Сколько урона нанести?'), '1') || 0))
    if (amount < 1) return
    const severity: DamageSeverity = window.confirm(t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'))
      ? 'aggravated'
      : 'superficial'
    const halveSuperficial = severity === 'superficial'
      ? window.confirm(t('Делить лёгкий урон пополам с округлением вверх?'))
      : false
    const note = window.prompt(t('Комментарий к урону (необязательно):'), '') || ''
    await applyCharacterHealthDamage(character, amount, severity, {
      source: 'manual',
      halveSuperficial,
      ignoreHalving: severity === 'superficial' && !halveSuperficial,
      notes: note ? [note] : [],
    })
  }

  const getWillpowerRerollEligibleDieIds = (roll: RollMessage) => roll.dice
    .map((die, index) => ({ die, id: getRollDieId(roll, index) }))
    .filter(({ die }) => !String(die.kind).startsWith('hunger'))
    .map(({ id }) => id)

  const canUseWillpowerReroll = (roll: RollMessage) => {
    if (roll.opposed || (roll.hidden && !isMaster) || roll.meta?.willpowerReroll?.used || isWillpowerRerollExcluded(roll)) return false
    if (!getWillpowerRerollEligibleDieIds(roll).length) return false
    const character = getRollCharacter(roll)
    if (!character) return false
    const willpower = getCharacterWillpower(character)
    return willpower.max > 0 && willpower.aggravated < willpower.max
  }

  const toggleWillpowerRerollDie = (roll: RollMessage, dieId: string) => {
    if (!canUseWillpowerReroll(roll)) return
    setWillpowerRerollDraft(current => {
      const selected = current?.rollId === roll.id ? current.selectedDieIds : []
      if (selected.includes(dieId)) {
        return { rollId: roll.id, selectedDieIds: selected.filter(id => id !== dieId) }
      }
      if (selected.length >= 3) return { rollId: roll.id, selectedDieIds: selected }
      return { rollId: roll.id, selectedDieIds: [...selected, dieId] }
    })
  }

  const publishRollReplacement = async (roll: RollMessage) => {
    setRolls(prev => mergeRoll(prev, roll))
    broadcast('roll', roll)
    const payload = {
      pool_name: roll.poolName,
      pool_type: roll.poolType,
      dice_count: roll.diceCount,
      dice: roll.dice,
      successes: roll.successes,
      meta: roll.meta || {},
    }
    let { error } = await createClient()
      .from(TABLE_ROLLS)
      .update(payload)
      .eq('id', roll.id)

    if (error && /meta/i.test(error.message || '')) {
      const { meta, ...legacyPayload } = payload
      const fallback = await createClient()
        .from(TABLE_ROLLS)
        .update(legacyPayload)
        .eq('id', roll.id)
      error = fallback.error
    }

    if (error) setConnectionText('Переброс отправлен онлайн, но не сохранился')
    else setConnectionText('Онлайн')
  }

  const confirmWillpowerReroll = async (roll: RollMessage) => {
    const draft = willpowerRerollDraft?.rollId === roll.id ? willpowerRerollDraft : null
    if (!draft || draft.selectedDieIds.length < 1) {
      window.alert(t('Выбери от одного до трёх обычных кубиков.'))
      return
    }
    const character = getRollCharacter(roll)
    if (!character) {
      window.alert(t('Не удалось найти персонажа для траты Воли.'))
      return
    }
    const spendResult = await spendWillpower(character, 1, tf('Воля: переброс · {poolName}', { poolName: t(roll.poolName) }))
    if (!spendResult) return

    const selected = new Set(draft.selectedDieIds)
    const oldDice: Die[] = []
    const newDice: Die[] = []
    const rerolledDice = roll.dice.map((die, index) => {
      const id = getRollDieId(roll, index)
      const normalizedDie = { ...die, id }
      if (!selected.has(id)) return normalizedDie
      oldDice.push(normalizedDie)
      const value = Math.floor(Math.random() * 10) + 1
      const nextDie = { id, value, kind: getDieKind(value, false), rerolled: true } as Die
      newDice.push(nextDie)
      return nextDie
    })
    const successes = countD10Successes(rerolledDice)
    const outcomeMeta = getRollOutcomeMeta(rerolledDice, successes)
    const previousWarnings = roll.meta?.warnings || []
    const updatedRoll: RollMessage = {
      ...roll,
      dice: rerolledDice,
      diceCount: rerolledDice.length,
      successes,
      meta: {
        ...(roll.meta || {}),
        characterId: character.id,
        willpowerBefore: getWillpowerMetaState(spendResult.before),
        willpowerAfter: getWillpowerMetaState(spendResult.after),
        spentWillpower: (roll.meta?.spentWillpower || 0) + spendResult.spent,
        willpowerImpaired: spendResult.after.impaired,
        willpowerReroll: {
          used: true,
          selectedDieIds: draft.selectedDieIds,
          oldDice,
          newDice,
        },
        warnings: [...previousWarnings, ...spendResult.warnings],
        ...outcomeMeta,
      },
    }
    setWillpowerRerollDraft(null)
    queueDiceOverlayRoll({
      id: `${updatedRoll.id}-reroll`,
      title: `${updatedRoll.characterName} · ${t('Переброс Воли')}`,
      groups: [{ key: 'main', label: '', dice: newDice.map(die => ({ value: die.value, kind: die.kind })) }],
    })
    await publishRollReplacement(updatedRoll)
  }

  const rollMasterPool = async () => {
    if (!selectedMasterRollCharacter) {
      window.alert(t('Выбери персонажа мастера.'))
      return
    }
    if (masterRollDiceCount < 1) {
      window.alert(t('Выбери характеристику, навык, дисциплину или положительный модификатор.'))
      return
    }
    if (masterRollMode === 'contested' && !selectedMasterContestedOpponent) {
      window.alert(t('Выбери оппонента для встречного броска.'))
      return
    }
    const options: QuickRollOptions = {
      hidden: masterRollHidden,
      useBloodSurge: masterUseBloodSurge,
      source: masterUseBloodSurge ? 'blood_surge' : 'manual',
      rollTraits: getRollTraits(masterRollAttribute, masterRollAttributeTwo, masterRollSkill, masterRollDiscipline),
      rollAction: masterRollMode,
      rollPenalties: getRollPenalties(masterWillpowerImpairmentPenalty, masterHealthImpairmentPenalty),
      disabledRollModifierIds: disabledMasterRollModifierIds,
    }
    if (masterRollMode === 'contested') {
      await sendContestedRollRequest(
        masterRollPoolBeforeLimit,
        masterRollPoolName,
        selectedMasterRollCharacter,
        selectedMasterContestedOpponent,
        'master-character',
        options,
      )
      return
    }
    await rollQuickDice(
      masterRollPoolBeforeLimit,
      masterRollPoolName,
      selectedMasterRollCharacter,
      'master-character',
      options,
    )
  }

  const rollMasterQuick = async (diceCount: number) => {
    if (!selectedMasterRollCharacter) {
      window.alert(t('Выбери персонажа мастера.'))
      return
    }
    await rollQuickDice(
      diceCount,
      d10(diceCount),
      selectedMasterRollCharacter,
      'master-quick',
      {
        hidden: masterRollHidden,
        useBloodSurge: masterUseBloodSurge,
        source: masterUseBloodSurge ? 'blood_surge' : 'manual',
      },
    )
  }

  const toggleMasterRollAttribute = (name: string) => {
    if (masterRollAttribute === name) {
      setMasterRollAttribute('')
      return
    }
    if (masterRollAttributeTwo === name) {
      setMasterRollAttributeTwo('')
      return
    }
    if (!masterRollAttribute) setMasterRollAttribute(name)
    else setMasterRollAttributeTwo(name)
  }

  const rollPreviewPool = async () => {
    if (!previewCharacter || !canRollPreview) {
      window.alert(t('Броски доступны мастеру или владельцу активного персонажа.'))
      return
    }
    if (previewDiceCount < 1) {
      window.alert(t('Выбери характеристику, навык или положительный модификатор.'))
      return
    }
    if (previewRollMode === 'contested' && !selectedPreviewContestedOpponent) {
      window.alert(t('Выбери оппонента для встречного броска.'))
      return
    }

    const poolParts = []
    if (previewRollAttribute) poolParts.push(`${t(previewRollAttribute)} ${previewAttributeDots}`)
    if (previewRollAttributeTwo) poolParts.push(`${t(previewRollAttributeTwo)} ${previewAttributeTwoDots}`)
    if (previewRollSkill) poolParts.push(`${t(previewRollSkill)} ${previewSkillDots}`)
    if (previewRollDiscipline) poolParts.push(`${previewRollDiscipline} ${previewDisciplineDots}`)
    if (previewRollModifier) poolParts.push(`${t('модификатор')} ${previewRollModifier > 0 ? '+' : ''}${previewRollModifier}`)
    const poolName = poolParts.join(' + ') || d10(previewDiceCount)
    const options: QuickRollOptions = {
      useBloodSurge: previewBloodSurgeEnabled,
      source: previewBloodSurgeEnabled ? 'blood_surge' : 'manual',
      rollTraits: getRollTraits(previewRollAttribute, previewRollAttributeTwo, previewRollSkill, previewRollDiscipline),
      rollAction: previewRollMode,
      rollPenalties: getRollPenalties(previewWillpowerImpairmentPenalty, previewHealthImpairmentPenalty),
      disabledRollModifierIds: disabledPreviewRollModifierIds,
    }
    if (previewRollMode === 'contested') {
      await sendContestedRollRequest(
        previewPoolBeforeLimit,
        poolName,
        previewCharacter,
        selectedPreviewContestedOpponent,
        'character-sheet',
        options,
      )
      return
    }
    await rollQuickDice(previewPoolBeforeLimit, poolName, previewCharacter, 'character-sheet', options)
  }

  const togglePreviewAttribute = (name: string) => {
    if (previewRollAttribute === name) {
      setPreviewRollAttribute('')
      return
    }
    if (previewRollAttributeTwo === name) {
      setPreviewRollAttributeTwo('')
      return
    }
    if (!previewRollAttribute) setPreviewRollAttribute(name)
    else setPreviewRollAttributeTwo(name)
  }

  const openPreviewDiscipline = (name: string) => {
    setPreviewDisciplineName(name)
    setPreviewPowerName('')
  }

  const payActivateAndSaveDisciplinePower = async (
    character: CharacterOption,
    power: DisciplinePowerEntry,
    cost: DisciplineCost,
    inputValues: Record<string, string> = {},
  ) => {
    let rouseChecksOverride: number | undefined
    if (cost.variableRouseChecks) {
      const answer = window.prompt(
        t('Сколько Испытаний Крови сделать для этой силы?'),
        String(Math.max(1, cost.rouseChecks)),
      )
      if (answer === null) return null
      rouseChecksOverride = Math.max(
        1,
        Math.min(5, Math.floor(Number(answer) || cost.rouseChecks || 1)),
      )
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', character.id)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для оплаты силы:', error)
      setConnectionText('Цена силы не оплачена')
      return null
    }

    const storedCharacter = mapCharacterRow(data as CharacterRow)
    const isActivePower = power.rule.mechanics?.activation?.kind === 'active'
    let payment: DisciplineCostPayment<CharacterOption>
    let nextActiveEffects: ActiveEffect[] | undefined
    let activated = false

    if (isActivePower) {
      const activation = activateDisciplinePower(
        storedCharacter,
        power.rule.mechanics || {},
        {
          identity: {
            discipline: previewDisciplineName,
            path: power.path,
            power: power.name,
            level: power.level,
          },
          legacyCost: power.rule.cost,
          legacyDuration: power.rule.duration,
          targetCharacterId: storedCharacter.id,
          reason: `${previewDisciplineName}: ${power.name}`,
          rouseChecksOverride,
          inputValues,
          t,
          tf,
        },
      )
      if (!activation.success || !activation.payment) {
        setConnectionText(activation.warnings[0] || 'Сила не активирована')
        return null
      }
      payment = activation.payment
      nextActiveEffects = activation.activeEffects
      activated = activation.createdEffects.length > 0
    } else {
      payment = payDisciplineCost(
        storedCharacter,
        {
          mechanics: power.rule.mechanics,
          legacyCost: power.rule.cost,
        },
        {
          reason: `${previewDisciplineName}: ${power.name}`,
          rouseChecksOverride,
          t,
          tf,
        },
      )
      if (!payment.success) {
        setConnectionText(payment.warnings[0] || 'Цена силы требует ручного решения')
        return null
      }
    }

    const hasAutomaticCost = payment.rouseChecks.length > 0
      || payment.spentWillpower > 0
    if (!hasAutomaticCost && !activated) {
      return { character: storedCharacter, payment, activated }
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const nextData = {
      ...characterData,
      vitalTrackers: {
        ...(characterData.vitalTrackers || {}),
        ...(payment.rouseChecks.length > 0
          ? { hunger: payment.hungerAfter }
          : {}),
        ...(payment.spentWillpower > 0
          ? {
              willpower: {
                superficial: payment.willpowerAfter.superficial,
                aggravated: payment.willpowerAfter.aggravated,
              },
            }
          : {}),
      },
      ...(nextActiveEffects ? { activeEffects: nextActiveEffects } : {}),
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: nextData })
      .eq('id', character.id)

    if (updateError) {
      console.error('Не удалось сохранить оплату силы:', updateError)
      setConnectionText('Цена силы не сохранилась')
      return null
    }

    const updatedCharacter = mapCharacterRow({
      ...(data as CharacterRow),
      data: nextData,
    })
    setChatCharacters(current => current.map(currentCharacter => (
      currentCharacter.id === character.id
        ? { ...updatedCharacter, username: currentCharacter.username }
        : currentCharacter
    )))
    setPreviewCharacter(current => current?.id === character.id
      ? { ...updatedCharacter, username: current.username }
      : current)

    if (chatUser && selectedActiveCharacter?.id === character.id) {
      const participant: ActiveParticipant = {
        userId: chatUser.id,
        username: chatUser.username,
        characterId: character.id,
        characterName: updatedCharacter.name || 'без персонажа',
        characterClan: updatedCharacter.clan || null,
        characterImage: updatedCharacter.image || '',
        updatedAt: new Date().toISOString(),
      }
      broadcast('active-character', { room, participant })
    }

    setConnectionText(activated ? 'Сила активирована' : 'Цена силы оплачена')
    return { character: updatedCharacter, payment, activated }
  }

  const publishDisciplineActivation = async (
    character: CharacterOption,
    context: DisciplineRollContext,
    rouseChecks: RouseCheckResult[],
    willpowerMeta: Partial<RollMeta> = {},
    action: 'Активация' | 'Отключение' = 'Активация',
  ) => {
    const dice = rouseChecks.map(result => ({ value: result.value, kind: getDieKind(result.value, false) } as Die))
    const hungerBefore = rouseChecks[0]?.hungerBefore ?? getCharacterHunger(character)
    const hungerAfter = rouseChecks[rouseChecks.length - 1]?.hungerAfter ?? hungerBefore
    const warnings = rouseChecks.map(getRouseWarning).filter(Boolean)
    const roll: RollMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName: `${context.name}: ${context.power} · ${t(action)}`,
      poolType: 'discipline-power',
      diceCount: dice.length,
      dice,
      successes: rouseChecks.filter(result => result.success).length,
      createdAt: new Date().toISOString(),
      meta: {
        source: 'discipline',
        hungerBefore,
        hungerAfter,
        hungerDice: 0,
        bloodPotency: getCharacterBloodPotency(character),
        rouseChecks,
        discipline: context,
        warnings: [...warnings, ...(willpowerMeta.warnings || [])],
        characterId: character.id,
        willpowerBefore: willpowerMeta.willpowerBefore || getWillpowerMetaState(getCharacterWillpower(character)),
        willpowerAfter: willpowerMeta.willpowerAfter || getWillpowerMetaState(getCharacterWillpower(character)),
        spentWillpower: willpowerMeta.spentWillpower,
        recoveredWillpower: willpowerMeta.recoveredWillpower,
        willpowerImpaired: getCharacterWillpower(character).impaired,
      },
    }
    await publishRoll(roll)
  }

  const deactivatePreviewDisciplinePower = async () => {
    if (
      !previewCharacter
      || !selectedPreviewPower
      || !selectedPreviewPowerIsActive
      || !canRollPreview
    ) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', previewCharacter.id)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать персонажа для отключения силы:', error)
      setConnectionText('Сила не отключена')
      return
    }

    const storedCharacter = mapCharacterRow(data as CharacterRow)
    const deactivation = deactivateDisciplinePower(
      storedCharacter,
      selectedPreviewPower.rule.mechanics || {},
      {
        discipline: previewDisciplineName,
        path: selectedPreviewPower.path,
        power: selectedPreviewPower.name,
        level: selectedPreviewPower.level,
      },
    )
    if (!deactivation.success) {
      setConnectionText('Активный эффект силы не найден')
      return
    }

    const characterData = data.data as NonNullable<CharacterRow['data']>
    const nextData = {
      ...characterData,
      activeEffects: deactivation.activeEffects,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: nextData })
      .eq('id', previewCharacter.id)

    if (updateError) {
      console.error('Не удалось сохранить отключение силы:', updateError)
      setConnectionText('Сила не отключена')
      return
    }

    const updatedCharacter = mapCharacterRow({
      ...(data as CharacterRow),
      data: nextData,
    })
    setChatCharacters(current => current.map(character => (
      character.id === updatedCharacter.id
        ? { ...updatedCharacter, username: character.username }
        : character
    )))
    setPreviewCharacter(current => current?.id === updatedCharacter.id
      ? { ...updatedCharacter, username: current.username }
      : current)
    setConnectionText('Сила отключена')

    await publishDisciplineActivation(
      updatedCharacter,
      {
        name: previewDisciplineName,
        power: selectedPreviewPower.name,
        level: selectedPreviewPower.level,
        cost: t('без оплаты'),
      },
      [],
      { warnings: ['Активный эффект силы отключён.'] },
      'Отключение',
    )
  }

  const rollPreviewPower = async () => {
    if (!previewCharacter || !selectedPreviewPower || !canRollPreview) return
    if (hasMissingPreviewPowerInput) {
      setConnectionText('Заполни поля силы перед активацией')
      return
    }
    let activeCharacter = previewCharacter
    let willpowerMeta: Partial<RollMeta> = {}
    const context: DisciplineRollContext = {
      name: previewDisciplineName,
      power: selectedPreviewPower.name,
      level: selectedPreviewPower.level,
      cost: selectedPreviewPowerCostLabel,
    }
    const humanityRisk = selectedPreviewPower.rule.mechanics?.humanity
    if (humanityRisk?.risk) {
      const suggested = Math.max(1, Math.floor(Number(humanityRisk.suggestedStains) || 1))
      const answer = window.prompt(
        t('Эта сила может угрожать Человечности. Добавить Сомнения?\n\n1 — +1\n2 — +2\n0 — не добавлять\nДругое число — ручное значение'),
        String(suggested),
      )
      if (answer !== null) {
        const amount = Math.max(0, Math.min(10, Math.floor(Number(answer) || 0)))
        if (amount > 0) {
          const updated = await addHumanityStains(activeCharacter, amount, 'использование силы с риском Человечности', {
            source: 'discipline_risk',
            reasonText: humanityRisk.reason || `${previewDisciplineName}: ${selectedPreviewPower.name}`,
          })
          if (updated) activeCharacter = updated
        }
      }
    }

    const costResult = await payActivateAndSaveDisciplinePower(
      activeCharacter,
      selectedPreviewPower,
      selectedPreviewPowerCost,
      previewPowerInputValues,
    )
    if (!costResult) return
    activeCharacter = costResult.character
    const rouseChecks = costResult.payment.rouseChecks
    willpowerMeta = {
      willpowerBefore: getWillpowerMetaState(costResult.payment.willpowerBefore),
      willpowerAfter: getWillpowerMetaState(costResult.payment.willpowerAfter),
      spentWillpower: costResult.payment.spentWillpower || undefined,
      warnings: costResult.payment.warnings,
    }

    if (previewPowerDiceCount < 1 || previewPowerPoolChoices.length === 0) {
      if (
        costResult.activated
        || rouseChecks.length > 0
        || willpowerMeta.spentWillpower
      ) {
        await publishDisciplineActivation(activeCharacter, context, rouseChecks, willpowerMeta)
        return
      }
      window.alert(t('Для этой силы автоматический бросок не указан. Используй обычный конструктор пула.'))
      return
    }
    const selectedParts = previewPowerPoolSelections.map(name => `${t(name)} ${getCharacterPoolPartDots(activeCharacter, name)}`)
    if (previewPowerModifier) selectedParts.push(`${t('модификатор')} ${previewPowerModifier > 0 ? '+' : ''}${previewPowerModifier}`)
    await rollQuickDice(
      previewPowerPoolBeforeLimit,
      `${previewDisciplineName}: ${selectedPreviewPower.name} · ${selectedParts.join(' + ')}`,
      activeCharacter,
      'discipline-power',
      {
        source: 'discipline',
        disciplineContext: context,
        rouseChecks,
        willpowerBefore: willpowerMeta.willpowerBefore,
        willpowerAfter: willpowerMeta.willpowerAfter,
        spentWillpower: willpowerMeta.spentWillpower,
        rollTraits: getRollTraits(...previewPowerPoolSelections, previewDisciplineName),
        rollAction: selectedPreviewPower.name,
        rollPenalties: getRollPenalties(previewPowerWillpowerImpairmentPenalty, previewPowerHealthImpairmentPenalty),
        disabledRollModifierIds: disabledPreviewPowerModifierIds,
        warnings: [
          ...(willpowerMeta.warnings || []),
        ],
      },
    )
  }

  const addQuickInventoryItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = quickInventoryName.trim()
    if (!name || !previewCharacter?.id || !chatUser || !canEditPreviewInventory || isQuickInventoryBusy) return

    setIsQuickInventoryBusy(true)
    setQuickInventoryStatus('Сохраняю...')
    const now = new Date().toISOString()
    const item: InventoryItem = {
      id: `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      description: '',
      quantity: Math.max(0, Math.floor(quickInventoryQuantity)),
      category: quickInventoryCategory,
      note: '',
      createdAt: now,
      updatedAt: now,
      collapsed: true,
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('characters')
        .select('data')
        .eq('id', previewCharacter.id)
        .eq('user_id', chatUser.id)
        .single()
      if (error || !data?.data) throw error || new Error('Данные персонажа не найдены')

      const characterData = data.data as Record<string, unknown>
      const nextInventory = [item, ...normalizeInventory(characterData.inventory)]
      const { error: updateError } = await supabase
        .from('characters')
        .update({ data: { ...characterData, inventory: nextInventory, timestamp: now } })
        .eq('id', previewCharacter.id)
        .eq('user_id', chatUser.id)
      if (updateError) throw updateError

      setPreviewCharacter(current => current ? { ...current, inventory: nextInventory } : current)
      setChatCharacters(current => current.map(character => character.id === previewCharacter.id ? { ...character, inventory: nextInventory } : character))
      setQuickInventoryName('')
      setQuickInventoryQuantity(1)
      setQuickInventoryStatus('Предмет добавлен')
    } catch (error) {
      console.error('Не удалось добавить предмет в инвентарь:', error)
      setQuickInventoryStatus('Не удалось сохранить предмет')
    } finally {
      setIsQuickInventoryBusy(false)
    }
  }

  const removePreviewActiveEffect = async (effectId: string) => {
    if (
      !previewCharacter?.id
      || !chatUser
      || !canEditPreviewActiveEffects
    ) return

    setConnectionText('Удаляю эффект...')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('characters')
      .select('id, user_id, name, clan, data')
      .eq('id', previewCharacter.id)
      .eq('user_id', chatUser.id)
      .single()

    if (error || !data?.data) {
      console.error('Не удалось прочитать активные эффекты персонажа:', error)
      setConnectionText('Эффект не удалён')
      return
    }

    const storedCharacter = mapCharacterRow(data as CharacterRow)
    const targetEffect = storedCharacter.activeEffects.find(
      (activeEffect) => activeEffect.id === effectId,
    )
    const deactivation = targetEffect
      ? deactivateDisciplinePower(
          storedCharacter,
          {
            identity: targetEffect.source,
            activation: { kind: 'active' },
          },
          targetEffect.source,
        )
      : null
    const withoutEffect = deactivation?.success
      ? {
          ...(data.data as NonNullable<CharacterRow['data']>),
          activeEffects: deactivation.activeEffects,
        }
      : removeActiveEffectFromData(
          data.data,
          effectId,
        ) as NonNullable<CharacterRow['data']>
    const nextData = {
      ...withoutEffect,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ data: nextData })
      .eq('id', previewCharacter.id)
      .eq('user_id', chatUser.id)

    if (updateError) {
      console.error('Не удалось удалить активный эффект:', updateError)
      setConnectionText('Эффект не удалён')
      return
    }

    const updatedCharacter = mapCharacterRow({
      ...(data as CharacterRow),
      data: nextData,
    })
    setPreviewCharacter(current => current?.id === updatedCharacter.id
      ? { ...updatedCharacter, username: current.username }
      : current)
    setChatCharacters(current => current.map(character => (
      character.id === updatedCharacter.id
        ? { ...updatedCharacter, username: character.username }
        : character
    )))
    setConnectionText('Эффект отключён')

    if (targetEffect) {
      await publishDisciplineActivation(
        updatedCharacter,
        {
          name: targetEffect.source.discipline,
          power: targetEffect.source.power,
          level: targetEffect.source.level || 0,
          cost: t('без оплаты'),
        },
        [],
        { warnings: ['Активный эффект силы отключён.'] },
        'Отключение',
      )
    }
  }

  const showInventoryItemToMaster = (item: InventoryItem) => {
    if (!previewCharacter || !chatUser) return
    const reveal: MasterReveal = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      kind: t('Инвентарь'),
      title: item.name || t('Без названия'),
      body: item.description || item.note || t('Описание не указано'),
      meta: tf('{category} · {quantity} шт.', { category: t(item.category) || t('Другое'), quantity: item.quantity ?? 1 }),
      characterName: previewCharacter.name || t('Безымянный'),
      userId: chatUser.id,
      username: chatUser.username,
      createdAt: new Date().toISOString(),
    }
    broadcast('master-reveal', reveal)
    setQuickInventoryStatus(tf('«{title}» показано мастеру', { title: reveal.title }))
  }

  const addExperienceToActiveCharacter = async () => {
    if (!chatUser || !previewCharacter?.id || previewCharacter.id !== selectedActiveCharacter?.id) return
    const amount = Number(window.prompt(t('Сколько опыта добавить?'), '1'))
    if (!Number.isFinite(amount) || amount <= 0) return
    const { data, error } = await createClient()
      .from('characters')
      .select('data')
      .eq('id', previewCharacter.id)
      .eq('user_id', chatUser.id)
      .single()
    if (error || !data?.data) {
      window.alert(t('Не удалось загрузить персонажа для добавления опыта.'))
      return
    }
    const characterData = data.data as Record<string, unknown>
    const current = Number(characterData.freeExp ?? characterData.experience ?? 0) || 0
    const nextData = {
      ...characterData,
      freeExp: current + amount,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await createClient()
      .from('characters')
      .update({ data: nextData })
      .eq('id', previewCharacter.id)
      .eq('user_id', chatUser.id)
    if (updateError) {
      window.alert(t('Опыт не сохранился.'))
      return
    }
    const nextFreeExp = current + amount
    setPreviewCharacter(prev => prev ? { ...prev, freeExp: nextFreeExp } : prev)
    setChatCharacters(prev => prev.map(character => character.id === previewCharacter.id ? { ...character, freeExp: nextFreeExp } : character))
  }

  useEffect(() => {
    if (!chatUser || !journalStorageKey) {
      setJournalEntries([])
      setSelectedJournalEntryId('')
      return
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(journalStorageKey) || '[]') as JournalEntry[]
      const entries = Array.isArray(parsed) ? parsed : []
      setJournalEntries(entries)
      setSelectedJournalEntryId(entries[0]?.id || '')
      setJournalSaveStatus('Сохранено')
    } catch {
      setJournalEntries([])
      setSelectedJournalEntryId('')
    }
  }, [chatUser, journalStorageKey])

  useEffect(() => {
    if (!chatUser || journalSaveStatus !== 'Есть несохранённые изменения') return
    const timeout = window.setTimeout(() => persistCurrentJournal(), 800)
    return () => window.clearTimeout(timeout)
  }, [journalEntries, journalSaveStatus, chatUser])

  useEffect(() => {
    if (!chatUser || !journalStorageKey) return
    const interval = window.setInterval(() => {
      window.localStorage.setItem(journalStorageKey, JSON.stringify(journalEntriesRef.current))
      setJournalSaveStatus('Сохранено')
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [chatUser, journalStorageKey])

  useEffect(() => {
    if (!chatUser) return
    const character = selectedActiveCharacter
    const participant: ActiveParticipant = {
      userId: chatUser.id,
      username: chatUser.username,
      characterId: character?.id || null,
      characterName: character?.name || 'без персонажа',
      characterClan: character?.clan || null,
      characterImage: character?.image || '',
      updatedAt: new Date().toISOString(),
    }
    setRoomParticipants(prev => {
      const exists = prev.some(item => item.userId === participant.userId)
      return exists ? prev.map(item => item.userId === participant.userId ? participant : item) : [participant, ...prev]
    })
    broadcast('active-character', { room, participant })
  }, [chatUser, selectedChatCharacterId, chatCharacters, room])

  const activeScene = scenes.find(scene => scene.id === activeSceneId) || null
  const selectedScene = scenes.find(scene => scene.id === getSelectedSceneId()) || activeScene
  const activeSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === activeSceneId)), [sceneMusic, activeSceneId])
  const selectedSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === selectedScene?.id)), [sceneMusic, selectedScene?.id])
  const isMusicPanelVisible = isMaster
    ? leftPanelOpen && leftToolbarTab === 'music'
    : rightPanelOpen && rightRailTab === 'media' && mediaTab === 'music'
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) || null
  const previewLayer = layers.find(layer => layer.id === previewLayerId) || null
  const currentOwnerId = isMaster ? 'master' : chatUser?.id ?? null
  const currentSceneId = activeSceneId || scenes[0]?.id || null
  const canEditLayer = (layer: TableLayer) => {
    if (isMaster) return true
    if (layer.ownerRole === 'master') return false
    if (!layer.ownerId) return true
    return Boolean(chatUser?.id && layer.ownerId === chatUser.id)
  }
  const getDescendantIds = (layerId: string) => {
    const ids = new Set<string>()
    const visit = (parentId: string) => {
      layersRef.current.forEach(layer => {
        if (layer.parentId !== parentId || ids.has(layer.id)) return
        ids.add(layer.id)
        visit(layer.id)
      })
    }
    visit(layerId)
    return ids
  }

  const isLayerEffectivelyVisible = (layer: TableLayer) => {
    if (!layer.onTable) return false
    if (layer.layerType === 'folder') return false
    if (!layer.visible) return false
    let parentId = layer.parentId
    const visited = new Set<string>()
    while (parentId) {
      if (visited.has(parentId)) return true
      visited.add(parentId)
      const parent = layers.find(item => item.id === parentId)
      if (!parent) return true
      if (!parent.visible) return false
      parentId = parent.parentId
    }
    return true
  }

  const visibleLayers = useMemo(() => sortLayers(layers).filter(isLayerEffectivelyVisible), [layers, isMaster, chatUser])
  const managerLayers = useMemo(
    () => (isMaster ? layers : layers.filter(layer => canEditLayer(layer))),
    [isMaster, layers, chatUser]
  )
  const tableManagerLayers = useMemo(() => managerLayers.filter(layer => layer.onTable), [managerLayers])
  const libraryLayers = useMemo(() => {
    const query = mediaSearchDraft.trim().toLowerCase()
    return managerLayers.filter(layer => !layer.onTable && (!query || layer.name.toLowerCase().includes(query) || layer.layerType.includes(query)))
  }, [managerLayers, mediaSearchDraft])
  const selectedManagerLayer = managerLayers.find(layer => layer.id === selectedLayerId) || null
  const buildLayerTree = (sourceLayers: TableLayer[]) => {
    const nodeMap = new Map<string, LayerTreeNode>()
    sortLayers(sourceLayers).forEach(layer => nodeMap.set(layer.id, { ...layer, children: [] }))

    const roots: LayerTreeNode[] = []
    nodeMap.forEach(node => {
      const parent = node.parentId ? nodeMap.get(node.parentId) : null
      if (parent && parent.id !== node.id) parent.children.push(node)
      else roots.push(node)
    })

    const sortNodes = (nodes: LayerTreeNode[]) => {
      nodes.sort((a, b) => b.zIndex - a.zIndex || b.createdAt.localeCompare(a.createdAt))
      nodes.forEach(node => sortNodes(node.children))
      return nodes
    }

    return sortNodes(roots)
  }
  const layerTree = useMemo<LayerTreeNode[]>(() => {
    return buildLayerTree(tableManagerLayers)
  }, [tableManagerLayers])
  const libraryTree = useMemo<LayerTreeNode[]>(() => {
    return buildLayerTree(libraryLayers)
  }, [libraryLayers])
  const broadcast = (event: string, payload: unknown) => {
    broadcastMusicChannel(channelRef.current, event, payload)
  }

  const hashChatPassword = (password: string) => {
    try {
      return window.btoa(password)
    } catch {
      return window.btoa(unescape(encodeURIComponent(password)))
    }
  }

  const rememberChatUser = (user: ChatUser) => {
    window.localStorage.setItem('vtm-chat-user', JSON.stringify(user))
    window.localStorage.setItem('vtm-sheet-user', JSON.stringify(user))
    setChatUser(user)
    setChatUsernameDraft('')
    setChatPasswordDraft('')
  }

  const handleChatAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = chatUsernameDraft.trim()
    const password = chatPasswordDraft.trim()

    if (username.length < 3) {
      window.alert(t('Имя пользователя минимум 3 символа.'))
      return
    }
    if (password.length < 6) {
      window.alert(t('Пароль минимум 6 символов.'))
      return
    }

    setIsChatBusy(true)
    try {
      const supabase = createClient()
      const passwordHash = hashChatPassword(password)

      if (chatAuthMode === 'register') {
        const { data, error } = await supabase
          .from('users')
          .insert({ username, password_hash: passwordHash })
          .select('id, username')
          .single()

        if (error || !data) {
          console.error('Не удалось зарегистрировать пользователя:', error)
          window.alert(error?.code === '23505' ? t('Пользователь с таким именем уже существует.') : t('Не удалось создать аккаунт.'))
          return
        }

        rememberChatUser(data as ChatUser)
        setChatStatus('Вход выполнен')
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .single()

      if (error || !data) {
        console.error('Не удалось войти в чат:', error)
        window.alert(t('Неверный логин или пароль.'))
        return
      }

      rememberChatUser(data as ChatUser)
      setChatStatus('Вход выполнен')
    } finally {
      setIsChatBusy(false)
    }
  }

  const logoutChat = () => {
    stopVoice()
    window.localStorage.removeItem('vtm-chat-user')
    window.localStorage.removeItem('vtm-sheet-user')
    setChatUser(null)
    setChatStatus('Выйди в аккаунт, чтобы писать')
  }

  const sendChatMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = chatDraft.trim()
    const character = chatCharacters.find(item => item.id === selectedChatCharacterId)
    if (!chatUser) {
      window.alert(t('Сначала войди в аккаунт.'))
      return
    }
    if (!character) {
      window.alert(t('Выбери персонажа. Сохранённые персонажи берутся из личного кабинета листа.'))
      return
    }
    if (!text) return

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      userId: chatUser.id,
      username: chatUser.username,
      characterId: character.id,
      characterName: character.name,
      characterImage: character.image,
      message: text,
      createdAt: new Date().toISOString(),
    }

    setChatDraft('')
    setChatMessages(prev => mergeChatMessage(prev, message))
    broadcast('chat-message', message)

    const { error } = await createClient().from(TABLE_CHAT_MESSAGES).insert({
      id: message.id,
      room: message.room,
      user_id: message.userId,
      username: message.username,
      character_id: message.characterId,
      character_name: message.characterName,
      character_image: message.characterImage,
      message: message.message,
      created_at: message.createdAt,
    })

    if (error) {
      console.error('Не удалось сохранить сообщение чата:', error)
      setChatStatus('Сообщение показано онлайн, но не сохранилось')
      window.alert(t('Сообщение отправлено в realtime, но не сохранилось. Нужно применить SQL для table_chat_messages.'))
    } else {
      setChatStatus('Чат онлайн')
    }
  }

  const sendMasterWhisper = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = masterChatDraft.trim()
    if (!chatUser || !text) return
    const targetId = isMaster ? selectedMasterChatUserId : null
    if (isMaster && !targetId) {
      window.alert(t('Выбери игрока для ответа.'))
      return
    }
    const message: MasterWhisper = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      fromUserId: chatUser.id,
      fromUsername: chatUser.username,
      toUserId: targetId,
      message: text,
      fromMaster: isMaster,
      createdAt: new Date().toISOString(),
    }
    setMasterChatDraft('')
    setMasterWhispers(prev => [...prev, message].slice(-160))
    broadcast('master-whisper', message)
  }

  const getVoiceIdentity = () => {
    const user = chatUserRef.current
    const character = chatCharactersRef.current.find(item => item.id === selectedChatCharacterIdRef.current)
    if (!user || !character) return null
    return {
      id: user.id,
      username: user.username,
      characterName: character.name,
      characterImage: character.image,
    }
  }

  const getSavedVoiceVolume = (participantId: string) => {
    const saved = Number(window.localStorage.getItem(`vtm-voice-volume:${participantId}`))
    return Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 1
  }

  const upsertVoiceParticipant = (signal: VoiceSignal, patch: Partial<VoiceParticipant> = {}) => {
    if (!signal.from || signal.from === chatUserRef.current?.id) return
    setVoiceParticipants(prev => {
      const existing = prev.find(item => item.id === signal.from)
      const base: VoiceParticipant = {
        id: signal.from,
        username: signal.username || existing?.username || t('Участник'),
        characterName: signal.characterName || existing?.characterName || t('Безымянный'),
        characterImage: signal.characterImage ?? existing?.characterImage ?? '',
        volume: existing?.volume ?? getSavedVoiceVolume(signal.from),
        muted: signal.muted ?? existing?.muted ?? false,
        connected: existing?.connected ?? false,
      }
      const next = { ...base, ...patch }
      return existing ? prev.map(item => (item.id === signal.from ? next : item)) : [...prev, next]
    })
  }

  const removeVoiceParticipant = (participantId: string) => {
    const connection = peerConnectionsRef.current.get(participantId)
    connection?.close()
    peerConnectionsRef.current.delete(participantId)
    remoteStreamsRef.current.delete(participantId)
    voiceAudioRefs.current.delete(participantId)
    setVoiceParticipants(prev => prev.filter(item => item.id !== participantId))
  }

  const setVoiceParticipantVolume = (participantId: string, volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume))
    window.localStorage.setItem(`vtm-voice-volume:${participantId}`, String(nextVolume))
    setVoiceParticipants(prev => prev.map(item => (item.id === participantId ? { ...item, volume: nextVolume } : item)))
  }

  const broadcastVoiceSignal = (signal: Omit<VoiceSignal, 'room' | 'from'>) => {
    const identity = getVoiceIdentity()
    if (!identity) return
    broadcast('voice-signal', {
      ...signal,
      room: roomRef.current,
      from: identity.id,
      username: identity.username,
      characterName: identity.characterName,
      characterImage: identity.characterImage,
      muted: voiceMutedRef.current,
    })
  }

  const attachRemoteStream = (participantId: string, stream: MediaStream) => {
    remoteStreamsRef.current.set(participantId, stream)
    const audio = voiceAudioRefs.current.get(participantId)
    if (audio) {
      audio.srcObject = stream
      audio.volume = Math.max(0, Math.min(1, (voiceParticipantsRef.current.find(item => item.id === participantId)?.volume ?? 1) * voiceMasterVolume))
      audio.play().catch(() => setVoiceStatus('Нажми на страницу, если браузер заблокировал звук'))
    }
  }

  const getVoiceBitrate = () => (voiceQualityRef.current === 'clear' ? 96000 : 64000)

  const getVoiceAudioConstraints = (): MediaTrackConstraints => {
    const clearMode = voiceQualityRef.current === 'clear'
    return {
      channelCount: 1,
      sampleRate: 48000,
      echoCancellation: true,
      noiseSuppression: !clearMode,
      autoGainControl: !clearMode,
    }
  }

  const enhanceVoiceSdp = (sdp = '') => {
    const opusPayload = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1]
    if (!opusPayload) return sdp

    const bitrate = getVoiceBitrate()
    const opusOptions = `minptime=10;useinbandfec=1;usedtx=0;maxaveragebitrate=${bitrate};stereo=0;sprop-stereo=0;cbr=1`
    const fmtpPattern = new RegExp(`a=fmtp:${opusPayload} .+`, 'i')

    if (fmtpPattern.test(sdp)) {
      return sdp.replace(fmtpPattern, line => {
        const [, options = ''] = line.split(' ')
        const cleaned = options
          .split(';')
          .map(option => option.trim())
          .filter(option => option && !/^(minptime|useinbandfec|usedtx|maxaveragebitrate|stereo|sprop-stereo|cbr)=/i.test(option))
          .join(';')
        return `a=fmtp:${opusPayload} ${cleaned ? `${cleaned};` : ''}${opusOptions}`
      })
    }

    return sdp.replace(new RegExp(`(a=rtpmap:${opusPayload} opus/48000.*\\r?\\n)`, 'i'), `$1a=fmtp:${opusPayload} ${opusOptions}\r\n`)
  }

  const enhanceVoiceDescription = (description: RTCSessionDescriptionInit): RTCSessionDescriptionInit => ({
    type: description.type,
    sdp: enhanceVoiceSdp(description.sdp || ''),
  })

  const tuneVoiceSender = async (sender: RTCRtpSender) => {
    try {
      const parameters = sender.getParameters()
      parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}]
      parameters.encodings = parameters.encodings.map(encoding => ({
        ...encoding,
        maxBitrate: getVoiceBitrate(),
      }))
      await sender.setParameters(parameters)
    } catch (error) {
      console.warn('Не удалось поднять битрейт голосового sender:', error)
    }
  }

  const createVoicePeer = async (participantId: string, offerAfterCreate: boolean) => {
    const existing = peerConnectionsRef.current.get(participantId)
    if (existing && existing.connectionState !== 'closed') return existing

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    peerConnectionsRef.current.set(participantId, connection)
    localVoiceStreamRef.current?.getTracks().forEach(track => {
      const stream = localVoiceStreamRef.current
      if (stream) void tuneVoiceSender(connection.addTrack(track, stream))
    })

    connection.onicecandidate = event => {
      if (!event.candidate) return
      broadcastVoiceSignal({
        type: 'ice',
        to: participantId,
        candidate: event.candidate.toJSON(),
      })
    }

    connection.ontrack = event => {
      const [stream] = event.streams
      if (stream) attachRemoteStream(participantId, stream)
      upsertVoiceParticipant({ type: 'join', room: roomRef.current, from: participantId }, { connected: true })
    }

    connection.onconnectionstatechange = () => {
      const connected = connection.connectionState === 'connected'
      const failed = connection.connectionState === 'failed' || connection.connectionState === 'closed' || connection.connectionState === 'disconnected'
      setVoiceParticipants(prev => prev.map(item => (item.id === participantId ? { ...item, connected: connected || (!failed && item.connected) } : item)))
      if (failed) setVoiceStatus('Кто-то отключился от голоса')
    }

    if (offerAfterCreate) {
      const offer = await connection.createOffer()
      await connection.setLocalDescription(enhanceVoiceDescription(offer))
      broadcastVoiceSignal({
        type: 'offer',
        to: participantId,
        description: connection.localDescription?.toJSON(),
      })
    }

    return connection
  }

  const handleVoiceSignal = async (signal: VoiceSignal) => {
    const currentUser = chatUserRef.current
    if (!signal || signal.room !== roomRef.current || !signal.from || signal.from === currentUser?.id) return

    if (signal.to && signal.to !== currentUser?.id) return

    if (signal.type === 'leave') {
      removeVoiceParticipant(signal.from)
      return
    }

    if (signal.type === 'mute') {
      upsertVoiceParticipant(signal, { muted: Boolean(signal.muted) })
      return
    }

    upsertVoiceParticipant(signal)

    if (!voiceEnabledRef.current || !currentUser) return

    try {
      if (signal.type === 'join') {
        await createVoicePeer(signal.from, true)
        return
      }

      if (signal.type === 'offer' && signal.description) {
        const connection = await createVoicePeer(signal.from, false)
        await connection.setRemoteDescription(signal.description)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(enhanceVoiceDescription(answer))
        broadcastVoiceSignal({
          type: 'answer',
          to: signal.from,
          description: connection.localDescription?.toJSON(),
        })
        return
      }

      if (signal.type === 'answer' && signal.description) {
        const connection = peerConnectionsRef.current.get(signal.from)
        if (connection && connection.signalingState !== 'stable') {
          await connection.setRemoteDescription(signal.description)
        }
        return
      }

      if (signal.type === 'ice' && signal.candidate) {
        const connection = peerConnectionsRef.current.get(signal.from)
        if (connection?.remoteDescription) await connection.addIceCandidate(signal.candidate)
      }
    } catch (error) {
      console.error('Не удалось обработать голосовой сигнал:', error)
      setVoiceStatus('Голос не смог соединиться')
    }
  }

  const stopVoice = () => {
    const wasEnabled = voiceEnabledRef.current
    if (wasEnabled) broadcastVoiceSignal({ type: 'leave' })
    voiceEnabledRef.current = false
    peerConnectionsRef.current.forEach(connection => connection.close())
    peerConnectionsRef.current.clear()
    remoteStreamsRef.current.clear()
    voiceAudioRefs.current.clear()
    localVoiceStreamRef.current?.getTracks().forEach(track => track.stop())
    localVoiceStreamRef.current = null
    setVoiceEnabled(false)
    setVoiceParticipants([])
    setVoiceStatus('Голос выключен')
  }

  const startVoice = async () => {
    const identity = getVoiceIdentity()
    if (!chatUserRef.current) {
      window.alert(t('Сначала войди в аккаунт.'))
      return
    }
    if (!identity) {
      window.alert(t('Выбери персонажа для голоса.'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getVoiceAudioConstraints(),
      })
      stream.getAudioTracks().forEach(track => {
        track.enabled = !voiceMutedRef.current
      })
      localVoiceStreamRef.current = stream
      voiceEnabledRef.current = true
      setVoiceEnabled(true)
      setVoiceStatus('Голос онлайн')
      broadcastVoiceSignal({ type: 'join' })
    } catch (error) {
      console.error('Микрофон недоступен:', error)
      setVoiceStatus('Микрофон недоступен')
      window.alert(t('Не получилось включить микрофон. Проверь разрешение браузера.'))
    }
  }

  const toggleVoiceMuted = () => {
    const nextMuted = !voiceMutedRef.current
    localVoiceStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted
    })
    setVoiceMuted(nextMuted)
    voiceMutedRef.current = nextMuted
    if (voiceEnabledRef.current) broadcastVoiceSignal({ type: 'mute', muted: nextMuted })
  }

  useEffect(() => {
    return () => stopVoice()
  }, [])

  const patchLayer = async (id: string, patch: LayerPatch) => {
    const existingLayer = layersRef.current.find(layer => layer.id === id)
    if (existingLayer && !canEditLayer(existingLayer)) return

    const nextLayers = sortLayers(layersRef.current.map(layer => (layer.id === id ? { ...layer, ...patch } : layer)))
    layersRef.current = nextLayers
    setLayers(nextLayers)
    broadcast('layer-update', { id, room, patch })

    const { error } = await createClient().from(TABLE_IMAGES).update(toDbPatch(patch)).eq('id', id)
    if (error) {
      console.error('Не удалось обновить слой:', error)
      setTableStatus('Слой не сохранился')
    }
  }

  const previewLayerOpacity = (id: string, opacity: number) => {
    const element = Array.from(sceneRef.current?.querySelectorAll<HTMLElement>('.scene-layer[data-layer-id]') || [])
      .find(item => item.dataset.layerId === id)
    if (element) element.style.opacity = String(opacity)
  }

  const commitLayerOpacity = (id: string, input: HTMLInputElement) => {
    const opacity = Number(input.value)
    if (!Number.isFinite(opacity) || input.dataset.committedValue === String(opacity)) return
    input.dataset.committedValue = String(opacity)
    void patchLayer(id, { opacity })
  }

  const addMediaLayer = async (
    imageData: string,
    name: string,
    natural: { width: number; height: number },
    layerType: 'image' | 'video' | 'text' | 'file' = 'image',
    index = 0,
    point?: { x: number; y: number },
    onTable = true,
    overrides: LayerPatch = {}
  ) => {
    if (!isMaster && !chatUser) {
      window.alert(t('Сначала войди в аккаунт игрока в чате, чтобы материалы получили владельца.'))
      setRightRailTab('chat')
      return
    }
    if (!currentSceneId) {
      window.alert(t('Сначала нужна активная сцена.'))
      return
    }
    const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const fitWidth = Math.min(760, Math.max(220, natural.width))
    const fitHeight = Math.max(160, Math.round((fitWidth / Math.max(1, natural.width)) * Math.max(1, natural.height)))
    const ownerRole = tableRole ?? 'player'
    const activeFolder = selectedLayer?.layerType === 'folder' && canEditLayer(selectedLayer) ? selectedLayer : null
    const layer: TableLayer = {
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      room,
      sceneId: currentSceneId,
      layerType,
      ownerRole,
      ownerId: currentOwnerId,
      parentId: activeFolder?.id || null,
      name,
      imageData,
      x: Math.round(point?.x ?? (activeFolder?.x ?? 80) + ((layersRef.current.length + index) % 6) * 28),
      y: Math.round(point?.y ?? (activeFolder?.y ?? 70) + ((layersRef.current.length + index) % 6) * 24),
      width: fitWidth,
      height: fitHeight,
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      rotation: 0,
      flipX: false,
      flipY: false,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      onTable,
      createdAt: new Date().toISOString(),
    }
    Object.assign(layer, overrides)

    const { error } = await createClient().from(TABLE_IMAGES).insert({
      id: layer.id,
      room: layer.room,
      scene_id: layer.sceneId,
      layer_type: layer.layerType,
      owner_role: layer.ownerRole,
      owner_id: layer.ownerId,
      parent_id: layer.parentId,
      name: layer.name,
      image_data: layer.imageData,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      crop_x: layer.cropX,
      crop_y: layer.cropY,
      crop_width: layer.cropWidth,
      crop_height: layer.cropHeight,
      z_index: layer.zIndex,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blend_mode: layer.blendMode,
      rotation: layer.rotation,
      flip_x: layer.flipX,
      flip_y: layer.flipY,
      brightness: layer.brightness,
      contrast: layer.contrast,
      saturation: layer.saturation,
      on_table: layer.onTable,
      created_at: layer.createdAt,
    })

    layersRef.current = upsertLayer(layersRef.current, layer)
    setLayers(layersRef.current)
    setSelectedLayerId(layer.id)
    setSelectedLayerIds(new Set([layer.id]))
    broadcast('layer', layer)

    if (error) {
      console.error('Не удалось сохранить слой стола:', error)
      setTableStatus('Слой показан онлайн, но не сохранён')
      window.alert(t('Слой показан онлайн, но не сохранился. Нужно обновить table_images в Supabase.'))
    }
    return layer.id
  }

  const uploadFiles = async (
    files: FileList | File[],
    onTable = true,
    options: { asBackground?: boolean; point?: { x: number; y: number }; preserveFolders?: boolean } = {}
  ) => {
    const uploadItems = Array.from(files).map(file => ({
      file,
      relativePath: options.preserveFolders ? file.webkitRelativePath || file.name : file.name,
    }))
    if (uploadItems.length === 0) return
    if (!isMaster && !chatUser) {
      window.alert(t('Сначала войди в аккаунт игрока, чтобы добавлять медиа в комнату.'))
      setRightRailTab('chat')
      return
    }

    setIsUploading(true)

    try {
      const supabase = createClient()
      const folderIds = new Map<string, string | null>()

      const ensureFolder = async (folderPath: string, onTableForFolder: boolean) => {
        const parts = folderPath.split('/').map(part => part.trim()).filter(Boolean)
        if (parts.length === 0) return null

        let parentId: string | null = null
        let pathKey = ''

        for (const part of parts) {
          pathKey = pathKey ? `${pathKey}/${part}` : part
          if (folderIds.has(pathKey)) {
            parentId = folderIds.get(pathKey) ?? null
            continue
          }

          const existing = layersRef.current.find(layer =>
            layer.layerType === 'folder' &&
            layer.parentId === parentId &&
            layer.name === part &&
            layer.onTable === onTableForFolder
          )
          const folderId = existing?.id || await createFolder(parentId, part, false, onTableForFolder)
          folderIds.set(pathKey, folderId)
          if (folderId) parentId = folderId
        }

        return parentId
      }

      for (const [index, item] of uploadItems.entries()) {
        const file = item.file
        const relativeParts = item.relativePath.split('/').filter(Boolean)
        const parentFolderPath = relativeParts.length > 1 ? relativeParts.slice(0, -1).join('/') : ''
        const parentId = options.preserveFolders && parentFolderPath
          ? await ensureFolder(parentFolderPath, onTable)
          : undefined
        const layerType: 'image' | 'video' | 'text' | 'file' = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : isReadableTextFile(file)
              ? 'text'
              : 'file'
        const id = `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
        const objectUrl = URL.createObjectURL(file)
        const natural = layerType === 'image' || layerType === 'video'
          ? await getMediaSize(objectUrl, layerType)
          : isWordLikeFile(file)
            ? { width: 460, height: 320 }
            : { width: 440, height: 300 }
        URL.revokeObjectURL(objectUrl)

        const storageFolderPath = options.preserveFolders
          ? relativeParts.slice(0, -1).map(part => safeStorageName(part)).filter(Boolean).join('/')
          : ''
        const storagePath = storageFolderPath
          ? `${room}/${storageFolderPath}/${id}-${safeStorageName(file.name)}`
          : `${room}/${id}-${safeStorageName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from(TABLE_IMAGE_BUCKET)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          })

        if (uploadError) {
          console.error('Не удалось загрузить файл в Storage:', uploadError)
          window.alert(t('Файл не загрузился в Supabase Storage. Примени обновлённый SQL для bucket table-images.'))
          continue
        }

        const { data: publicUrlData } = supabase.storage.from(TABLE_IMAGE_BUCKET).getPublicUrl(storagePath)
        const layerData = layerType === 'text'
          ? getTextLayerData(file, await getFileText(file))
          : layerType === 'file'
            ? JSON.stringify({
              url: publicUrlData.publicUrl,
              type: file.type || 'application/octet-stream',
              wordLike: isWordLikeFile(file),
              pdf: /\.pdf$/i.test(file.name) || /pdf/i.test(file.type),
              name: file.name,
            })
            : publicUrlData.publicUrl
        await addMediaLayer(
          layerData,
          options.asBackground ? `Фон — ${file.name}` : file.name,
          natural,
          layerType,
          index,
          options.asBackground ? { x: 0, y: 0 } : options.point,
          onTable,
          {
            ...(options.asBackground
              ? {
              zIndex: -1000 + index,
              locked: true,
              parentId: null,
              width: Math.max(1600, natural.width),
              height: Math.max(900, Math.round((Math.max(1600, natural.width) / Math.max(1, natural.width)) * Math.max(1, natural.height))),
              }
              : {}),
            ...(parentId !== undefined ? { parentId } : {}),
          }
        )
      }

      setTableStatus('Сцена онлайн')
    } finally {
      setIsUploading(false)
    }
  }

  const addRemoteMediaUrls = async (items: Array<{ url: string; layerType: 'image' | 'video' }>, point?: { x: number; y: number }, onTable = true) => {
    if (items.length === 0) return false
    setIsUploading(true)

    try {
      for (const [index, item] of items.entries()) {
        const natural = await getMediaSize(item.url, item.layerType)
        await addMediaLayer(
          item.url,
          getImageNameFromUrl(item.url),
          natural,
          item.layerType,
          index,
          point ? { x: point.x + index * 28, y: point.y + index * 24 } : undefined,
          onTable
        )
      }
      setTableStatus('Сцена онлайн')
      return true
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadFiles(event.target.files, mediaTab !== 'library')
      event.target.value = ''
    }
  }

  const handleFolderUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadFiles(event.target.files, mediaTab !== 'library', { preserveFolders: true })
      event.target.value = ''
    }
  }

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const imageFiles = Array.from(event.target.files).filter(file => file.type.startsWith('image/'))
      if (imageFiles.length === 0) window.alert(t('Для фона выбери картинку.'))
      else await uploadFiles(imageFiles, true, { asBackground: true })
      event.target.value = ''
    }
  }

  const handleMediaUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const items = getMediaUrlsFromText(mediaUrlDraft)
    if (items.length === 0) {
      window.alert(t('Вставь ссылку на YouTube или прямую ссылку на файл: jpg, png, webp, gif, svg, mp4, webm, mov, m4v, ogg.'))
      return
    }

    const added = await addRemoteMediaUrls(items)
    if (added) setMediaUrlDraft('')
  }

  const createTextMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = textMaterialDraft.trim()
    if (!text) return
    await addMediaLayer(
      text,
      textMaterialNameDraft.trim() || t('Текст мастера'),
      { width: 420, height: 260 },
      'text',
      0,
      undefined,
      false
    )
    setTextMaterialDraft('')
    setTextMaterialNameDraft('')
  }

  const placeLayerOnTable = async (layerId: string, point?: { x: number; y: number }) => {
    const layer = layersRef.current.find(item => item.id === layerId)
    if (!layer || !canEditLayer(layer)) return
    if (!layer.onTable) {
      if (layer.layerType === 'folder') {
        const ids = [layer.id, ...getDescendantIds(layer.id)]
        await patchSelectedLayers(ids, () => ({ onTable: true, visible: true }))
        setLayerSelection(ids, layer.id)
        return
      }
      await addMediaLayer(
        layer.imageData,
        layer.name,
        { width: layer.width, height: layer.height },
        layer.layerType,
        0,
        point,
        true
      )
      return
    }
    const maxZ = layersRef.current.reduce((max, item) => Math.max(max, item.zIndex), 0)
    await patchLayer(layer.id, {
      onTable: true,
      visible: true,
      parentId: null,
      x: Math.round(point?.x ?? 120),
      y: Math.round(point?.y ?? 120),
      zIndex: maxZ + 1,
    })
    setLayerSelection([layer.id], layer.id)
  }

  const moveLayersToFolder = async (ids: string[], folderId: string | null) => {
    const folder = folderId ? layersRef.current.find(layer => layer.id === folderId) : null
    const patches = ids
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => canEditLayer(layer) && layer.layerType !== 'folder' && layer.id !== folderId)
      .filter(layer => !folder || !getDescendantIds(layer.id).has(folder.id))
      .map(layer => ({ id: layer.id, patch: { parentId: folderId } }))
    if (folderId) setExpandedFolders(prev => new Set(prev).add(folderId))
    await patchLayers(patches)
  }

  const createFolderForSelection = async (ids: string[]) => {
    const folderName = window.prompt(t('Название новой папки'), t('Новая папка'))?.trim()
    if (!folderName) return
    const folderId = await createFolder(null, folderName, false, true)
    if (!folderId) return
    await moveLayersToFolder(ids, folderId)
  }

  const deleteLayer = async (layerId: string) => {
    const layer = layersRef.current.find(item => item.id === layerId) || layers.find(item => item.id === layerId)
    if (layer && !window.confirm(tf('Удалить "{name}"?', { name: layer.name }))) return
    const childIds = getDescendantIds(layerId)
    const requestedDeleteIds = new Set([layerId, ...childIds])
    const deleteIds = isMaster
      ? requestedDeleteIds
      : new Set([...requestedDeleteIds].filter(id => {
        const item = layersRef.current.find(layer => layer.id === id)
        return item ? canEditLayer(item) : false
      }))
    if (deleteIds.size === 0) return

    const deletedLayers = layersRef.current.filter(item => deleteIds.has(item.id))
    const nextLayers = layersRef.current.filter(item => !deleteIds.has(item.id))
    layersRef.current = nextLayers
    setLayers(nextLayers)
    setSelectedLayerId(prev => (prev && deleteIds.has(prev) ? null : prev))
    setSelectedLayerIds(prev => new Set([...prev].filter(id => !deleteIds.has(id))))
    deleteIds.forEach(id => broadcast('layer-delete', { id, room }))
    const supabase = createClient()
    await supabase.from(TABLE_IMAGES).delete().in('id', [...deleteIds])

    const journalUrls = getJournalReferencedMediaUrls(journalEntriesRef.current)
    await Promise.all(deletedLayers.map(async deletedLayer => {
      const fileUrl = deletedLayer.layerType === 'file' ? getFileLayerMeta(deletedLayer.imageData, deletedLayer.name).url : deletedLayer.imageData
      const stillUsed = nextLayers.some(item => {
        const itemUrl = item.layerType === 'file' ? getFileLayerMeta(item.imageData, item.name).url : item.imageData
        return itemUrl && itemUrl === fileUrl
      })
      if (stillUsed) return
      if (isMediaUrlReferencedInJournal(fileUrl, journalUrls)) return
      const storagePath = getStoragePathFromPublicUrl(fileUrl)
      if (storagePath) {
        const { error } = await supabase.storage.from(TABLE_IMAGE_BUCKET).remove([storagePath])
        if (error) console.error('Не удалось удалить файл слоя из Storage:', error)
      }
    }))
  }

  const createFolder = async (parentId: string | null = null, name?: string, selectAfterCreate = true, onTable = true) => {
    if (!isMaster && !chatUser) {
      window.alert(t('Сначала войди в аккаунт игрока в чате, чтобы папка получила владельца.'))
      setRightRailTab('chat')
      return null
    }
    if (!currentSceneId) {
      window.alert(t('Сначала нужна активная сцена.'))
      return null
    }
    const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const siblingCount = layersRef.current.filter(layer => layer.layerType === 'folder' && layer.parentId === parentId).length
    const parentFolder = parentId ? layersRef.current.find(layer => layer.id === parentId) : null
    const folder: TableLayer = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      sceneId: currentSceneId,
      layerType: 'folder',
      ownerRole: tableRole ?? 'player',
      ownerId: currentOwnerId,
      parentId,
      name: name?.trim() || tf('Папка {n}', { n: siblingCount + 1 }),
      imageData: '',
      x: (parentFolder?.x ?? 120) + (siblingCount % 5) * 36,
      y: (parentFolder?.y ?? 120) + (siblingCount % 5) * 28,
      width: 520,
      height: 320,
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      rotation: 0,
      flipX: false,
      flipY: false,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      onTable,
      createdAt: new Date().toISOString(),
    }

    const { error } = await createClient().from(TABLE_IMAGES).insert({
      id: folder.id,
      room: folder.room,
      scene_id: folder.sceneId,
      layer_type: folder.layerType,
      owner_role: folder.ownerRole,
      owner_id: folder.ownerId,
      parent_id: folder.parentId,
      name: folder.name,
      image_data: folder.imageData,
      x: folder.x,
      y: folder.y,
      width: folder.width,
      height: folder.height,
      crop_x: folder.cropX,
      crop_y: folder.cropY,
      crop_width: folder.cropWidth,
      crop_height: folder.cropHeight,
      z_index: folder.zIndex,
      visible: folder.visible,
      locked: folder.locked,
      opacity: folder.opacity,
      blend_mode: folder.blendMode,
      rotation: folder.rotation,
      flip_x: folder.flipX,
      flip_y: folder.flipY,
      brightness: folder.brightness,
      contrast: folder.contrast,
      saturation: folder.saturation,
      on_table: folder.onTable,
      created_at: folder.createdAt,
    })

    layersRef.current = upsertLayer(layersRef.current, folder)
    setLayers(layersRef.current)
    if (selectAfterCreate) {
      setSelectedLayerId(folder.id)
      setSelectedLayerIds(new Set([folder.id]))
    }
    if (parentId) setExpandedFolders(prev => new Set(prev).add(parentId))
    broadcast('layer', folder)

    if (error) {
      console.error('Не удалось сохранить папку:', error)
      setTableStatus('Папка показана онлайн, но не сохранена')
    }
    return folder.id
  }

  const patchLayers = async (patches: Array<{ id: string; patch: LayerPatch }>) => {
    if (patches.length === 0) return

    const patchMap = new Map(patches.map(item => [item.id, item.patch]))
    const nextLayers = sortLayers(layersRef.current.map(layer => ({ ...layer, ...(patchMap.get(layer.id) || {}) })))
    layersRef.current = nextLayers
    setLayers(nextLayers)
    patches.forEach(item => broadcast('layer-update', { id: item.id, room, patch: item.patch }))

    const supabase = createClient()
    const results = await Promise.all(
      patches.map(item => supabase.from(TABLE_IMAGES).update(toDbPatch(item.patch)).eq('id', item.id))
    )
    if (results.some(result => result.error)) {
      console.error('Не удалось обновить порядок слоёв:', results.find(result => result.error)?.error)
      setTableStatus('Порядок слоёв не сохранился')
    }
  }

  const renameLayer = async (layer: TableLayer) => {
    const nextName = window.prompt(t('Новое имя слоя'), layer.name)?.trim()
    if (!nextName || nextName === layer.name) return
    await patchLayer(layer.id, { name: nextName })
    setLayerContextMenu(null)
  }

  const openImageEditor = (layer: TableLayer) => {
    if (!canEditLayer(layer) || !['image', 'video'].includes(layer.layerType)) return
    setImageEditor({
      layerId: layer.id,
      state: createEditorState(layer),
      history: [],
      future: [],
      aspectLocked: false,
      drag: null,
    })
    setLayerContextMenu(null)
  }

  const updateImageEditor = (updater: (state: ImageEditorState) => ImageEditorState, commit = true) => {
    setImageEditor(editor => {
      if (!editor) return editor
      const nextState = updater(editor.state)
      return {
        ...editor,
        state: nextState,
        history: commit ? [...editor.history, editor.state].slice(-40) : editor.history,
        future: commit ? [] : editor.future,
      }
    })
  }

  const undoImageEditor = () => {
    setImageEditor(editor => {
      if (!editor || editor.history.length === 0) return editor
      const previous = editor.history[editor.history.length - 1]
      return {
        ...editor,
        state: previous,
        history: editor.history.slice(0, -1),
        future: [editor.state, ...editor.future].slice(0, 40),
      }
    })
  }

  const redoImageEditor = () => {
    setImageEditor(editor => {
      if (!editor || editor.future.length === 0) return editor
      const next = editor.future[0]
      return {
        ...editor,
        state: next,
        history: [...editor.history, editor.state].slice(-40),
        future: editor.future.slice(1),
      }
    })
  }

  const applyImageEditor = async (saveAsNew = false) => {
    if (!imageEditor) return
    const layer = layersRef.current.find(item => item.id === imageEditor.layerId)
    if (!layer) return
    const patch: LayerPatch = {
      cropX: imageEditor.state.cropX,
      cropY: imageEditor.state.cropY,
      cropWidth: imageEditor.state.cropWidth,
      cropHeight: imageEditor.state.cropHeight,
      rotation: imageEditor.state.rotation,
      flipX: imageEditor.state.flipX,
      flipY: imageEditor.state.flipY,
      brightness: imageEditor.state.brightness,
      contrast: imageEditor.state.contrast,
      saturation: imageEditor.state.saturation,
    }
    if (saveAsNew) {
      await addMediaLayer(layer.imageData, `${layer.name} copy`, { width: layer.width, height: layer.height }, layer.layerType === 'video' ? 'video' : 'image', 0, { x: layer.x + 32, y: layer.y + 32 }, layer.onTable, patch)
    } else {
      await patchLayer(layer.id, patch)
    }
    setImageEditor(null)
  }

  const resetLayerCrop = async (layer: TableLayer) => {
    await patchLayer(layer.id, { cropX: null, cropY: null, cropWidth: null, cropHeight: null })
    setLayerContextMenu(null)
  }

  const createNamedFolder = async (parentId: string | null = null, onTable = true) => {
    const nextName = window.prompt(t('Название папки'), t('Новая папка'))?.trim()
    if (!nextName) return null
    return createFolder(parentId, nextName, true, onTable)
  }

  const getContextLayerIds = (layerId: string | null) => {
    if (layerId && selectedLayerIds.has(layerId) && selectedLayerIds.size > 1) return [...selectedLayerIds]
    if (layerId) return [layerId]
    return [...selectedLayerIds]
  }

  const setLayerSelection = (ids: string[], primaryId = ids[0] || null) => {
    setSelectedLayerIds(new Set(ids))
    setSelectedLayerId(primaryId)
  }

  const patchSelectedLayers = async (ids: string[], patchFor: (layer: TableLayer) => LayerPatch) => {
    const patches = ids
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => canEditLayer(layer))
      .map(layer => ({ id: layer.id, patch: patchFor(layer) }))
    await patchLayers(patches)
  }

  const reorderLayers = async (ids: string[], direction: 'top' | 'up' | 'down' | 'bottom') => {
    const selected = ids
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => canEditLayer(layer))
    if (selected.length === 0) return

    const patches: Array<{ id: string; patch: LayerPatch }> = []
    const groups = new Map<string, TableLayer[]>()
    selected.forEach(layer => {
      const key = layer.parentId || ROOT_LAYER_DROP_ID
      groups.set(key, [...(groups.get(key) || []), layer])
    })

    groups.forEach(groupSelected => {
      const selectedIds = new Set(groupSelected.map(layer => layer.id))
      const parentId = groupSelected[0]?.parentId ?? null
      const siblings = sortLayers(layersRef.current.filter(layer => layer.parentId === parentId))
      const ordered = siblings.filter(layer => !selectedIds.has(layer.id))
      const picked = siblings.filter(layer => selectedIds.has(layer.id))
      const firstIndex = Math.min(...picked.map(layer => siblings.findIndex(item => item.id === layer.id)))
      const insertIndex =
        direction === 'top'
          ? ordered.length
          : direction === 'bottom'
            ? 0
            : direction === 'up'
              ? Math.min(ordered.length, firstIndex + 1)
              : Math.max(0, firstIndex - 1)
      ordered.splice(insertIndex, 0, ...picked)
      ordered.forEach((layer, index) => {
        const nextZ = index + 1
        if (layer.zIndex !== nextZ) patches.push({ id: layer.id, patch: { zIndex: nextZ } })
      })
    })

    await patchLayers(patches)
  }

  const deleteSelectedLayers = async (ids: string[]) => {
    for (const id of ids) await deleteLayer(id)
  }

  const duplicateLayer = async (layer: TableLayer) => {
    if (!canEditLayer(layer) || layer.layerType === 'folder') return
    await addMediaLayer(
      layer.imageData,
      `${layer.name} copy`,
      { width: layer.width, height: layer.height },
      layer.layerType === 'video' ? 'video' : layer.layerType === 'text' ? 'text' : layer.layerType === 'file' ? 'file' : 'image',
      0,
      { x: layer.x + 28, y: layer.y + 28 },
      layer.onTable,
      {
        parentId: layer.parentId,
        cropX: layer.cropX,
        cropY: layer.cropY,
        cropWidth: layer.cropWidth,
        cropHeight: layer.cropHeight,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        rotation: layer.rotation,
        flipX: layer.flipX,
        flipY: layer.flipY,
        brightness: layer.brightness,
        contrast: layer.contrast,
        saturation: layer.saturation,
      }
    )
  }

  const getLayerShareUrl = (layer: TableLayer) => {
    if (layer.layerType === 'file') return getFileLayerMeta(layer.imageData, layer.name).url
    if (layer.layerType === 'image' || layer.layerType === 'video') return layer.imageData
    return ''
  }

  const getLayerClipboardText = (layer: TableLayer) => {
    const url = getLayerShareUrl(layer)
    if (layer.layerType === 'image' && url) return `![${layer.name}](${url})`
    if (url) return `[${layer.name}](${url})`
    if (layer.layerType === 'text') return `${layer.name}\n\n${layer.imageData}`
    return layer.name
  }

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setTableStatus('Скопировано')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setTableStatus('Скопировано')
    }
  }

  const copyLayerForDiary = async (layer: TableLayer) => {
    await copyTextToClipboard(getLayerClipboardText(layer))
    setLayerContextMenu(null)
  }

  const addLayerToJournal = (imageUrl: string, name: string) => {
    if (!chatUser) return
    const imgHtml = `<p><img src="${imageUrl}" alt="${name}"></p>`
    if (selectedJournalEntry) {
      const newText = (selectedJournalEntry.text || '') + imgHtml
      const now = new Date().toISOString()
      const next = journalEntries.map(entry =>
        entry.id === selectedJournalEntry.id ? { ...entry, text: newText, updatedAt: now } : entry
      )
      saveJournalEntries(next, 'Есть несохранённые изменения')
    } else {
      const now = new Date().toISOString()
      const entry: JournalEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: name || t('Изображение со стола'),
        text: imgHtml,
        createdAt: now,
        updatedAt: now,
      }
      saveJournalEntries([entry, ...journalEntries], 'Сохранено')
      setSelectedJournalEntryId(entry.id)
    }
    setRightRailTab('diary')
    setLayerContextMenu(null)
    setTableStatus('Добавлено в дневник')
  }

  const copyLayerUrl = async (layer: TableLayer) => {
    const url = getLayerShareUrl(layer)
    await copyTextToClipboard(url || getLayerClipboardText(layer))
    setLayerContextMenu(null)
  }

  const copyLayerToPersonalMedia = async (layer: TableLayer) => {
    if (layer.layerType === 'folder') return
    await addMediaLayer(
      layer.imageData,
      `${layer.name} copy`,
      { width: layer.width, height: layer.height },
      layer.layerType === 'video' ? 'video' : layer.layerType === 'text' ? 'text' : layer.layerType === 'file' ? 'file' : 'image',
      0,
      undefined,
      false,
      {
        parentId: null,
        visible: true,
        locked: false,
        cropX: layer.cropX,
        cropY: layer.cropY,
        cropWidth: layer.cropWidth,
        cropHeight: layer.cropHeight,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        rotation: layer.rotation,
        flipX: layer.flipX,
        flipY: layer.flipY,
        brightness: layer.brightness,
        contrast: layer.contrast,
        saturation: layer.saturation,
      }
    )
    setRightRailTab('media')
    setMediaTab('library')
    setLayerContextMenu(null)
    setTableStatus('Скопировано в мои медиа')
  }

  const focusLayersForEveryone = (ids: string[]) => {
    const targets = ids
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
    if (targets.length === 0 || !sceneRef.current) return

    const minX = Math.min(...targets.map(layer => layer.x))
    const minY = Math.min(...targets.map(layer => layer.y))
    const maxX = Math.max(...targets.map(layer => layer.x + layer.width))
    const maxY = Math.max(...targets.map(layer => layer.y + layer.height))
    const rect = sceneRef.current.getBoundingClientRect()
    const contentWidth = Math.max(1, maxX - minX)
    const contentHeight = Math.max(1, maxY - minY)
    const nextZoom = Math.min(5, Math.max(0.2, Math.min((rect.width - 80) / contentWidth, (rect.height - 80) / contentHeight)))
    const nextPan = {
      x: Math.round(rect.width / 2 - (minX + contentWidth / 2) * nextZoom),
      y: Math.round(rect.height / 2 - (minY + contentHeight / 2) * nextZoom),
    }

    setZoom(nextZoom)
    setPan(nextPan)
    broadcast('viewport-focus', { room, pan: nextPan, zoom: nextZoom })
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const getAncestorIds = (layerId: string) => {
    const ids: string[] = []
    const visited = new Set<string>()
    let parentId = layersRef.current.find(layer => layer.id === layerId)?.parentId || null
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      ids.push(parentId)
      parentId = layersRef.current.find(layer => layer.id === parentId)?.parentId || null
    }
    return ids
  }

  const revealLayerInTableManager = (layer: TableLayer) => {
    if (!layer.onTable || !canEditLayer(layer)) return
    setRightRailTab('media')
    setMediaTab('layers')
    setExpandedFolders(prev => {
      const next = new Set(prev)
      getAncestorIds(layer.id).forEach(id => next.add(id))
      return next
    })
    setLayerSelection([layer.id], layer.id)
  }

  const handleManagerDoubleClick = (layer: TableLayer) => {
    if (!layer.onTable && layer.layerType !== 'folder') {
      setPreviewLayerId(layer.id)
      return
    }
    if (layer.layerType === 'folder') {
      toggleFolder(layer.id)
      return
    }
    renameLayer(layer)
  }

  const canMoveLayer = (layer: TableLayer) => {
    if (layer.locked) return false
    return canEditLayer(layer)
  }

  const canDropLayerOn = (dragged: TableLayer, target: TableLayer, placement: LayerDropPlacement) => {
    if (!canMoveLayer(dragged)) return false
    if (dragged.id === target.id) return false
    if (placement === 'inside' && target.layerType !== 'folder') return false
    if (dragged.layerType === 'folder' && getDescendantIds(dragged.id).has(target.id)) return false
    return true
  }

  const handleLayerDragStart = (event: React.DragEvent<HTMLElement>, layerId: string) => {
    const layer = layersRef.current.find(item => item.id === layerId)
    if (!layer || !canMoveLayer(layer)) {
      event.preventDefault()
      return
    }

    const shareUrl = getLayerShareUrl(layer)
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData('text/plain', layerId)
    if (shareUrl) {
      event.dataTransfer.setData('text/uri-list', shareUrl)
      event.dataTransfer.setData('application/x-vtm-layer', JSON.stringify({
        id: layer.id,
        title: layer.name,
        url: shareUrl,
        layerType: layer.layerType,
      }))
    }
    setDraggingLayerId(layerId)
    setLayerContextMenu(null)
  }

  const handleLayerDragOver = (event: React.DragEvent<HTMLElement>, target: TableLayer) => {
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === target.id) return
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged) return

    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const ratio = y / Math.max(1, rect.height)
    const placement: LayerDropPlacement =
      target.layerType === 'folder' && ratio > 0.28 && ratio < 0.72 ? 'inside' : ratio < 0.5 ? 'before' : 'after'
    if (!canDropLayerOn(dragged, target, placement)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setLayerDropTarget({ layerId: target.id, placement })
  }

  const handleLayerDrop = async (event: React.DragEvent<HTMLElement>, target: TableLayer) => {
    event.preventDefault()
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || dragged.id === target.id) return

    const placement = layerDropTarget?.layerId === target.id ? layerDropTarget.placement : 'after'
    if (!canDropLayerOn(dragged, target, placement)) return
    const nextParentId = placement === 'inside' ? target.id : target.parentId
    const draggableLayers = layersRef.current.filter(layer => isMaster || canEditLayer(layer))
    const siblings = sortLayers(draggableLayers.filter(layer => layer.parentId === nextParentId && layer.id !== dragged.id)).reverse()
    const targetIndex = siblings.findIndex(layer => layer.id === target.id)
    const insertIndex = placement === 'inside' ? 0 : placement === 'before' ? Math.max(0, targetIndex) : Math.max(0, targetIndex + 1)
    siblings.splice(insertIndex, 0, { ...dragged, parentId: nextParentId })

    const highestZ = Math.max(1, ...layersRef.current.map(layer => layer.zIndex)) + siblings.length
    const patches = siblings.map((layer, index) => ({
      id: layer.id,
      patch: {
        parentId: layer.id === dragged.id ? nextParentId : layer.parentId,
        zIndex: highestZ - index,
      },
    }))

    if (nextParentId) setExpandedFolders(prev => new Set(prev).add(nextParentId))
    setDraggingLayerId(null)
    setLayerDropTarget(null)
    await patchLayers(patches)
  }

  const handleLayerRootDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || !canMoveLayer(dragged)) return

    if (event.currentTarget !== event.target) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setLayerDropTarget({ layerId: ROOT_LAYER_DROP_ID, placement: 'inside' })
  }

  const handleLayerRootDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target && layerDropTarget?.layerId !== ROOT_LAYER_DROP_ID) return
    event.preventDefault()
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || !canMoveLayer(dragged)) return

    const draggableLayers = layersRef.current.filter(layer => isMaster || canEditLayer(layer))
    const siblings = sortLayers(draggableLayers.filter(layer => layer.parentId === null && layer.id !== dragged.id)).reverse()
    siblings.push({ ...dragged, parentId: null })

    const highestZ = Math.max(1, ...layersRef.current.map(layer => layer.zIndex)) + siblings.length
    const patches = siblings.map((layer, index) => ({
      id: layer.id,
      patch: {
        parentId: layer.id === dragged.id ? null : layer.parentId,
        zIndex: highestZ - index,
      },
    }))

    setDraggingLayerId(null)
    setLayerDropTarget(null)
    await patchLayers(patches)
  }

  const handleLayerDragEnd = () => {
    setDraggingLayerId(null)
    setLayerDropTarget(null)
  }

  const getScenePointFromClient = (clientX: number, clientY: number) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoom,
      y: (clientY - rect.top - panRef.current.y) / zoom,
    }
  }

  const getScenePoint = (event: React.PointerEvent<HTMLElement>) => getScenePointFromClient(event.clientX, event.clientY)

  const prepareLayerDragPreview = (ids: Set<string>, mode: 'move' | 'resize') => {
    const elements = new Map<string, HTMLElement>()
    sceneRef.current?.querySelectorAll<HTMLElement>('.scene-layer[data-layer-id]').forEach(element => {
      const id = element.dataset.layerId
      if (!id || !ids.has(id)) return
      element.style.willChange = mode === 'move' ? 'transform' : 'left, top, width, height'
      elements.set(id, element)
    })
    dragLayerElementsRef.current = elements
    dragPreviewPositionsRef.current = new Map()
    dragPreviewBoundsRef.current = null
    pendingDragPointerRef.current = null
  }

  const applyLayerMovePreview = (drag: DragState, clientX: number, clientY: number) => {
    const sceneDx = (clientX - drag.startClientX) / zoom
    const sceneDy = (clientY - drag.startClientY) / zoom
    const positions = new Map<string, { x: number; y: number }>()
    positions.set(drag.id, {
      x: Math.round(drag.startX + sceneDx),
      y: Math.round(drag.startY + sceneDy),
    })
    drag.childStartPositions.forEach(child => {
      positions.set(child.id, {
        x: Math.round(child.x + sceneDx),
        y: Math.round(child.y + sceneDy),
      })
    })
    dragPreviewPositionsRef.current = positions

    dragLayerElementsRef.current.forEach(element => {
      element.style.transform = `translate3d(${sceneDx}px, ${sceneDy}px, 0)`
    })
  }

  const applyLayerResizePreview = (drag: DragState, clientX: number, clientY: number) => {
    const sceneDx = (clientX - drag.startClientX) / zoom
    const sceneDy = (clientY - drag.startClientY) / zoom
    const horizontal = drag.corner?.includes('w') ? -sceneDx : sceneDx
    const vertical = drag.corner?.includes('n') ? -sceneDy : sceneDy
    const widthFromX = drag.startWidth + horizontal
    const widthFromY = (drag.startHeight + vertical) * drag.aspectRatio
    const width = Math.max(60, Math.round(Math.abs(horizontal) > Math.abs(vertical) ? widthFromX : widthFromY))
    const height = Math.max(60, Math.round(width / drag.aspectRatio))
    const x = drag.corner?.includes('w') ? Math.round(drag.startX + drag.startWidth - width) : drag.startX
    const y = drag.corner?.includes('n') ? Math.round(drag.startY + drag.startHeight - height) : drag.startY
    dragPreviewBoundsRef.current = { x, y, width, height }

    const element = dragLayerElementsRef.current.get(drag.id)
    if (!element) return
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  const startLayerDrag = (event: React.PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize', corner: DragState['corner'] = 'se') => {
    if (event.button !== 0) return
    if (!canEditLayer(layer)) return
    if (layer.locked) return
    const target = event.target as HTMLElement
    if (layer.layerType === 'text' && target.closest('.scene-text-material')) {
      setLayerSelection([layer.id], layer.id)
      return
    }
    if (mode === 'move' && layer.layerType === 'video' && target instanceof HTMLVideoElement) {
      const rect = target.getBoundingClientRect()
      const controlHeight = Math.min(56, Math.max(36, rect.height * 0.3))
      if (event.clientY >= rect.bottom - controlHeight) {
        setLayerSelection([layer.id], layer.id)
        return
      }
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextSelection = selectedLayerIds.has(layer.id) ? selectedLayerIds : new Set([layer.id])
    setSelectedLayerIds(nextSelection)
    setSelectedLayerId(layer.id)
    const moveIds = new Set<string>()
    if (mode === 'move') {
      nextSelection.forEach(id => {
        moveIds.add(id)
        getDescendantIds(id).forEach(childId => moveIds.add(childId))
      })
      moveIds.delete(layer.id)
    }
    dragRef.current = {
      id: layer.id,
      mode,
      corner,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startWidth: layer.width,
      startHeight: layer.height,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      aspectRatio: Math.max(0.01, layer.width / layer.height),
      childStartPositions: layersRef.current
        .filter(item => moveIds.has(item.id))
        .map(item => ({ id: item.id, x: item.x, y: item.y })),
    }
    prepareLayerDragPreview(new Set([layer.id, ...moveIds]), mode)
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 2 && event.button !== 0) return
    const target = event.target as HTMLElement
    const emptySceneTarget = target.classList.contains('scene') || target.classList.contains('scene-world')
    if (event.button === 0 && !emptySceneTarget) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    suppressNextContextMenuRef.current = false
    if (event.button === 0) {
      const point = getScenePoint(event)
      setLayerSelection([])
      setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
      dragRef.current = {
        id: '',
        mode: 'select',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: point.x,
        startY: point.y,
        startWidth: 0,
        startHeight: 0,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        aspectRatio: 1,
        childStartPositions: [],
      }
      return
    }
    dragRef.current = {
      id: '',
      mode: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      aspectRatio: 1,
      childStartPositions: [],
    }
  }

  const updateLayerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return

    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY

    if (drag.mode === 'pan') {
      if (Math.abs(dx) + Math.abs(dy) > 6) suppressNextContextMenuRef.current = true
      setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy })
      return
    }

    if (drag.mode === 'select') {
      const point = getScenePoint(event)
      const x = Math.min(drag.startX, point.x)
      const y = Math.min(drag.startY, point.y)
      const width = Math.abs(point.x - drag.startX)
      const height = Math.abs(point.y - drag.startY)
      const rect = { x, y, width, height }
      setSelectionRect(rect)
      const selected = visibleLayers
        .filter(layer => (
          layer.x < x + width &&
          layer.x + layer.width > x &&
          layer.y < y + height &&
          layer.y + layer.height > y
        ))
        .map(layer => layer.id)
      setLayerSelection(selected)
      return
    }

    if (drag.mode === 'move' || drag.mode === 'resize') {
      pendingDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY }
      if (dragAnimationFrameRef.current === null) {
        dragAnimationFrameRef.current = requestAnimationFrame(() => {
          dragAnimationFrameRef.current = null
          const pending = pendingDragPointerRef.current
          const activeDrag = dragRef.current
          if (!pending || !activeDrag) return
          if (activeDrag.mode === 'move') applyLayerMovePreview(activeDrag, pending.clientX, pending.clientY)
          if (activeDrag.mode === 'resize') applyLayerResizePreview(activeDrag, pending.clientX, pending.clientY)
        })
      }
      return
    }
  }

  const finishLayerDrag = async () => {
    const drag = dragRef.current
    if (!drag) return

    if ((drag.mode === 'move' || drag.mode === 'resize') && pendingDragPointerRef.current) {
      if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current)
      dragAnimationFrameRef.current = null
      if (drag.mode === 'move') applyLayerMovePreview(drag, pendingDragPointerRef.current.clientX, pendingDragPointerRef.current.clientY)
      if (drag.mode === 'resize') applyLayerResizePreview(drag, pendingDragPointerRef.current.clientX, pendingDragPointerRef.current.clientY)
    }
    dragRef.current = null
    pendingDragPointerRef.current = null
    if (drag.mode === 'select') {
      setSelectionRect(null)
      return
    }
    if (drag.mode === 'pan') return
    if (drag.mode === 'move') {
      const positions = dragPreviewPositionsRef.current
      dragPreviewPositionsRef.current = new Map()
      if (positions.size === 0) {
        dragLayerElementsRef.current.forEach(element => {
          element.style.transform = ''
          element.style.willChange = ''
        })
        dragLayerElementsRef.current = new Map()
        return
      }

      const nextLayers = layersRef.current.map(layer => {
        const position = positions.get(layer.id)
        return position ? { ...layer, ...position } : layer
      })
      layersRef.current = nextLayers
      dragLayerElementsRef.current.forEach((element, id) => {
        const position = positions.get(id)
        if (position) {
          element.style.left = `${position.x}px`
          element.style.top = `${position.y}px`
        }
        element.style.transform = ''
        element.style.willChange = ''
      })
      dragLayerElementsRef.current = new Map()
      setLayers(nextLayers)

      const updates = Array.from(positions, ([id, position]) => ({ id, ...position }))
      broadcast('layer-move', { room, updates })
      const supabase = createClient()
      const results = await Promise.all(updates.map(update => (
        supabase.from(TABLE_IMAGES).update(toDbPatch({ x: update.x, y: update.y })).eq('id', update.id)
      )))
      if (results.some(result => result.error)) {
        console.error('Не удалось сохранить перемещение слоёв:', results.filter(result => result.error).map(result => result.error))
        setTableStatus('Позиция слоя не сохранилась')
      }
      return
    }
    const bounds = dragPreviewBoundsRef.current
    dragPreviewBoundsRef.current = null
    dragLayerElementsRef.current.forEach(element => {
      element.style.willChange = ''
    })
    dragLayerElementsRef.current = new Map()
    if (bounds) await patchLayer(drag.id, bounds)
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const nextZoom = Math.min(5, Math.max(0.2, zoom * (event.deltaY > 0 ? 0.9 : 1.1)))
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const worldX = (cursorX - pan.x) / zoom
    const worldY = (cursorY - pan.y) / zoom
    setPan({
      x: Math.round(cursorX - worldX * nextZoom),
      y: Math.round(cursorY - worldY * nextZoom),
    })
    setZoom(nextZoom)
  }

  const getTouchCenter = (touches: React.TouchList | TouchList) => {
    const first = touches[0]
    const second = touches[1] || touches[0]
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    }
  }

  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return 1
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.max(1, Math.hypot(dx, dy))
  }

  const startSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return

    if (event.touches.length >= 2) {
      event.preventDefault()
      dragRef.current = null
      setSelectionRect(null)
      const center = getTouchCenter(event.touches)
      touchGestureRef.current = {
        mode: 'pinch',
        startClientX: center.x,
        startClientY: center.y,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        startDistance: getTouchDistance(event.touches),
        startZoom: zoom,
        worldCenterX: (center.x - rect.left - panRef.current.x) / zoom,
        worldCenterY: (center.y - rect.top - panRef.current.y) / zoom,
      }
      return
    }

    const target = event.target as HTMLElement
    const emptySceneTarget = target.classList.contains('scene') || target.classList.contains('scene-world')
    if (!emptySceneTarget) return

    event.preventDefault()
    const touch = event.touches[0]
    touchGestureRef.current = {
      mode: 'pan',
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      startDistance: 1,
      startZoom: zoom,
      worldCenterX: 0,
      worldCenterY: 0,
    }
  }

  const updateSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!gesture || !rect) return

    event.preventDefault()
    if (gesture.mode === 'pinch' && event.touches.length >= 2) {
      const center = getTouchCenter(event.touches)
      const nextZoom = Math.min(5, Math.max(0.2, gesture.startZoom * (getTouchDistance(event.touches) / gesture.startDistance)))
      setZoom(nextZoom)
      setPan({
        x: Math.round(center.x - rect.left - gesture.worldCenterX * nextZoom),
        y: Math.round(center.y - rect.top - gesture.worldCenterY * nextZoom),
      })
      return
    }

    if (gesture.mode === 'pan' && event.touches.length === 1) {
      const touch = event.touches[0]
      setPan({
        x: Math.round(gesture.startPanX + touch.clientX - gesture.startClientX),
        y: Math.round(gesture.startPanY + touch.clientY - gesture.startClientY),
      })
    }
  }

  const finishSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) touchGestureRef.current = null
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const libraryLayerId = event.dataTransfer.getData('application/x-vtm-library-layer')
    if (libraryLayerId) {
      await placeLayerOnTable(libraryLayerId, getScenePointFromClient(event.clientX, event.clientY))
      return
    }
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.some(file => file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      await uploadFiles(droppedFiles, true, { point: getScenePointFromClient(event.clientX, event.clientY), preserveFolders: true })
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) {
      await addRemoteMediaUrls(mediaUrls, getScenePointFromClient(event.clientX, event.clientY))
      return
    }

    if (droppedFiles.length > 0) await uploadFiles(droppedFiles, true, { point: getScenePointFromClient(event.clientX, event.clientY), preserveFolders: true })
  }

  const handleSceneMediaDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, false, { preserveFolders: true })
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) await addRemoteMediaUrls(mediaUrls, undefined, false)
  }

  const handleSceneMusicDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) await uploadSceneMusicFiles(droppedFiles)
  }

  const handleTableLayerPanelDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, true, { preserveFolders: true })
      return
    }
    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) await addRemoteMediaUrls(mediaUrls, undefined, true)
  }

  const startEditorCropDrag = (event: React.PointerEvent<HTMLElement>, handle: NonNullable<ImageEditorDraft['drag']>['handle']) => {
    if (!imageEditor) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setImageEditor({
      ...imageEditor,
      history: [...imageEditor.history, imageEditor.state].slice(-40),
      future: [],
      drag: {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        initial: imageEditor.state,
      },
    })
  }

  const updateEditorCropDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!imageEditor?.drag) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = ((event.clientX - imageEditor.drag.startX) / Math.max(1, rect.width)) * 100
    const dy = ((event.clientY - imageEditor.drag.startY) / Math.max(1, rect.height)) * 100
    const initial = imageEditor.drag.initial
    let cropX = initial.cropX
    let cropY = initial.cropY
    let cropWidth = initial.cropWidth
    let cropHeight = initial.cropHeight

    if (imageEditor.drag.handle === 'move') {
      cropX = initial.cropX + dx
      cropY = initial.cropY + dy
    } else {
      if (imageEditor.drag.handle.includes('w')) {
        cropX = initial.cropX + dx
        cropWidth = initial.cropWidth - dx
      }
      if (imageEditor.drag.handle.includes('e')) cropWidth = initial.cropWidth + dx
      if (imageEditor.drag.handle.includes('n')) {
        cropY = initial.cropY + dy
        cropHeight = initial.cropHeight - dy
      }
      if (imageEditor.drag.handle.includes('s')) cropHeight = initial.cropHeight + dy
    }

    cropWidth = Math.max(8, Math.min(100, cropWidth))
    cropHeight = Math.max(8, Math.min(100, cropHeight))
    cropX = Math.max(0, Math.min(100 - cropWidth, cropX))
    cropY = Math.max(0, Math.min(100 - cropHeight, cropY))
    setImageEditor({ ...imageEditor, state: { ...imageEditor.state, cropX, cropY, cropWidth, cropHeight } })
  }

  const finishEditorCropDrag = () => {
    setImageEditor(editor => (editor ? { ...editor, drag: null } : editor))
  }

  const getCharacterSheetHref = (characterId?: string | null) => {
    const params = new URLSearchParams({ room })
    if (tableRole) params.set('role', tableRole)
    if (characterId) params.set('characterId', characterId)
    return `/character-sheet?${params.toString()}`
  }

  const getRollModifierSummary = (modifier: AppliedDisciplineRollModifier) => {
    if (modifier.operation === 'ignore_penalty') {
      return tf('игнорирует штраф · от {source}', { source: modifier.sourceLabel })
    }
    if (modifier.operation === 'auto_success') {
      return tf('бросок не нужен · от {source}', { source: modifier.sourceLabel })
    }
    if (modifier.difficultyDelta) {
      return tf('Сложность {delta} · от {source}', {
        delta: `${modifier.difficultyDelta > 0 ? '+' : ''}${modifier.difficultyDelta}`,
        source: modifier.sourceLabel,
      })
    }
    if (modifier.diceDelta) {
      return tf('{delta} от {source}', {
        delta: `${modifier.diceDelta > 0 ? '+' : ''}${d10(Math.abs(modifier.diceDelta))}`,
        source: modifier.sourceLabel,
      })
    }
    return modifier.sourceLabel
  }

  const toggleDisabledRollModifier = (
    modifierId: string,
    setDisabledIds: Dispatch<SetStateAction<string[]>>,
  ) => {
    setDisabledIds(current => current.includes(modifierId)
      ? current.filter(id => id !== modifierId)
      : [...current, modifierId])
  }

  const renderRollModifierControls = (
    result: DisciplineRollEffectResult | null | undefined,
    setDisabledIds?: Dispatch<SetStateAction<string[]>>,
  ) => {
    const visibleModifiers = (result?.modifiers || []).filter(modifier => (
      (modifier.sourceKind !== 'penalty' || modifier.active)
      && (
        modifier.diceDelta !== 0
        || modifier.difficultyDelta !== 0
        || modifier.operation === 'ignore_penalty'
        || modifier.operation === 'auto_success'
      )
    ))
    if (!visibleModifiers.length) return null

    return (
      <div className="preview-roll-modifier-list">
        <strong>{t('Модификаторы')}:</strong>
        {visibleModifiers.map(modifier => {
          const summary = getRollModifierSummary(modifier)
          const canToggle = isMaster && modifier.canDisable && setDisabledIds
          return canToggle ? (
            <label key={modifier.id} className="preview-blood-surge-toggle">
              <span>{modifier.active ? summary : `${t('отключено')}: ${summary}`}</span>
              <input
                type="checkbox"
                checked={modifier.active}
                onChange={() => toggleDisabledRollModifier(modifier.id, setDisabledIds)}
              />
            </label>
          ) : (
            <span className="preview-roll-notice" key={modifier.id}>
              {modifier.active ? summary : `${t('отключено')}: ${summary}`}
            </span>
          )
        })}
      </div>
    )
  }

  const renderRollMeta = (roll: RollMessage) => {
    const meta = roll.meta
    if (!meta) return null
    const rouseChecks = meta.rouseChecks || []
    const warnings = meta.warnings || []
    const rollModifiers = meta.rollModifiers || []
    const hungerChange = typeof meta.hungerBefore === 'number'
      && typeof meta.hungerAfter === 'number'
      && meta.hungerBefore !== meta.hungerAfter
      ? { before: meta.hungerBefore, after: meta.hungerAfter }
      : null
    const hasHungerChange = hungerChange !== null
    const hasWillpowerChange = Boolean(meta.willpowerBefore && meta.willpowerAfter && meta.willpowerBefore.current !== meta.willpowerAfter.current)
    const hasWillpowerMeta = hasWillpowerChange
      || Boolean(meta.spentWillpower)
      || Boolean(meta.recoveredWillpower)
      || Boolean(meta.willpowerReroll?.used)
      || Boolean(meta.impairmentPenaltyApplied)
    const hasHealthChange = Boolean(meta.healthBefore && meta.healthAfter)
    const hasHealthMeta = hasHealthChange
      || Boolean(meta.damage)
      || Boolean(meta.healing)
      || Boolean(meta.healthImpairmentPenaltyApplied)
    const hasHumanityMeta = meta.rollKind === 'humanity_check'
      || meta.rollKind === 'remorse_check'
      || typeof meta.humanityBefore === 'number'
      || typeof meta.stainsBefore === 'number'

    if (!rouseChecks.length && !meta.bloodSurge?.enabled && !hasHungerChange && !hasWillpowerMeta && !hasHealthMeta && !hasHumanityMeta && !meta.messyCritical && !meta.bestialFailure && !warnings.length && !meta.discipline && !rollModifiers.length && !meta.rollDifficultyModifier) {
      return null
    }

    return (
      <div className="roll-v5-meta">
        {meta.discipline ? (
          <span className="roll-note">{tf('Дисциплина: {name} · {power}', { name: meta.discipline.name, power: meta.discipline.power })}{meta.discipline.cost && meta.discipline.cost !== '—' ? ` · ${t(meta.discipline.cost)}` : ''}</span>
        ) : null}
        {meta.bloodSurge?.enabled ? (
          <span className="roll-note">{tf('Прилив Крови: +{bonus}к10', { bonus: meta.bloodSurge.bonusDice })}</span>
        ) : null}
        {rouseChecks.map(result => (
          <span className="roll-note" key={result.id}>
            {tf('{reason}: {value} · {outcome}', { reason: t(result.reason), value: result.value, outcome: result.success ? t('успех') : t('провал') })}
          </span>
        ))}
        {hungerChange ? <span className="roll-note">{tf('Голод: {before} → {after}', hungerChange)}</span> : null}
        {meta.spentWillpower ? <span className="roll-note">{tf('Воля потрачена: {n}', { n: meta.spentWillpower })}</span> : null}
        {meta.recoveredWillpower ? <span className="roll-note">{tf('Воля восстановлена: {n}', { n: meta.recoveredWillpower })}</span> : null}
        {hasWillpowerChange && meta.willpowerBefore && meta.willpowerAfter ? (
          <span className="roll-note">{tf('Воля: {before} → {after} / {max}', { before: meta.willpowerBefore.current, after: meta.willpowerAfter.current, max: meta.willpowerAfter.max })}</span>
        ) : null}
        {meta.willpowerReroll?.used ? (
          <span className="roll-note">{tf('Переброс Воли: {before} → {after}', { before: meta.willpowerReroll.oldDice.map(die => die.value).join(', '), after: meta.willpowerReroll.newDice.map(die => die.value).join(', ') })}</span>
        ) : null}
        {meta.impairmentPenaltyApplied ? <span className="roll-note">{tf('Истощение Воли: {n}к10', { n: meta.impairmentPenaltyApplied })}</span> : null}
        {meta.healthImpairmentPenaltyApplied ? <span className="roll-note">{tf('Изнурение по здоровью: {n}к10', { n: meta.healthImpairmentPenaltyApplied })}</span> : null}
        {rollModifiers.length ? (
          <span className="roll-note">
            {t('Модификаторы')}: {rollModifiers.map(getRollModifierSummary).join(' · ')}
          </span>
        ) : null}
        {meta.damage ? (
          <span className="roll-note">
            {tf('Урон: {amount} {severity}', { amount: meta.damage.originalAmount, severity: meta.damage.severity === 'aggravated' ? t('тяжёлых') : t('лёгких') })}
            {meta.damage.halved ? tf(' → после деления {final}', { final: meta.damage.finalAmount }) : ''}
            {meta.damage.targetCharacterName ? tf(' · цель: {name}', { name: meta.damage.targetCharacterName }) : ''}
          </span>
        ) : null}
        {meta.damage?.chain?.map((line, index) => (
          <span className="roll-note" key={`${roll.id}-damage-chain-${index}`}>
            {line}
          </span>
        ))}
        {meta.healthBefore && meta.healthAfter ? (
          <span className="roll-note">
            {tf('Здоровье: {before} → {after} / {max} · / {superficial} · X {aggravated}', {
              before: meta.healthBefore.current, after: meta.healthAfter.current, max: meta.healthAfter.max,
              superficial: meta.healthAfter.superficial, aggravated: meta.healthAfter.aggravated
            })}
          </span>
        ) : null}
        {meta.healing ? (
          <span className="roll-note">
            {tf('Лечение: / {superficial} · X {aggravated}', { superficial: meta.healing.amountSuperficial || 0, aggravated: meta.healing.amountAggravated || 0 })}
          </span>
        ) : null}
        {meta.rollKind === 'remorse_check' ? (
          <span className="roll-note">
            {tf('Проверка мук совести: {result}', { result: meta.automaticFailure ? t('автоматический провал') : tf('{dice}к10 без кубиков Голода', { dice: meta.remorseDice || 0 }) })}
          </span>
        ) : null}
        {typeof meta.humanityBefore === 'number' && typeof meta.humanityAfter === 'number' ? (
          <span className="roll-note">{tf('Человечность: {before} → {after}', { before: meta.humanityBefore, after: meta.humanityAfter })}</span>
        ) : null}
        {typeof meta.stainsBefore === 'number' && typeof meta.stainsAfter === 'number' ? (
          <span className="roll-note">{tf('Сомнения: {before} → {after}', { before: meta.stainsBefore, after: meta.stainsAfter })}</span>
        ) : null}
        {meta.messyCritical ? <strong className="roll-alert">{t('Кровавый триумф')}</strong> : null}
        {meta.bestialFailure ? <strong className="roll-alert">{t('Кровавый провал')}</strong> : null}
        {warnings.map((warning, index) => <span className="roll-warning" key={`${roll.id}-warning-${index}`}>{t(warning)}</span>)}
      </div>
    )
  }

  const renderOpposedResponseControls = () => {
    const character = selectedActiveCharacter
    const pool = getOpposedCharacterPool(character, opposedResponseSide)

    return (
      <section className="opposed-side-builder opposed-response-builder">
        <div className="opposed-side-heading">
          <span>{t('Твой ответ')}</span>
          <strong>{d10(pool.diceCount || 0)}</strong>
        </div>

        {!character ? (
          <p className="opposed-side-status">{t('Выбери активного персонажа.')}</p>
        ) : (
          <div className="opposed-trait-controls">
            <label>
              <span>{t('Характеристика 1')}</span>
              <select
                value={opposedResponseSide.attribute}
                onChange={event => updateOpposedResponseSide({ attribute: event.target.value })}
              >
                <option value="">{t('Без характеристики')}</option>
                {ATTRIBUTE_GROUPS.map(group => (
                  <optgroup key={group.name} label={t(group.name)}>
                    {group.traits.map(name => <option key={name} value={name} disabled={opposedResponseSide.attributeTwo === name}>{t(name)} · {getAttributeDots(character.attributes, name)}</option>)}
                  </optgroup>
                ))}
                {pool.extraAttributes.length ? (
                  <optgroup label={t('Другие')}>
                    {pool.extraAttributes.map(name => <option key={name} value={name} disabled={opposedResponseSide.attributeTwo === name}>{name} · {getAttributeDots(character.attributes, name)}</option>)}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label>
              <span>{t('Характеристика 2')}</span>
              <select
                value={opposedResponseSide.attributeTwo}
                onChange={event => updateOpposedResponseSide({ attributeTwo: event.target.value })}
              >
                <option value="">{t('Без второй характеристики')}</option>
                {ATTRIBUTE_GROUPS.map(group => (
                  <optgroup key={group.name} label={t(group.name)}>
                    {group.traits.map(name => <option key={name} value={name} disabled={opposedResponseSide.attribute === name}>{t(name)} · {getAttributeDots(character.attributes, name)}</option>)}
                  </optgroup>
                ))}
                {pool.extraAttributes.length ? (
                  <optgroup label={t('Другие')}>
                    {pool.extraAttributes.map(name => <option key={name} value={name} disabled={opposedResponseSide.attribute === name}>{name} · {getAttributeDots(character.attributes, name)}</option>)}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label>
              <span>{t('Навык')}</span>
              <select
                value={opposedResponseSide.skill}
                onChange={event => updateOpposedResponseSide({ skill: event.target.value })}
              >
                <option value="">{t('Без навыка')}</option>
                {SKILL_GROUPS.map(group => (
                  <optgroup key={group.name} label={t(group.name)}>
                    {group.traits.map(name => <option key={name} value={name}>{t(name)} · {getSkillDots(resolveSkillValue(character.skills, name))}</option>)}
                  </optgroup>
                ))}
                {pool.extraSkills.length ? (
                  <optgroup label={t('Другие')}>
                    {pool.extraSkills.map(name => <option key={name} value={name}>{name} · {getSkillDots(resolveSkillValue(character.skills, name))}</option>)}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label>
              <span>{t('Дисциплина')}</span>
              <select
                value={opposedResponseSide.discipline}
                onChange={event => updateOpposedResponseSide({ discipline: event.target.value })}
              >
                <option value="">{t('Без дисциплины')}</option>
                {pool.disciplineNames.map(name => (
                  <option key={name} value={name}>{name} · {getDisciplineDots(character.disciplines[name] || {})}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('Модификатор')}</span>
              <input
                type="number"
                min="-20"
                max="20"
                value={opposedResponseSide.modifier}
                onChange={event => updateOpposedResponseSide({ modifier: Math.max(-20, Math.min(20, Number(event.target.value) || 0)) })}
              />
            </label>
          </div>
        )}
      </section>
    )
  }

  const opposedResponsePool = getOpposedCharacterPool(selectedActiveCharacter, opposedResponseSide)
  const canAnswerOpposedProposal = Boolean(incomingOpposedProposal && selectedActiveCharacter && opposedResponsePool.diceCount > 0)

  return (
    <main className="table-page-shell">
      <section className="table-topbar">
        <div>
          <p className="table-kicker">{t('Игровой стол')}</p>
          <h1>{room}</h1>
        </div>
        <div className="table-actions">
          <a href="/" title={t('Вернуться на главную страницу')}>{t('Главная')}</a>
          <button type="button" className="role-pill" onClick={resetTableRole}>
            {isMaster ? t('Мастер') : tableRole === 'player' ? t('Игрок') : t('Выбрать роль')}
          </button>
          {isMaster ? (
            <label className="master-password-control">
              <span>{t('Пароль мастера')}</span>
              <input
                value={masterPasswordEdit}
                onChange={event => setMasterPasswordEdit(event.target.value)}
                aria-label={t('Пароль мастера')}
              />
              <button type="button" onClick={saveMasterPassword}>{t('Сменить')}</button>
            </label>
          ) : null}
          <a href={getCharacterSheetHref(selectedActiveCharacter?.id)} title={t('Открыть лист персонажа')}>{t('Лист')}</a>
          <input ref={fileInputRef} type="file" multiple onChange={handleImageUpload} />
          <input ref={folderInputRef} type="file" multiple onChange={handleFolderUpload} />
          <input ref={backgroundFileInputRef} type="file" accept="image/*" multiple onChange={handleBackgroundUpload} />
          <input ref={sceneMusicFileInputRef} type="file" accept="audio/*" multiple onChange={handleSceneMusicUpload} />
        </div>
      </section>

      {!isMaster ? <section className="active-character-strip" aria-label={t('Активный персонаж')}>
        <div className="active-character-card">
          <div className="chat-avatar large" aria-hidden="true">
            {selectedActiveCharacter?.image ? (
              <img src={selectedActiveCharacter.image} alt="" />
            ) : (
              <span>{(selectedActiveCharacter?.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <span>{t('Активный персонаж')}</span>
            <strong>{selectedActiveCharacter?.name || t('Персонаж не выбран')}</strong>
            <small>{selectedActiveCharacter?.clan || (chatUser ? t('без клана') : t('войдите в аккаунт'))}</small>
          </div>
          <button type="button" onClick={() => selectedActiveCharacter ? void openCharacterPreview(selectedActiveCharacter) : setRightRailTab('chat')} disabled={!selectedActiveCharacter}>
            {t('Быстрый просмотр')}
          </button>
          <a href={getCharacterSheetHref(selectedActiveCharacter?.id)}>{t('Открыть полный лист')}</a>
        </div>
        <div className="active-character-picker">
          <label>
            <span>{t('Смена персонажа')}</span>
            <select
              value={selectedChatCharacterId}
              onChange={event => chooseActiveCharacter(event.target.value)}
              disabled={!chatUser || chatCharacters.length === 0}
            >
              {chatCharacters.length === 0 ? <option value="">{t('Нет сохранённых персонажей')}</option> : null}
              {chatCharacters.map(character => (
                <option value={character.id} key={character.id}>
                  {character.name}{character.clan ? `, ${character.clan}` : ''}
                </option>
              ))}
            </select>
          </label>
          {!selectedActiveCharacter ? <button type="button" onClick={() => setRightRailTab('chat')}>{t('Выбрать персонажа')}</button> : null}
        </div>
      </section> : null}

      <MusicPanel
        room={room}
        tableRole={tableRole}
        channelRef={channelRef}
        hidden
        playbackEnabled
      />

      <section className={`table-layout ${isMaster && leftPanelOpen ? 'with-left-toolbar' : ''} ${isMaster && !leftPanelOpen ? 'left-collapsed' : ''} ${!rightPanelOpen ? 'right-collapsed' : ''}`}>
        <TableLeftPanel
          isMaster={isMaster}
          leftPanelOpen={leftPanelOpen}
          setLeftPanelOpen={setLeftPanelOpen}
        >
        {isMaster && leftPanelOpen ? (
          <aside className="left-toolbar" aria-label={t('Мастерская панель сцен')}>
            <nav className="left-tabs" aria-label={t('Разделы сцен')}>
              <button type="button" className={leftToolbarTab === 'scenes' ? 'active' : ''} onClick={() => setLeftToolbarTab('scenes')}>{t('Сцены')}</button>
              <button type="button" className={leftToolbarTab === 'layers' ? 'active' : ''} onClick={() => setLeftToolbarTab('layers')}>{t('Слои')}</button>
              <button type="button" className={leftToolbarTab === 'media' ? 'active' : ''} onClick={() => setLeftToolbarTab('media')}>{t('Медиа')}</button>
              <button type="button" className={leftToolbarTab === 'music' ? 'active' : ''} onClick={() => setLeftToolbarTab('music')}>{t('Музыка')}</button>
            </nav>

            <SceneManager
              leftToolbarTab={leftToolbarTab}
              activeScene={activeScene}
              selectedScene={selectedScene}
              sceneStatus={sceneStatus}
              scenes={scenes}
              selectedSceneMusic={selectedSceneMusic}
              room={room}
              sceneMusicDraft={sceneMusicDraft}
              isUploading={isUploading}
              sceneMusicFileInputRef={sceneMusicFileInputRef}
              createScene={createScene}
              renameScene={renameScene}
              deleteScene={deleteScene}
              activateScene={activateScene}
              loadSceneMusic={loadSceneMusic}
              setSelectedSceneId={setSelectedSceneId}
              handleSceneMusicDrop={handleSceneMusicDrop}
              addSceneMusic={addSceneMusic}
              setSceneMusicDraft={setSceneMusicDraft}
              reorderSceneMusic={reorderSceneMusic}
              publishSceneTrack={publishSceneTrack}
              patchSceneMusic={patchSceneMusic}
              renameSceneMusic={renameSceneMusic}
              deleteSceneMusic={deleteSceneMusic}
            />

            <section className={`scene-layer-panel ${leftToolbarTab === 'layers' ? '' : 'table-right-panel-hidden'}`}>
              <header>
                <strong>{t('Слои сцены')}</strong>
                <span>{activeScene?.name || t('активная сцена')}</span>
              </header>
              <div className="scene-layer-groups">
                {/* 'фон'/'токен' below match layer.name, a Storyteller-assigned scene-layer
                    label (data, not UI copy) — not part of the RU/EN site translation. */}
                {[
                  ['Фон', tableManagerLayers.filter(layer => layer.onTable && (layer.zIndex < 0 || layer.name.toLowerCase().includes('фон')))],
                  ['Картинки / декорации', tableManagerLayers.filter(layer => layer.onTable && ['image', 'video'].includes(layer.layerType) && layer.zIndex >= 0 && !layer.name.toLowerCase().includes('фон'))],
                  ['Токены', tableManagerLayers.filter(layer => layer.onTable && layer.name.toLowerCase().includes('токен'))],
                  ['Группы / папки', tableManagerLayers.filter(layer => layer.onTable && layer.layerType === 'folder')],
                  ['Текст / документы', tableManagerLayers.filter(layer => layer.onTable && ['text', 'file'].includes(layer.layerType))],
                ].map(([title, items]) => (
                  <details open key={title as string}>
                    <summary>{t(title as string)}<span>{(items as TableLayer[]).length}</span></summary>
                    <div
                      className={`layer-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                      onDragOver={handleLayerRootDragOver}
                      onDrop={handleLayerRootDrop}
                    >
                      {(items as TableLayer[]).length === 0 ? <p className="panel-empty">{t('Пусто')}</p> : <LayerManager layers={buildLayerTree(items as TableLayer[])}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={isLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section
              className={`scene-media-panel ${leftToolbarTab === 'media' ? '' : 'table-right-panel-hidden'}`}
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleSceneMediaDrop}
            >
              <header>
                <strong>{t('Медиа сцены')}</strong>
                <span>{selectedScene?.name || activeScene?.name || t('сцена')}</span>
              </header>
              <div className="media-manager-toolbar">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? t('Загрузка...') : t('Загрузить')}
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
                  {t('Папка файлов')}
                </button>
                <button type="button" onClick={() => backgroundFileInputRef.current?.click()} disabled={isUploading}>
                  {t('Фон')}
                </button>
                <button type="button" onClick={() => createNamedFolder(null, false)}>{t('Папка')}</button>
                <button type="button" onClick={saveSelectionAsGroup} disabled={selectedLayerIds.size === 0}>{t('Группа')}</button>
                <button type="button" onClick={setSceneThumbnailFromSelection} disabled={selectedLayerIds.size === 0}>Preview</button>
              </div>
              <form className="media-url-form" onSubmit={event => {
                event.preventDefault()
                const items = getMediaUrlsFromText(mediaUrlDraft)
                void addRemoteMediaUrls(items, undefined, false).then(added => {
                  if (added) setMediaUrlDraft('')
                })
              }}>
                <input
                  value={mediaUrlDraft}
                  onChange={event => setMediaUrlDraft(event.target.value)}
                  placeholder={t('Ссылка на картинку, видео или YouTube')}
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>{t('В папку')}</button>
              </form>
              <input
                className="media-search-input"
                data-media-search
                value={mediaSearchDraft}
                onChange={event => setMediaSearchDraft(event.target.value)}
                placeholder={t('Поиск медиа')}
              />
              <div
                className="layer-list library-list scene-media-drop-zone"
                onDragOver={event => {
                  event.preventDefault()
                  if (!event.dataTransfer.types.includes('Files')) handleLayerRootDragOver(event as React.DragEvent<HTMLDivElement>)
                }}
                onDrop={async event => {
                  if (event.dataTransfer.files.length > 0 || getDroppedMediaUrls(event.dataTransfer).length > 0) {
                    await handleSceneMediaDrop(event)
                    return
                  }
                  await handleLayerRootDrop(event as React.DragEvent<HTMLDivElement>)
                }}
              >
                {libraryTree.length === 0 ? <p className="panel-empty">{t('Подготовленные медиа этой сцены появятся здесь.')}</p> : <LayerManager layers={libraryTree}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={isLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />}
              </div>
            </section>

            {leftToolbarTab === 'music' ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <MusicPanel room={room} tableRole={tableRole} channelRef={channelRef} playbackEnabled={false} />
              </div>
            ) : null}
          </aside>
        ) : null}
        </TableLeftPanel>

        <TableCanvas
          tableStatus={tableStatus}
          activeScene={activeScene}
          layersLength={layers.length}
          zoom={zoom}
          pan={pan}
          handNotice={handNotice}
          isDraggingOver={isDraggingOver}
          visibleLayers={visibleLayers}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          imageEditor={imageEditor}
          selectionRect={selectionRect}
          sceneRef={sceneRef}
          suppressNextContextMenuRef={suppressNextContextMenuRef}
          canEditLayer={canEditLayer}
          raiseHand={raiseHand}
          setZoom={setZoom}
          setIsDraggingOver={setIsDraggingOver}
          setLayerContextMenu={setLayerContextMenu}
          setLayerSelection={setLayerSelection}
          setSelectedLayerId={setSelectedLayerId}
          setImageEditor={setImageEditor}
          startPan={startPan}
          updateLayerDrag={updateLayerDrag}
          finishLayerDrag={finishLayerDrag}
          startSceneTouch={startSceneTouch}
          updateSceneTouch={updateSceneTouch}
          finishSceneTouch={finishSceneTouch}
          handleWheel={handleWheel}
          handleDrop={handleDrop}
          startLayerDrag={startLayerDrag}
          openImageEditor={openImageEditor}
          revealLayerInTableManager={revealLayerInTableManager}
          updateEditorCropDrag={updateEditorCropDrag}
          finishEditorCropDrag={finishEditorCropDrag}
          startEditorCropDrag={startEditorCropDrag}
          applyImageEditor={applyImageEditor}
          updateImageEditor={updateImageEditor}
          undoImageEditor={undoImageEditor}
          redoImageEditor={redoImageEditor}
          previewLayerOpacity={previewLayerOpacity}
          commitLayerOpacity={commitLayerOpacity}
        />

        <TableRightPanel
          isMaster={isMaster}
          rightPanelOpen={rightPanelOpen}
          rightRailTab={rightRailTab}
          setRightPanelOpen={setRightPanelOpen}
          setRightRailTab={setRightRailTab}
        >
          <section className={`media-sidebar table-right-panel ${rightRailTab === 'media' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Медиа стола')}>
            {!isMaster ? (
              <nav className="sub-tabs" aria-label={t('Медиа панели')}>
                <button type="button" className={mediaTab === 'layers' ? 'active' : ''} onClick={() => setMediaTab('layers')}>
                  {t('Стол')}
                </button>
                <button type="button" className={mediaTab === 'library' ? 'active' : ''} onClick={() => setMediaTab('library')}>
                  {t('Мои медиа')}
                </button>
                <button type="button" className={mediaTab === 'music' ? 'active' : ''} onClick={() => setMediaTab('music')}>
                  {t('Музыка')}
                </button>
              </nav>
            ) : null}

            {!isMaster ? (
            <section
              className={`layer-panel table-right-panel ${mediaTab === 'layers' ? '' : 'table-right-panel-hidden'}`}
              aria-label={t('Слои стола')}
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleTableLayerPanelDrop}
            >
              <header>
                <strong>{t('Изображения и видео')}</strong>
                <span>{selectedManagerLayer?.name || t('папки выше перекрывают ниже')}</span>
              </header>

              <div className="media-manager-toolbar">
                <button type="button" onClick={() => createNamedFolder()}>{t('Папка')}</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? t('Загрузка...') : t('Новый слой')}
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
                  {t('Папка файлов')}
                </button>
              </div>

              <form className="media-url-form" onSubmit={handleMediaUrlSubmit}>
                <input
                  value={mediaUrlDraft}
                  onChange={event => setMediaUrlDraft(event.target.value)}
                  placeholder={t('Ссылка на картинку, видео или YouTube')}
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>
                  {t('Вставить')}
                </button>
              </form>

              <div
                className={`layer-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                onDragOver={handleLayerRootDragOver}
                onDrop={handleLayerRootDrop}
                onDragLeave={event => {
                  if (event.currentTarget === event.target) setLayerDropTarget(null)
                }}
              >
                {layerTree.length === 0 ? (
                  <p className="panel-empty">{t('Слоёв пока нет.')}</p>
                ) : (
                  <LayerManager layers={layerTree}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={isLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />
                )}
                <div
                  className="layer-root-drop-zone"
                  onDragOver={handleLayerRootDragOver}
                  onDrop={handleLayerRootDrop}
                >
                  {t('Перетащи сюда, чтобы вынести в корень')}
                </div>
              </div>
            </section>
            ) : null}

            {!isMaster ? (
            <MediaLibrary
              mediaTab={mediaTab}
              isMaster={isMaster}
              isUploading={isUploading}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              mediaSearchDraft={mediaSearchDraft}
              textMaterialNameDraft={textMaterialNameDraft}
              textMaterialDraft={textMaterialDraft}
              libraryTree={libraryTree}
              layerDropTarget={layerDropTarget}
              expandedFolders={expandedFolders}
              selectedLayerIds={selectedLayerIds}
              draggingLayerId={draggingLayerId}
              createNamedFolder={createNamedFolder}
              setMediaSearchDraft={setMediaSearchDraft}
              setTextMaterialNameDraft={setTextMaterialNameDraft}
              setTextMaterialDraft={setTextMaterialDraft}
              createTextMaterial={createTextMaterial}
              handleLayerRootDragOver={handleLayerRootDragOver}
              handleLayerRootDrop={handleLayerRootDrop}
              uploadFiles={uploadFiles}
              setLayerDropTarget={setLayerDropTarget}
              canMoveLayer={canMoveLayer}
              isLayerEffectivelyVisible={isLayerEffectivelyVisible}
              handleLayerDragStart={handleLayerDragStart}
              handleLayerDragOver={handleLayerDragOver}
              handleLayerDrop={handleLayerDrop}
              handleLayerDragEnd={handleLayerDragEnd}
              handleManagerDoubleClick={handleManagerDoubleClick}
              patchLayer={patchLayer}
              placeLayerOnTable={placeLayerOnTable}
              deleteLayer={deleteLayer}
              setLayerSelection={setLayerSelection}
              setLayerContextMenu={setLayerContextMenu}
              toggleFolder={toggleFolder}
            />
            ) : null}

            {!isMaster && mediaTab === 'music' ? (
              <div className="table-right-panel" style={{ overflow: 'auto' }}>
                <MusicPanel room={room} tableRole={tableRole} channelRef={channelRef} playbackEnabled={false} />
              </div>
            ) : null}
          </section>

          <section className={`roll-sidebar table-right-panel ${rightRailTab === 'rolls' ? '' : 'table-right-panel-hidden'}`} aria-label={t('История бросков')}>
            <section className="roll-list">
              {rolls.length === 0 ? (
                <p className="panel-empty">{t('Бросков пока нет.')}</p>
              ) : (
                rolls.map(roll => {
                  const rerollDraftForRoll = willpowerRerollDraft?.rollId === roll.id ? willpowerRerollDraft : null
                  const canRerollWithWillpower = canUseWillpowerReroll(roll)
                  const contestedRequest = roll.meta?.rollMode === 'contested' && roll.meta.contested?.status === 'requested'
                  return (
                  <article className={`roll-card ${roll.hidden ? 'hidden-roll' : ''}`} key={roll.id}>
                    <div className="roll-meta">
                      <strong>{roll.characterName}</strong>
                      {roll.hidden ? <span className="roll-hidden-badge">{t('скрытый')}</span> : null}
                      <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
                    </div>
                    <span className="roll-pool">{t(roll.poolName)}</span>

                    {contestedRequest ? (
                      <div className="contested-request-result">
                        <strong>{t('Запрошен встречный бросок')}</strong>
                        <span>{tf('Пул инициатора: {pool}, {count}.', { pool: roll.meta?.contested?.initiatorPoolName || d10(roll.diceCount), count: d10(roll.meta?.contested?.initiatorDiceCount || roll.diceCount) })}</span>
                        <span>{tf('Оппонент: {name}.', { name: roll.meta?.contested?.opponentName || t('не выбран') })}</span>
                        <small>{t('Ожидается ответный бросок.')}</small>
                      </div>
                    ) : roll.poolType === 'humanity-event' ? (
                      <div className="humanity-history-event">{t('Событие Человечности')}</div>
                    ) : roll.opposed ? (
                      <div className="opposed-roll-result">
                        <strong className={`opposed-result-badge outcome-${roll.opposed.outcome}`}>{roll.opposed.summary}</strong>
                        {roll.opposed.sides.map(side => {
                          const sideOutcome = roll.opposed?.winnerSideId === side.id ? 'winner' : roll.opposed?.winnerSideId ? 'loser' : 'tie'
                          return (
                            <section className={`opposed-result-side ${sideOutcome}`} key={`${roll.id}-${side.id}`}>
                              <div>
                                <strong>{side.actorName}</strong>
                                <span>{t(side.poolName)}</span>
                              </div>
                              <div className="dice-row" aria-label={tf('Результаты кубиков {actor}: {values}', { actor: side.actorName, values: side.dice.map(die => die.value).join(', ') })}>
                                {side.dice.map((die, index) => {
                                  const dieImage = getDieImage(die)
                                  const dieLabel = t(dieImage.label)
                                  return (
                                    <span
                                      className={`die die-${die.kind}`}
                                      key={`${roll.id}-${side.id}-${index}`}
                                      aria-label={`${dieLabel}: ${die.value}`}
                                      title={`${die.value} - ${dieLabel}`}
                                    >
                                      <img src={dieImage.src} alt="" draggable={false} />
                                    </span>
                                  )
                                })}
                              </div>
                              <footer>
                                <span>{d10(side.diceCount)}</span>
                                <strong>{side.successes}</strong>
                              </footer>
                            </section>
                          )
                        })}
                      </div>
                    ) : (
                      <>
                        <div className="dice-row" aria-label={tf('Результаты кубиков: {values}', { values: roll.dice.map(die => die.value).join(', ') })}>
                          {roll.dice.map((die, index) => {
                            const dieImage = getDieImage(die)
                            const dieLabel = t(dieImage.label)
                            const dieId = getRollDieId(roll, index)
                            const rerollSelectable = canRerollWithWillpower && !String(die.kind).startsWith('hunger')
                            const rerollSelected = Boolean(rerollDraftForRoll?.selectedDieIds.includes(dieId))
                            return (
                              <span
                                className={`die die-${die.kind}${die.rerolled ? ' die-rerolled' : ''}${rerollSelectable ? ' reroll-selectable' : ''}${rerollSelected ? ' reroll-selected' : ''}`}
                                key={`${roll.id}-${index}`}
                                aria-label={`${dieLabel}: ${die.value}`}
                                title={rerollSelectable ? tf('{value} - {label}. Выбрать для переброса Воли', { value: die.value, label: dieLabel }) : `${die.value} - ${dieLabel}`}
                                onClick={rerollSelectable ? () => toggleWillpowerRerollDie(roll, dieId) : undefined}
                              >
                                <img src={dieImage.src} alt="" draggable={false} />
                              </span>
                            )
                          })}
                        </div>

                        <footer>
                          <span>{d10(roll.diceCount)}</span>
                          <strong>{roll.successes}</strong>
                        </footer>
                        {canRerollWithWillpower ? (
                          <div className="roll-reroll-actions">
                            {rerollDraftForRoll ? (
                              <>
                                <span>{tf('Выбрано {n} / 3', { n: rerollDraftForRoll.selectedDieIds.length })}</span>
                                <button type="button" onClick={() => confirmWillpowerReroll(roll)} disabled={rerollDraftForRoll.selectedDieIds.length < 1}>
                                  {t('Перебросить за Волю')}
                                </button>
                                <button type="button" onClick={() => setWillpowerRerollDraft(null)}>
                                  {t('Отмена')}
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setWillpowerRerollDraft({ rollId: roll.id, selectedDieIds: [] })}>
                                {t('Переброс Воли')}
                              </button>
                            )}
                          </div>
                        ) : null}
                        {!['health', 'rouse-check', 'remorse-check', 'humanity-event'].includes(roll.poolType) && !contestedRequest && chatCharacters.length ? (
                          <div className="roll-health-actions">
                            <button type="button" onClick={() => applyRollDamage(roll)}>
                              {t('Применить урон к цели')}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                    {roll.opposed && chatCharacters.length ? (
                      <div className="roll-health-actions">
                        <button type="button" onClick={() => applyRollDamage(roll)}>
                          {t('Применить урон к цели')}
                        </button>
                      </div>
                    ) : null}
                    {renderRollMeta(roll)}
                  </article>
                )})
              )}
            </section>
          </section>

          <ChatPanel
            rightRailTab={rightRailTab}
            chatMessages={chatMessages}
            chatStatus={chatStatus}
            chatUser={chatUser}
            roomParticipants={roomParticipants}
            chatCharacters={chatCharacters}
            selectedChatCharacterId={selectedChatCharacterId}
            chatAuthMode={chatAuthMode}
            chatUsernameDraft={chatUsernameDraft}
            chatPasswordDraft={chatPasswordDraft}
            isChatBusy={isChatBusy}
            chatPanelTab={chatPanelTab}
            voiceStatus={voiceStatus}
            voiceEnabled={voiceEnabled}
            voiceMuted={voiceMuted}
            voiceMasterVolume={voiceMasterVolume}
            voiceQuality={voiceQuality}
            voiceParticipants={voiceParticipants}
            chatDraft={chatDraft}
            chatListRef={chatListRef}
            voiceAudioRefs={voiceAudioRefs}
            remoteStreamsRef={remoteStreamsRef}
            formatTime={formatTime}
            openParticipantPreview={openParticipantPreview}
            logoutChat={logoutChat}
            chooseActiveCharacter={chooseActiveCharacter}
            handleChatAuth={handleChatAuth}
            setChatAuthMode={setChatAuthMode}
            setChatUsernameDraft={setChatUsernameDraft}
            setChatPasswordDraft={setChatPasswordDraft}
            setChatPanelTab={setChatPanelTab}
            startVoice={startVoice}
            stopVoice={stopVoice}
            toggleVoiceMuted={toggleVoiceMuted}
            setVoiceMasterVolume={setVoiceMasterVolume}
            setVoiceQuality={setVoiceQuality}
            setVoiceStatus={setVoiceStatus}
            setVoiceParticipantVolume={setVoiceParticipantVolume}
            sendChatMessage={sendChatMessage}
            setChatDraft={setChatDraft}
          />

          {isMaster ? (
            <section className={`master-roll-sidebar table-right-panel ${rightRailTab === 'diary' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Персонажи мастера')}>
              <header>
                <div>
                  <span>{t('Персонажи')}</span>
                  <strong>{chatCharacters.length}</strong>
                </div>
                <div>
                  <span>{t('Бросок')}</span>
                  <strong>{masterRollHidden ? t('скрытый') : t('открытый')}</strong>
                </div>
              </header>

              {!chatUser ? (
                <div className="master-roll-empty">
                  <p>{t('Войди в чат, чтобы увидеть своих персонажей.')}</p>
                  <button type="button" onClick={() => setRightRailTab('chat')}>{t('Открыть чат')}</button>
                </div>
              ) : chatCharacters.length === 0 ? (
                <div className="master-roll-empty">
                  <p>{t('Сохранённых персонажей пока нет.')}</p>
                  <a href={getCharacterSheetHref()}>{t('Создать лист')}</a>
                </div>
              ) : (
                <div className="master-roll-layout">
                  <aside className="master-roll-character-list" aria-label={t('Персонажи для бросков')}>
                    {chatCharacters.map(character => (
                      <button
                        type="button"
                        key={character.id}
                        className={character.id === selectedMasterRollCharacter?.id ? 'active' : ''}
                        onClick={() => chooseMasterRollCharacter(character.id)}
                      >
                        <span className="chat-avatar" aria-hidden="true">
                          {character.image ? <img src={character.image} alt="" /> : <i>{(character.name || '?').slice(0, 1).toUpperCase()}</i>}
                        </span>
                        <span>
                          <strong>{character.name || t('Безымянный')}</strong>
                          <small>{character.clan || t('без клана')}</small>
                        </span>
                      </button>
                    ))}
                  </aside>

                  <section className="master-roll-builder" aria-label={t('Бросок персонажа мастера')}>
                    {selectedMasterRollCharacter ? (
                      <>
                        <div className="master-roll-current">
                          <div className="chat-avatar large" aria-hidden="true">
                            {selectedMasterRollCharacter.image ? (
                              <img src={selectedMasterRollCharacter.image} alt="" />
                            ) : (
                              <span>{(selectedMasterRollCharacter.name || '?').slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <span>{t('Выбран')}</span>
                            <strong>{selectedMasterRollCharacter.name}</strong>
                            <small>{tf('{clan} · Голод {hunger}/5 · Воля {willpowerCurrent}/{willpowerMax} · Сила Крови {bloodPotency}', {
                              clan: selectedMasterRollCharacter.clan || t('без клана'),
                              hunger: getCharacterHunger(selectedMasterRollCharacter),
                              willpowerCurrent: getCharacterWillpower(selectedMasterRollCharacter).current,
                              willpowerMax: getCharacterWillpower(selectedMasterRollCharacter).max,
                              bloodPotency: masterBloodPotency
                            })}</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void openCharacterPreview(selectedMasterRollCharacter)
                              setPreviewCharacterTab('mechanics')
                            }}
                          >
                            {t('Просмотр')}
                          </button>
                          <a href={getCharacterSheetHref(selectedMasterRollCharacter.id)}>{t('Лист')}</a>
                        </div>

                        <div className="master-roll-mode" aria-label={t('Видимость броска')}>
                          <button
                            type="button"
                            className={masterRollVisibility === 'public' ? 'active' : ''}
                            onClick={() => setMasterRollVisibility('public')}
                          >
                            {t('Открытый')}
                          </button>
                          <button
                            type="button"
                            className={masterRollVisibility === 'hidden' ? 'active' : ''}
                            onClick={() => setMasterRollVisibility('hidden')}
                          >
                            {t('Скрытый')}
                          </button>
                        </div>

                        <div className="preview-roll-controls master-roll-controls">
                          <label>
                            <span>{t('Характеристика 1')}</span>
                            <select value={masterRollAttribute} onChange={event => setMasterRollAttribute(event.target.value)}>
                              <option value="">{t('Без характеристики')}</option>
                              {ATTRIBUTE_GROUPS.map(group => (
                                <optgroup key={group.name} label={group.name}>
                                  {group.traits.map(name => <option key={name} value={name} disabled={masterRollAttributeTwo === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraAttributes.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraAttributes.map(name => <option key={name} value={name} disabled={masterRollAttributeTwo === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Характеристика 2')}</span>
                            <select value={masterRollAttributeTwo} onChange={event => setMasterRollAttributeTwo(event.target.value)}>
                              <option value="">{t('Без второй характеристики')}</option>
                              {ATTRIBUTE_GROUPS.map(group => (
                                <optgroup key={group.name} label={t(group.name)}>
                                  {group.traits.map(name => <option key={name} value={name} disabled={masterRollAttribute === name}>{t(name)} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraAttributes.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraAttributes.map(name => <option key={name} value={name} disabled={masterRollAttribute === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Навык')}</span>
                            <select value={masterRollSkill} onChange={event => setMasterRollSkill(event.target.value)}>
                              <option value="">{t('Без навыка')}</option>
                              {SKILL_GROUPS.map(group => (
                                <optgroup key={group.name} label={t(group.name)}>
                                  {group.traits.map(name => <option key={name} value={name}>{t(name)} · {getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, name))}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraSkills.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraSkills.map(name => <option key={name} value={name}>{name} · {getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, name))}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Дисциплина')}</span>
                            <select value={masterRollDiscipline} onChange={event => setMasterRollDiscipline(event.target.value)}>
                              <option value="">{t('Без дисциплины')}</option>
                              {masterRollDisciplineNames.map(name => (
                                <option key={name} value={name}>{name} · {getDisciplineDots(selectedMasterRollCharacter.disciplines[name] || {})}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{t('Модификатор')}</span>
                            <input
                              type="number"
                              min="-20"
                              max="20"
                              value={masterRollModifier}
                              onChange={event => setMasterRollModifier(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                            />
                          </label>
                          <label className="preview-blood-surge-toggle">
                            <span>{tf('Прилив Крови +{bonus}к10', { bonus: masterBloodSurgeBonus })}</span>
                            <input
                              type="checkbox"
                              checked={masterUseBloodSurge}
                              onChange={event => setMasterUseBloodSurge(event.target.checked)}
                            />
                          </label>
                          <label className="roll-mode-field">
                            <span>{t('Тип броска')}</span>
                            <select
                              value={masterRollMode}
                              onChange={event => {
                                const nextMode = event.target.value as RollMode
                                setMasterRollMode(nextMode)
                                if (nextMode === 'normal') setMasterContestedOpponentId('')
                              }}
                            >
                              <option value="normal">{t('Обычный бросок')}</option>
                              <option value="contested">{t('Встречный бросок')}</option>
                            </select>
                          </label>
                          {masterRollMode === 'contested' ? (
                            <label className="contested-opponent-field">
                              <span>{t('Оппонент')}</span>
                              <select
                                value={masterContestedOpponentId}
                                onChange={event => setMasterContestedOpponentId(event.target.value)}
                                disabled={masterContestedOpponentOptions.length === 0}
                              >
                                <option value="">{masterContestedOpponentOptions.length ? t('Выбрать оппонента') : t('Нет доступных оппонентов')}</option>
                                {masterContestedOpponentOptions.map(option => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          <button
                            type="button"
                            className="preview-roll-submit"
                            onClick={rollMasterPool}
                            disabled={masterRollDiceCount < 1 || (masterRollMode === 'contested' && !selectedMasterContestedOpponent)}
                          >
                            {masterRollMode === 'contested' ? t('Запросить встречный') : t('Бросить')} {d10(Math.min(20, masterRollDiceCount + (masterUseBloodSurge ? masterBloodSurgeBonus : 0)) || 0)}
                          </button>
                        </div>

                        {renderRollModifierControls(masterRollEffectResult, setDisabledMasterRollModifierIds)}

                        <div className="quick-roll-grid master-quick-rolls" aria-label={t('Быстрые броски мастера')}>
                          {[1, 3, 5, 7, 10].map(count => (
                            <button type="button" key={count} onClick={() => rollMasterQuick(count)}>
                              {d10(count)}
                            </button>
                          ))}
                        </div>

                        <div className="master-roll-traits">
                          {ATTRIBUTE_GROUPS.map(group => (
                            <section key={group.name}>
                              <strong>{t(group.name)}</strong>
                              {group.traits.map(name => {
                                const dots = getAttributeDots(selectedMasterRollCharacter.attributes, name)
                                return (
                                  <button
                                    type="button"
                                    key={name}
                                    className={masterRollAttribute === name || masterRollAttributeTwo === name ? 'active' : ''}
                                    onClick={() => toggleMasterRollAttribute(name)}
                                  >
                                    <span>{t(name)}</span>
                                    <i>{getDotDisplay(dots)}</i>
                                  </button>
                                )
                              })}
                            </section>
                          ))}
                        </div>

                        {masterRollPoolBeforeLimit > 20 ? <p className="preview-roll-notice">{t('Пул ограничен двадцатью костями.')}</p> : null}
                        {getActivePenaltyDelta(masterRollEffectResult, 'willpower_impairment') ? <p className="preview-roll-notice">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                        {getActivePenaltyDelta(masterRollEffectResult, 'health_impairment') ? <p className="preview-roll-notice">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
                      </>
                    ) : (
                      <p className="panel-empty">{t('Выбери персонажа.')}</p>
                    )}
                  </section>
                </div>
              )}
            </section>
          ) : (
            <JournalPanel
              rightRailTab={rightRailTab}
              journalEntries={journalEntries}
              journalSaveStatus={journalSaveStatus}
              chatUser={chatUser}
              journalSearch={journalSearch}
              filteredJournalEntries={filteredJournalEntries}
              selectedJournalEntry={selectedJournalEntry}
              setJournalSearch={setJournalSearch}
              createJournalEntry={createJournalEntry}
              setSelectedJournalEntryId={setSelectedJournalEntryId}
              updateJournalEntry={updateJournalEntry}
              persistCurrentJournal={persistCurrentJournal}
              deleteJournalEntry={deleteJournalEntry}
              addLayerToJournal={addLayerToJournal}
            />
          )}

          <MasterPanel
            rightRailTab={rightRailTab}
            isMaster={isMaster}
            masterReveals={masterReveals}
            visibleMasterWhispers={visibleMasterWhispers}
            room={room}
            chatUser={chatUser}
            selectedMasterChatUserId={selectedMasterChatUserId}
            masterChatPlayers={masterChatPlayers}
            masterChatDraft={masterChatDraft}
            formatTime={formatTime}
            setSelectedMasterChatUserId={setSelectedMasterChatUserId}
            setMasterChatDraft={setMasterChatDraft}
            sendMasterWhisper={sendMasterWhisper}
          />
        </TableRightPanel>
      </section>

      {incomingOpposedProposal ? (
        <div className="opposed-proposal-backdrop" role="dialog" aria-modal="true" aria-label={t('Встречная проверка')}>
          <section className="opposed-proposal-modal">
            <header>
              <div>
                <span>{t('Встречная проверка')}</span>
                <strong>{incomingOpposedProposal.fromUsername || t('Игрок')}</strong>
              </div>
              <button type="button" onClick={dismissOpposedProposal} aria-label={t('Закрыть предложение')}>×</button>
            </header>

            <div className="opposed-proposal-body">
              <section className="opposed-proposal-summary">
                <div>
                  <span>{t('Заявленный бросок')}</span>
                  <strong>{incomingOpposedProposal.initiator.actorName}</strong>
                </div>
                <p>{t(incomingOpposedProposal.initiator.poolName)}</p>
                <b>{d10(incomingOpposedProposal.initiator.diceCount)}</b>
              </section>

              <section className="opposed-proposal-active">
                <span>{t('Отвечает')}</span>
                <strong>{selectedActiveCharacter?.name || t('Активный персонаж не выбран')}</strong>
              </section>

              {renderOpposedResponseControls()}
            </div>

            <footer className="opposed-proposal-actions">
              <button type="button" onClick={dismissOpposedProposal}>{t('Отклонить')}</button>
              <button type="button" className="primary" onClick={answerOpposedProposal} disabled={!canAnswerOpposedProposal}>
                {tf('Бросить ответ {count}к10', { count: opposedResponsePool.diceCount || 0 })}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {previewCharacter ? (
        <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label={t('Быстрый просмотр персонажа')} onMouseDown={() => setPreviewCharacter(null)}>
          <section className="character-preview-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div className="character-preview-identity">
                <div className="chat-avatar large" aria-hidden="true">
                  {previewCharacter.image ? <img src={previewCharacter.image} alt="" /> : <span>{previewCharacter.name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div>
                  <span>{previewCharacter.username || chatUser?.username || t('Игрок')}</span>
                  <strong>{previewCharacter.name}</strong>
                  <small>{previewCharacter.clan || t('Клан не указан')}</small>
                </div>
              </div>
              <button type="button" onClick={() => setPreviewCharacter(null)} aria-label={t('Закрыть предпросмотр')}>×</button>
            </header>
            <nav className="character-preview-tabs" aria-label={t('Разделы краткого листа')}>
              <button
                type="button"
                className={previewCharacterTab === 'mechanics' ? 'active' : ''}
                onClick={() => setPreviewCharacterTab('mechanics')}
              >
                {t('Броски / механика')}
              </button>
              <button
                type="button"
                className={previewCharacterTab === 'inventory' ? 'active' : ''}
                onClick={() => setPreviewCharacterTab('inventory')}
              >
                {t('Инвентарь')} <span>{previewCharacter.inventory.length}</span>
              </button>
            </nav>
            <div className="character-preview-body">
              <dl className="character-preview-summary">
                <div><dt>{t('Клан')}</dt><dd>{previewCharacter.clan || '—'}</dd></div>
                <div><dt>{t('Поколение')}</dt><dd>{previewCharacter.generation || '—'}</dd></div>
                <div><dt>{t('Тип')}</dt><dd>{previewCharacter.type || '—'}</dd></div>
                <div><dt>{t('Стиль охоты')}</dt><dd>{previewCharacter.predator || '—'}</dd></div>
                {previewUsesVampireResources ? <div><dt>{t('Голод')}</dt><dd>{previewHunger} / 5</dd></div> : null}
                <div><dt>{t('Здоровье')}</dt><dd>{previewHealth.current} / {previewHealth.max}</dd></div>
                <div><dt>{t('Воля')}</dt><dd>{previewWillpower.current} / {previewWillpower.max}</dd></div>
                {previewUsesVampireResources ? <div><dt>{t('Человечность')}</dt><dd>{tf('{value} · Сомнения {stains}', { value: previewHumanity.value, stains: previewHumanity.stains })}</dd></div> : null}
                {previewUsesVampireResources ? <div><dt>{t('Сила Крови')}</dt><dd>{previewBloodPotency}</dd></div> : null}
                <div><dt>{t('Свободный опыт')}</dt><dd>{previewCharacter.freeExp ?? 0}</dd></div>
              </dl>

              {previewCharacterTab === 'mechanics' ? (
                <div className="character-mechanics-sheet">
                  {previewSheetFixed ? (
                    <>
                    {previewUsesVampireResources ? <section className="preview-blood-panel">
                    <div className="preview-section-heading">
                      <div>
                        <span>{t('Голод и кровь')}</span>
                        <h3>{t('Состояние')}</h3>
                      </div>
                      <strong>{previewHunger} / 5</strong>
                    </div>
                    <div className="preview-blood-grid">
                      <div>
                        <span>{t('Голод')}</span>
                        <b>{'●'.repeat(previewHunger)}{'○'.repeat(5 - previewHunger)}</b>
                      </div>
                      <div>
                        <span>{t('Сила Крови')}</span>
                        <b>{previewBloodPotency}</b>
                      </div>
                    </div>
                    {previewSheetFixed && previewUsesVampireResources ? (
                      <div className="preview-blood-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        <button type="button" onClick={() => rollRouseCheck(previewCharacter)} disabled={!canRollPreview}>
                          {t('Проверить Голод')}
                        </button>
                        <button
                          type="button"
                          onClick={() => quenchHunger(previewCharacter, 1)}
                          disabled={!canRollPreview || previewHunger <= 0}
                        >
                          {t('Утолить голод')}
                        </button>
                        <button
                          type="button"
                          onClick={() => quenchHunger(previewCharacter, 5)}
                          disabled={!canRollPreview || previewHunger <= 0}
                        >
                          {t('Насытиться')}
                        </button>
                      </div>
                    ) : null}
                    </section> : null}
                  {previewUsesVampireResources ? (
                    <section className="preview-humanity-panel">
                      <div className="preview-section-heading">
                        <div>
                          <span>{t('Человечность')}</span>
                          <h3>{t('Сомнения и муки совести')}</h3>
                        </div>
                        <strong>{previewHumanity.value} / 10</strong>
                      </div>
                      <div className="preview-humanity-track" aria-label={tf('Человечность {value}, Сомнения {stains}', { value: previewHumanity.value, stains: previewHumanity.stains })}>
                        {Array.from({ length: 10 }, (_, index) => {
                          const cell = index + 1
                          const status = cell <= previewHumanity.value
                            ? 'humanity-filled'
                            : cell <= previewHumanity.value + previewHumanity.stains
                              ? 'stain'
                              : 'empty'
                          return <span className={`preview-humanity-cell ${status}`} key={`preview-humanity-${cell}`} />
                        })}
                      </div>
                      <p className="preview-humanity-caption">
                        {tf('Сомнения {stains} / {remaining} · свободно {free}', { stains: previewHumanity.stains, remaining: 10 - previewHumanity.value, free: previewHumanity.freeBoxes })}
                      </p>
                      {previewHumanity.status === 'at_risk' ? (
                        <p className="preview-roll-notice warning">{t('Шкала Сомнений заполнена. Следующая проверка почти наверняка приведёт к потере Человечности.')}</p>
                      ) : null}
                      {previewHumanity.status === 'lost_to_beast' ? (
                        <p className="preview-roll-notice danger">{t('Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.')}</p>
                      ) : null}
                      {previewSheetFixed ? (
                        <div className="preview-humanity-actions">
                          <button type="button" onClick={() => addHumanityStains(previewCharacter, 1)} disabled={!canRollPreview}>
                            + {t('Сомнение')}
                          </button>
                          <button
                            type="button"
                            onClick={() => performRemorseCheck(previewCharacter)}
                            disabled={!canRollPreview || previewHumanity.stains <= 0}
                            title={previewHumanity.stains <= 0 ? t('Нет Сомнений для проверки.') : tf('Пул: {dice}к10', { dice: getRemorseDice(previewHumanity) })}
                          >
                            {t('Проверка мук совести')}
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  <section className="preview-willpower-panel">
                    <div className="preview-section-heading">
                      <div>
                        <span>{t('Здоровье')}</span>
                        <h3>{t('Повреждения')}</h3>
                      </div>
                      <strong>{previewHealth.current} / {previewHealth.max}</strong>
                    </div>
                    {previewHealthDerived ? (
                      <p className="preview-humanity-caption">
                        {t('Здоровье')}: {previewHealthDerived.baseMax}
                        {previewHealthDerived.legacyBonus > 0 ? ` + ${previewHealthDerived.legacyBonus}` : ''}
                        {previewHealthDerived.passiveBonus > 0
                          ? ` + ${previewHealthDerived.passiveBonus} ${t('от Стойкости')}`
                          : ''}
                        {' = '}{previewHealthDerived.totalMax}
                      </p>
                    ) : null}
                    <div className="preview-willpower-track" aria-label={t('Трек Здоровья')}>
                      {Array.from({ length: previewHealth.max }, (_, index) => {
                        const cell = index + 1
                        const status = cell <= previewHealth.aggravated
                          ? 'aggravated'
                          : cell <= previewHealth.aggravated + previewHealth.superficial
                            ? 'superficial'
                            : 'empty'
                        return (
                          <span className={`preview-willpower-cell ${status}`} key={`preview-health-${cell}`}>
                            {status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : ''}
                          </span>
                        )
                      })}
                    </div>
                    {previewHealth.impaired ? <p className="preview-roll-notice">{getHealthWarning(previewHealth, previewDamageProfile, t)}</p> : null}
                    {previewSheetFixed ? <div className="preview-willpower-actions preview-health-actions">
                      <button type="button" onClick={() => applyCharacterHealthDamage(previewCharacter, 1, 'superficial', { source: 'manual', ignoreHalving: true })} disabled={!canRollPreview}>+ {t('лёгкий')}</button>
                      <button type="button" onClick={() => applyCharacterHealthDamage(previewCharacter, 1, 'aggravated', { source: 'manual' })} disabled={!canRollPreview}>+ {t('тяжёлый')}</button>
                      <button type="button" onClick={() => promptCharacterHealthDamage(previewCharacter)} disabled={!canRollPreview}>{t('+N урона')}</button>
                      <button type="button" onClick={() => recoverCharacterHealth(previewCharacter, 1, 'superficial', 'Ручное лечение', 'manual')} disabled={!canRollPreview || previewHealth.superficial < 1}>- {t('лёгкий')}</button>
                      <button type="button" onClick={() => recoverCharacterHealth(previewCharacter, 1, 'aggravated', 'Ручное лечение', 'manual')} disabled={!canRollPreview || previewHealth.aggravated < 1}>- {t('тяжёлый')}</button>
                      <button type="button" onClick={() => mendVampireSuperficial(previewCharacter)} disabled={!canRollPreview || previewHealth.superficial < 1 || !['vampire', 'thinblood'].includes(previewDamageProfile)}>
                        {t('Заживить лёгкий')}
                      </button>
                      <button type="button" onClick={() => mendVampireAggravated(previewCharacter)} disabled={!canRollPreview || previewHealth.aggravated < 1 || !['vampire', 'thinblood'].includes(previewDamageProfile)}>
                        {t('Заживить тяжёлый')}
                      </button>
                      <button type="button" onClick={() => recoverMortalHealth(previewCharacter)} disabled={!canRollPreview || previewHealth.superficial < 1 || !['mortal', 'ghoul', 'custom'].includes(previewDamageProfile)}>
                        {t('Восстановление смертного')}
                      </button>
                      <button type="button" onClick={() => treatMortalHealth(previewCharacter)} disabled={!canRollPreview || previewHealth.aggravated < 1 || !['mortal', 'ghoul', 'custom'].includes(previewDamageProfile)}>
                        {t('Лечение смертного')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('Полностью очистить шкалу здоровья?'))) {
                            void updateCharacterHealth(previewCharacter.id, normalizeHealthTracker({
                              ...toHealthTracker(previewHealth),
                              superficial: 0,
                              aggravated: 0,
                            }, getCharacterHealthStamina(previewCharacter), previewDamageProfile), 'Здоровье очищено')
                          }
                        }}
                        disabled={!canRollPreview || (!previewHealth.superficial && !previewHealth.aggravated)}
                      >
                        {t('Очистить')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const stateName = previewDamageProfile === 'vampire' ? 'торпор' : 'кому/смерть'
                          if (window.confirm(tf('Отметить {state} и заполнить шкалу тяжёлыми повреждениями?', { state: t(stateName) }))) {
                            void updateCharacterHealth(previewCharacter.id, normalizeHealthTracker({
                              ...toHealthTracker(previewHealth),
                              superficial: 0,
                              aggravated: previewHealth.max,
                            }, getCharacterHealthStamina(previewCharacter), previewDamageProfile), stateName)
                          }
                        }}
                        disabled={!canRollPreview}
                      >
                        {t('Торпор/кома')}
                      </button>
                    </div> : null}
                    {previewDamageProfile === 'thinblood' ? <p className="preview-roll-notice">{t('Слабокровные получают часть урона ближе к смертным.')}</p> : null}
                    {previewUsesVampireResources ? <p className="preview-roll-notice">{tf('Сила Крови {potency}: за Испытание Крови лечит {amount} лёгк.', { potency: previewBloodPotency, amount: getSuperficialMendAmount(previewBloodPotency) })}</p> : null}
                  </section>
                  <section className="preview-willpower-panel">
                    <div className="preview-section-heading">
                      <div>
                        <span>{t('Воля')}</span>
                        <h3>{t('Стресс')}</h3>
                      </div>
                      <strong>{previewWillpower.current} / {previewWillpower.max}</strong>
                    </div>
                    {previewWillpowerDerived ? (
                      <p className="preview-humanity-caption">
                        {t('Воля')}: {previewWillpowerDerived.baseMax}
                        {previewWillpowerDerived.legacyBonus > 0 ? ` + ${previewWillpowerDerived.legacyBonus}` : ''}
                        {previewWillpowerDerived.passiveBonus > 0
                          ? ` + ${previewWillpowerDerived.passiveBonus} ${t('от дисциплин')}`
                          : ''}
                        {' = '}{previewWillpowerDerived.totalMax}
                      </p>
                    ) : null}
                    <div className="preview-willpower-track" aria-label={t('Трек Воли')}>
                      {Array.from({ length: previewWillpower.max }, (_, index) => {
                        const cell = index + 1
                        const status = cell <= previewWillpower.aggravated
                          ? 'aggravated'
                          : cell <= previewWillpower.aggravated + previewWillpower.superficial
                            ? 'superficial'
                            : 'empty'
                        return (
                          <span className={`preview-willpower-cell ${status}`} key={`preview-wp-${cell}`}>
                            {status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : ''}
                          </span>
                        )
                      })}
                    </div>
                    {previewWillpower.impaired ? <p className="preview-roll-notice">{t('Трек заполнен: ментальные и социальные проверки получают -2к10.')}</p> : null}
                    {previewSheetFixed ? <div className="preview-willpower-actions">
                      <button type="button" onClick={() => spendWillpower(previewCharacter, 1, 'Воля: трата')} disabled={!canRollPreview || previewWillpower.aggravated >= previewWillpower.max}>
                        {t('Потратить')}
                      </button>
                      <button type="button" onClick={() => rollWillpowerCheck(previewCharacter)} disabled={!canRollPreview || previewWillpower.current < 1}>
                        {t('Проверка Воли')}
                      </button>
                      <button type="button" onClick={() => recoverWillpower(previewCharacter, getWillpowerRecoveryPool(previewCharacter), 'superficial', 'Воля: начало встречи')} disabled={!canRollPreview || previewWillpower.superficial < 1}>
                        {t('Встреча')}
                      </button>
                      <button type="button" onClick={() => recoverWillpower(previewCharacter, 1, 'superficial', 'Воля: Прихоть')} disabled={!canRollPreview || previewWillpower.superficial < 1}>
                        {t('Прихоть +1')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('Снять один тяжёлый стресс Воли?'))) void recoverWillpower(previewCharacter, 1, 'aggravated', 'Воля: восстановление тяжёлого стресса')
                        }}
                        disabled={!canRollPreview || previewWillpower.aggravated < 1}
                      >
                        {t('Снять X')}
                      </button>
                      <button type="button" onClick={() => adjustWillpowerStress(previewCharacter, 'superficial', 1)} disabled={!canRollPreview}>+ /</button>
                      <button type="button" onClick={() => adjustWillpowerStress(previewCharacter, 'superficial', -1)} disabled={!canRollPreview}>- /</button>
                      <button type="button" onClick={() => adjustWillpowerStress(previewCharacter, 'aggravated', 1)} disabled={!canRollPreview}>+ X</button>
                      <button type="button" onClick={() => adjustWillpowerStress(previewCharacter, 'aggravated', -1)} disabled={!canRollPreview}>- X</button>
                    </div> : null}
                  </section>
                  <section className="preview-willpower-panel">
                    <div className="preview-section-heading">
                      <div>
                        <span>{t('Состояние персонажа')}</span>
                        <h3>{t('Активные эффекты')}</h3>
                      </div>
                      <strong>{previewCharacter.activeEffects.length}</strong>
                    </div>
                    {previewCharacter.activeEffects.length === 0 ? (
                      <p className="character-preview-empty">{t('Активных эффектов нет.')}</p>
                    ) : (
                      <div className="preview-inventory-list">
                        {previewCharacter.activeEffects.map(activeEffect => (
                          <article key={activeEffect.id}>
                            <header>
                              <div>
                                <strong>{getActiveEffectTitle(activeEffect)}</strong>
                                <span>{activeEffect.source.discipline || t('Ручной эффект')}</span>
                              </div>
                              <b>{activeEffect.active ? t('активен') : t('выкл.')}</b>
                            </header>
                            {getActiveEffectDescription(activeEffect, t, tf) ? (
                              <p>{getActiveEffectDescription(activeEffect, t, tf)}</p>
                            ) : null}
                            <footer>
                              <button
                                type="button"
                                onClick={() => removePreviewActiveEffect(activeEffect.id)}
                                disabled={!canEditPreviewActiveEffects}
                              >
                                {t('Отключить')}
                              </button>
                            </footer>
                          </article>
                        ))}
                      </div>
                    )}
                    <p className="preview-roll-notice">{t('Активные roll modifiers применяются к броскам; урон пока не автоматизируется.')}</p>
                  </section>
                    </>
                  ) : (
                    <section className="preview-creation-vitals">
                      <div>
                        <span>{t('Лист ещё не зафиксирован')}</span>
                        <strong>{t('Стартовые значения')}</strong>
                      </div>
                      <dl>
                        <div><dt>{t('Здоровье')}</dt><dd>{previewHealth.max}</dd></div>
                        <div><dt>{t('Воля')}</dt><dd>{previewWillpower.max}</dd></div>
                        {previewUsesVampireResources ? <div><dt>{t('Человечность')}</dt><dd>{previewHumanity.value}</dd></div> : null}
                        {previewUsesVampireResources ? <div><dt>{t('Голод')}</dt><dd>{previewHunger}</dd></div> : null}
                        {previewUsesVampireResources ? <div><dt>{t('Сила Крови')}</dt><dd>{previewBloodPotency}</dd></div> : null}
                      </dl>
                    </section>
                  )}
                  <section className="preview-roll-builder">
                    <div className="preview-section-heading">
                      <div>
                        <span>{t('Пул костей')}</span>
                        <h3>{t('Собрать бросок')}</h3>
                      </div>
                      <strong>{d10(previewDiceCount)}</strong>
                    </div>
                    <div className="preview-roll-controls">
                      <label>
                        <span>{t('Характеристика 1')}</span>
                        <select value={previewRollAttribute} onChange={event => setPreviewRollAttribute(event.target.value)}>
                          <option value="">{t('Без характеристики')}</option>
                          {ATTRIBUTE_GROUPS.map(group => (
                            <optgroup key={group.name} label={t(group.name)}>
                              {group.traits.map(name => <option key={name} value={name} disabled={previewRollAttributeTwo === name}>{t(name)} · {getAttributeDots(previewCharacter.attributes, name)}</option>)}
                            </optgroup>
                          ))}
                          {previewExtraAttributes.length ? (
                            <optgroup label={t('Другие')}>
                              {previewExtraAttributes.map(name => <option key={name} value={name} disabled={previewRollAttributeTwo === name}>{name} · {getAttributeDots(previewCharacter.attributes, name)}</option>)}
                            </optgroup>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        <span>{t('Характеристика 2')}</span>
                        <select value={previewRollAttributeTwo} onChange={event => setPreviewRollAttributeTwo(event.target.value)}>
                          <option value="">{t('Без второй характеристики')}</option>
                          {ATTRIBUTE_GROUPS.map(group => (
                            <optgroup key={group.name} label={t(group.name)}>
                              {group.traits.map(name => <option key={name} value={name} disabled={previewRollAttribute === name}>{t(name)} · {getAttributeDots(previewCharacter.attributes, name)}</option>)}
                            </optgroup>
                          ))}
                          {previewExtraAttributes.length ? (
                            <optgroup label={t('Другие')}>
                              {previewExtraAttributes.map(name => <option key={name} value={name} disabled={previewRollAttribute === name}>{name} · {getAttributeDots(previewCharacter.attributes, name)}</option>)}
                            </optgroup>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        <span>{t('Навык')}</span>
                        <select value={previewRollSkill} onChange={event => setPreviewRollSkill(event.target.value)}>
                          <option value="">{t('Без навыка')}</option>
                          {SKILL_GROUPS.map(group => (
                            <optgroup key={group.name} label={t(group.name)}>
                              {group.traits.map(name => <option key={name} value={name}>{t(name)} · {getSkillDots(resolveSkillValue(previewCharacter.skills, name))}</option>)}
                            </optgroup>
                          ))}
                          {previewExtraSkills.length ? (
                            <optgroup label={t('Другие')}>
                              {previewExtraSkills.map(name => <option key={name} value={name}>{name} · {getSkillDots(resolveSkillValue(previewCharacter.skills, name))}</option>)}
                            </optgroup>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        <span>{t('Дисциплина')}</span>
                        <select value={previewRollDiscipline} onChange={event => setPreviewRollDiscipline(event.target.value)}>
                          <option value="">{t('Без дисциплины')}</option>
                          {previewDisciplineNames.map(name => (
                            <option key={name} value={name}>{name} · {getDisciplineDots(previewCharacter.disciplines[name] || {})}</option>
                          ))}
                        </select>
                      </label>
                      <label className="preview-modifier-field">
                        <span>{t('Модификатор')}</span>
                        <input
                          type="number"
                          min="-20"
                          max="20"
                          value={previewRollModifier}
                          onChange={event => setPreviewRollModifier(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                        />
                      </label>
                      {previewUsesVampireResources ? <label className="preview-blood-surge-toggle">
                        <span>{tf('Прилив Крови +{bonus}к10', { bonus: previewBloodSurgeBonus })}</span>
                        <input
                          type="checkbox"
                          checked={previewBloodSurgeEnabled}
                          onChange={event => setPreviewUseBloodSurge(event.target.checked)}
                        />
                      </label> : null}
                      <label className="roll-mode-field">
                        <span>{t('Тип броска')}</span>
                        <select
                          value={previewRollMode}
                          onChange={event => {
                            const nextMode = event.target.value as RollMode
                            setPreviewRollMode(nextMode)
                            if (nextMode === 'normal') setPreviewContestedOpponentId('')
                          }}
                        >
                          <option value="normal">{t('Обычный бросок')}</option>
                          <option value="contested">{t('Встречный бросок')}</option>
                        </select>
                      </label>
                      {previewRollMode === 'contested' ? (
                        <label className="contested-opponent-field">
                          <span>{t('Оппонент')}</span>
                          <select
                            value={previewContestedOpponentId}
                            onChange={event => setPreviewContestedOpponentId(event.target.value)}
                            disabled={previewContestedOpponentOptions.length === 0}
                          >
                            <option value="">{previewContestedOpponentOptions.length ? t('Выбрать оппонента') : t('Нет доступных оппонентов')}</option>
                            {previewContestedOpponentOptions.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="preview-roll-submit"
                        onClick={rollPreviewPool}
                        disabled={!canRollPreview || previewDiceCount < 1 || (previewRollMode === 'contested' && !selectedPreviewContestedOpponent)}
                      >
                        {previewRollMode === 'contested' ? t('Запросить встречный') : t('Бросить')} {Math.min(20, previewDiceCount + (previewBloodSurgeEnabled ? previewBloodSurgeBonus : 0)) || 0}к10
                      </button>
                    </div>
                    {renderRollModifierControls(previewRollEffectResult, setDisabledPreviewRollModifierIds)}
                    <div className="quick-roll-grid" aria-label={t('Быстрые броски')}>
                      {[1, 3, 5, 7].map(count => (
                        <button
                          type="button"
                          key={count}
                          disabled={!canRollPreview}
                          onClick={() => rollQuickDice(count, d10(count), previewCharacter, 'quick', {
                            useBloodSurge: previewBloodSurgeEnabled,
                            source: previewBloodSurgeEnabled ? 'blood_surge' : 'manual',
                          })}
                        >
                          {d10(count)}
                        </button>
                      ))}
                    </div>
                    {!canRollPreview ? <p className="preview-roll-notice">{t('Бросать может мастер или владелец активного персонажа.')}</p> : null}
                    {previewPoolBeforeLimit > 20 ? <p className="preview-roll-notice">{t('Пул ограничен двадцатью костями.')}</p> : null}
                    {getActivePenaltyDelta(previewRollEffectResult, 'willpower_impairment') ? <p className="preview-roll-notice">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                    {getActivePenaltyDelta(previewRollEffectResult, 'health_impairment') ? <p className="preview-roll-notice">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
                  </section>

                  <section className="preview-trait-section">
                    <div className="preview-section-heading"><h3>{t('Характеристики')}</h3><span>{t('Можно выбрать две характеристики')}</span></div>
                    <div className="preview-trait-columns">
                      {ATTRIBUTE_GROUPS.map(group => (
                        <div className="preview-trait-group" key={group.name}>
                          <h4>{t(group.name)}</h4>
                          {group.traits.map(name => {
                            const dots = getAttributeDots(previewCharacter.attributes, name)
                            return (
                              <button
                                type="button"
                                key={name}
                                className={previewRollAttribute === name || previewRollAttributeTwo === name ? 'active' : ''}
                                onClick={() => togglePreviewAttribute(name)}
                              >
                                <span>{t(name)}</span><i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                      {previewExtraAttributes.length ? (
                        <div className="preview-trait-group">
                          <h4>{t('Другие')}</h4>
                          {previewExtraAttributes.map(name => {
                            const dots = getAttributeDots(previewCharacter.attributes, name)
                            return (
                              <button type="button" key={name} className={previewRollAttribute === name || previewRollAttributeTwo === name ? 'active' : ''} onClick={() => togglePreviewAttribute(name)}>
                                <span>{name}</span><i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="preview-trait-section">
                    <div className="preview-section-heading"><h3>{t('Навыки')}</h3><span>{t('Специализации указаны под навыком')}</span></div>
                    <div className="preview-trait-columns skills">
                      {SKILL_GROUPS.map(group => (
                        <div className="preview-trait-group" key={group.name}>
                          <h4>{t(group.name)}</h4>
                          {group.traits.map(name => {
                            const value = resolveSkillValue(previewCharacter.skills, name)
                            const dots = getSkillDots(value)
                            const specs = getSkillSpecs(value)
                            return (
                              <button
                                type="button"
                                key={name}
                                className={previewRollSkill === name ? 'active' : ''}
                                onClick={() => setPreviewRollSkill(current => current === name ? '' : name)}
                              >
                                <span>{t(name)}{specs.length ? <small>{specs.join(', ')}</small> : null}</span>
                                <i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                      {previewExtraSkills.length ? (
                        <div className="preview-trait-group">
                          <h4>{t('Другие')}</h4>
                          {previewExtraSkills.map(name => {
                            const value = resolveSkillValue(previewCharacter.skills, name)
                            const dots = getSkillDots(value)
                            const specs = getSkillSpecs(value)
                            return (
                              <button type="button" key={name} className={previewRollSkill === name ? 'active' : ''} onClick={() => setPreviewRollSkill(current => current === name ? '' : name)}>
                                <span>{name}{specs.length ? <small>{specs.join(', ')}</small> : null}</span>
                                <i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="preview-trait-section">
                    <div className="preview-section-heading"><h3>{t('Дисциплины и способности')}</h3><span>{t('Нажми дисциплину, чтобы открыть силы')}</span></div>
                    {previewDisciplineNames.length === 0 ? (
                      <p className="character-preview-empty">{t('Дисциплины не сохранены.')}</p>
                    ) : (
                      <div className="preview-discipline-list">
                        {previewDisciplineNames.map(name => {
                          const dots = getDisciplineDots(previewCharacter.disciplines[name] || {})
                          const powerLabels = getSelectedDisciplinePowerLabels(
                            previewCharacter.selectedPowers[name],
                            previewCharacter.selectedPathPowers[name],
                          )
                          return (
                            <button type="button" className="preview-discipline-card" key={name} onClick={() => openPreviewDiscipline(name)}>
                              <span><strong>{name}</strong><i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i></span>
                              {powerLabels.length ? <p>{powerLabels.join(' · ')}</p> : <p>{t('Открыть описание и доступные силы')}</p>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <div className="character-inventory-sheet">
                  <div className="preview-section-heading">
                    <div><span>{t('Снаряжение персонажа')}</span><h3>{t('Инвентарь')}</h3></div>
                    <strong>{previewCharacter.inventory.length}</strong>
                  </div>
                  {canEditPreviewInventory ? (
                    <form className="quick-inventory-form" onSubmit={addQuickInventoryItem}>
                      <label className="quick-inventory-name">
                        <span>{t('Новый предмет')}</span>
                        <input
                          value={quickInventoryName}
                          onChange={event => setQuickInventoryName(event.target.value)}
                          placeholder={t('Название')}
                          maxLength={120}
                        />
                      </label>
                      <label>
                        <span>{t('Категория')}</span>
                        <select value={quickInventoryCategory} onChange={event => setQuickInventoryCategory(event.target.value as (typeof INVENTORY_CATEGORIES)[number])}>
                          {INVENTORY_CATEGORIES.map(category => <option value={category} key={category}>{t(category)}</option>)}
                        </select>
                      </label>
                      <label className="quick-inventory-quantity">
                        <span>{t('Количество')}</span>
                        <input
                          type="number"
                          min="0"
                          max="999"
                          value={quickInventoryQuantity}
                          onChange={event => setQuickInventoryQuantity(Math.max(0, Math.min(999, Number(event.target.value) || 0)))}
                        />
                      </label>
                      <button type="submit" disabled={!quickInventoryName.trim() || isQuickInventoryBusy}>
                        {isQuickInventoryBusy ? t('Сохраняю...') : t('Добавить')}
                      </button>
                    </form>
                  ) : (
                    <p className="quick-inventory-readonly">{t('Добавлять предметы может владелец активного персонажа.')}</p>
                  )}
                  {quickInventoryStatus ? <p className="quick-inventory-status" role="status">{t(quickInventoryStatus)}</p> : null}
                  {previewCharacter.inventory.length === 0 ? (
                    <p className="character-preview-empty">{t('Инвентарь пуст.')}</p>
                  ) : (
                    <div className="preview-inventory-list">
                      {previewCharacter.inventory.map(item => (
                        <article key={item.id}>
                          <header>
                            <div><strong>{item.name || t('Без названия')}</strong><span>{t(item.category) || t('Без категории')}</span></div>
                            <b aria-label={tf('Количество: {quantity}', { quantity: item.quantity ?? 1 })}>×{item.quantity ?? 1}</b>
                          </header>
                          {item.description ? <p>{item.description}</p> : null}
                          {item.note ? <aside><span>{t('Заметка')}</span>{item.note}</aside> : null}
                          {canEditPreviewInventory && !isMaster ? (
                            <footer>
                              <button type="button" onClick={() => showInventoryItemToMaster(item)}>{t('Показать мастеру')}</button>
                            </footer>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <footer className="character-preview-actions">
              {previewCharacter.id && previewCharacter.id === selectedActiveCharacter?.id ? (
                <button type="button" onClick={addExperienceToActiveCharacter}>{t('Добавить опыт')}</button>
              ) : null}
              <a href={getCharacterSheetHref(previewCharacter.id)}>{t('Открыть полный лист')}</a>
              <button type="button" onClick={() => setPreviewCharacter(null)}>{t('Закрыть')}</button>
            </footer>
          </section>
        </div>
      ) : null}

      {previewCharacter && previewDisciplineName ? (
        <div className="discipline-detail-backdrop" role="dialog" aria-modal="true" aria-label={tf('Дисциплина {name}', { name: previewDisciplineName })} onMouseDown={() => setPreviewDisciplineName('')}>
          <section className="discipline-detail-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{tf('Дисциплина · {dots} точек', { dots: previewOpenedDisciplineDots })}</span>
                <strong>{previewDisciplineName}</strong>
              </div>
              <button type="button" onClick={() => setPreviewDisciplineName('')} aria-label={t('Закрыть описание дисциплины')}>×</button>
            </header>

            {disciplineRulesStatus ? (
              <div className="discipline-detail-status">{t(disciplineRulesStatus)}</div>
            ) : !previewDisciplineRule ? (
              <div className="discipline-detail-status">{t('Описание этой дисциплины не найдено в правилах.')}</div>
            ) : (
              <div className="discipline-detail-layout">
                <aside className="discipline-detail-sidebar">
                  <div className="discipline-description">
                    <p>{previewDisciplineRule.description || t('Описание отсутствует.')}</p>
                    {previewDisciplineRule.system ? (
                      <dl>
                        {Object.entries(previewDisciplineRule.system).map(([key, value]) => (
                          <div key={key}>
                            <dt>{key === 'type' ? t('Тип') : key === 'masquerade' ? t('Маскарад') : key === 'resonance' ? t('Резонанс') : key === 'limitations' ? t('Ограничения') : key}</dt>
                            <dd>{formatRuleValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                  <nav className="discipline-power-list" aria-label={t('Силы дисциплины')}>
                    {previewDisciplinePowers.length ? previewDisciplinePowers.map(power => (
                      <button
                        type="button"
                        key={`${power.path || 'direct'}-${power.level}-${power.name}`}
                        className={previewPowerName === getDisciplinePowerEntryKey(power) ? 'active' : ''}
                        onClick={() => setPreviewPowerName(getDisciplinePowerEntryKey(power))}
                      >
                        <span>{power.path ? `${power.path} · ${tf('Уровень {level}', { level: power.level })}` : tf('Уровень {level}', { level: power.level })}</span>
                        <strong>{power.name}</strong>
                      </button>
                    )) : (
                      <p>{t('Для текущего уровня нет выбранных сил.')}</p>
                    )}
                  </nav>
                </aside>

                <main className="discipline-power-detail">
                  {selectedPreviewPower ? (
                    <>
                      <div className="discipline-power-title">
                        <div><span>{selectedPreviewPower.path ? `${selectedPreviewPower.path} · ${tf('Уровень {level}', { level: selectedPreviewPower.level })}` : tf('Уровень {level}', { level: selectedPreviewPower.level })}</span><h3>{selectedPreviewPower.name}</h3></div>
                        <i>{getDotDisplay(selectedPreviewPower.level)}</i>
                      </div>
                      <p className="discipline-power-description">{selectedPreviewPower.rule.description || t('Описание отсутствует.')}</p>
                      <dl className="discipline-power-facts">
                        <div><dt>{t('Бросок')}</dt><dd>{selectedPreviewPowerRollSummary || '—'}</dd></div>
                        <div><dt>{t('Сложность')}</dt><dd>{selectedPreviewPowerDifficultySummary || '—'}</dd></div>
                        <div><dt>{t('Стоимость')}</dt><dd>{selectedPreviewPowerCostLabel}</dd></div>
                        {selectedPreviewPowerCost.willpowerSpend || selectedPreviewPowerCost.willpowerRatingReduction || selectedPreviewPowerCost.manualWillpower ? (
                          <div>
                            <dt>{t('Воля')}</dt>
                            <dd>
                              {selectedPreviewPowerCost.willpowerRatingReduction
                                ? tf('проверь снижение рейтинга: {rating}', { rating: selectedPreviewPowerCost.willpowerRatingReduction })
                                : selectedPreviewPowerCost.manualWillpower
                                  ? t('добровольная трата')
                                  : tf('{n} пункт', { n: selectedPreviewPowerCost.willpowerSpend })}
                            </dd>
                          </div>
                        ) : null}
                        <div><dt>{t('Длительность')}</dt><dd>{selectedPreviewPower.rule.duration || '—'}</dd></div>
                      </dl>
                      {selectedPreviewPower.rule.effect ? (
                        <section className="discipline-power-effect">
                          <h4>{t('Эффект')}</h4>
                          <p>{selectedPreviewPower.rule.effect}</p>
                        </section>
                      ) : null}
                      {selectedPreviewPowerManualPrompts.length ? (
                        <section className="discipline-power-effect">
                          <h4>{t('Подсказка')}</h4>
                          {selectedPreviewPowerManualPrompts.map((prompt, index) => (
                            <p key={`${prompt.label || 'manual-prompt'}-${index}`}>
                              {prompt.label ? <strong>{t(prompt.label)}. </strong> : null}
                              {t(prompt.description || prompt.message)}
                            </p>
                          ))}
                        </section>
                      ) : null}
                      {selectedPreviewPowerInputFields.length ? (
                        <section className="discipline-power-inputs">
                          <h4>{t('Данные для эффекта')}</h4>
                          {selectedPreviewPowerInputFields.map(field => (
                            <label key={field.id}>
                              <span>
                                {field.label ? t(field.label) : field.id}
                                {field.required ? ' *' : ''}
                              </span>
                              {field.type === 'select' ? (
                                <select
                                  value={previewPowerInputValues[field.id] || ''}
                                  onChange={event => setPreviewPowerInputValues(current => ({
                                    ...current,
                                    [field.id]: event.target.value,
                                  }))}
                                >
                                  <option value="">{field.placeholder ? t(field.placeholder) : t('Выбери значение')}</option>
                                  {(field.options || []).map(option => (
                                    <option key={option.value} value={option.value}>
                                      {t(option.label)}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === 'textarea' ? (
                                <textarea
                                  value={previewPowerInputValues[field.id] || ''}
                                  placeholder={field.placeholder ? t(field.placeholder) : undefined}
                                  onChange={event => setPreviewPowerInputValues(current => ({
                                    ...current,
                                    [field.id]: event.target.value,
                                  }))}
                                />
                              ) : (
                                <input
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  value={previewPowerInputValues[field.id] || ''}
                                  placeholder={field.placeholder ? t(field.placeholder) : undefined}
                                  onChange={event => setPreviewPowerInputValues(current => ({
                                    ...current,
                                    [field.id]: event.target.value,
                                  }))}
                                />
                              )}
                              {field.description ? <em>{t(field.description)}</em> : null}
                            </label>
                          ))}
                          {hasMissingPreviewPowerInput ? (
                            <p>{t('Заполни обязательные поля перед активацией силы.')}</p>
                          ) : null}
                        </section>
                      ) : null}

                      <section className="discipline-power-roll">
                        <div className="preview-section-heading">
                          <div><span>{t('По формуле силы')}</span><h3>{t('Бросок')}</h3></div>
                          <strong>{d10(previewPowerDiceCount)}</strong>
                        </div>
                        {previewPowerPoolChoices.length ? (
                          <>
                            <div className="discipline-power-roll-controls">
                              {previewPowerPoolChoices.map((choice, index) => (
                                <label key={`${choice.source}-${index}`}>
                                  <span>{tf('Часть пула {n}', { n: index + 1 })}</span>
                                  <select
                                    value={previewPowerPoolSelections[index] || ''}
                                    onChange={event => setPreviewPowerPoolSelections(current => current.map((value, currentIndex) => currentIndex === index ? event.target.value : value))}
                                  >
                                    {choice.options.map(option => (
                                      <option key={option} value={option}>{option} · {getCharacterPoolPartDots(previewCharacter, option)}</option>
                                    ))}
                                  </select>
                                </label>
                              ))}
                              <label>
                                <span>{t('Модификатор')}</span>
                                <input
                                  type="number"
                                  min="-20"
                                  max="20"
                                  value={previewPowerModifier}
                                  onChange={event => setPreviewPowerModifier(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={selectedPreviewPowerIsActive
                                  ? deactivatePreviewDisciplinePower
                                  : rollPreviewPower}
                                disabled={!canRollPreview || (
                                  !selectedPreviewPowerIsActive
                                  && previewPowerDiceCount < 1
                                ) || (!selectedPreviewPowerIsActive && hasMissingPreviewPowerInput)}
                              >
                                {selectedPreviewPowerIsActive
                                  ? t('Отключить')
                                  : selectedPreviewPowerIsActiveKind
                                    ? t('Активировать')
                                    : tf('Бросить {count}к10', { count: previewPowerDiceCount })}
                              </button>
                            </div>
                            {renderRollModifierControls(previewPowerRollEffectResult, setDisabledPreviewPowerModifierIds)}
                            {previewPowerOpposition ? <p className="discipline-roll-opposition">{tf('Сопротивление цели: {value}', { value: previewPowerOpposition })}</p> : null}
                            {selectedPreviewPowerRollFormula !== resolvedPreviewPowerPool ? <p className="discipline-roll-opposition">{tf('Используется формула силы «{formula}».', { formula: selectedPreviewPowerRollFormula.replace(/^как\s+/i, '') })}</p> : null}
                            {getActivePenaltyDelta(previewPowerRollEffectResult, 'willpower_impairment') ? <p className="discipline-roll-opposition">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                            {getActivePenaltyDelta(previewPowerRollEffectResult, 'health_impairment') ? <p className="discipline-roll-opposition">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
                            {selectedPreviewPowerCost.warnings.map((warning, index) => <p className="discipline-roll-opposition" key={`wp-cost-warning-${index}`}>{t(warning)}</p>)}
                          </>
                        ) : (
                          selectedPreviewPowerIsActiveKind
                          || selectedPreviewPowerCost.rouseChecks > 0
                          || (selectedPreviewPowerCost.willpowerSpend > 0 && !selectedPreviewPowerCost.manualWillpower) ? (
                            <div className="discipline-activation-only">
                              <button
                                type="button"
                                onClick={selectedPreviewPowerIsActive
                                  ? deactivatePreviewDisciplinePower
                                  : rollPreviewPower}
                                disabled={!canRollPreview || (!selectedPreviewPowerIsActive && hasMissingPreviewPowerInput)}
                              >
                                {selectedPreviewPowerIsActive
                                  ? t('Отключить')
                                  : t('Активировать')}
                              </button>
                              <p className="discipline-no-roll">
                                {selectedPreviewPowerIsActive
                                  ? t('Сила активна и сохранена в эффектах персонажа.')
                                  : tf('У силы нет автоматического пула, но есть цена: {cost}.', { cost: selectedPreviewPowerCostLabel })}
                              </p>
                            </div>
                          ) : (
                            <p className="discipline-no-roll">{t('Для этой силы отдельный автоматический бросок не требуется или его пул зависит от ситуации. При необходимости используй конструктор броска в кратком листе.')}</p>
                          )
                        )}
                        {!canRollPreview ? <p className="discipline-roll-opposition">{t('Бросать может мастер или владелец активного персонажа.')}</p> : null}
                      </section>
                    </>
                  ) : (
                    <div className="discipline-detail-status">{t('Выбери силу слева.')}</div>
                  )}
                </main>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {previewLayer ? (
        <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label={t('Предпросмотр медиа')} onMouseDown={() => setPreviewLayerId(null)}>
          <section className="media-preview-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{previewLayer.ownerRole === 'master' ? t('Мастер') : t('Игрок')}</span>
                <strong>{previewLayer.name}</strong>
              </div>
              <button type="button" onClick={() => setPreviewLayerId(null)} aria-label={t('Закрыть предпросмотр')}>×</button>
            </header>
            <div className="media-preview-body">
              {previewLayer.layerType === 'image' ? (
                <img src={previewLayer.imageData} alt={previewLayer.name} />
              ) : previewLayer.layerType === 'video' ? (
                getEmbeddableVideoUrl(previewLayer.imageData) ? (
                  <iframe
                    src={getEmbeddableVideoUrl(previewLayer.imageData)}
                    title={previewLayer.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video src={previewLayer.imageData} controls playsInline />
                )
              ) : previewLayer.layerType === 'text' ? (
                <article className="preview-text-material" dangerouslySetInnerHTML={{ __html: previewLayer.imageData }} />
              ) : previewLayer.layerType === 'file' ? (() => {
                const meta = getFileLayerMeta(previewLayer.imageData, previewLayer.name)
                const embedUrl = getDocumentEmbedUrl(meta)
                return embedUrl ? (
                  <iframe src={embedUrl} title={previewLayer.name} />
                ) : (
                  <article className="preview-file-card">
                    <strong>{previewLayer.name}</strong>
                    <span>{meta.type}</span>
                    <a href={meta.url} target="_blank" rel="noreferrer">{t('Открыть файл')}</a>
                  </article>
                )
              })() : null}
            </div>
          </section>
        </div>
      ) : null}

      {layerContextMenu ? (() => {
        const layer = layers.find(item => item.id === layerContextMenu.layerId)
        const ids = getContextLayerIds(layerContextMenu.layerId)
        const contextLayers = ids
          .map(id => layers.find(item => item.id === id))
          .filter((item): item is TableLayer => Boolean(item))
        if (contextLayers.length === 0) return null
        const firstLayer = layer || contextLayers[0]
        const allVisible = contextLayers.every(item => item.visible)
        const allLocked = contextLayers.every(item => item.locked)
        const singleLayer = contextLayers.length === 1 ? contextLayers[0] : null
        const canManageContext = contextLayers.every(item => canEditLayer(item))
        const movableIds = canManageContext ? ids.filter(id => layers.find(item => item.id === id)?.layerType !== 'folder') : []
        const folderScope = firstLayer.onTable ? tableManagerLayers : libraryLayers
        const availableFolders = canManageContext ? folderScope.filter(item => item.layerType === 'folder' && !ids.includes(item.id)) : []
        if (!canManageContext && (!singleLayer || singleLayer.layerType === 'folder')) return null
        return (
          <SmartContextMenu
            x={layerContextMenu.x}
            y={layerContextMenu.y}
            onClick={event => event.stopPropagation()}
          >
            {singleLayer && singleLayer.layerType !== 'folder' ? (
              <>
                {/* Add to journal — available to all players for any visible layer */}
                {chatUser && !isMaster && singleLayer.layerType === 'image' ? (
                  <button
                    type="button"
                    style={{ fontWeight: 600, color: '#ffd89a', borderColor: 'rgba(214,170,101,0.5)' }}
                    onClick={() => addLayerToJournal(singleLayer.imageData, singleLayer.name)}
                  >
                    📖 {t('Добавить в дневник')}
                  </button>
                ) : null}
                <div className="context-menu-group">
                  <span>{t('Копировать')}</span>
                  <button type="button" onClick={() => copyLayerForDiary(singleLayer)}>{t('Для дневника')}</button>
                  <button type="button" onClick={() => copyLayerUrl(singleLayer)}>{t('Ссылку')}</button>
                  <button type="button" onClick={() => copyLayerToPersonalMedia(singleLayer)}>{t('В мои медиа')}</button>
                </div>
              </>
            ) : null}
            {canManageContext ? (
              <>
                {singleLayer ? <button type="button" onClick={() => renameLayer(singleLayer)}>{t('Переименовать')}</button> : null}
                {singleLayer && ['image', 'video'].includes(singleLayer.layerType) ? (
                  <div className="context-menu-group">
                    <span>{t('Изображение')}</span>
                    <button type="button" onClick={() => openImageEditor(singleLayer)}>{t('Обрезать')}</button>
                    <button type="button" onClick={() => patchLayer(singleLayer.id, { rotation: (singleLayer.rotation + 90) % 360 })}>{t('Повернуть')}</button>
                    <button type="button" onClick={() => duplicateLayer(singleLayer)}>{t('Дублировать')}</button>
                  </div>
                ) : null}
                {singleLayer && getLayerCrop(singleLayer).cropped ? (
                  <button type="button" onClick={() => resetLayerCrop(singleLayer)}>{t('Восстановить обрезанное')}</button>
                ) : null}
                <button type="button" onClick={() => {
                  patchSelectedLayers(ids, () => ({ visible: !allVisible }))
                  setLayerContextMenu(null)
                }}>
                  {allVisible ? t('Скрыть') : t('Показать')}
                </button>
                <button type="button" onClick={() => {
                  patchSelectedLayers(ids, () => ({ locked: !allLocked }))
                  setLayerContextMenu(null)
                }}>
                  {allLocked ? t('Разблокировать') : t('Заблокировать')}
                </button>
                {singleLayer && singleLayer.layerType !== 'folder' ? (
                  <div className="context-menu-group context-menu-controls">
                    <span>{t('Слой')}</span>
                    <label>
                      <small>Opacity</small>
                      <input
                        key={`${singleLayer.id}:${singleLayer.opacity}`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        defaultValue={singleLayer.opacity}
                        data-committed-value={singleLayer.opacity}
                        onInput={event => previewLayerOpacity(singleLayer.id, Number(event.currentTarget.value))}
                        onPointerUp={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                        onPointerCancel={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                        onKeyUp={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                        onBlur={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                      />
                    </label>
                    <label>
                      <small>Blend</small>
                      <select
                        value={singleLayer.blendMode}
                        onChange={event => patchLayer(singleLayer.id, { blendMode: event.target.value as BlendMode })}
                      >
                        {(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'luminosity'] as BlendMode[]).map(mode => (
                          <option value={mode} key={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                <div className="context-menu-group">
                  <span>{t('Порядок слоя')}</span>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'top')
                    setLayerContextMenu(null)
                  }}>{t('На самый верх')}</button>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'up')
                    setLayerContextMenu(null)
                  }}>{t('Выше')}</button>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'down')
                    setLayerContextMenu(null)
                  }}>{t('Ниже')}</button>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'bottom')
                    setLayerContextMenu(null)
                  }}>{t('На самый низ')}</button>
                </div>
                {singleLayer?.layerType === 'folder' ? (
                  <button type="button" onClick={() => {
                    createNamedFolder(singleLayer.id, singleLayer.onTable)
                    setLayerContextMenu(null)
                  }}>{t('Новая папка внутри')}</button>
                ) : null}
                {contextLayers.some(item => item.parentId) ? (
                  <button type="button" onClick={() => {
                    patchSelectedLayers(ids, () => ({ parentId: null }))
                    setLayerContextMenu(null)
                  }}>{t('Вынести из папки')}</button>
                ) : null}
                {contextLayers.some(item => item.onTable) ? (
                  <button type="button" onClick={() => {
                    patchSelectedLayers(ids, () => ({ onTable: false, parentId: null }))
                    setLayerContextMenu(null)
                  }}>{t('Убрать в медиа сцены')}</button>
                ) : null}
                {contextLayers.some(item => !item.onTable) ? (
                  <button type="button" onClick={() => {
                    patchSelectedLayers(ids, () => ({ onTable: true, visible: true, parentId: null }))
                    setLayerContextMenu(null)
                  }}>{t('Вынести на стол')}</button>
                ) : null}
                {movableIds.length > 0 ? (
                  <div className="context-menu-group">
                    <span>{t('Поместить в папку')}</span>
                    {availableFolders.map(folder => (
                      <button type="button" key={folder.id} onClick={() => {
                        moveLayersToFolder(movableIds, folder.id)
                        setLayerContextMenu(null)
                      }}>{folder.name}</button>
                    ))}
                    <button type="button" onClick={() => {
                      createFolderForSelection(movableIds)
                      setLayerContextMenu(null)
                    }}>{t('Создать новую папку')}</button>
                  </div>
                ) : null}
                <button type="button" onClick={() => {
                  focusLayersForEveryone(ids.length > 0 ? ids : [firstLayer.id])
                  setLayerContextMenu(null)
                }}>{t('Указать всем')}</button>
                <button type="button" className="danger" onClick={() => {
                  deleteSelectedLayers(ids)
                  setLayerContextMenu(null)
                }}>{t('Удалить')}</button>
              </>
            ) : null}
          </SmartContextMenu>
        )
      })() : null}

      {!tableRole ? (
        <div className="role-gate" role="dialog" aria-modal="true" aria-label={t('Выбор роли')}>
          <section>
            <span>{t('Вход на стол')}</span>
            <h2>{t('Кто ты в этой сцене?')}</h2>
            <form className="master-login-form" onSubmit={enterAsMaster}>
              <input
                value={masterPasswordDraft}
                onChange={event => setMasterPasswordDraft(event.target.value)}
                placeholder={t('Пароль мастера')}
                type="password"
              />
              <button type="submit">{t('Мастер')}</button>
            </form>
            <div>
              <button type="button" onClick={() => chooseTableRole('player')}>
                {t('Игрок')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {diceOverlayQueue[0] ? (
        <DiceRollOverlay
          key={diceOverlayQueue[0].id}
          roll={diceOverlayQueue[0]}
          onDone={() => setDiceOverlayQueue(prev => prev.slice(1))}
        />
      ) : null}

      <GameTableStyles />
    </main>
  )
}
