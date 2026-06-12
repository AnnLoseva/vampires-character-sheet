import type { CharacterOption, CharacterRow, ChatMessage, ChatMessageRow, InventoryItem, LayerPatch, RollMessage, RollRow, SceneMusicRow, SceneMusicTrack, TableLayer, TableLayerRow, TableScene, TableSceneRow } from './types'
import { getMusicProvider } from '@/components/music/utils'

export function mapRollRow(row: RollRow): RollMessage {
  return {
    id: row.id,
    room: row.room,
    characterName: row.character_name,
    poolName: row.pool_name,
    poolType: row.pool_type,
    diceCount: row.dice_count,
    dice: row.dice || [],
    successes: row.successes,
    createdAt: row.created_at,
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
      name: source.name || 'Без названия',
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

export function mapCharacterRow(row: CharacterRow): CharacterOption {
  const data = row.data || {}
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
    notes: data.notes || data.backstory || '',
    appearance: data.appearance || '',
    backstory: data.backstory || '',
    freeExp: Number(data.freeExp ?? data.experience ?? 0) || 0,
    inventory: normalizeInventory(data.inventory),
    attributes: data.attributes || {},
    skills: data.skills || {},
    disciplines: data.disciplines || {},
    selectedPowers: data.selectedPowers || {},
  }
}

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
