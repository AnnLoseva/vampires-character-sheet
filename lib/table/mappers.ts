import type { CharacterOption, CharacterRow, CharacterType, ChatMessage, ChatMessageRow, Die, HealthMetaState, InventoryItem, LayerPatch, NormalizedWillpower, OpposedRollResult, RollMessage, RollMeta, RollRow, RouseCheckResult, SceneMusicRow, SceneMusicTrack, TableLayer, TableLayerRow, TableScene, TableSceneRow, VitalTrackers, WillpowerMetaState, WillpowerTracker } from './types'
import { getMusicProvider } from '@/components/music/utils'
import { normalizeDamageProfile, normalizeHealthTracker, toHealthTracker } from '@/lib/vtm/health'
import { getHumanityState, getHumanityStatus, normalizeMoralityState } from '@/lib/vtm/humanity'
import type { HumanityStainEvent } from '@/lib/vtm/humanity'
import { getAttributeDots } from '@/lib/i18n/ruleNames'
import { normalizeCharacterDisciplines } from '@/lib/vtm/disciplines/character-disciplines'
import { getDerivedStats } from '@/lib/vtm/derived-stats'
import { getActiveEffects } from '@/lib/vtm/disciplines/active-effects'
import defaultRules from '@/public/rules.json'

const DIE_KINDS = new Set<Die['kind']>([
  'fail',
  'success',
  'critical',
  'botch',
  'hunger-fail',
  'hunger-success',
  'hunger-critical-success',
  'hunger-critical-fail',
])

function isDie(value: unknown): value is Die {
  if (!value || typeof value !== 'object') return false
  const die = value as Partial<Die>
  return typeof die.value === 'number'
    && Boolean(die.kind && DIE_KINDS.has(die.kind))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function clampInteger(value: unknown, min: number, max: number) {
  const number = Math.floor(Number(value) || 0)
  return Math.max(min, Math.min(max, number))
}

export function getWillpowerMaxFromAttributes(attributes: Record<string, unknown> = {}) {
  const composure = getAttributeDots(attributes, 'Самообладание')
  const resolve = getAttributeDots(attributes, 'Упорство')
  return Math.max(0, Math.floor(composure + resolve))
}

function isWillpowerTracker(value: unknown): value is WillpowerTracker {
  return isRecord(value) && (typeof value.superficial === 'number' || typeof value.aggravated === 'number')
}

export function normalizeWillpowerTracker(value: unknown, max: number): NormalizedWillpower {
  const safeMax = Math.max(0, Math.floor(Number(max) || 0))
  if (typeof value === 'number') {
    const current = clampInteger(value, 0, safeMax)
    return {
      superficial: safeMax - current,
      aggravated: 0,
      max: safeMax,
      current,
      impaired: safeMax > 0 && current <= 0,
    }
  }

  if (isWillpowerTracker(value)) {
    const aggravated = clampInteger(value.aggravated, 0, safeMax)
    const superficial = clampInteger(value.superficial, 0, Math.max(0, safeMax - aggravated))
    const current = Math.max(0, safeMax - superficial - aggravated)
    return {
      superficial,
      aggravated,
      max: safeMax,
      current,
      impaired: safeMax > 0 && current <= 0,
    }
  }

  return {
    superficial: 0,
    aggravated: 0,
    max: safeMax,
    current: safeMax,
    impaired: false,
  }
}

function normalizeVitalTrackers(
  value: unknown,
  willpowerMax: number,
  health: ReturnType<typeof normalizeHealthTracker>,
  humanityValue: number,
): VitalTrackers {
  const source = isRecord(value) ? value : {}
  const willpower = normalizeWillpowerTracker(source.willpower, willpowerMax)
  return {
    health: toHealthTracker(health),
    willpower: {
      superficial: willpower.superficial,
      aggravated: willpower.aggravated,
    },
    humanity: humanityValue,
    hunger: Math.max(0, Math.min(5, Number(source.hunger || 0) || 0)),
  }
}

function normalizeHealthMetaState(value: unknown): HealthMetaState | undefined {
  if (!isRecord(value)) return undefined
  const max = Math.max(0, Math.floor(Number(value.max) || 0))
  const aggravated = clampInteger(value.aggravated, 0, max)
  const superficial = clampInteger(value.superficial, 0, Math.max(0, max - aggravated))
  const current = clampInteger(value.current ?? max - superficial - aggravated, 0, max)
  const physicalState = typeof value.physicalState === 'string'
    ? value.physicalState as HealthMetaState['physicalState']
    : undefined
  return { max, superficial, aggravated, current, impaired: Boolean(value.impaired), physicalState }
}

function normalizeWillpowerMetaState(value: unknown): WillpowerMetaState | undefined {
  if (!isRecord(value)) return undefined
  const max = Math.max(0, Math.floor(Number(value.max) || 0))
  const aggravated = clampInteger(value.aggravated, 0, max)
  const superficial = clampInteger(value.superficial, 0, Math.max(0, max - aggravated))
  const fallbackCurrent = max - superficial - aggravated
  const current = clampInteger(value.current ?? fallbackCurrent, 0, max)
  return { max, superficial, aggravated, current }
}

function isOpposedRollResult(value: unknown): value is OpposedRollResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<OpposedRollResult>
  return Array.isArray(result.sides)
    && result.sides.length === 2
    && (result.outcome === 'left' || result.outcome === 'right' || result.outcome === 'tie')
}

function isRouseCheckResult(value: unknown): value is RouseCheckResult {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.reason === 'string'
    && typeof value.value === 'number'
    && typeof value.success === 'boolean'
    && typeof value.hungerBefore === 'number'
    && typeof value.hungerAfter === 'number'
}

function normalizeRollMeta(value: unknown): RollMeta | undefined {
  if (!isRecord(value)) return undefined
  const meta: RollMeta = {}

  if (typeof value.characterId === 'string') meta.characterId = value.characterId
  if (value.rollKind === 'humanity_check' || value.rollKind === 'remorse_check') meta.rollKind = value.rollKind
  if (value.rollMode === 'normal' || value.rollMode === 'contested') meta.rollMode = value.rollMode
  if (typeof value.hungerBefore === 'number') meta.hungerBefore = value.hungerBefore
  if (typeof value.hungerAfter === 'number') meta.hungerAfter = value.hungerAfter
  if (typeof value.hungerDice === 'number') meta.hungerDice = value.hungerDice
  if (typeof value.bloodPotency === 'number') meta.bloodPotency = value.bloodPotency
  if (typeof value.spentWillpower === 'number') meta.spentWillpower = value.spentWillpower
  if (typeof value.recoveredWillpower === 'number') meta.recoveredWillpower = value.recoveredWillpower
  if (typeof value.willpowerImpaired === 'boolean') meta.willpowerImpaired = value.willpowerImpaired
  if (typeof value.impairmentPenaltyApplied === 'number') meta.impairmentPenaltyApplied = value.impairmentPenaltyApplied
  if (typeof value.healthImpaired === 'boolean') meta.healthImpaired = value.healthImpaired
  if (typeof value.healthImpairmentPenaltyApplied === 'number') meta.healthImpairmentPenaltyApplied = value.healthImpairmentPenaltyApplied
  if (typeof value.physicalState === 'string') meta.physicalState = value.physicalState as RollMeta['physicalState']
  if (typeof value.humanityBefore === 'number') meta.humanityBefore = value.humanityBefore
  if (typeof value.humanityAfter === 'number') meta.humanityAfter = value.humanityAfter
  if (typeof value.stainsBefore === 'number') meta.stainsBefore = value.stainsBefore
  if (typeof value.stainsAfter === 'number') meta.stainsAfter = value.stainsAfter
  if (typeof value.remorseDice === 'number') meta.remorseDice = value.remorseDice
  if (typeof value.automaticFailure === 'boolean') meta.automaticFailure = value.automaticFailure
  if (typeof value.humanityLost === 'boolean') meta.humanityLost = value.humanityLost
  if (typeof value.messyCritical === 'boolean') meta.messyCritical = value.messyCritical
  if (typeof value.bestialFailure === 'boolean') meta.bestialFailure = value.bestialFailure
  if (typeof value.source === 'string') meta.source = value.source as RollMeta['source']
  if (Array.isArray(value.warnings)) meta.warnings = value.warnings.filter((warning): warning is string => typeof warning === 'string')
  if (Array.isArray(value.rouseChecks)) meta.rouseChecks = value.rouseChecks.filter(isRouseCheckResult)
  if (Array.isArray(value.stainEvents)) {
    meta.stainEvents = value.stainEvents.flatMap((item, index) => {
      if (!isRecord(item)) return []
      return [{
        id: typeof item.id === 'string' ? item.id : `stain-${index}`,
        amount: Math.max(0, Math.floor(Number(item.amount) || 0)),
        requestedAmount: typeof item.requestedAmount === 'number' ? item.requestedAmount : undefined,
        source: typeof item.source === 'string' ? item.source as HumanityStainEvent['source'] : 'manual',
        reason: typeof item.reason === 'string' ? item.reason : 'Сомнение',
        reasonText: typeof item.reasonText === 'string' ? item.reasonText : undefined,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date(0).toISOString(),
        mitigatedByConviction: typeof item.mitigatedByConviction === 'boolean' ? item.mitigatedByConviction : undefined,
        relatedConvictionId: typeof item.relatedConvictionId === 'string' ? item.relatedConvictionId : undefined,
        relatedTouchstoneId: typeof item.relatedTouchstoneId === 'string' ? item.relatedTouchstoneId : undefined,
      }]
    })
  }

  if (isRecord(value.contested)) {
    const status = ['requested', 'answered', 'resolved', 'cancelled'].includes(String(value.contested.status))
      ? value.contested.status as NonNullable<RollMeta['contested']>['status']
      : undefined
    const winner = ['initiator', 'opponent', 'tie'].includes(String(value.contested.winner))
      ? value.contested.winner as NonNullable<RollMeta['contested']>['winner']
      : undefined
    meta.contested = {
      requestId: typeof value.contested.requestId === 'string' ? value.contested.requestId : undefined,
      initiatorCharacterId: typeof value.contested.initiatorCharacterId === 'string' ? value.contested.initiatorCharacterId : undefined,
      initiatorCharacterName: typeof value.contested.initiatorCharacterName === 'string' ? value.contested.initiatorCharacterName : undefined,
      initiatorPoolName: typeof value.contested.initiatorPoolName === 'string' ? value.contested.initiatorPoolName : undefined,
      initiatorDiceCount: typeof value.contested.initiatorDiceCount === 'number' ? value.contested.initiatorDiceCount : undefined,
      opponentUserId: typeof value.contested.opponentUserId === 'string' ? value.contested.opponentUserId : undefined,
      opponentCharacterId: typeof value.contested.opponentCharacterId === 'string' ? value.contested.opponentCharacterId : undefined,
      opponentName: typeof value.contested.opponentName === 'string' ? value.contested.opponentName : undefined,
      status,
      initiatorSuccesses: typeof value.contested.initiatorSuccesses === 'number' ? value.contested.initiatorSuccesses : undefined,
      opponentSuccesses: typeof value.contested.opponentSuccesses === 'number' ? value.contested.opponentSuccesses : undefined,
      margin: typeof value.contested.margin === 'number' ? value.contested.margin : undefined,
      winner,
    }
  }

  const willpowerBefore = normalizeWillpowerMetaState(value.willpowerBefore)
  const willpowerAfter = normalizeWillpowerMetaState(value.willpowerAfter)
  if (willpowerBefore) meta.willpowerBefore = willpowerBefore
  if (willpowerAfter) meta.willpowerAfter = willpowerAfter
  const healthBefore = normalizeHealthMetaState(value.healthBefore)
  const healthAfter = normalizeHealthMetaState(value.healthAfter)
  if (healthBefore) meta.healthBefore = healthBefore
  if (healthAfter) meta.healthAfter = healthAfter

  if (isRecord(value.damage)) {
    meta.damage = {
      source: String(value.damage.source || 'manual'),
      originalAmount: Math.max(0, Number(value.damage.originalAmount) || 0),
      finalAmount: Math.max(0, Number(value.damage.finalAmount) || 0),
      severity: value.damage.severity === 'aggravated' ? 'aggravated' : 'superficial',
      halved: Boolean(value.damage.halved),
      weaponModifier: typeof value.damage.weaponModifier === 'number' ? value.damage.weaponModifier : undefined,
      margin: typeof value.damage.margin === 'number' ? value.damage.margin : undefined,
      targetCharacterId: typeof value.damage.targetCharacterId === 'string' ? value.damage.targetCharacterId : undefined,
      targetCharacterName: typeof value.damage.targetCharacterName === 'string' ? value.damage.targetCharacterName : undefined,
    }
  }

  if (isRecord(value.healing)) {
    meta.healing = {
      type: String(value.healing.type || 'manual') as NonNullable<RollMeta['healing']>['type'],
      amountSuperficial: typeof value.healing.amountSuperficial === 'number' ? value.healing.amountSuperficial : undefined,
      amountAggravated: typeof value.healing.amountAggravated === 'number' ? value.healing.amountAggravated : undefined,
      rouseChecks: Array.isArray(value.healing.rouseChecks) ? value.healing.rouseChecks.filter(isRouseCheckResult) : undefined,
    }
  }

  if (isRecord(value.willpowerReroll)) {
    meta.willpowerReroll = {
      used: Boolean(value.willpowerReroll.used),
      selectedDieIds: Array.isArray(value.willpowerReroll.selectedDieIds)
        ? value.willpowerReroll.selectedDieIds.filter((id): id is string => typeof id === 'string')
        : [],
      oldDice: Array.isArray(value.willpowerReroll.oldDice) ? value.willpowerReroll.oldDice.filter(isDie) : [],
      newDice: Array.isArray(value.willpowerReroll.newDice) ? value.willpowerReroll.newDice.filter(isDie) : [],
    }
  }

  if (isRecord(value.bloodSurge)) {
    meta.bloodSurge = {
      enabled: Boolean(value.bloodSurge.enabled),
      bonusDice: Math.max(0, Number(value.bloodSurge.bonusDice) || 0),
    }
  }

  if (isRecord(value.discipline)) {
    meta.discipline = {
      name: String(value.discipline.name || ''),
      power: String(value.discipline.power || ''),
      level: Number(value.discipline.level) || 0,
      cost: String(value.discipline.cost || ''),
    }
  }

  return Object.keys(meta).length ? meta : undefined
}

export function mapRollRow(row: RollRow): RollMessage {
  const dicePayload = row.dice
  const dice = Array.isArray(dicePayload) ? dicePayload.filter(isDie) : []
  const opposed = isOpposedRollResult(dicePayload) ? dicePayload : undefined
  const meta = normalizeRollMeta(row.meta)
  return {
    id: row.id,
    room: row.room,
    characterName: row.character_name,
    poolName: row.pool_name,
    poolType: row.pool_type,
    diceCount: row.dice_count,
    dice,
    successes: row.successes,
    createdAt: row.created_at,
    opposed,
    meta,
  }
}

export function mapChatRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    room: row.room,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    characterImage: row.character_image || '',
    message: row.message,
    createdAt: row.created_at,
  }
}

export function normalizeInventory(items: unknown): InventoryItem[] {
  if (!Array.isArray(items)) return []
  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<InventoryItem> : {}
    const now = new Date().toISOString()
    return {
      id: source.id || `inventory-${index}`,
      name: source.name || '',
      description: source.description || '',
      quantity: Math.max(0, Number(source.quantity ?? 1) || 0),
      category: source.category || 'Другое',
      note: source.note || '',
      createdAt: source.createdAt || now,
      updatedAt: source.updatedAt || source.createdAt || now,
      collapsed: source.collapsed,
    }
  })
}

export function getCharacterType(data?: CharacterRow['data']): CharacterType {
  const value = data?.characterType || data?.creatureType || data?.kind
  if (value === 'mortal' || value === 'ghoul' || value === 'thinblood') return value
  return 'vampire'
}

export function getDefaultDamageProfile(characterType: CharacterType): NonNullable<CharacterOption['damageProfile']> {
  if (characterType === 'mortal' || characterType === 'ghoul') return 'mortal'
  if (characterType === 'thinblood') return 'thinblood'
  return 'vampire'
}

export function mapCharacterRowToOption(
  row: CharacterRow,
  rules: unknown = defaultRules,
): CharacterOption {
  const data = row.data || {}
  const normalizedDisciplines = normalizeCharacterDisciplines(data)
  const derivedStats = getDerivedStats(data, rules)
  const characterType = getCharacterType(data)
  const bloodPotency = Number(data.bloodPotency ?? data.blood?.potency ?? 0) || 0
  const humanityState = getHumanityState(data)
  const moralitySource = normalizeMoralityState(data.morality)
  const legacyTouchstones = moralitySource.touchstones.length
    ? moralitySource.touchstones
    : (data.touchstones || []).flatMap((item, index) => {
      const name = typeof item === 'string' ? item : String(item?.name || item?.text || '')
      return name.trim() ? [{ id: `legacy-touchstone-${index}`, name: name.trim(), status: 'safe' as const }] : []
    })
  const morality = { ...moralitySource, touchstones: legacyTouchstones }
  const damageProfile = normalizeDamageProfile(data.damageProfile || getDefaultDamageProfile(characterType))
  const rawHealthTracker = data.vitalTrackers?.health
  const healthTracker = typeof rawHealthTracker === 'number'
    ? rawHealthTracker + derivedStats.health.passiveBonus
    : rawHealthTracker
  const health = normalizeHealthTracker(
    healthTracker,
    getAttributeDots(data.attributes, 'Выносливость')
      + derivedStats.health.passiveBonus,
    damageProfile,
  )
  const rawWillpowerTracker = data.vitalTrackers?.willpower
  const willpowerTracker = typeof rawWillpowerTracker === 'number'
    ? rawWillpowerTracker + derivedStats.willpower.passiveBonus
    : rawWillpowerTracker
  const willpower = normalizeWillpowerTracker(
    willpowerTracker,
    derivedStats.willpower.totalMax,
  )
  return {
    id: row.id,
    userId: row.user_id || undefined,
    username: row.users?.username || undefined,
    name: row.name,
    clan: row.clan,
    image: data.characterImage || data.image || data.portrait || '',
    concept: data.concept || '',
    predator: data.predator || '',
    generation: data.generation || '',
    type: data.type || '',
    characterType,
    bloodPotency,
    humanity: {
      ...humanityState,
      freeBoxes: Math.max(0, 10 - humanityState.value - humanityState.stains),
      status: data.status?.humanityState === 'lost_to_beast' ? 'lost_to_beast' : getHumanityStatus(humanityState),
    },
    morality,
    health,
    notes: data.notes || data.backstory || '',
    appearance: data.appearance || '',
    backstory: data.backstory || '',
    freeExp: Number(data.freeExp ?? data.experience ?? 0) || 0,
    willpower,
    damageProfile,
    physicalState: data.status?.physicalState || health.physicalState,
    lastAggravatedMendAt: data.healthState?.lastAggravatedMendAt,
    sheetFixed: data.sheetFixed ?? data.sheetLock?.fixed ?? data.creationCompleted ?? true,
    vitalTrackers: normalizeVitalTrackers(data.vitalTrackers, willpower.max, health, humanityState.value),
    inventory: normalizeInventory(data.inventory),
    attributes: data.attributes || {},
    skills: data.skills || {},
    disciplines: normalizedDisciplines.disciplines,
    selectedPowers: normalizedDisciplines.powers,
    derivedStats,
    activeEffects: getActiveEffects(data),
  }
}

export const mapCharacterRow = mapCharacterRowToOption

export function mapLayerRow(row: TableLayerRow): TableLayer {
  return {
    id: row.id,
    room: row.room,
    sceneId: row.scene_id ?? null,
    layerType: row.layer_type ?? 'image',
    ownerRole: row.owner_role ?? 'player',
    ownerId: row.owner_id ?? null,
    parentId: row.parent_id ?? null,
    name: row.name,
    imageData: row.image_data,
    x: row.x ?? 80,
    y: row.y ?? 80,
    width: row.width ?? 420,
    height: row.height ?? 280,
    cropX: row.crop_x ?? null,
    cropY: row.crop_y ?? null,
    cropWidth: row.crop_width ?? null,
    cropHeight: row.crop_height ?? null,
    zIndex: row.z_index ?? 1,
    visible: row.visible ?? true,
    locked: row.locked ?? false,
    opacity: row.opacity ?? 1,
    blendMode: row.blend_mode ?? 'normal',
    rotation: row.rotation ?? 0,
    flipX: row.flip_x ?? false,
    flipY: row.flip_y ?? false,
    brightness: row.brightness ?? 1,
    contrast: row.contrast ?? 1,
    saturation: row.saturation ?? 1,
    onTable: row.on_table ?? true,
    createdAt: row.created_at,
  }
}

export function toDbPatch(patch: LayerPatch) {
  const dbPatch: Record<string, unknown> = {}
  if (patch.sceneId !== undefined) dbPatch.scene_id = patch.sceneId
  if (patch.layerType !== undefined) dbPatch.layer_type = patch.layerType
  if (patch.ownerRole !== undefined) dbPatch.owner_role = patch.ownerRole
  if (patch.ownerId !== undefined) dbPatch.owner_id = patch.ownerId
  if (patch.parentId !== undefined) dbPatch.parent_id = patch.parentId
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.imageData !== undefined) dbPatch.image_data = patch.imageData
  if (patch.x !== undefined) dbPatch.x = patch.x
  if (patch.y !== undefined) dbPatch.y = patch.y
  if (patch.width !== undefined) dbPatch.width = patch.width
  if (patch.height !== undefined) dbPatch.height = patch.height
  if (patch.cropX !== undefined) dbPatch.crop_x = patch.cropX
  if (patch.cropY !== undefined) dbPatch.crop_y = patch.cropY
  if (patch.cropWidth !== undefined) dbPatch.crop_width = patch.cropWidth
  if (patch.cropHeight !== undefined) dbPatch.crop_height = patch.cropHeight
  if (patch.zIndex !== undefined) dbPatch.z_index = patch.zIndex
  if (patch.visible !== undefined) dbPatch.visible = patch.visible
  if (patch.locked !== undefined) dbPatch.locked = patch.locked
  if (patch.opacity !== undefined) dbPatch.opacity = patch.opacity
  if (patch.blendMode !== undefined) dbPatch.blend_mode = patch.blendMode
  if (patch.rotation !== undefined) dbPatch.rotation = patch.rotation
  if (patch.flipX !== undefined) dbPatch.flip_x = patch.flipX
  if (patch.flipY !== undefined) dbPatch.flip_y = patch.flipY
  if (patch.brightness !== undefined) dbPatch.brightness = patch.brightness
  if (patch.contrast !== undefined) dbPatch.contrast = patch.contrast
  if (patch.saturation !== undefined) dbPatch.saturation = patch.saturation
  if (patch.onTable !== undefined) dbPatch.on_table = patch.onTable
  return dbPatch
}

export function mapSceneRow(row: TableSceneRow): TableScene {
  return {
    id: row.id,
    room: row.room,
    name: row.name,
    thumbnailUrl: row.thumbnail_url || '',
    isActive: row.is_active ?? false,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSceneMusicRow(row: SceneMusicRow): SceneMusicTrack {
  const provider = getMusicProvider(row.url)
  return {
    id: row.id,
    room: row.room,
    sceneId: row.scene_id,
    title: row.title,
    url: row.url,
    sourceType: row.source_type || (provider === 'none' ? 'youtube' : provider),
    orderIndex: row.order_index ?? 0,
    isDefault: row.is_default ?? false,
    autoplay: row.autoplay ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
