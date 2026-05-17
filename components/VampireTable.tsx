'use client'

import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import MusicPanel from './music/MusicPanel'
import {
  getMusicProvider,
  parseYouTubeUrl,
  safeStorageName as safeMusicStorageName,
  TABLE_MUSIC,
  TABLE_MUSIC_BUCKET,
} from './music/utils'

type Die = {
  value: number
  kind: 'fail' | 'success' | 'critical' | 'botch'
}

type RollMessage = {
  id: string
  room: string
  characterName: string
  poolName: string
  poolType: string
  diceCount: number
  dice: Die[]
  successes: number
  createdAt: string
}

type RollRow = {
  id: string
  room: string
  character_name: string
  pool_name: string
  pool_type: string
  dice_count: number
  dice: Die[]
  successes: number
  created_at: string
}

type ChatUser = {
  id: string
  username: string
}

type CharacterOption = {
  id: string
  name: string
  clan: string | null
  image: string
  username?: string
  userId?: string
  concept?: string
  predator?: string
  generation?: string
  type?: string
  notes?: string
  appearance?: string
  backstory?: string
  freeExp?: number
  inventory: InventoryItem[]
}

type CharacterRow = {
  id: string
  user_id?: string | null
  users?: { username?: string | null } | null
  name: string
  clan: string | null
  data: {
    characterImage?: string
    image?: string
    portrait?: string
    concept?: string
    predator?: string
    generation?: string
    type?: string
    notes?: string
    appearance?: string
    backstory?: string
    freeExp?: number
    experience?: number
    inventory?: InventoryItem[]
  } | null
}

type InventoryItem = {
  id: string
  name: string
  description: string
  quantity: number
  category: string
  note: string
  createdAt: string
  updatedAt: string
  collapsed?: boolean
}

type ActiveParticipant = {
  userId: string
  username: string
  characterId: string | null
  characterName: string
  characterClan: string | null
  characterImage: string
  updatedAt: string
}

type JournalEntry = {
  id: string
  title: string
  text: string
  updatedAt: string
  createdAt: string
}

type MasterReveal = {
  id: string
  room: string
  kind: string
  title: string
  body: string
  meta: string
  characterName: string
  userId: string
  username: string
  createdAt: string
}

type MasterWhisper = {
  id: string
  room: string
  fromUserId: string
  fromUsername: string
  toUserId: string | null
  message: string
  fromMaster: boolean
  createdAt: string
}

type ChatMessage = {
  id: string
  room: string
  userId: string
  username: string
  characterId: string | null
  characterName: string
  characterImage: string
  message: string
  createdAt: string
}

type ChatMessageRow = {
  id: string
  room: string
  user_id: string
  username: string
  character_id: string | null
  character_name: string
  character_image: string | null
  message: string
  created_at: string
}

type VoiceParticipant = {
  id: string
  username: string
  characterName: string
  characterImage: string
  volume: number
  muted: boolean
  connected: boolean
}

type VoiceSignal = {
  type: 'join' | 'offer' | 'answer' | 'ice' | 'leave' | 'mute'
  room: string
  from: string
  to?: string
  username?: string
  characterName?: string
  characterImage?: string
  muted?: boolean
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

type TableLayer = {
  id: string
  room: string
  sceneId: string | null
  layerType: 'image' | 'video' | 'folder' | 'text' | 'file'
  ownerRole: TableRole
  ownerId: string | null
  parentId: string | null
  name: string
  imageData: string
  x: number
  y: number
  width: number
  height: number
  cropX: number | null
  cropY: number | null
  cropWidth: number | null
  cropHeight: number | null
  zIndex: number
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
  onTable: boolean
  createdAt: string
}

type TableLayerRow = {
  id: string
  room: string
  scene_id?: string | null
  layer_type: 'image' | 'video' | 'folder' | 'text' | 'file' | null
  owner_role: TableRole | null
  owner_id?: string | null
  parent_id: string | null
  name: string
  image_data: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  crop_x?: number | null
  crop_y?: number | null
  crop_width?: number | null
  crop_height?: number | null
  z_index: number | null
  visible: boolean | null
  locked: boolean | null
  opacity?: number | null
  blend_mode?: BlendMode | null
  rotation?: number | null
  flip_x?: boolean | null
  flip_y?: boolean | null
  brightness?: number | null
  contrast?: number | null
  saturation?: number | null
  on_table?: boolean | null
  created_at: string
}

type TableRole = 'master' | 'player'
type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'luminosity'

type LayerPatch = Partial<Pick<TableLayer, 'sceneId' | 'layerType' | 'ownerRole' | 'ownerId' | 'parentId' | 'name' | 'imageData' | 'x' | 'y' | 'width' | 'height' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight' | 'zIndex' | 'visible' | 'locked' | 'opacity' | 'blendMode' | 'rotation' | 'flipX' | 'flipY' | 'brightness' | 'contrast' | 'saturation' | 'onTable'>>

type ImageEditorState = {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
}

type ImageEditorDraft = {
  layerId: string
  state: ImageEditorState
  history: ImageEditorState[]
  future: ImageEditorState[]
  aspectLocked: boolean
  drag: null | {
    handle: 'nw' | 'ne' | 'sw' | 'se' | 'move'
    startX: number
    startY: number
    initial: ImageEditorState
  }
}

type TableScene = {
  id: string
  room: string
  name: string
  thumbnailUrl: string
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type TableSceneRow = {
  id: string
  room: string
  name: string
  thumbnail_url: string | null
  is_active: boolean | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type SceneMusicTrack = {
  id: string
  room: string
  sceneId: string
  title: string
  url: string
  sourceType: string
  orderIndex: number
  isDefault: boolean
  autoplay: boolean
  createdAt: string
  updatedAt: string
}

type SceneMusicRow = {
  id: string
  room: string
  scene_id: string
  title: string
  url: string
  source_type: string | null
  order_index: number | null
  is_default: boolean | null
  autoplay: boolean | null
  created_at: string
  updated_at: string
}

type DragState = {
  id: string
  mode: 'move' | 'resize' | 'pan' | 'select'
  corner?: 'nw' | 'ne' | 'sw' | 'se'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startPanX: number
  startPanY: number
  aspectRatio: number
  childStartPositions: Array<{ id: string; x: number; y: number }>
}

type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
} | null

type TouchGestureState = {
  mode: 'pan' | 'pinch'
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
  startDistance: number
  startZoom: number
  worldCenterX: number
  worldCenterY: number
}

type LayerTreeNode = TableLayer & {
  children: LayerTreeNode[]
}

type LayerContextMenu = {
  layerId: string | null
  x: number
  y: number
} | null

type LayerDropPlacement = 'before' | 'after' | 'inside'

type LayerDropTarget = {
  layerId: string
  placement: LayerDropPlacement
} | null

type RightRailTab = 'media' | 'rolls' | 'chat' | 'diary' | 'master'
type MediaTab = 'music' | 'layers' | 'library'
type LeftToolbarTab = 'scenes' | 'layers' | 'media'
type ChatPanelTab = 'text' | 'voice'
type VoiceQuality = 'balanced' | 'clear'

const TABLE_ROLLS = 'table_rolls'
const TABLE_CHAT_MESSAGES = 'table_chat_messages'
const TABLE_IMAGES = 'table_images'
const TABLE_SCENES = 'table_scenes'
const TABLE_SCENE_MUSIC = 'table_scene_music'
const TABLE_IMAGE_BUCKET = 'table-images'
const ROOT_LAYER_DROP_ID = '__root__'
const MASTER_PASSWORD_KEY = 'vtm-table-master-password'
const DEFAULT_SCENE_NAME = 'Основная сцена'

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

function mergeRoll(rolls: RollMessage[], roll: RollMessage) {
  if (rolls.some(item => item.id === roll.id)) return rolls
  return [roll, ...rolls].slice(0, 80)
}

function mergeChatMessage(messages: ChatMessage[], message: ChatMessage) {
  if (messages.some(item => item.id === message.id)) return messages
  return [...messages, message]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-120)
}

function upsertLayer(layers: TableLayer[], layer: TableLayer) {
  const exists = layers.some(item => item.id === layer.id)
  const next = exists ? layers.map(item => (item.id === layer.id ? layer : item)) : [...layers, layer]
  return sortLayers(next).slice(0, 80)
}

function sortLayers(layers: TableLayer[]) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt))
}

function mapRollRow(row: RollRow): RollMessage {
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

function mapChatRow(row: ChatMessageRow): ChatMessage {
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

function normalizeInventory(items: unknown): InventoryItem[] {
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

function mapCharacterRow(row: CharacterRow): CharacterOption {
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
  }
}

function mapLayerRow(row: TableLayerRow): TableLayer {
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

function toDbPatch(patch: LayerPatch) {
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

function mapSceneRow(row: TableSceneRow): TableScene {
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

function mapSceneMusicRow(row: SceneMusicRow): SceneMusicTrack {
  return {
    id: row.id,
    room: row.room,
    sceneId: row.scene_id,
    title: row.title,
    url: row.url,
    sourceType: row.source_type || 'youtube',
    orderIndex: row.order_index ?? 0,
    isDefault: row.is_default ?? false,
    autoplay: row.autoplay ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sortScenes(scenes: TableScene[]) {
  return [...scenes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function upsertScene(scenes: TableScene[], scene: TableScene) {
  const exists = scenes.some(item => item.id === scene.id)
  return sortScenes(exists ? scenes.map(item => (item.id === scene.id ? scene : item)) : [...scenes, scene])
}

function sortSceneMusic(tracks: SceneMusicTrack[]) {
  return [...tracks].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
}

function getImageSize(src: string) {
  return new Promise<{ width: number; height: number }>(resolve => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 420, height: image.naturalHeight || 280 })
    image.onerror = () => resolve({ width: 420, height: 280 })
    image.src = src
  })
}

function getVideoSize(src: string) {
  if (getEmbeddableVideoUrl(src)) return Promise.resolve({ width: 640, height: 360 })

  return new Promise<{ width: number; height: number }>(resolve => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth || 640, height: video.videoHeight || 360 })
      video.removeAttribute('src')
      video.load()
    }
    video.onerror = () => resolve({ width: 640, height: 360 })
    video.src = src
  })
}

function getMediaSize(src: string, layerType: TableLayer['layerType']) {
  return layerType === 'video' ? getVideoSize(src) : getImageSize(src)
}

function safeStorageName(name: string) {
  const cleanName = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleanName || 'image'
}

function getStoragePathFromPublicUrl(publicUrl: string, bucket = TABLE_IMAGE_BUCKET) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0])
}

function getImageNameFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const lastPart = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
    return lastPart || parsed.hostname || 'internet-media'
  } catch {
    return 'internet-media'
  }
}

function isImageUrlCandidate(value: string) {
  const raw = value.trim()
  if (!raw) return false
  if (/^data:image\//i.test(raw) || /^blob:/i.test(raw)) return true

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return /\.(apng|avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(parsed.pathname + parsed.search)
  } catch {
    return false
  }
}

function isVideoUrlCandidate(value: string) {
  const raw = value.trim()
  if (!raw) return false
  if (/^data:video\//i.test(raw) || /^blob:/i.test(raw)) return true
  if (getEmbeddableVideoUrl(raw)) return true

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return /\.(mp4|webm|mov|m4v|ogv|ogg)(?:$|[?#])/i.test(parsed.pathname + parsed.search)
  } catch {
    return false
  }
}

function getYouTubeId(url: string) {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || ''
    if (!hostname.endsWith('youtube.com') && !hostname.endsWith('youtube-nocookie.com')) return ''

    if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || ''
    return ''
  } catch {
    return ''
  }
}

function getEmbeddableVideoUrl(url: string) {
  const youtubeId = getYouTubeId(url)
  if (!youtubeId) return ''
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0`
}

function getMediaUrlCandidate(url: string) {
  if (isImageUrlCandidate(url)) return { url, layerType: 'image' as const }
  if (isVideoUrlCandidate(url)) return { url, layerType: 'video' as const }
  return null
}

function extractImageUrlsFromHtml(html: string) {
  if (!html.trim()) return []
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')
  const urls: string[] = []

  documentFragment.querySelectorAll('img, source').forEach(element => {
    const src = element.getAttribute('src') || element.getAttribute('data-src')
    if (src) urls.push(src)
    const srcset = element.getAttribute('srcset')
    if (srcset) {
      const firstSrc = srcset.split(',')[0]?.trim().split(/\s+/)[0]
      if (firstSrc) urls.push(firstSrc)
    }
  })

  documentFragment.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(element => {
    const content = element.getAttribute('content')
    if (content) urls.push(content)
  })

  return urls
}

function extractVideoUrlsFromHtml(html: string) {
  if (!html.trim()) return []
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')
  const urls: string[] = []

  documentFragment.querySelectorAll('video, source').forEach(element => {
    const src = element.getAttribute('src') || element.getAttribute('data-src')
    if (src) urls.push(src)
  })

  documentFragment.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[name="twitter:player:stream"]').forEach(element => {
    const content = element.getAttribute('content')
    if (content) urls.push(content)
  })

  return urls
}

function getDroppedMediaUrls(dataTransfer: DataTransfer) {
  const candidates: string[] = []
  candidates.push(...extractImageUrlsFromHtml(dataTransfer.getData('text/html')))
  candidates.push(...extractVideoUrlsFromHtml(dataTransfer.getData('text/html')))
  candidates.push(
    ...dataTransfer
      .getData('text/uri-list')
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith('#'))
  )
  candidates.push(dataTransfer.getData('text/plain'))

  return [...new Set(candidates.map(value => value.trim()))]
    .map(getMediaUrlCandidate)
    .filter((item): item is { url: string; layerType: 'image' | 'video' } => Boolean(item))
}

function getMediaUrlsFromText(value: string) {
  return [...new Set(value.split(/\s+/).map(item => item.trim()).filter(Boolean))]
    .map(getMediaUrlCandidate)
    .filter((item): item is { url: string; layerType: 'image' | 'video' } => Boolean(item))
}

function isReadableTextFile(file: File) {
  const name = file.name.toLowerCase()
  return file.type.startsWith('text/') || /\.(txt|md|markdown|rtf|html?|css|json|csv|xml|svg)$/i.test(name)
}

function isWordLikeFile(file: File) {
  return /\.(docx?|odt)$/i.test(file.name) || /wordprocessingml|msword|opendocument\.text/i.test(file.type)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function getFileText(file: File) {
  return file.text()
}

function getTextLayerData(file: File, text: string) {
  if (/\.html?$/i.test(file.name) || /html/i.test(file.type)) return text
  if (/\.rtf$/i.test(file.name) || /rtf/i.test(file.type)) {
    return `<pre>${escapeHtml(text.replace(/\\'[0-9a-fA-F]{2}/g, '').replace(/[{}]/g, '').replace(/\\[a-z]+-?\\d* ?/g, ''))}</pre>`
  }
  return `<pre>${escapeHtml(text)}</pre>`
}

function getFileLayerMeta(value: string, fallbackName = '') {
  try {
    const parsed = JSON.parse(value) as { url?: string; type?: string; wordLike?: boolean; pdf?: boolean; name?: string }
    const name = parsed.name || fallbackName
    return {
      url: parsed.url || '',
      type: parsed.type || 'file',
      wordLike: Boolean(parsed.wordLike),
      pdf: Boolean(parsed.pdf) || /\.pdf$/i.test(name) || /pdf/i.test(parsed.type || ''),
      name,
    }
  } catch {
    return { url: value, type: 'file', wordLike: /\.(docx?|odt)$/i.test(fallbackName), pdf: /\.pdf$/i.test(fallbackName), name: fallbackName }
  }
}

function getDocumentEmbedUrl(meta: ReturnType<typeof getFileLayerMeta>) {
  if (!meta.url) return ''
  if (meta.pdf) return meta.url
  if (meta.wordLike) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(meta.url)}`
  return ''
}

function getLayerCrop(layer: TableLayer) {
  const cropX = Math.max(0, Math.min(95, layer.cropX ?? 0))
  const cropY = Math.max(0, Math.min(95, layer.cropY ?? 0))
  const cropWidth = Math.max(1, Math.min(100 - cropX, layer.cropWidth ?? 100))
  const cropHeight = Math.max(1, Math.min(100 - cropY, layer.cropHeight ?? 100))
  const cropped = cropX > 0 || cropY > 0 || cropWidth < 100 || cropHeight < 100
  return { cropX, cropY, cropWidth, cropHeight, cropped }
}

function getCroppedMediaStyle(layer: TableLayer): CSSProperties {
  const crop = getLayerCrop(layer)
  if (!crop.cropped) return {}
  return {
    width: `${10000 / crop.cropWidth}%`,
    height: `${10000 / crop.cropHeight}%`,
    transform: `translate(${-crop.cropX}%, ${-crop.cropY}%)`,
    transformOrigin: '0 0',
  }
}

function getLayerMediaStyle(layer: TableLayer): CSSProperties {
  const cropStyle = getCroppedMediaStyle(layer)
  return {
    ...cropStyle,
    filter: `brightness(${layer.brightness}) contrast(${layer.contrast}) saturate(${layer.saturation})`,
    transform: [
      cropStyle.transform,
      `rotate(${layer.rotation}deg)`,
      `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
    ].filter(Boolean).join(' '),
  }
}

function getSmartFloatingPosition(x: number, y: number, width: number, height: number, margin = 12) {
  if (typeof window === 'undefined') return { left: x, top: y }
  const left = x + width + margin > window.innerWidth ? Math.max(margin, x - width - margin) : Math.max(margin, x)
  const top = y + height + margin > window.innerHeight ? Math.max(margin, y - height - margin) : Math.max(margin, y)
  return { left, top }
}

function createEditorState(layer: TableLayer): ImageEditorState {
  const crop = getLayerCrop(layer)
  return {
    cropX: crop.cropX,
    cropY: crop.cropY,
    cropWidth: crop.cropWidth,
    cropHeight: crop.cropHeight,
    rotation: layer.rotation,
    flipX: layer.flipX,
    flipY: layer.flipY,
    brightness: layer.brightness,
    contrast: layer.contrast,
    saturation: layer.saturation,
  }
}

function getEditorImageStyle(state: ImageEditorState): CSSProperties {
  return {
    width: `${10000 / state.cropWidth}%`,
    height: `${10000 / state.cropHeight}%`,
    transform: `translate(${-state.cropX}%, ${-state.cropY}%) rotate(${state.rotation}deg) scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`,
    transformOrigin: '50% 50%',
    filter: `brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation})`,
  }
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [tableRole, setTableRole] = useState<TableRole | null>(null)
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [chatCharacters, setChatCharacters] = useState<CharacterOption[]>([])
  const [selectedChatCharacterId, setSelectedChatCharacterId] = useState('')
  const [roomParticipants, setRoomParticipants] = useState<ActiveParticipant[]>([])
  const [previewCharacter, setPreviewCharacter] = useState<CharacterOption | null>(null)
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
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('media')
  const [mediaTab, setMediaTab] = useState<MediaTab>('layers')
  const [leftToolbarTab, setLeftToolbarTab] = useState<LeftToolbarTab>('scenes')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [musicPanelOpen, setMusicPanelOpen] = useState(true)
  const [chatPanelTab, setChatPanelTab] = useState<ChatPanelTab>('text')
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backgroundFileInputRef = useRef<HTMLInputElement>(null)
  const sceneMusicFileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const dragRef = useRef<DragState | null>(null)
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
        setSelectedChatCharacterId(nextId)
        if (nextId) {
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}:${roomRef.current}`, nextId)
          window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, nextId)
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
      window.alert('Пароль мастера не подошёл.')
      return
    }
    setMasterPasswordDraft('')
    chooseTableRole('master')
  }

  const saveMasterPassword = () => {
    window.localStorage.setItem(MASTER_PASSWORD_KEY, masterPasswordEdit)
    window.alert('Пароль мастера обновлён.')
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
      return
    }
    setSceneMusic(sortSceneMusic((data || []).map(row => mapSceneMusicRow(row as SceneMusicRow))))
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
        name: DEFAULT_SCENE_NAME,
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
    const name = window.prompt('Название сцены', 'Новая сцена')?.trim()
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
    const name = window.prompt('Новое название сцены', selectedScene.name)?.trim()
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
    const nextMusic = {
      room: roomRef.current,
      url: track.url,
      active_uri: provider === 'youtube' ? youtube.playlistId || youtube.videoId : track.url,
      is_playing: Boolean(options.play),
      position_seconds: 0,
      updated_at: now,
      provider,
      playlist_id: youtube.playlistId || null,
      playlist_index: youtube.playlistId ? Math.max(0, track.orderIndex) : null,
      track_id: youtube.videoId || track.id,
      source_type: track.sourceType,
    }

    await createClient().from(TABLE_MUSIC).upsert(nextMusic)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'music',
      payload: {
        room: nextMusic.room,
        url: nextMusic.url,
        activeUri: nextMusic.active_uri,
        isPlaying: nextMusic.is_playing,
        positionSeconds: nextMusic.position_seconds,
        updatedAt: nextMusic.updated_at,
        provider: nextMusic.provider,
        playlistId: nextMusic.playlist_id || undefined,
        playlistIndex: typeof nextMusic.playlist_index === 'number' ? nextMusic.playlist_index : undefined,
        trackId: nextMusic.track_id,
        sourceType: nextMusic.source_type,
      },
    })
  }

  const raiseHand = () => {
    const character = chatCharacters.find(item => item.id === selectedChatCharacterId)
    const name = character?.name || chatUser?.username || (isMaster ? 'Мастер' : 'Игрок')
    const payload = { room, name, at: new Date().toISOString() }
    setHandNotice(`${name} поднял руку`)
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
      window.alert('Нельзя удалить единственную сцену.')
      return
    }
    const ok = window.confirm(`Удалить сцену "${selectedScene.name}" вместе с её слоями, медиа и музыкой?`)
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
      window.alert('Выдели картинку на активной сцене, чтобы сделать её preview.')
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
    const name = window.prompt('Название группы', 'Группа сцены')?.trim()
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

  const addSceneMusic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isMaster || !selectedScene) return
    const urls = sceneMusicDraft.split(/\s+/).map(item => item.trim()).filter(Boolean)
    if (urls.length === 0) return
    const supabase = createClient()
    const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
    for (const [index, url] of urls.entries()) {
      const now = new Date().toISOString()
      const track: SceneMusicTrack = {
        id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        room,
        sceneId: selectedScene.id,
        title: `Трек ${baseOrder + index + 2}`,
        url,
        sourceType: getMusicProvider(url),
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
    const title = window.prompt('Название трека', track.title)?.trim()
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
      window.alert('Для музыки сцены можно загрузить только аудиофайлы.')
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
          window.alert('Аудиофайл не загрузился. Проверь bucket table-music и policies из SQL.')
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

    supabase
      .from(TABLE_ROLLS)
      .select('id, room, character_name, pool_name, pool_type, dice_count, dice, successes, created_at')
      .eq('room', currentRoom)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить историю бросков:', error)
          setConnectionText('Нет общей истории')
          return
        }

        setRolls((data || []).map(row => mapRollRow(row as RollRow)))
        setConnectionText('Онлайн')
      })

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
        setConnectionText('Онлайн')
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
        setLayers(prev => {
          const next = sortLayers(prev.map(layer => (layer.id === update.id ? { ...layer, ...update.patch } : layer)))
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
        setHandNotice(`${notice.name} поднял руку`)
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
          setRolls(prev => mergeRoll(prev, mapRollRow(payload.new as RollRow)))
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
  const journalStorageKey = chatUser ? `vtm-journal:${chatUser.id}:${room}` : ''
  const selectedJournalEntry = journalEntries.find(entry => entry.id === selectedJournalEntryId) || journalEntries[0] || null
  const filteredJournalEntries = journalEntries.filter(entry => {
    const query = journalSearch.trim().toLowerCase()
    if (!query) return true
    return `${entry.title} ${entry.text}`.toLowerCase().includes(query)
  })
  const masterChatPlayers = roomParticipants.filter(participant => participant.userId !== chatUser?.id)
  const visibleMasterWhispers = masterWhispers.filter(message => {
    if (!chatUser) return false
    if (isMaster) return !selectedMasterChatUserId
      ? true
      : message.fromUserId === selectedMasterChatUserId || message.toUserId === selectedMasterChatUserId
    return message.fromUserId === chatUser.id || message.toUserId === chatUser.id
  })

  const saveJournalEntries = (entries: JournalEntry[], status = 'Сохранено') => {
    setJournalEntries(entries)
    if (journalStorageKey) window.localStorage.setItem(journalStorageKey, JSON.stringify(entries))
    setJournalSaveStatus(status)
  }

  const createJournalEntry = () => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: 'Новая запись',
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
    if (!window.confirm(`Удалить запись "${selectedJournalEntry.title || 'Без названия'}"?`)) return
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

  const openParticipantPreview = async (participant: ActiveParticipant) => {
    const local = chatCharacters.find(character => character.id === participant.characterId)
    if (local) {
      setPreviewCharacter({ ...local, username: participant.username })
      return
    }
    if (!participant.characterId) {
      setPreviewCharacter({
        id: '',
        name: 'Без персонажа',
        clan: null,
        image: '',
        username: participant.username,
        inventory: [],
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
        name: participant.characterName,
        clan: participant.characterClan,
        image: participant.characterImage,
        username: participant.username,
        inventory: [],
      })
      return
    }
    setPreviewCharacter({ ...mapCharacterRow(data as CharacterRow), username: participant.username })
  }

  const rollQuickDice = async (diceCount = 1, poolName = 'Быстрый бросок') => {
    const character = selectedActiveCharacter
    if (!character) {
      window.alert('Сначала выбери активного персонажа.')
      return
    }
    const dice = Array.from({ length: Math.max(1, Math.min(20, diceCount)) }, () => {
      const value = Math.floor(Math.random() * 10) + 1
      return {
        value,
        kind: value === 1 ? 'botch' : value === 10 ? 'critical' : value >= 6 ? 'success' : 'fail',
      } as Die
    })
    const criticals = dice.filter(die => die.value === 10).length
    const successes = dice.filter(die => die.value >= 6).length + Math.floor(criticals / 2) * 2
    const roll: RollMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      characterName: character.name,
      poolName,
      poolType: 'quick',
      diceCount: dice.length,
      dice,
      successes,
      createdAt: new Date().toISOString(),
    }
    setRolls(prev => mergeRoll(prev, roll))
    broadcast('roll', roll)
    const { error } = await createClient().from(TABLE_ROLLS).insert({
      id: roll.id,
      room: roll.room,
      character_name: roll.characterName,
      pool_name: roll.poolName,
      pool_type: roll.poolType,
      dice_count: roll.diceCount,
      dice: roll.dice,
      successes: roll.successes,
      created_at: roll.createdAt,
    })
    if (error) setConnectionText('Бросок отправлен онлайн, но не сохранился')
    else setConnectionText('Онлайн')
  }

  const addExperienceToActiveCharacter = async () => {
    if (!chatUser || !previewCharacter?.id || previewCharacter.id !== selectedActiveCharacter?.id) return
    const amount = Number(window.prompt('Сколько опыта добавить?', '1'))
    if (!Number.isFinite(amount) || amount <= 0) return
    const { data, error } = await createClient()
      .from('characters')
      .select('data')
      .eq('id', previewCharacter.id)
      .eq('user_id', chatUser.id)
      .single()
    if (error || !data?.data) {
      window.alert('Не удалось загрузить персонажа для добавления опыта.')
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
      window.alert('Опыт не сохранился.')
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

  const latest = rolls[0]
  const totalDice = useMemo(() => rolls.reduce((sum, roll) => sum + roll.diceCount, 0), [rolls])
  const activeScene = scenes.find(scene => scene.id === activeSceneId) || null
  const selectedScene = scenes.find(scene => scene.id === getSelectedSceneId()) || activeScene
  const activeSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === activeSceneId)), [sceneMusic, activeSceneId])
  const selectedSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === selectedScene?.id)), [sceneMusic, selectedScene?.id])
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
    channelRef.current?.send({ type: 'broadcast', event, payload })
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
      window.alert('Имя пользователя минимум 3 символа.')
      return
    }
    if (password.length < 6) {
      window.alert('Пароль минимум 6 символов.')
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
          window.alert(error?.code === '23505' ? 'Пользователь с таким именем уже существует.' : 'Не удалось создать аккаунт.')
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
        window.alert('Неверный логин или пароль.')
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
      window.alert('Сначала войди в аккаунт.')
      return
    }
    if (!character) {
      window.alert('Выбери персонажа. Сохранённые персонажи берутся из личного кабинета листа.')
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
      window.alert('Сообщение отправлено в realtime, но не сохранилось. Нужно применить SQL для table_chat_messages.')
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
      window.alert('Выбери игрока для ответа.')
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
        username: signal.username || existing?.username || 'Участник',
        characterName: signal.characterName || existing?.characterName || 'Безымянный',
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
      window.alert('Сначала войди в аккаунт.')
      return
    }
    if (!identity) {
      window.alert('Выбери персонажа для голоса.')
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
      window.alert('Не получилось включить микрофон. Проверь разрешение браузера.')
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

  const patchLayer = async (id: string, patch: LayerPatch, options: { persist?: boolean } = { persist: true }) => {
    const existingLayer = layersRef.current.find(layer => layer.id === id)
    if (existingLayer && !canEditLayer(existingLayer)) return

    const nextLayers = sortLayers(layersRef.current.map(layer => (layer.id === id ? { ...layer, ...patch } : layer)))
    layersRef.current = nextLayers
    setLayers(nextLayers)
    broadcast('layer-update', { id, room, patch })

    if (options.persist === false) return

    const { error } = await createClient().from(TABLE_IMAGES).update(toDbPatch(patch)).eq('id', id)
    if (error) {
      console.error('Не удалось обновить слой:', error)
      setTableStatus('Слой не сохранился')
    }
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
      window.alert('Сначала войди в аккаунт игрока в чате, чтобы материалы получили владельца.')
      setRightRailTab('chat')
      return
    }
    if (!currentSceneId) {
      window.alert('Сначала нужна активная сцена.')
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
      window.alert('Слой показан онлайн, но не сохранился. Нужно обновить table_images в Supabase.')
    }
    return layer.id
  }

  const uploadFiles = async (
    files: FileList | File[],
    onTable = true,
    options: { asBackground?: boolean; point?: { x: number; y: number } } = {}
  ) => {
    const uploadItems = Array.from(files)
    if (uploadItems.length === 0) return
    if (!isMaster && !chatUser) {
      window.alert('Сначала войди в аккаунт игрока, чтобы добавлять медиа в комнату.')
      setRightRailTab('chat')
      return
    }

    setIsUploading(true)

    try {
      const supabase = createClient()
      for (const [index, file] of uploadItems.entries()) {
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

        const storagePath = `${room}/${id}-${safeStorageName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from(TABLE_IMAGE_BUCKET)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          })

        if (uploadError) {
          console.error('Не удалось загрузить файл в Storage:', uploadError)
          window.alert('Файл не загрузился в Supabase Storage. Примени обновлённый SQL для bucket table-images.')
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
          options.asBackground
            ? {
              zIndex: -1000 + index,
              locked: true,
              parentId: null,
              width: Math.max(1600, natural.width),
              height: Math.max(900, Math.round((Math.max(1600, natural.width) / Math.max(1, natural.width)) * Math.max(1, natural.height))),
            }
            : {}
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

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const imageFiles = Array.from(event.target.files).filter(file => file.type.startsWith('image/'))
      if (imageFiles.length === 0) window.alert('Для фона выбери картинку.')
      else await uploadFiles(imageFiles, true, { asBackground: true })
      event.target.value = ''
    }
  }

  const handleMediaUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const items = getMediaUrlsFromText(mediaUrlDraft)
    if (items.length === 0) {
      window.alert('Вставь ссылку на YouTube или прямую ссылку на файл: jpg, png, webp, gif, svg, mp4, webm, mov, m4v, ogg.')
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
      textMaterialNameDraft.trim() || 'Текст мастера',
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
    const folderName = window.prompt('Название новой папки', 'Новая папка')?.trim()
    if (!folderName) return
    const folderId = await createFolder(null, folderName, false, true)
    if (!folderId) return
    await moveLayersToFolder(ids, folderId)
  }

  const deleteLayer = async (layerId: string) => {
    const layer = layersRef.current.find(item => item.id === layerId) || layers.find(item => item.id === layerId)
    if (layer && !window.confirm(`Удалить "${layer.name}"?`)) return
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

    await Promise.all(deletedLayers.map(async deletedLayer => {
      const fileUrl = deletedLayer.layerType === 'file' ? getFileLayerMeta(deletedLayer.imageData, deletedLayer.name).url : deletedLayer.imageData
      const stillUsed = nextLayers.some(item => {
        const itemUrl = item.layerType === 'file' ? getFileLayerMeta(item.imageData, item.name).url : item.imageData
        return itemUrl && itemUrl === fileUrl
      })
      if (stillUsed) return
      const storagePath = getStoragePathFromPublicUrl(fileUrl)
      if (storagePath) {
        const { error } = await supabase.storage.from(TABLE_IMAGE_BUCKET).remove([storagePath])
        if (error) console.error('Не удалось удалить файл слоя из Storage:', error)
      }
    }))
  }

  const createFolder = async (parentId: string | null = null, name?: string, selectAfterCreate = true, onTable = true) => {
    if (!isMaster && !chatUser) {
      window.alert('Сначала войди в аккаунт игрока в чате, чтобы папка получила владельца.')
      setRightRailTab('chat')
      return null
    }
    if (!currentSceneId) {
      window.alert('Сначала нужна активная сцена.')
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
      name: name?.trim() || `Папка ${siblingCount + 1}`,
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
    const nextName = window.prompt('Новое имя слоя', layer.name)?.trim()
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
    const nextName = window.prompt('Название папки', 'Новая папка')?.trim()
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

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', layerId)
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
    } else {
      getDescendantIds(layer.id).forEach(childId => moveIds.add(childId))
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

    if (drag.mode === 'move') {
      const sceneDx = dx / zoom
      const sceneDy = dy / zoom
      const layerPatch = { x: Math.round(drag.startX + sceneDx), y: Math.round(drag.startY + sceneDy) }
      const nextLayers = sortLayers(
        layersRef.current.map(layer => {
          if (layer.id === drag.id) return { ...layer, ...layerPatch }
          const child = drag.childStartPositions.find(item => item.id === layer.id)
          if (child) return { ...layer, x: Math.round(child.x + sceneDx), y: Math.round(child.y + sceneDy) }
          return layer
        })
      )
      layersRef.current = nextLayers
      setLayers(nextLayers)
      broadcast('layer-update', { id: drag.id, room, patch: layerPatch })
      drag.childStartPositions.forEach(child => {
        broadcast('layer-update', {
          id: child.id,
          room,
          patch: { x: Math.round(child.x + sceneDx), y: Math.round(child.y + sceneDy) },
        })
      })
      return
    }

    const sceneDx = dx / zoom
    const sceneDy = dy / zoom
    const horizontal = drag.corner?.includes('w') ? -sceneDx : sceneDx
    const vertical = drag.corner?.includes('n') ? -sceneDy : sceneDy
    const widthFromX = drag.startWidth + horizontal
    const widthFromY = (drag.startHeight + vertical) * drag.aspectRatio
    const nextWidth = Math.max(60, Math.round(Math.abs(horizontal) > Math.abs(vertical) ? widthFromX : widthFromY))
    const nextHeight = Math.max(60, Math.round(nextWidth / drag.aspectRatio))
    const nextX = drag.corner?.includes('w') ? Math.round(drag.startX + drag.startWidth - nextWidth) : drag.startX
    const nextY = drag.corner?.includes('n') ? Math.round(drag.startY + drag.startHeight - nextHeight) : drag.startY

    patchLayer(drag.id, { x: nextX, y: nextY, width: nextWidth, height: nextHeight }, { persist: false })
  }

  const finishLayerDrag = async () => {
    const drag = dragRef.current
    if (!drag) return

    dragRef.current = null
    if (drag.mode === 'select') {
      setSelectionRect(null)
      return
    }
    if (drag.mode === 'pan') return
    const layer = layersRef.current.find(item => item.id === drag.id)
    if (layer) {
      await patchLayer(layer.id, { x: layer.x, y: layer.y, width: layer.width, height: layer.height })
      const childUpdates = drag.childStartPositions
        .map(child => layersRef.current.find(item => item.id === child.id))
        .filter(Boolean) as TableLayer[]
      await Promise.all(childUpdates.map(child => patchLayer(child.id, { x: child.x, y: child.y })))
    }
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
      await uploadFiles(droppedFiles, true, { point: getScenePointFromClient(event.clientX, event.clientY) })
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) {
      await addRemoteMediaUrls(mediaUrls, getScenePointFromClient(event.clientX, event.clientY))
      return
    }

    if (droppedFiles.length > 0) await uploadFiles(droppedFiles, true, { point: getScenePointFromClient(event.clientX, event.clientY) })
  }

  const handleSceneMediaDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, false)
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
      await uploadFiles(droppedFiles, true)
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
      const ratio = Math.max(0.05, initial.cropWidth / Math.max(1, initial.cropHeight))
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
      if (imageEditor.aspectLocked) {
        if (Math.abs(dx) >= Math.abs(dy)) cropHeight = cropWidth / ratio
        else cropWidth = cropHeight * ratio
      }
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

  const renderLayerNode = (layer: LayerTreeNode, depth = 0): React.ReactNode => {
    const isFolder = layer.layerType === 'folder'
    const isExpanded = expandedFolders.has(layer.id)
    const isDropTarget = layerDropTarget?.layerId === layer.id
    const canDragLayer = canMoveLayer(layer)
    const isEffectivelyVisible = isLayerEffectivelyVisible(layer)

    return (
      <div className="layer-tree-item" key={layer.id}>
        <article
          className={`layer-row ${selectedLayerIds.has(layer.id) ? 'active' : ''} ${draggingLayerId === layer.id ? 'dragging' : ''} ${!isEffectivelyVisible ? 'hidden' : ''} ${layer.locked ? 'locked' : ''} ${
            isDropTarget ? `drop-${layerDropTarget?.placement}` : ''
          }`}
          draggable={canDragLayer}
          onDragStart={event => handleLayerDragStart(event, layer.id)}
          onDragOver={event => handleLayerDragOver(event, layer)}
          onDrop={event => handleLayerDrop(event, layer)}
          onDragEnd={handleLayerDragEnd}
          onClick={() => setLayerSelection([layer.id], layer.id)}
          onContextMenu={event => {
            event.preventDefault()
            setLayerSelection([layer.id], layer.id)
            setLayerContextMenu({ layerId: layer.id, x: event.clientX, y: event.clientY })
          }}
          onDoubleClick={() => handleManagerDoubleClick(layer)}
        >
          <button
            type="button"
            className={`layer-visibility ${layer.visible ? 'visible' : ''}`}
            draggable={false}
            onMouseDown={event => event.stopPropagation()}
            onDragStart={event => event.preventDefault()}
            onClick={event => {
              event.stopPropagation()
              patchLayer(layer.id, { visible: !layer.visible })
            }}
            title={layer.visible ? 'Скрыть' : 'Показать'}
            aria-label={layer.visible ? 'Скрыть слой' : 'Показать слой'}
          >
            <span aria-hidden="true" />
          </button>
          <div className="layer-name" style={{ paddingLeft: 6 + depth * 18 }}>
            {isFolder ? (
              <button
                type="button"
                className="folder-toggle"
                draggable={false}
                onMouseDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation()
                  toggleFolder(layer.id)
                }}
                title={isExpanded ? 'Свернуть' : 'Открыть'}
                aria-label={isExpanded ? 'Свернуть папку' : 'Открыть папку'}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="folder-toggle spacer" />
            )}
            <div className="layer-thumb" aria-hidden="true">
              {isFolder ? (
                <span className="folder-thumb" />
              ) : layer.layerType === 'video' ? (
                <span className="video-thumb">▶</span>
              ) : layer.layerType === 'text' ? (
                <span className="text-thumb">T</span>
              ) : layer.layerType === 'file' ? (
                <span className="file-thumb">F</span>
              ) : (
                <img
                  src={layer.imageData}
                  alt=""
                  draggable={false}
                  width={36}
                  height={32}
                  style={{
                    width: 36,
                    height: 32,
                    maxWidth: 36,
                    maxHeight: 32,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              )}
            </div>
            <div className="layer-title">
              <span>{layer.name}</span>
              {isMaster ? <small>{layer.ownerRole === 'master' ? 'master' : 'player'}</small> : null}
            </div>
            <div className="layer-quick-actions">
              {layer.locked ? <span className="lock-indicator" title="Заблокирован">L</span> : null}
              {!layer.onTable && layer.layerType !== 'folder' ? (
                <button
                  type="button"
                  draggable={false}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation()
                    placeLayerOnTable(layer.id)
                  }}
                  title="Вынести на стол"
                  aria-label="Вынести на стол"
                >
                  ↗
                </button>
              ) : null}
              {!layer.onTable ? (
                <button
                  type="button"
                  className="danger"
                  draggable={false}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation()
                    deleteLayer(layer.id)
                  }}
                  title="Удалить из медиа"
                  aria-label="Удалить из медиа"
                >
                  ×
                </button>
              ) : null}
              <button
                type="button"
                draggable={false}
                onMouseDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation()
                  patchLayer(layer.id, { locked: !layer.locked })
                }}
                title={layer.locked ? 'Разблокировать' : 'Заблокировать'}
                aria-label={layer.locked ? 'Разблокировать слой' : 'Заблокировать слой'}
              >
                {layer.locked ? 'L' : 'U'}
              </button>
            </div>
          </div>
        </article>
        {isFolder && isExpanded && layer.children.length > 0 ? (
          <div className="layer-children">{layer.children.map(child => renderLayerNode(child, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  return (
    <main className="table-page-shell">
      <section className="table-topbar">
        <div>
          <p className="table-kicker">Игровой стол</p>
          <h1>{room}</h1>
        </div>
        <div className="table-actions">
          <a href="/" title="Вернуться на главную страницу">Главная</a>
          <button type="button" className="role-pill" onClick={resetTableRole}>
            {isMaster ? 'Мастер' : tableRole === 'player' ? 'Игрок' : 'Выбрать роль'}
          </button>
          {isMaster ? (
            <label className="master-password-control">
              <span>Пароль мастера</span>
              <input
                value={masterPasswordEdit}
                onChange={event => setMasterPasswordEdit(event.target.value)}
                aria-label="Пароль мастера"
              />
              <button type="button" onClick={saveMasterPassword}>Сменить</button>
            </label>
          ) : null}
          <a href={`/character-sheet?room=${encodeURIComponent(room)}`} title="Открыть лист персонажа">Лист</a>
          <input ref={fileInputRef} type="file" multiple onChange={handleImageUpload} />
          <input ref={backgroundFileInputRef} type="file" accept="image/*" multiple onChange={handleBackgroundUpload} />
          <input ref={sceneMusicFileInputRef} type="file" accept="audio/*" multiple onChange={handleSceneMusicUpload} />
        </div>
      </section>

      <section className="active-character-strip" aria-label="Активный персонаж">
        <div className="active-character-card">
          <div className="chat-avatar large" aria-hidden="true">
            {selectedActiveCharacter?.image ? (
              <img src={selectedActiveCharacter.image} alt="" />
            ) : (
              <span>{(selectedActiveCharacter?.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <span>Активный персонаж</span>
            <strong>{selectedActiveCharacter?.name || 'Персонаж не выбран'}</strong>
            <small>{selectedActiveCharacter?.clan || (chatUser ? 'без клана' : 'войдите в аккаунт')}</small>
          </div>
          <button type="button" onClick={() => selectedActiveCharacter ? setPreviewCharacter(selectedActiveCharacter) : setRightRailTab('chat')} disabled={!selectedActiveCharacter}>
            Быстрый просмотр
          </button>
          <a href={`/character-sheet?room=${encodeURIComponent(room)}`}>Открыть полный лист</a>
        </div>
        <div className="active-character-picker">
          <label>
            <span>Смена персонажа</span>
            <select
              value={selectedChatCharacterId}
              onChange={event => chooseActiveCharacter(event.target.value)}
              disabled={!chatUser || chatCharacters.length === 0}
            >
              {chatCharacters.length === 0 ? <option value="">Нет сохранённых персонажей</option> : null}
              {chatCharacters.map(character => (
                <option value={character.id} key={character.id}>
                  {character.name}{character.clan ? `, ${character.clan}` : ''}
                </option>
              ))}
            </select>
          </label>
          {!selectedActiveCharacter ? <button type="button" onClick={() => setRightRailTab('chat')}>Выбрать персонажа</button> : null}
        </div>
      </section>

      <section className={`table-layout ${isMaster ? 'with-left-toolbar' : ''} ${!musicPanelOpen ? 'music-collapsed' : ''} ${isMaster && !leftPanelOpen ? 'left-collapsed' : ''} ${!rightPanelOpen ? 'right-collapsed' : ''}`}>
        <aside className={`music-dock ${musicPanelOpen ? '' : 'panel-collapsed'}`} aria-label="Музыка комнаты">
          <MusicPanel room={room} tableRole={tableRole} channelRef={channelRef} />
        </aside>
        <button
          type="button"
          className="column-edge-toggle music-toggle"
          onClick={() => setMusicPanelOpen(prev => !prev)}
          aria-label={musicPanelOpen ? 'Скрыть музыку' : 'Показать музыку'}
          title={musicPanelOpen ? 'Скрыть музыку' : 'Показать музыку'}
        >
          <span />
          <span />
          <span />
        </button>
        {isMaster ? (
          <button
            type="button"
            className="column-edge-toggle master-toggle"
            onClick={() => setLeftPanelOpen(prev => !prev)}
            aria-label={leftPanelOpen ? 'Скрыть сцены' : 'Показать сцены'}
            title={leftPanelOpen ? 'Скрыть сцены' : 'Показать сцены'}
          >
            <span />
            <span />
            <span />
          </button>
        ) : null}
        {isMaster ? (
          <aside className={`left-toolbar ${leftPanelOpen ? '' : 'panel-collapsed'}`} aria-label="Мастерская панель сцен">
            <nav className="left-tabs" aria-label="Разделы сцен">
              <button type="button" className={leftToolbarTab === 'scenes' ? 'active' : ''} onClick={() => setLeftToolbarTab('scenes')}>Сцены</button>
              <button type="button" className={leftToolbarTab === 'layers' ? 'active' : ''} onClick={() => setLeftToolbarTab('layers')}>Слои сцены</button>
              <button type="button" className={leftToolbarTab === 'media' ? 'active' : ''} onClick={() => setLeftToolbarTab('media')}>Медиа сцены</button>
            </nav>

            <section className={`scene-control-panel ${leftToolbarTab === 'scenes' ? '' : 'table-right-panel-hidden'}`}>
              <header>
                <div>
                  <span>Активная сцена</span>
                  <strong>{activeScene?.name || sceneStatus}</strong>
                </div>
              </header>
              <div className="scene-toolbar">
                <button type="button" onClick={createScene}>Создать</button>
                <button type="button" onClick={renameScene} disabled={!selectedScene}>Переименовать</button>
                <button type="button" onClick={deleteScene} disabled={!selectedScene || scenes.length <= 1}>Удалить</button>
              </div>
              <div className="scene-list">
                {scenes.length === 0 ? (
                  <p className="panel-empty">Сцены пока не загружены.</p>
                ) : scenes.map(scene => (
                  <article
                    className={`scene-list-row ${scene.id === selectedScene?.id ? 'selected' : ''} ${scene.isActive ? 'active' : ''}`}
                    key={scene.id}
                    onClick={() => {
                      setSelectedSceneId(scene.id)
                      void loadSceneMusic(room, scene.id)
                    }}
                  >
                    <div className="scene-thumb">
                      {scene.thumbnailUrl ? <img src={scene.thumbnailUrl} alt="" /> : <span>{scene.name.slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div>
                      <strong>{scene.name}</strong>
                      <span>{scene.isActive ? 'сейчас на столе' : 'подготовлена'}</span>
                    </div>
                    <button type="button" disabled={scene.isActive} onClick={event => {
                      event.stopPropagation()
                      activateScene(scene.id)
                    }}>
                      {scene.isActive ? 'Активна' : 'Включить'}
                    </button>
                  </article>
                ))}
              </div>
              <div className="scene-music-box">
                <header>
                  <strong>Музыка сцены</strong>
                  <span>{selectedSceneMusic.length ? `${selectedSceneMusic.length} треков` : 'мини-плейлист пуст'}</span>
                </header>
                <div
                  className="scene-music-actions"
                  onDragOver={event => {
                    if (event.dataTransfer.types.includes('Files')) event.preventDefault()
                  }}
                  onDrop={handleSceneMusicDrop}
                >
                  <button type="button" onClick={() => sceneMusicFileInputRef.current?.click()} disabled={!selectedScene || isUploading}>
                    Загрузить песню
                  </button>
                  <span>Можно перетащить аудио сюда</span>
                </div>
                <form className="media-url-form" onSubmit={addSceneMusic}>
                  <input
                    value={sceneMusicDraft}
                    onChange={event => setSceneMusicDraft(event.target.value)}
                    placeholder="YouTube-ссылки через пробел"
                  />
                  <button type="submit" disabled={!sceneMusicDraft.trim() || !selectedScene}>Добавить</button>
                </form>
                <div className="scene-track-list">
                  {selectedSceneMusic.map(track => (
                    <article className="scene-track-row" key={track.id}>
                      <div>
                        <strong>{track.title}</strong>
                        <span>{track.isDefault ? 'по умолчанию' : track.sourceType}{track.autoplay ? ' · автозапуск' : ''}</span>
                      </div>
                      <button type="button" onClick={() => reorderSceneMusic(track, 'up')}>↑</button>
                      <button type="button" onClick={() => reorderSceneMusic(track, 'down')}>↓</button>
                      <button type="button" onClick={() => publishSceneTrack(track, { play: true })}>▶</button>
                      <button type="button" onClick={() => patchSceneMusic(track, { isDefault: true })}>★</button>
                      <button type="button" onClick={() => patchSceneMusic(track, { autoplay: !track.autoplay })}>{track.autoplay ? 'A' : 'a'}</button>
                      <button type="button" onClick={() => renameSceneMusic(track)}>T</button>
                      <button type="button" className="danger" onClick={() => deleteSceneMusic(track)}>×</button>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className={`scene-layer-panel ${leftToolbarTab === 'layers' ? '' : 'table-right-panel-hidden'}`}>
              <header>
                <strong>Слои сцены</strong>
                <span>{activeScene?.name || 'активная сцена'}</span>
              </header>
              <div className="scene-layer-groups">
                {[
                  ['Фон', tableManagerLayers.filter(layer => layer.onTable && (layer.zIndex < 0 || layer.name.toLowerCase().includes('фон')))],
                  ['Картинки / декорации', tableManagerLayers.filter(layer => layer.onTable && ['image', 'video'].includes(layer.layerType) && layer.zIndex >= 0 && !layer.name.toLowerCase().includes('фон'))],
                  ['Токены', tableManagerLayers.filter(layer => layer.onTable && layer.name.toLowerCase().includes('токен'))],
                  ['Группы / папки', tableManagerLayers.filter(layer => layer.onTable && layer.layerType === 'folder')],
                  ['Текст / документы', tableManagerLayers.filter(layer => layer.onTable && ['text', 'file'].includes(layer.layerType))],
                ].map(([title, items]) => (
                  <details open key={title as string}>
                    <summary>{title as string}<span>{(items as TableLayer[]).length}</span></summary>
                    <div
                      className={`layer-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                      onDragOver={handleLayerRootDragOver}
                      onDrop={handleLayerRootDrop}
                    >
                      {(items as TableLayer[]).length === 0 ? <p className="panel-empty">Пусто</p> : buildLayerTree(items as TableLayer[]).map(layer => renderLayerNode(layer))}
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
                <strong>Медиа сцены</strong>
                <span>{selectedScene?.name || activeScene?.name || 'сцена'}</span>
              </header>
              <div className="media-manager-toolbar">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? 'Загрузка...' : 'Загрузить'}
                </button>
                <button type="button" onClick={() => backgroundFileInputRef.current?.click()} disabled={isUploading}>
                  Фон
                </button>
                <button type="button" onClick={() => createNamedFolder(null, false)}>Папка</button>
                <button type="button" onClick={saveSelectionAsGroup} disabled={selectedLayerIds.size === 0}>Группа</button>
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
                  placeholder="Ссылка на картинку, видео или YouTube"
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>В папку</button>
              </form>
              <input
                className="media-search-input"
                data-media-search
                value={mediaSearchDraft}
                onChange={event => setMediaSearchDraft(event.target.value)}
                placeholder="Поиск медиа"
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
                {libraryTree.length === 0 ? <p className="panel-empty">Подготовленные медиа этой сцены появятся здесь.</p> : libraryTree.map(layer => renderLayerNode(layer))}
              </div>
            </section>
          </aside>
        ) : null}

        <section className="play-surface" aria-label="Игровой стол">
          <header className="surface-head">
            <div>
              <span>{tableStatus}</span>
              <strong>{activeScene?.name || (layers.length ? `${layers.length} слоёв` : 'Пустая сцена')}</strong>
            </div>
            <div>
              <span>Масштаб</span>
              <strong>{Math.round(zoom * 100)}%</strong>
            </div>
            <div className="zoom-tools">
              <button type="button" onClick={raiseHand} title="Поднять руку">!</button>
              <button type="button" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}>−</button>
              <button type="button" onClick={() => setZoom(1)}>100</button>
              <button type="button" onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}>+</button>
            </div>
          </header>
          {handNotice ? <div className="hand-notice" role="status">{handNotice}</div> : null}

          <div
            ref={sceneRef}
            className={`scene ${isDraggingOver ? 'drag-over' : ''}`}
            onPointerDown={startPan}
            onPointerMove={updateLayerDrag}
            onPointerUp={finishLayerDrag}
            onPointerCancel={finishLayerDrag}
            onPointerLeave={finishLayerDrag}
            onTouchStart={startSceneTouch}
            onTouchMove={updateSceneTouch}
            onTouchEnd={finishSceneTouch}
            onTouchCancel={finishSceneTouch}
          onContextMenu={event => {
            event.preventDefault()
            if (suppressNextContextMenuRef.current) {
              suppressNextContextMenuRef.current = false
              return
            }
            if (selectedLayerIds.size > 0) setLayerContextMenu({ layerId: null, x: event.clientX, y: event.clientY })
          }}
            onWheel={handleWheel}
            onDragOver={event => {
              event.preventDefault()
              setIsDraggingOver(true)
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
          >
            <div
              className="scene-world"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              {visibleLayers.length === 0 ? (
                <div className="scene-empty">
                  <h2>Добавь первый слой</h2>
                  <p>Перетащи картинки прямо на стол или нажми «Добавить слой».</p>
                </div>
              ) : null}

              {visibleLayers.map(layer => (
                <div
                  className={`scene-layer ${layer.layerType === 'image' ? 'image-layer' : ''} ${layer.layerType === 'video' ? 'video-layer' : ''} ${layer.layerType === 'text' ? 'text-layer' : ''} ${getLayerCrop(layer).cropped ? 'cropped-layer' : ''} ${selectedLayerIds.has(layer.id) ? 'selected' : ''} ${layer.locked || !canEditLayer(layer) ? 'locked' : ''}`}
                  key={layer.id}
                  style={{
                    left: layer.x,
                    top: layer.y,
                    width: layer.width,
                    height: layer.height,
                    zIndex: layer.zIndex,
                    opacity: layer.opacity,
                    mixBlendMode: layer.blendMode,
                  }}
                  onPointerDown={event => startLayerDrag(event, layer, 'move')}
                  onContextMenu={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (suppressNextContextMenuRef.current) {
                      suppressNextContextMenuRef.current = false
                      return
                    }
                    if (!selectedLayerIds.has(layer.id)) setLayerSelection([layer.id], layer.id)
                    else setSelectedLayerId(layer.id)
                    setLayerContextMenu({ layerId: layer.id, x: event.clientX, y: event.clientY })
                  }}
                  onDoubleClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (['image', 'video'].includes(layer.layerType)) openImageEditor(layer)
                    else revealLayerInTableManager(layer)
                  }}
                  onClick={event => {
                    event.stopPropagation()
                    if (!['image', 'video'].includes(layer.layerType) || !canEditLayer(layer) || layer.locked) return
                    if (selectedLayerId === layer.id && imageEditor?.layerId !== layer.id) openImageEditor(layer)
                  }}
                >
                  {layer.layerType === 'video' ? (
                    <>
                      {getEmbeddableVideoUrl(layer.imageData) ? (
                        <>
                          <iframe
                            src={getEmbeddableVideoUrl(layer.imageData)}
                            title={layer.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                          <button
                            type="button"
                            className="embedded-video-drag-handle"
                            onPointerDown={event => {
                              event.stopPropagation()
                              startLayerDrag(event, layer, 'move')
                            }}
                            title="Переместить видео"
                            aria-label="Переместить видео"
                          >
                            ⠿
                          </button>
                        </>
                      ) : (
                        <video
                          src={layer.imageData}
                          controls
                          loop
                          playsInline
                          draggable={false}
                          style={imageEditor?.layerId === layer.id ? getEditorImageStyle(imageEditor.state) : getLayerMediaStyle(layer)}
                          onError={event => {
                            event.currentTarget.style.display = 'none'
                            event.currentTarget.parentElement?.classList.add('image-load-error')
                          }}
                        />
                      )}
                      <span className="broken-image-label">{layer.name}</span>
                    </>
                  ) : layer.layerType === 'text' ? (
                    <article className="scene-text-material">
                      <strong>{layer.name}</strong>
                      <div dangerouslySetInnerHTML={{ __html: layer.imageData }} />
                    </article>
                  ) : layer.layerType === 'file' ? (() => {
                    const meta = getFileLayerMeta(layer.imageData, layer.name)
                    const embedUrl = getDocumentEmbedUrl(meta)
                    return (
                      <article className={`scene-file-material ${embedUrl ? 'embedded-document' : ''}`}>
                        <strong>{layer.name}</strong>
                        {embedUrl ? (
                          <iframe src={embedUrl} title={layer.name} />
                        ) : (
                          <>
                            <span>{meta.type}</span>
                            <a href={meta.url} target="_blank" rel="noreferrer">Открыть файл</a>
                          </>
                        )}
                      </article>
                    )
                  })() : (
                    <>
                      <img
                        src={layer.imageData}
                        alt=""
                        draggable={false}
                        style={imageEditor?.layerId === layer.id ? getEditorImageStyle(imageEditor.state) : getLayerMediaStyle(layer)}
                        onError={event => {
                          event.currentTarget.style.display = 'none'
                          event.currentTarget.parentElement?.classList.add('image-load-error')
                        }}
                      />
                      <span className="broken-image-label">{layer.name}</span>
                    </>
                  )}
                  {imageEditor?.layerId === layer.id ? (
                    <div
                      className="inline-crop-surface"
                      onPointerMove={updateEditorCropDrag}
                      onPointerUp={finishEditorCropDrag}
                      onPointerCancel={finishEditorCropDrag}
                      onPointerLeave={finishEditorCropDrag}
                    >
                      <div
                        className="inline-crop-box"
                        style={{
                          left: `${imageEditor.state.cropX}%`,
                          top: `${imageEditor.state.cropY}%`,
                          width: `${imageEditor.state.cropWidth}%`,
                          height: `${imageEditor.state.cropHeight}%`,
                        }}
                        onPointerDown={event => startEditorCropDrag(event, 'move')}
                      >
                        {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
                          <button
                            type="button"
                            key={handle}
                            className={`crop-handle ${handle}`}
                            onPointerDown={event => startEditorCropDrag(event, handle)}
                            aria-label="Изменить обрезку"
                          />
                        ))}
                      </div>
                      <div className="inline-crop-toolbar" onPointerDown={event => event.stopPropagation()}>
                        <button type="button" onClick={() => applyImageEditor(false)}>Применить</button>
                        <button type="button" onClick={() => setImageEditor(null)}>Отменить</button>
                        <button type="button" onClick={() => updateImageEditor(() => createEditorState({ ...layer, cropX: null, cropY: null, cropWidth: null, cropHeight: null, rotation: 0, flipX: false, flipY: false, brightness: 1, contrast: 1, saturation: 1 }))}>Сбросить</button>
                        <button type="button" onClick={undoImageEditor} disabled={imageEditor.history.length === 0}>Undo</button>
                        <button type="button" onClick={redoImageEditor} disabled={imageEditor.future.length === 0}>Redo</button>
                        <button type="button" className={imageEditor.aspectLocked ? 'active' : ''} onClick={() => setImageEditor(editor => editor ? { ...editor, aspectLocked: !editor.aspectLocked } : editor)}>Lock</button>
                        <button type="button" onClick={() => updateImageEditor(state => ({ ...state, rotation: (state.rotation + 90) % 360 }))}>↻</button>
                        <button type="button" onClick={() => updateImageEditor(state => ({ ...state, flipX: !state.flipX }))}>⇋</button>
                      </div>
                    </div>
                  ) : null}
                  {selectedLayerId === layer.id && ['image', 'video'].includes(layer.layerType) && canEditLayer(layer) && imageEditor?.layerId !== layer.id ? (
                    <label className="inline-opacity-control" onPointerDown={event => event.stopPropagation()}>
                      <span>Opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={layer.opacity}
                        onChange={event => patchLayer(layer.id, { opacity: Number(event.target.value) })}
                      />
                    </label>
                  ) : null}
                  {selectedLayerId === layer.id && selectedLayerIds.size <= 1 && !layer.locked && canEditLayer(layer) && imageEditor?.layerId !== layer.id ? (
                    <>
                      {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
                        <button
                          type="button"
                          className={`resize-handle ${corner}`}
                          key={corner}
                          onPointerDown={event => {
                            event.stopPropagation()
                            startLayerDrag(event, layer, 'resize', corner)
                          }}
                          title="Изменить размер"
                        />
                      ))}
                    </>
                  ) : null}
                </div>
              ))}
              {selectionRect ? (
                <div
                  className="selection-rect"
                  style={{
                    left: selectionRect.x,
                    top: selectionRect.y,
                    width: selectionRect.width,
                    height: selectionRect.height,
                  }}
                />
              ) : null}
            </div>
          </div>
        </section>

        <button
          type="button"
          className="column-edge-toggle right-toggle"
          onClick={() => setRightPanelOpen(prev => !prev)}
          aria-label={rightPanelOpen ? 'Скрыть правую панель' : 'Показать правую панель'}
          title={rightPanelOpen ? 'Скрыть правую панель' : 'Показать правую панель'}
        >
          <span />
          <span />
          <span />
        </button>
        <aside className={`right-rail ${rightPanelOpen ? '' : 'panel-collapsed'}`}>
          <nav className="right-tabs" aria-label="Панели стола">
            <button
              type="button"
              className={rightRailTab === 'media' ? 'active' : ''}
              onClick={() => setRightRailTab('media')}
            >
              Медиа
            </button>
            <button
              type="button"
              className={rightRailTab === 'rolls' ? 'active' : ''}
              onClick={() => setRightRailTab('rolls')}
            >
              Броски
            </button>
            <button
              type="button"
              className={rightRailTab === 'chat' ? 'active' : ''}
              onClick={() => setRightRailTab('chat')}
            >
              Чат
            </button>
            <button
              type="button"
              className={rightRailTab === 'diary' ? 'active' : ''}
              onClick={() => setRightRailTab('diary')}
            >
              Дневник
            </button>
            <button
              type="button"
              className={rightRailTab === 'master' ? 'active' : ''}
              onClick={() => setRightRailTab('master')}
            >
              Мастер
            </button>
          </nav>

          <section className={`media-sidebar table-right-panel ${rightRailTab === 'media' ? '' : 'table-right-panel-hidden'}`} aria-label="Медиа стола">
            {!isMaster ? (
              <nav className="sub-tabs" aria-label="Медиа панели">
                <button type="button" className={mediaTab === 'layers' ? 'active' : ''} onClick={() => setMediaTab('layers')}>
                  Стол
                </button>
                <button type="button" className={mediaTab === 'library' ? 'active' : ''} onClick={() => setMediaTab('library')}>
                  Мои медиа
                </button>
              </nav>
            ) : null}

            {!isMaster ? (
            <section
              className={`layer-panel table-right-panel ${mediaTab === 'layers' ? '' : 'table-right-panel-hidden'}`}
              aria-label="Слои стола"
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleTableLayerPanelDrop}
            >
              <header>
                <strong>Изображения и видео</strong>
                <span>{selectedManagerLayer?.name || 'папки выше перекрывают ниже'}</span>
              </header>

              <div className="media-manager-toolbar">
                <button type="button" onClick={() => createNamedFolder()}>Папка</button>
                <button type="button" onClick={() => backgroundFileInputRef.current?.click()} disabled={isUploading}>Фон</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? 'Загрузка...' : 'Новый слой'}
                </button>
              </div>

              <form className="media-url-form" onSubmit={handleMediaUrlSubmit}>
                <input
                  value={mediaUrlDraft}
                  onChange={event => setMediaUrlDraft(event.target.value)}
                  placeholder="Ссылка на картинку, видео или YouTube"
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>
                  Вставить
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
                  <p className="panel-empty">Слоёв пока нет.</p>
                ) : (
                  layerTree.map(layer => renderLayerNode(layer))
                )}
                <div
                  className="layer-root-drop-zone"
                  onDragOver={handleLayerRootDragOver}
                  onDrop={handleLayerRootDrop}
                >
                  Перетащи сюда, чтобы вынести в корень
                </div>
              </div>
            </section>
            ) : null}

            {!isMaster ? (
            <section
              className={`library-panel table-right-panel ${mediaTab === 'library' ? '' : 'table-right-panel-hidden'}`}
              aria-label="Мои медиа"
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleSceneMediaDrop}
            >
              <header>
                <strong>{isMaster ? 'Материалы мастера' : 'Мои медиа'}</strong>
                <span>можно вытащить на стол</span>
              </header>

              <div className="media-manager-toolbar">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? 'Загрузка...' : 'Загрузить'}
                </button>
                <button type="button" onClick={() => createNamedFolder(null, false)}>Папка</button>
              </div>
              <input
                className="media-search-input"
                data-media-search
                value={mediaSearchDraft}
                onChange={event => setMediaSearchDraft(event.target.value)}
                placeholder="Поиск медиа"
              />

              {isMaster ? (
                <form className="text-material-form" onSubmit={createTextMaterial}>
                  <input
                    value={textMaterialNameDraft}
                    onChange={event => setTextMaterialNameDraft(event.target.value)}
                    placeholder="Название текста"
                  />
                  <textarea
                    value={textMaterialDraft}
                    onChange={event => setTextMaterialDraft(event.target.value)}
                    placeholder="Текст, дневник, заметка..."
                    rows={4}
                  />
                  <button type="submit" disabled={!textMaterialDraft.trim()}>Добавить текст</button>
                </form>
              ) : null}

              <div
                className={`layer-list library-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                onDragOver={event => {
                  if (event.dataTransfer.types.includes('Files')) {
                    event.preventDefault()
                    return
                  }
                  handleLayerRootDragOver(event)
                }}
                onDrop={async event => {
                  const droppedFiles = Array.from(event.dataTransfer.files || [])
                  if (droppedFiles.length > 0) {
                    event.preventDefault()
                    await uploadFiles(droppedFiles, false)
                    return
                  }
                  await handleLayerRootDrop(event)
                }}
                onDragLeave={event => {
                  if (event.currentTarget === event.target) setLayerDropTarget(null)
                }}
              >
                {libraryTree.length === 0 ? (
                  <p className="panel-empty">Здесь будут материалы, которые ещё не лежат на столе.</p>
                ) : (
                  libraryTree.map(layer => renderLayerNode(layer))
                )}
                <div
                  className="layer-root-drop-zone"
                  onDragOver={handleLayerRootDragOver}
                  onDrop={handleLayerRootDrop}
                >
                  Перетащи сюда, чтобы вынести из папки
                </div>
              </div>
            </section>
            ) : null}
          </section>

          <section className={`roll-sidebar table-right-panel ${rightRailTab === 'rolls' ? '' : 'table-right-panel-hidden'}`} aria-label="История бросков">
            <header>
              <div>
                <span>Броски</span>
                <strong>{rolls.length}</strong>
              </div>
              <div>
                <span>Кубы</span>
                <strong>{totalDice}</strong>
              </div>
              <div>
                <span>Итог</span>
                <strong>{latest ? latest.successes : 0}</strong>
              </div>
            </header>

            <section className="roll-list">
              {rolls.length === 0 ? (
                <p className="panel-empty">Бросков пока нет.</p>
              ) : (
                rolls.map(roll => (
                  <article className="roll-card" key={roll.id}>
                    <div className="roll-meta">
                      <strong>{roll.characterName}</strong>
                      <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
                    </div>
                    <span className="roll-pool">{roll.poolName}</span>

                    <div className="dice-row" aria-label={`Результаты кубиков: ${roll.dice.map(die => die.value).join(', ')}`}>
                      {roll.dice.map((die, index) => (
                        <span className={`die die-${die.kind}`} key={`${roll.id}-${index}`}>
                          {die.value}
                        </span>
                      ))}
                    </div>

                    <footer>
                      <span>{roll.diceCount}к10</span>
                      <strong>{roll.successes}</strong>
                    </footer>
                  </article>
                ))
              )}
            </section>
          </section>

          <section className={`chat-sidebar table-right-panel ${rightRailTab === 'chat' ? '' : 'table-right-panel-hidden'}`} aria-label="Чат стола">
            <header>
              <div>
                <span>Чат</span>
                <strong>{chatMessages.length}</strong>
              </div>
              <div>
                <span>Статус</span>
                <strong>{chatStatus}</strong>
              </div>
            </header>

            <div className="chat-login">
              {chatUser ? (
                <>
                  <section className="room-participants-panel" aria-label="Участники комнаты">
                    <header>
                      <strong>Участники</strong>
                      <span>{roomParticipants.length || 1}</span>
                    </header>
                    <div>
                      {roomParticipants.length === 0 ? (
                        <p className="panel-empty">Пока виден только ваш вход.</p>
                      ) : roomParticipants.map(participant => (
                        <button type="button" className="participant-row" key={participant.userId} onClick={() => openParticipantPreview(participant)}>
                          <span className="chat-avatar" aria-hidden="true">
                            {participant.characterImage ? <img src={participant.characterImage} alt="" /> : <span>{participant.characterName.slice(0, 1).toUpperCase()}</span>}
                          </span>
                          <span>
                            <strong>{participant.username}</strong>
                            <small>{participant.characterName || 'без персонажа'}{participant.characterClan ? ` · ${participant.characterClan}` : ''}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <div className="chat-user-row">
                    <span>{chatUser.username}</span>
                    <button type="button" onClick={logoutChat}>Выйти</button>
                  </div>
                  <label>
                    <span>Писать как</span>
                    <select
                      value={selectedChatCharacterId}
                      onChange={event => {
                        chooseActiveCharacter(event.target.value)
                      }}
                    >
                      {chatCharacters.length === 0 ? <option value="">Нет сохранённых персонажей</option> : null}
                      {chatCharacters.map(character => (
                        <option value={character.id} key={character.id}>
                          {character.name}{character.clan ? `, ${character.clan}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {chatCharacters.length === 0 ? <p>Сохрани персонажа на листе в личный кабинет, и он появится здесь.</p> : null}
                </>
              ) : (
                <form onSubmit={handleChatAuth}>
                  <div className="chat-auth-tabs">
                    <button type="button" className={chatAuthMode === 'login' ? 'active' : ''} onClick={() => setChatAuthMode('login')}>Вход</button>
                    <button type="button" className={chatAuthMode === 'register' ? 'active' : ''} onClick={() => setChatAuthMode('register')}>Регистрация</button>
                  </div>
                  <input
                    value={chatUsernameDraft}
                    onChange={event => setChatUsernameDraft(event.target.value)}
                    placeholder="Имя пользователя"
                    autoComplete="username"
                  />
                  <input
                    value={chatPasswordDraft}
                    onChange={event => setChatPasswordDraft(event.target.value)}
                    placeholder="Пароль"
                    type="password"
                    autoComplete={chatAuthMode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button type="submit" disabled={isChatBusy}>{isChatBusy ? '...' : chatAuthMode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
                </form>
              )}
            </div>

            <nav className="sub-tabs" aria-label="Панели чата">
              <button type="button" className={chatPanelTab === 'text' ? 'active' : ''} onClick={() => setChatPanelTab('text')}>
                Текст
              </button>
              <button type="button" className={chatPanelTab === 'voice' ? 'active' : ''} onClick={() => setChatPanelTab('voice')}>
                Голос
              </button>
            </nav>

            <section className={`voice-panel ${chatPanelTab === 'voice' ? '' : 'table-right-panel-hidden'}`} aria-label="Голосовой чат">
              <header>
                <div>
                  <strong>Голос</strong>
                  <span>{voiceStatus}</span>
                </div>
                <button
                  type="button"
                  className={voiceEnabled ? 'danger' : ''}
                  onClick={voiceEnabled ? stopVoice : startVoice}
                  disabled={!chatUser || chatCharacters.length === 0}
                >
                  {voiceEnabled ? 'Выйти' : 'Войти'}
                </button>
              </header>

              <div className="voice-controls">
                <button
                  type="button"
                  className={voiceMuted ? 'muted' : ''}
                  onClick={toggleVoiceMuted}
                  disabled={!voiceEnabled}
                >
                  {voiceMuted ? 'Микрофон выкл.' : 'Микрофон вкл.'}
                </button>
                <label>
                  <span>Общая громкость</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceMasterVolume}
                    onChange={event => setVoiceMasterVolume(Number(event.target.value))}
                  />
                  <strong>{Math.round(voiceMasterVolume * 100)}%</strong>
                </label>
                <label className="voice-quality">
                  <span>Качество</span>
                  <select
                    value={voiceQuality}
                    onChange={event => setVoiceQuality(event.target.value as VoiceQuality)}
                    disabled={voiceEnabled}
                  >
                    <option value="clear">Чище голос</option>
                    <option value="balanced">Шумодав</option>
                  </select>
                </label>
              </div>

              <div className="voice-participants">
                {voiceEnabled ? (
                  <article className="voice-participant self">
                    <div className="chat-avatar" aria-hidden="true">
                      {chatCharacters.find(item => item.id === selectedChatCharacterId)?.image ? (
                        <img src={chatCharacters.find(item => item.id === selectedChatCharacterId)?.image} alt="" />
                      ) : (
                        <span>{(chatCharacters.find(item => item.id === selectedChatCharacterId)?.name || chatUser?.username || 'Я').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <strong>{chatCharacters.find(item => item.id === selectedChatCharacterId)?.name || 'Вы'}</strong>
                      <span>{voiceMuted ? 'микрофон выключен' : 'вы в голосе'}</span>
                    </div>
                  </article>
                ) : null}

                {voiceParticipants.length === 0 ? (
                  <p>{voiceEnabled ? 'Пока никого не слышно.' : 'Войди в голос, чтобы слышать участников.'}</p>
                ) : (
                  voiceParticipants.map(participant => (
                    <article className="voice-participant" key={participant.id}>
                      <audio
                        autoPlay
                        playsInline
                        ref={element => {
                          if (!element) {
                            voiceAudioRefs.current.delete(participant.id)
                            return
                          }
                          voiceAudioRefs.current.set(participant.id, element)
                          const stream = remoteStreamsRef.current.get(participant.id)
                          if (stream && element.srcObject !== stream) element.srcObject = stream
                          element.volume = Math.max(0, Math.min(1, participant.volume * voiceMasterVolume))
                          if (stream) element.play().catch(() => setVoiceStatus('Нажми на страницу, если браузер заблокировал звук'))
                        }}
                      />
                      <div className="chat-avatar" aria-hidden="true">
                        {participant.characterImage ? <img src={participant.characterImage} alt="" /> : <span>{participant.characterName.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="voice-participant-main">
                        <div>
                          <strong>{participant.characterName}</strong>
                          <span>{participant.muted ? 'микрофон выключен' : participant.connected ? 'слышно' : 'соединение...'}</span>
                        </div>
                        <label>
                          <span>Громкость</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={participant.volume}
                            onChange={event => setVoiceParticipantVolume(participant.id, Number(event.target.value))}
                          />
                          <strong>{Math.round(participant.volume * 100)}%</strong>
                        </label>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className={`chat-list ${chatPanelTab === 'text' ? '' : 'table-right-panel-hidden'}`} ref={chatListRef}>
              {chatMessages.length === 0 ? (
                <p className="panel-empty">Сообщений пока нет.</p>
              ) : (
                chatMessages.map(message => (
                  <article className={`chat-message ${message.userId === chatUser?.id ? 'own' : ''}`} key={message.id}>
                    <div className="chat-message-head">
                      <div className="chat-avatar" aria-hidden="true">
                        {message.characterImage ? (
                          <img src={message.characterImage} alt="" />
                        ) : (
                          <span>{message.characterName.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="chat-message-meta">
                        <strong>{message.characterName}</strong>
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </div>
                    </div>
                    <p>{message.message}</p>
                    <span>{message.username}</span>
                  </article>
                ))
              )}
            </section>

            <form className={`chat-composer ${chatPanelTab === 'text' ? '' : 'table-right-panel-hidden'}`} onSubmit={sendChatMessage}>
              <textarea
                value={chatDraft}
                onChange={event => setChatDraft(event.target.value)}
                placeholder={chatUser ? 'Сообщение в сцену...' : 'Войди, чтобы писать'}
                disabled={!chatUser || chatCharacters.length === 0}
                rows={3}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <button type="submit" disabled={!chatUser || chatCharacters.length === 0 || !chatDraft.trim()}>
                Отправить
              </button>
            </form>
          </section>

          <section className={`diary-sidebar table-right-panel ${rightRailTab === 'diary' ? '' : 'table-right-panel-hidden'}`} aria-label="Дневник игрока">
            <header>
              <div>
                <span>Дневник</span>
                <strong>{journalEntries.length}</strong>
              </div>
              <div>
                <span>Статус</span>
                <strong>{journalSaveStatus}</strong>
              </div>
            </header>
            {!chatUser ? (
              <p className="panel-empty">Войдите в аккаунт, чтобы вести личный дневник комнаты.</p>
            ) : (
              <div className="diary-layout">
                <aside className="diary-list">
                  <input value={journalSearch} onChange={event => setJournalSearch(event.target.value)} placeholder="Поиск в дневнике" />
                  <button type="button" onClick={createJournalEntry}>Новая запись</button>
                  <div>
                    {filteredJournalEntries.length === 0 ? (
                      <p className="panel-empty">Записей не найдено.</p>
                    ) : filteredJournalEntries.map(entry => (
                      <button
                        type="button"
                        className={entry.id === selectedJournalEntry?.id ? 'active' : ''}
                        key={entry.id}
                        onClick={() => setSelectedJournalEntryId(entry.id)}
                      >
                        <strong>{entry.title || 'Без названия'}</strong>
                        <span>{new Date(entry.updatedAt).toLocaleString('ru-RU')}</span>
                      </button>
                    ))}
                  </div>
                </aside>
                <section className="diary-editor">
                  {selectedJournalEntry ? (
                    <>
                      <input
                        value={selectedJournalEntry.title}
                        onChange={event => updateJournalEntry({ title: event.target.value })}
                        placeholder="Заголовок"
                      />
                      <textarea
                        value={selectedJournalEntry.text}
                        onChange={event => updateJournalEntry({ text: event.target.value })}
                        placeholder="Текст записи"
                      />
                      <footer>
                        <span>Обновлено: {new Date(selectedJournalEntry.updatedAt).toLocaleString('ru-RU')}</span>
                        <button type="button" onClick={persistCurrentJournal}>Сохранить</button>
                        <button type="button" className="danger" onClick={deleteJournalEntry}>Удалить</button>
                      </footer>
                    </>
                  ) : (
                    <p className="panel-empty">Создайте первую запись.</p>
                  )}
                </section>
              </div>
            )}
          </section>

          <section className={`master-sidebar table-right-panel ${rightRailTab === 'master' ? '' : 'table-right-panel-hidden'}`} aria-label="Связь с мастером">
            <header>
              <div>
                <span>{isMaster ? 'Панель мастера' : 'Чат с мастером'}</span>
                <strong>{isMaster ? masterReveals.length : visibleMasterWhispers.length}</strong>
              </div>
              <div>
                <span>Комната</span>
                <strong>{room}</strong>
              </div>
            </header>

            {!chatUser ? (
              <p className="panel-empty">Войдите в аккаунт, чтобы писать мастеру.</p>
            ) : (
              <>
                {isMaster ? (
                  <section className="master-reveal-list">
                    <strong>Показано мастеру</strong>
                    {masterReveals.length === 0 ? (
                      <p className="panel-empty">Игроки пока ничего не показывали.</p>
                    ) : masterReveals.map(item => (
                      <article key={item.id}>
                        <span>{item.kind} · {item.characterName} · {item.username}</span>
                        <strong>{item.title}</strong>
                        {item.meta ? <small>{item.meta}</small> : null}
                        <p>{item.body}</p>
                        <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                      </article>
                    ))}
                  </section>
                ) : null}

                <section className="master-chat-panel">
                  {isMaster ? (
                    <label>
                      <span>Игрок</span>
                      <select value={selectedMasterChatUserId} onChange={event => setSelectedMasterChatUserId(event.target.value)}>
                        <option value="">Все сообщения</option>
                        {masterChatPlayers.map(player => (
                          <option value={player.userId} key={player.userId}>{player.username} · {player.characterName}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="master-chat-list">
                    {visibleMasterWhispers.length === 0 ? (
                      <p className="panel-empty">{isMaster ? 'Выберите игрока или дождитесь сообщения.' : 'Здесь будет приватный диалог с мастером.'}</p>
                    ) : visibleMasterWhispers.map(message => (
                      <article className={message.fromUserId === chatUser.id ? 'own' : ''} key={message.id}>
                        <strong>{message.fromMaster ? 'Мастер' : message.fromUsername}</strong>
                        <p>{message.message}</p>
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </article>
                    ))}
                  </div>
                  <form className="master-chat-composer" onSubmit={sendMasterWhisper}>
                    <textarea
                      value={masterChatDraft}
                      onChange={event => setMasterChatDraft(event.target.value)}
                      placeholder={isMaster ? 'Ответ игроку...' : 'Сообщение мастеру...'}
                      rows={3}
                    />
                    <button type="submit" disabled={!masterChatDraft.trim() || (isMaster && !selectedMasterChatUserId)}>
                      Отправить
                    </button>
                  </form>
                </section>
              </>
            )}
          </section>
        </aside>
      </section>

      {previewCharacter ? (
        <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label="Быстрый просмотр персонажа" onMouseDown={() => setPreviewCharacter(null)}>
          <section className="character-preview-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div className="character-preview-identity">
                <div className="chat-avatar large" aria-hidden="true">
                  {previewCharacter.image ? <img src={previewCharacter.image} alt="" /> : <span>{previewCharacter.name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div>
                  <span>{previewCharacter.username || chatUser?.username || 'Игрок'}</span>
                  <strong>{previewCharacter.name}</strong>
                  <small>{previewCharacter.clan || 'Клан не указан'}</small>
                </div>
              </div>
              <button type="button" onClick={() => setPreviewCharacter(null)} aria-label="Закрыть предпросмотр">×</button>
            </header>
            <div className="character-preview-grid">
              <section>
                <h3>Броски / механика</h3>
                <p><b>Клан:</b> {previewCharacter.clan || '—'}</p>
                <p><b>Поколение:</b> {previewCharacter.generation || '—'}</p>
                <p><b>Тип:</b> {previewCharacter.type || '—'}</p>
                <p><b>Стиль охоты:</b> {previewCharacter.predator || '—'}</p>
                <p><b>Свободный опыт:</b> {previewCharacter.freeExp ?? 0}</p>
              </section>
              <section>
                <h3>Быстрые броски</h3>
                <div className="quick-roll-grid">
                  <button type="button" onClick={() => rollQuickDice(1, '1к10')}>1к10</button>
                  <button type="button" onClick={() => rollQuickDice(3, '3к10')}>3к10</button>
                  <button type="button" onClick={() => rollQuickDice(5, '5к10')}>5к10</button>
                  <button type="button" onClick={() => rollQuickDice(7, '7к10')}>7к10</button>
                </div>
                <p>Полные пулы характеристик, навыков и дисциплин доступны в листе персонажа во вкладке “Броски / механика”.</p>
              </section>
              <section>
                <h3>Инвентарь</h3>
                {previewCharacter.inventory.length === 0 ? (
                  <p>Инвентарь пуст.</p>
                ) : (
                  <ul>
                    {previewCharacter.inventory.slice(0, 8).map(item => (
                      <li key={item.id}>
                        <strong>{item.name}</strong>
                        <span>{item.quantity} · {item.category}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <footer className="character-preview-actions">
              <button type="button" onClick={() => rollQuickDice(1, 'Быстрый бросок')}>Бросить 1к10</button>
              {previewCharacter.id && previewCharacter.id === selectedActiveCharacter?.id ? (
                <button type="button" onClick={addExperienceToActiveCharacter}>Добавить опыт</button>
              ) : null}
              <a href={`/character-sheet?room=${encodeURIComponent(room)}`}>Открыть полный лист</a>
              <button type="button" onClick={() => setPreviewCharacter(null)}>Закрыть</button>
            </footer>
          </section>
        </div>
      ) : null}

      {previewLayer ? (
        <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label="Предпросмотр медиа" onMouseDown={() => setPreviewLayerId(null)}>
          <section className="media-preview-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{previewLayer.ownerRole === 'master' ? 'Мастер' : 'Игрок'}</span>
                <strong>{previewLayer.name}</strong>
              </div>
              <button type="button" onClick={() => setPreviewLayerId(null)} aria-label="Закрыть предпросмотр">×</button>
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
                    <a href={meta.url} target="_blank" rel="noreferrer">Открыть файл</a>
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
        const movableIds = ids.filter(id => layers.find(item => item.id === id)?.layerType !== 'folder')
        const folderScope = firstLayer.onTable ? tableManagerLayers : libraryLayers
        const availableFolders = folderScope.filter(item => item.layerType === 'folder' && !ids.includes(item.id))
        return (
          <div
            className="layer-context-menu"
            style={getSmartFloatingPosition(layerContextMenu.x, layerContextMenu.y, 280, 520)}
            onClick={event => event.stopPropagation()}
          >
            {singleLayer ? <button type="button" onClick={() => renameLayer(singleLayer)}>Переименовать</button> : null}
            {singleLayer && ['image', 'video'].includes(singleLayer.layerType) ? (
              <div className="context-menu-group">
                <span>Изображение</span>
                <button type="button" onClick={() => openImageEditor(singleLayer)}>Обрезать</button>
                <button type="button" onClick={() => patchLayer(singleLayer.id, { rotation: (singleLayer.rotation + 90) % 360 })}>Повернуть</button>
                <button type="button" onClick={() => duplicateLayer(singleLayer)}>Дублировать</button>
              </div>
            ) : null}
            {singleLayer && getLayerCrop(singleLayer).cropped ? (
              <button type="button" onClick={() => resetLayerCrop(singleLayer)}>Восстановить обрезанное</button>
            ) : null}
            <button type="button" onClick={() => {
              patchSelectedLayers(ids, () => ({ visible: !allVisible }))
              setLayerContextMenu(null)
            }}>
              {allVisible ? 'Скрыть' : 'Показать'}
            </button>
            <button type="button" onClick={() => {
              patchSelectedLayers(ids, () => ({ locked: !allLocked }))
              setLayerContextMenu(null)
            }}>
              {allLocked ? 'Разблокировать' : 'Заблокировать'}
            </button>
            {singleLayer && singleLayer.layerType !== 'folder' ? (
              <div className="context-menu-group context-menu-controls">
                <span>Слой</span>
                <label>
                  <small>Opacity</small>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={singleLayer.opacity}
                    onChange={event => patchLayer(singleLayer.id, { opacity: Number(event.target.value) })}
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
              <span>Порядок слоя</span>
              <button type="button" onClick={() => {
                reorderLayers(ids, 'top')
                setLayerContextMenu(null)
              }}>На самый верх</button>
              <button type="button" onClick={() => {
                reorderLayers(ids, 'up')
                setLayerContextMenu(null)
              }}>Выше</button>
              <button type="button" onClick={() => {
                reorderLayers(ids, 'down')
                setLayerContextMenu(null)
              }}>Ниже</button>
              <button type="button" onClick={() => {
                reorderLayers(ids, 'bottom')
                setLayerContextMenu(null)
              }}>На самый низ</button>
            </div>
            {singleLayer?.layerType === 'folder' ? (
              <button type="button" onClick={() => {
                createNamedFolder(singleLayer.id, singleLayer.onTable)
                setLayerContextMenu(null)
              }}>Новая папка внутри</button>
            ) : null}
            {contextLayers.some(item => item.parentId) ? (
              <button type="button" onClick={() => {
                patchSelectedLayers(ids, () => ({ parentId: null }))
                setLayerContextMenu(null)
              }}>Вынести из папки</button>
            ) : null}
            {contextLayers.some(item => item.onTable) ? (
              <button type="button" onClick={() => {
                patchSelectedLayers(ids, () => ({ onTable: false, parentId: null }))
                setLayerContextMenu(null)
              }}>Убрать в медиа сцены</button>
            ) : null}
            {contextLayers.some(item => !item.onTable) ? (
              <button type="button" onClick={() => {
                patchSelectedLayers(ids, () => ({ onTable: true, visible: true, parentId: null }))
                setLayerContextMenu(null)
              }}>Вынести на стол</button>
            ) : null}
            {movableIds.length > 0 ? (
              <div className="context-menu-group">
                <span>Поместить в папку</span>
                {availableFolders.map(folder => (
                  <button type="button" key={folder.id} onClick={() => {
                    moveLayersToFolder(movableIds, folder.id)
                    setLayerContextMenu(null)
                  }}>{folder.name}</button>
                ))}
                <button type="button" onClick={() => {
                  createFolderForSelection(movableIds)
                  setLayerContextMenu(null)
                }}>Создать новую папку</button>
              </div>
            ) : null}
            <button type="button" onClick={() => {
              focusLayersForEveryone(ids.length > 0 ? ids : [firstLayer.id])
              setLayerContextMenu(null)
            }}>Указать всем</button>
            <button type="button" className="danger" onClick={() => {
              deleteSelectedLayers(ids)
              setLayerContextMenu(null)
            }}>Удалить</button>
          </div>
        )
      })() : null}

      {!tableRole ? (
        <div className="role-gate" role="dialog" aria-modal="true" aria-label="Выбор роли">
          <section>
            <span>Вход на стол</span>
            <h2>Кто ты в этой сцене?</h2>
            <form className="master-login-form" onSubmit={enterAsMaster}>
              <input
                value={masterPasswordDraft}
                onChange={event => setMasterPasswordDraft(event.target.value)}
                placeholder="Пароль мастера"
                type="password"
              />
              <button type="submit">Мастер</button>
            </form>
            <div>
              <button type="button" onClick={() => chooseTableRole('player')}>
                Игрок
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-height: 100vh !important;
          background: #090909 !important;
          color: #f4f4f4 !important;
          display: block !important;
          overflow: hidden !important;
        }
      `}</style>
      <style jsx>{`
        .table-page-shell {
          min-height: 100vh;
          padding: 18px;
          font-family: "Courier New", Courier, monospace;
          background:
            linear-gradient(180deg, rgba(120, 0, 0, 0.16), rgba(0, 0, 0, 0) 250px),
            #090909;
        }

        .table-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin: 0 auto 14px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 12px;
        }

        .table-kicker {
          margin: 0 0 5px;
          color: #ff3131;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 46px);
          letter-spacing: 0;
        }

        .table-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .table-actions > input[type="file"] {
          display: none;
        }

        .table-actions a,
        .table-actions button {
          border: 1px solid #773030;
          background: #141414;
          color: #f5f5f5;
          border-radius: 6px;
          padding: 9px 12px;
          font: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .table-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .role-pill {
          border-color: #36d675 !important;
          color: #dfffe9 !important;
        }

        .master-password-control {
          display: grid;
          grid-template-columns: auto minmax(90px, 140px) auto;
          gap: 6px;
          align-items: center;
          color: #a9a9a9;
          font-size: 11px;
        }

        .master-password-control input {
          height: 34px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 0 8px;
          font: inherit;
          font-size: 12px;
        }

        .active-character-strip {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 12px;
          margin: 0 auto 12px;
        }

        .active-character-card,
        .active-character-picker {
          border: 1px solid #2b2b2b;
          border-radius: 8px;
          background: #101010;
          padding: 10px;
        }

        .active-character-card {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) auto auto;
          gap: 10px;
          align-items: center;
        }

        .active-character-card div:nth-child(2),
        .active-character-picker label {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .active-character-card span,
        .active-character-picker span,
        .active-character-card small {
          color: #9c9c9c;
          font-size: 12px;
        }

        .active-character-card strong {
          color: #f4f4f4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .active-character-card a,
        .active-character-card button,
        .active-character-picker button,
        .active-character-picker select {
          min-width: 0;
          min-height: 34px;
          border: 1px solid #773030;
          border-radius: 6px;
          background: #171717;
          color: #f4f4f4;
          padding: 8px 10px;
          font: inherit;
          font-size: 12px;
          text-decoration: none;
          cursor: pointer;
        }

        .active-character-card button:disabled,
        .active-character-picker select:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .active-character-picker {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: end;
        }

        .table-layout {
          position: relative;
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr) 420px;
          gap: 12px;
          height: calc(100vh - 182px);
          min-height: 560px;
        }

        .table-layout.with-left-toolbar {
          grid-template-columns: 320px 330px minmax(0, 1fr) 420px;
        }

        .table-layout.music-collapsed {
          grid-template-columns: 0 minmax(0, 1fr) 420px;
        }

        .table-layout.with-left-toolbar.music-collapsed {
          grid-template-columns: 0 330px minmax(0, 1fr) 420px;
        }

        .table-layout.with-left-toolbar.left-collapsed {
          grid-template-columns: 320px 0 minmax(0, 1fr) 420px;
        }

        .table-layout.with-left-toolbar.music-collapsed.left-collapsed {
          grid-template-columns: 0 0 minmax(0, 1fr) 420px;
        }

        .table-layout.right-collapsed {
          grid-template-columns: 320px minmax(0, 1fr) 0;
        }

        .table-layout.with-left-toolbar.right-collapsed {
          grid-template-columns: 320px 330px minmax(0, 1fr) 0;
        }

        .table-layout.with-left-toolbar.left-collapsed.right-collapsed {
          grid-template-columns: 320px 0 minmax(0, 1fr) 0;
        }

        .table-layout.music-collapsed.right-collapsed {
          grid-template-columns: 0 minmax(0, 1fr) 0;
        }

        .table-layout.with-left-toolbar.music-collapsed.left-collapsed.right-collapsed {
          grid-template-columns: 0 0 minmax(0, 1fr) 0;
        }

        .play-surface,
        .music-dock,
        .left-toolbar,
        .media-sidebar,
        .layer-panel,
        .roll-sidebar,
        .chat-sidebar {
          border: 1px solid #2b2b2b;
          background: #101010;
          border-radius: 8px;
          overflow: hidden;
        }

        .play-surface {
          position: relative;
          min-width: 0;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .music-dock {
          min-width: 0;
          min-height: 0;
        }

        .column-edge-toggle {
          position: absolute;
          z-index: 60;
          width: 24px;
          height: 44px;
          border: 1px solid #333;
          border-radius: 5px;
          background: rgba(14,14,14,0.92);
          display: grid;
          place-content: center;
          gap: 3px;
          padding: 0;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(0,0,0,0.36);
        }

        .column-edge-toggle span {
          display: block;
          width: 13px;
          height: 2px;
          border-radius: 2px;
          background: #bdbdbd;
        }

        .column-edge-toggle:hover {
          border-color: #ff3131;
        }

        .music-toggle {
          left: 306px;
          top: 50%;
          transform: translateY(-50%);
        }

        .music-collapsed .music-toggle {
          left: 0;
        }

        .master-toggle {
          left: 648px;
          top: 50%;
          transform: translateY(-50%);
        }

        .left-collapsed .master-toggle {
          left: 330px;
        }

        .music-collapsed .master-toggle {
          left: 328px;
        }

        .music-collapsed.left-collapsed .master-toggle {
          left: 22px;
        }

        .right-toggle {
          right: 406px;
          top: 50%;
          transform: translateY(-50%);
        }

        .right-collapsed .right-toggle {
          right: 0;
        }

        .left-toolbar {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .panel-collapsed {
          opacity: 0;
          pointer-events: none;
          border: 0;
          min-width: 0;
        }

        .left-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 4px;
          padding: 4px;
          border-bottom: 1px solid #2b2b2b;
          background: #101010;
        }

        .left-tabs button {
          min-width: 0;
          height: 34px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a9a9a9;
          cursor: pointer;
          font: inherit;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .left-tabs button.active {
          border-color: #773030;
          background: #221414;
          color: #ffd7d7;
        }

        .scene-control-panel,
        .scene-layer-panel,
        .scene-media-panel {
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          background: #101010;
        }

        .scene-control-panel {
          grid-template-rows: auto auto minmax(150px, 0.85fr) minmax(210px, 1fr);
        }

        .scene-media-panel {
          grid-template-rows: auto auto auto auto minmax(0, 1fr);
        }

        .scene-control-panel > header,
        .scene-layer-panel > header,
        .scene-media-panel > header,
        .scene-music-box > header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
          padding: 10px;
        }

        .scene-control-panel header div,
        .scene-music-box header {
          min-width: 0;
        }

        .scene-control-panel span,
        .scene-layer-panel span,
        .scene-media-panel span,
        .scene-music-box span {
          color: #9c9c9c;
          font-size: 11px;
        }

        .scene-control-panel strong,
        .scene-layer-panel strong,
        .scene-media-panel strong,
        .scene-music-box strong {
          min-width: 0;
          color: #f5f5f5;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-toolbar {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #171717;
        }

        .scene-toolbar button,
        .scene-list-row button,
        .scene-track-row button {
          min-width: 0;
          height: 30px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          padding: 0 8px;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .scene-toolbar button:disabled,
        .scene-list-row button:disabled,
        .scene-track-row button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .scene-list,
        .scene-track-list,
        .scene-layer-groups {
          min-height: 0;
          overflow-y: auto;
        }

        .scene-list-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 74px;
          gap: 8px;
          align-items: center;
          min-height: 58px;
          padding: 7px 8px;
          border-bottom: 1px solid #292929;
          background: #161616;
          cursor: pointer;
        }

        .scene-list-row:hover,
        .scene-list-row.selected {
          background: #242424;
        }

        .scene-list-row.active {
          box-shadow: inset 3px 0 0 #36d675;
        }

        .scene-thumb {
          width: 44px;
          height: 38px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: #ffb3b3;
          font-weight: 700;
        }

        .scene-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .scene-list-row div:nth-child(2),
        .scene-track-row div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .scene-music-box {
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr);
          border-top: 1px solid #2b2b2b;
        }

        .scene-music-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid #292929;
          background: #151515;
        }

        .scene-music-actions button {
          min-width: 0;
          height: 30px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .scene-music-actions span {
          text-align: right;
        }

        .scene-track-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) repeat(7, 24px);
          gap: 4px;
          align-items: center;
          padding: 7px 8px;
          border-bottom: 1px solid #292929;
          background: #141414;
        }

        .scene-track-row button {
          width: 24px;
          padding: 0;
        }

        .scene-track-row button.danger {
          color: #ff9c9c;
          border-color: #6a2727;
        }

        .scene-media-drop-zone {
          outline: 1px dashed rgba(255,255,255,0.08);
          outline-offset: -8px;
        }

        .scene-layer-groups {
          display: grid;
          align-content: start;
          gap: 0;
        }

        .scene-layer-groups details {
          border-bottom: 1px solid #2b2b2b;
          background: #121212;
        }

        .scene-layer-groups summary {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 10px;
          cursor: pointer;
          color: #f1f1f1;
          font-size: 12px;
        }

        .scene-layer-groups summary span {
          color: #36d675;
        }

        .surface-head,
        .layer-panel header,
        .roll-sidebar header,
        .chat-sidebar header {
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .surface-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          align-items: center;
        }

        .surface-head div {
          display: grid;
          gap: 4px;
        }

        .surface-head span,
        .layer-panel header span,
        .roll-sidebar header span,
        .chat-sidebar header span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .surface-head strong,
        .layer-panel header strong,
        .roll-sidebar header strong,
        .chat-sidebar header strong {
          color: #f5f5f5;
          font-size: 15px;
        }

        .zoom-tools {
          display: flex !important;
          gap: 6px !important;
          align-items: center;
        }

        .zoom-tools button {
          width: 34px;
          height: 30px;
          border-radius: 5px;
          border: 1px solid #333;
          background: #181818;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
        }

        .hand-notice {
          position: absolute;
          left: 50%;
          top: 74px;
          z-index: 80;
          transform: translateX(-50%);
          border: 1px solid #ff3131;
          border-radius: 6px;
          background: rgba(18, 6, 6, 0.94);
          color: #ffe2e2;
          padding: 9px 14px;
          font-size: 13px;
          box-shadow: 0 16px 38px rgba(0,0,0,0.42), 0 0 26px rgba(255,49,49,0.22);
          pointer-events: none;
        }

        .scene {
          position: relative;
          min-height: 0;
          overflow: hidden;
          touch-action: none;
          overscroll-behavior: contain;
          background-color: #080808;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 32px 32px;
          cursor: grab;
        }

        .scene:active {
          cursor: grabbing;
        }

        .scene.drag-over {
          outline: 2px solid #36d675;
          outline-offset: -2px;
        }

        .scene-world {
          position: absolute;
          inset: 0;
          width: 4000px;
          height: 3000px;
          transform-origin: 0 0;
        }

        .scene-empty {
          position: absolute;
          inset: 20px;
          display: grid;
          place-content: center;
          text-align: center;
          color: #aaa;
          border: 1px dashed #3a3a3a;
          border-radius: 8px;
          pointer-events: none;
        }

        .scene-empty h2 {
          margin: 0 0 8px;
          color: #fff;
          letter-spacing: 0;
          text-transform: none;
          border: 0;
          padding: 0;
        }

        .scene-empty p {
          margin: 0;
          max-width: 500px;
        }

        .scene-layer {
          position: absolute;
          border: 1px solid transparent;
          background: transparent;
          user-select: none;
          touch-action: none;
          cursor: move;
          box-shadow: 0 10px 30px rgba(0,0,0,0.28);
          overflow: hidden;
        }

        .image-layer {
          background: transparent;
          box-shadow: none;
        }

        .scene-layer.selected {
          border-color: #36d675;
          box-shadow: 0 0 0 2px rgba(54, 214, 117, 0.2), 0 12px 34px rgba(0,0,0,0.36);
        }

        .scene-layer.locked {
          cursor: default;
          opacity: 0.82;
        }

        .selection-rect {
          position: absolute;
          z-index: 9999;
          border: 1px solid #9ab7ff;
          background: rgba(154, 183, 255, 0.16);
          pointer-events: none;
        }

        .scene-layer img,
        .scene-layer video,
        .scene-layer iframe {
          width: 100%;
          height: 100%;
          display: block;
        }

        .scene-layer img,
        .scene-layer video {
          object-fit: fill;
        }

        .scene-layer img {
          pointer-events: none;
        }

        .scene-layer video,
        .scene-layer iframe,
        .video-layer {
          background: #050505;
        }

        .cropped-layer img,
        .cropped-layer video {
          max-width: none;
          max-height: none;
          object-fit: fill;
        }

        .scene-layer iframe {
          border: 0;
        }

        .inline-crop-surface {
          position: absolute;
          inset: 0;
          z-index: 8;
          box-shadow: inset 0 0 0 9999px rgba(0,0,0,0.18);
          touch-action: none;
        }

        .inline-crop-box {
          position: absolute;
          border: 1px solid #fff;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,49,49,0.85);
          cursor: move;
          touch-action: none;
        }

        .inline-crop-box::before,
        .inline-crop-box::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px solid rgba(255,255,255,0.38);
          pointer-events: none;
        }

        .inline-crop-box::before {
          top: 33.333%;
        }

        .inline-crop-box::after {
          top: 66.666%;
        }

        .inline-crop-toolbar,
        .inline-opacity-control {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 10px);
          transform: translateX(-50%);
          z-index: 12;
          display: flex;
          align-items: center;
          gap: 6px;
          max-width: min(560px, 92vw);
          padding: 6px;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          background: rgba(12,12,12,0.96);
          box-shadow: 0 14px 32px rgba(0,0,0,0.46);
        }

        .inline-crop-toolbar button {
          height: 28px;
          border: 1px solid #333;
          border-radius: 4px;
          background: #191919;
          color: #f4f4f4;
          padding: 0 8px;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
        }

        .inline-crop-toolbar button.active,
        .inline-crop-toolbar button:hover {
          border-color: #ff3131;
          background: #2a1111;
        }

        .inline-crop-toolbar button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .inline-opacity-control {
          width: 220px;
          bottom: auto;
          top: calc(100% + 10px);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .inline-opacity-control span {
          color: #cfcfcf;
          font-size: 11px;
        }

        .inline-opacity-control input {
          width: 100%;
          accent-color: #ff3131;
        }

        .text-layer {
          background: #030303;
          border: 1px solid #ff3131;
          box-shadow: 0 0 18px rgba(255,49,49,0.55), 0 12px 34px rgba(0,0,0,0.42);
        }

        .scene-text-material {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 10px;
          padding: 18px;
          box-sizing: border-box;
          color: #ffffff;
          overflow: hidden;
        }

        .scene-text-material strong {
          color: #ffb3b3;
          font-size: 15px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-text-material div {
          margin: 0;
          overflow: auto;
          line-height: 1.45;
          font-size: 14px;
          user-select: text;
          cursor: text;
        }

        .scene-text-material pre {
          margin: 0;
          white-space: pre-wrap;
          font: inherit;
        }

        .scene-text-material img {
          max-width: 100%;
          height: auto;
          object-fit: contain;
          pointer-events: none;
        }

        .scene-file-material {
          width: 100%;
          height: 100%;
          display: grid;
          align-content: center;
          gap: 10px;
          padding: 18px;
          box-sizing: border-box;
          color: #ffffff;
          background: #030303;
          border: 1px solid #ff3131;
          box-shadow: inset 0 0 20px rgba(255,49,49,0.18);
        }

        .scene-file-material.embedded-document {
          align-content: stretch;
          grid-template-rows: auto minmax(0, 1fr);
          padding: 10px;
        }

        .scene-file-material strong {
          color: #ffb3b3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-file-material span {
          color: #aaa;
          font-size: 12px;
        }

        .scene-file-material a {
          width: fit-content;
          border: 1px solid #773030;
          border-radius: 5px;
          color: #fff;
          background: #171717;
          padding: 8px 10px;
          text-decoration: none;
          font-size: 12px;
        }

        .scene-file-material iframe {
          width: 100%;
          height: 100%;
          min-height: 0;
          border: 1px solid rgba(255,49,49,0.32);
          border-radius: 4px;
          background: #111;
        }

        .embedded-video-drag-handle {
          position: absolute;
          left: 8px;
          top: 8px;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 5px;
          background: rgba(0,0,0,0.68);
          color: #f4f4f4;
          display: grid;
          place-items: center;
          font: inherit;
          line-height: 1;
          cursor: move;
          opacity: 0.72;
          z-index: 2;
        }

        .embedded-video-drag-handle:hover,
        .scene-layer.selected .embedded-video-drag-handle {
          opacity: 1;
        }

        .folder-layer {
          background: transparent;
          border-color: rgba(54, 214, 117, 0.45);
          box-shadow: inset 0 0 0 1px rgba(54, 214, 117, 0.08);
        }

        .folder-surface {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          padding: 9px 10px;
          box-sizing: border-box;
          color: #36d675;
          background: transparent;
          pointer-events: none;
        }

        .folder-surface span {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          background: rgba(0,0,0,0.38);
          border: 1px solid rgba(54, 214, 117, 0.28);
          border-radius: 4px;
          padding: 4px 6px;
        }

        .broken-image-label {
          display: none;
          position: absolute;
          inset: 0;
          place-content: center;
          padding: 18px;
          color: #aaa;
          text-align: center;
          font-size: 13px;
          background: #080808;
        }

        .scene-layer.image-load-error .broken-image-label {
          display: grid;
        }

        .resize-handle {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #0b0b0b;
          background: #36d675;
        }

        .resize-handle.nw {
          left: -7px;
          top: -7px;
          cursor: nwse-resize;
        }

        .resize-handle.ne {
          right: -7px;
          top: -7px;
          cursor: nesw-resize;
        }

        .resize-handle.sw {
          left: -7px;
          bottom: -7px;
          cursor: nesw-resize;
        }

        .resize-handle.se {
          right: -7px;
          bottom: -7px;
          cursor: nwse-resize;
        }

        .right-rail {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 12px;
          overflow: hidden;
        }

        .right-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 4px;
          padding: 4px;
          border: 1px solid #2b2b2b;
          border-radius: 8px;
          background: #101010;
        }

        .right-tabs button {
          min-width: 0;
          height: 34px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a9a9a9;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .right-tabs button.active {
          border-color: #3b3b3b;
          background: #242424;
          color: #f4f4f4;
        }

        .sub-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
          gap: 4px;
          padding: 4px;
          border-bottom: 1px solid #2b2b2b;
          background: #101010;
        }

        .sub-tabs button {
          min-width: 0;
          height: 32px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a9a9a9;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sub-tabs button.active {
          border-color: #3b3b3b;
          background: #242424;
          color: #f4f4f4;
        }

        .media-sidebar {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .media-sidebar > .table-right-panel {
          min-height: 0;
          border: 0;
          border-radius: 0;
        }

        .layer-panel,
        .library-panel {
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr);
        }

        .library-panel {
          grid-template-rows: auto auto auto auto minmax(0, 1fr);
        }

        .table-right-panel {
          width: 100%;
          min-width: 0;
          min-height: 0;
          align-self: stretch;
        }

        .table-right-panel-hidden {
          display: none !important;
        }

        .layer-list,
        .roll-list,
        .chat-list {
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .layer-list.drop-root {
          box-shadow: inset 0 -2px 0 rgba(123, 168, 255, 0.8);
        }

        .panel-empty {
          margin: auto;
          color: #888;
          text-align: center;
          font-size: 13px;
          padding: 20px;
        }

        .media-manager-toolbar {
          display: flex;
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #171717;
        }

        .media-manager-toolbar button,
        .text-material-form button,
        .library-card button {
          height: 32px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .media-manager-toolbar button:disabled,
        .text-material-form button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .media-url-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #141414;
        }

        .media-url-form input {
          min-width: 0;
          height: 34px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
        }

        .media-url-form input:disabled {
          opacity: 0.6;
        }

        .media-url-form button {
          height: 34px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .media-url-form button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .media-search-input {
          min-width: 0;
          height: 34px;
          border: 0;
          border-bottom: 1px solid #2b2b2b;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 0 11px;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .media-search-input:focus {
          box-shadow: inset 3px 0 0 #ff3131;
        }

        .layer-row {
          position: relative;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          width: 100%;
          min-height: 44px;
          max-height: 44px;
          border: 0;
          border-bottom: 1px solid #2b2b2b;
          border-radius: 0;
          background: #303030;
          overflow: visible;
          color: #eeeeee;
          cursor: default;
        }

        .layer-row:hover {
          background: #393939;
        }

        .layer-row.active {
          background: #4b4b4b;
          box-shadow: inset 3px 0 0 #9ab7ff;
        }

        .layer-row.hidden {
          color: #888;
          background: #262626;
        }

        .layer-row.dragging {
          opacity: 0.42;
        }

        .layer-row.drop-before::before,
        .layer-row.drop-after::after {
          content: "";
          position: absolute;
          left: 34px;
          right: 0;
          height: 2px;
          background: #7ba8ff;
          box-shadow: 0 0 10px rgba(123, 168, 255, 0.45);
          z-index: 2;
        }

        .layer-row.drop-before::before {
          top: -2px;
        }

        .layer-row.drop-after::after {
          bottom: -2px;
        }

        .layer-row.drop-inside {
          outline: 1px solid rgba(123, 168, 255, 0.9);
          outline-offset: -3px;
          background: rgba(123, 168, 255, 0.16);
        }

        .layer-visibility {
          width: 100%;
          min-height: 44px;
          border: 0;
          border-right: 1px solid #262626;
          background: transparent;
          color: #dcdcdc;
          cursor: pointer;
          font: inherit;
          display: grid;
          place-items: center;
        }

        .layer-visibility span {
          position: relative;
          width: 17px;
          height: 11px;
          border: 1.8px solid currentColor;
          border-radius: 50%;
          box-sizing: border-box;
        }

        .layer-visibility span::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          transform: translate(-50%, -50%);
        }

        .layer-visibility:not(.visible) {
          color: #5f5f5f;
        }

        .layer-name {
          width: 100%;
          min-height: 44px;
          max-height: 44px;
          color: #f1f1f1;
          display: grid;
          grid-template-columns: 18px 36px minmax(0, 1fr) auto;
          gap: 7px;
          align-items: center;
          padding: 4px 8px 4px 0;
          box-sizing: border-box;
        }

        .folder-toggle {
          width: 18px;
          height: 32px;
          border: 0;
          background: transparent;
          color: #bdbdbd;
          display: grid;
          place-items: center;
          padding: 0;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .folder-toggle.spacer {
          pointer-events: none;
        }

        .layer-thumb {
          min-width: 0;
          width: 36px !important;
          height: 32px !important;
          min-width: 36px !important;
          min-height: 32px !important;
          max-width: 36px !important;
          max-height: 32px !important;
          display: grid;
          place-items: center;
          border: 1px solid #181818;
          background-color: #f4f4f4;
          background-image:
            linear-gradient(45deg, #d8d8d8 25%, transparent 25%),
            linear-gradient(-45deg, #d8d8d8 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #d8d8d8 75%),
            linear-gradient(-45deg, transparent 75%, #d8d8d8 75%);
          background-size: 10px 10px;
          background-position: 0 0, 0 5px, 5px -5px, -5px 0;
          box-shadow: 0 0 0 1px #3f3f3f;
          overflow: hidden !important;
          flex: 0 0 36px !important;
        }

        .layer-thumb img {
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          max-width: 36px !important;
          max-height: 32px !important;
          object-fit: cover;
          display: block;
          pointer-events: none;
        }

        .video-thumb {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: #131722;
          color: #9ab7ff;
          font-size: 12px;
        }

        .text-thumb,
        .file-thumb {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: #070707;
          color: #ffb3b3;
          border: 1px solid rgba(255,49,49,0.5);
          box-shadow: inset 0 0 14px rgba(255,49,49,0.2);
          font-weight: 700;
        }

        .folder-thumb {
          position: relative;
          width: 24px;
          height: 17px;
          display: block;
          background: #c9a557;
          border-radius: 2px;
          border: 1px solid #8b7034;
          font-size: 0;
        }

        .folder-thumb::before {
          content: "";
          position: absolute;
          left: 1px;
          top: -5px;
          width: 11px;
          height: 6px;
          border-radius: 2px 2px 0 0;
          background: #d7b562;
          border: 1px solid #8b7034;
          border-bottom: 0;
        }

        .layer-title {
          min-width: 0;
          display: grid;
          gap: 1px;
        }

        .layer-title span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0;
        }

        .layer-title small {
          min-width: 0;
          color: #989898;
          font-size: 10px;
          line-height: 1.1;
          text-transform: uppercase;
        }

        .layer-quick-actions {
          display: flex;
          gap: 5px;
          align-items: center;
        }

        .lock-indicator {
          color: #d6d6d6;
          font-size: 11px;
        }

        .layer-quick-actions button {
          width: 20px;
          height: 20px;
          border: 1px solid #3a3a3a;
          border-radius: 3px;
          background: #272727;
          color: #cfcfcf;
          font: inherit;
          font-size: 10px;
          padding: 0;
          cursor: pointer;
        }

        .layer-quick-actions button.danger {
          color: #ff9c9c;
          border-color: #5d2929;
        }

        .layer-quick-actions button:hover,
        .folder-toggle:hover,
        .layer-visibility:hover {
          color: #ffffff;
        }

        .layer-children {
          display: grid;
          gap: 0;
          margin-top: 0;
        }

        .layer-root-drop-zone {
          min-height: 34px;
          display: grid;
          place-items: center;
          color: #777;
          font-size: 11px;
          border-top: 1px dashed #333;
        }

        .layer-list.drop-root .layer-root-drop-zone {
          color: #c7d7ff;
          background: rgba(123, 168, 255, 0.09);
        }

        .layer-context-menu {
          position: fixed;
          z-index: 1000;
          min-width: 190px;
          padding: 5px;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          background: #151515;
          box-shadow: 0 16px 40px rgba(0,0,0,0.45);
          display: grid;
          gap: 2px;
        }

        .layer-context-menu button {
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: #eee;
          padding: 8px 10px;
          text-align: left;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .layer-context-menu button:hover {
          background: #242424;
        }

        .layer-context-menu button.danger {
          color: #ff8b8b;
        }

        .media-preview-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1900;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0,0,0,0.78);
        }

        .media-preview-modal {
          width: min(980px, 100%);
          height: min(760px, 90vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #0b0b0b;
          box-shadow: 0 24px 70px rgba(0,0,0,0.65), 0 0 28px rgba(255,49,49,0.18);
          overflow: hidden;
        }

        .character-preview-modal {
          width: min(760px, 100%);
          max-height: min(760px, 90vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #0b0b0b;
          box-shadow: 0 24px 70px rgba(0,0,0,0.65), 0 0 28px rgba(255,49,49,0.18);
          overflow: hidden;
        }

        .character-preview-modal header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .character-preview-modal header button {
          width: 34px;
          height: 34px;
          border: 1px solid #3a3a3a;
          border-radius: 5px;
          background: #181818;
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-size: 22px;
          line-height: 1;
        }

        .character-preview-identity {
          min-width: 0;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .character-preview-identity > div:last-child {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .character-preview-grid {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .character-preview-grid section {
          border: 1px solid #292929;
          border-radius: 8px;
          background: #141414;
          padding: 12px;
        }

        .character-preview-grid h3 {
          margin: 0 0 8px;
          color: #ffb3b3;
          font-size: 13px;
        }

        .character-preview-grid p {
          margin: 0 0 6px;
          color: #d7d7d7;
          font-size: 13px;
          line-height: 1.45;
        }

        .character-preview-grid ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 6px;
        }

        .character-preview-grid li {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid #252525;
          padding-bottom: 6px;
          color: #ddd;
          font-size: 12px;
        }

        .character-preview-grid li span {
          color: #9c9c9c;
        }

        .quick-roll-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .quick-roll-grid button {
          min-height: 34px;
          border: 1px solid #773030;
          border-radius: 6px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .character-preview-actions {
          border-top: 1px solid #292929;
          background: #111;
          padding: 10px;
        }

        .media-preview-modal header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .media-preview-modal header div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .media-preview-modal header span {
          color: #ff7777;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .media-preview-modal header strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fff;
        }

        .media-preview-modal header button {
          width: 34px;
          height: 34px;
          border: 1px solid #3a3a3a;
          border-radius: 5px;
          background: #181818;
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-size: 22px;
          line-height: 1;
        }

        .media-preview-body {
          min-height: 0;
          display: grid;
          place-items: center;
          padding: 14px;
          overflow: auto;
        }

        .media-preview-body img,
        .media-preview-body video,
        .media-preview-body iframe {
          width: 100%;
          height: 100%;
          max-height: 100%;
          object-fit: contain;
          border: 0;
          background: #050505;
        }

        .preview-text-material,
        .preview-file-card {
          width: min(720px, 100%);
          max-height: 100%;
          overflow: auto;
          border: 1px solid #ff3131;
          border-radius: 6px;
          background: #030303;
          color: #fff;
          padding: 18px;
          box-shadow: 0 0 18px rgba(255,49,49,0.45);
          line-height: 1.5;
        }

        .preview-text-material pre {
          margin: 0;
          white-space: pre-wrap;
          font: inherit;
        }

        .preview-text-material img {
          max-width: 100%;
          height: auto;
        }

        .preview-file-card {
          display: grid;
          gap: 10px;
          align-content: center;
        }

        .preview-file-card span {
          color: #aaa;
          font-size: 12px;
        }

        .preview-file-card a {
          width: fit-content;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #171717;
          color: #fff;
          padding: 8px 10px;
          text-decoration: none;
        }

        .context-menu-group {
          display: grid;
          gap: 2px;
          border-top: 1px solid #2a2a2a;
          border-bottom: 1px solid #2a2a2a;
          padding: 4px 0;
        }

        .context-menu-group span {
          color: #8f8f8f;
          font-size: 10px;
          padding: 4px 10px 2px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .context-menu-controls label {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          padding: 4px 10px;
        }

        .context-menu-controls small {
          color: #b8b8b8;
          font-size: 11px;
        }

        .context-menu-controls input,
        .context-menu-controls select {
          min-width: 0;
          width: 100%;
          accent-color: #ff3131;
          border: 1px solid #333;
          border-radius: 4px;
          background: #090909;
          color: #eee;
          font: inherit;
          font-size: 11px;
        }

        .image-editor-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1950;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0,0,0,0.86);
          backdrop-filter: blur(8px);
        }

        .image-editor-modal {
          width: min(1180px, 100%);
          height: min(820px, 92vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid #4b1f1f;
          border-radius: 8px;
          background: #0b0b0b;
          box-shadow: 0 28px 80px rgba(0,0,0,0.72), 0 0 38px rgba(255,49,49,0.2);
          overflow: hidden;
        }

        .image-editor-modal header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          border-bottom: 1px solid #2b2b2b;
          background: linear-gradient(180deg, #151515, #101010);
          padding: 10px 12px;
        }

        .image-editor-modal header div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .image-editor-modal header span {
          color: #ff5858;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .image-editor-modal header strong {
          min-width: 0;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .image-editor-modal header nav {
          display: flex;
          gap: 7px;
          align-items: center;
          overflow-x: auto;
        }

        .image-editor-modal button,
        .image-editor-tools button {
          min-width: 0;
          height: 32px;
          border: 1px solid #3a3a3a;
          border-radius: 5px;
          background: #181818;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .image-editor-modal button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .image-editor-modal button.primary {
          border-color: #ff3131;
          background: #361414;
          color: #ffe1e1;
        }

        .image-editor-body {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          background: #070707;
        }

        .crop-stage {
          position: relative;
          min-height: 0;
          margin: 16px;
          border: 1px solid #252525;
          background:
            linear-gradient(45deg, #111 25%, transparent 25%),
            linear-gradient(-45deg, #111 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #111 75%),
            linear-gradient(-45deg, transparent 75%, #111 75%),
            #050505;
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0;
          overflow: hidden;
          touch-action: none;
        }

        .crop-stage img,
        .crop-stage video {
          width: 100%;
          height: 100%;
          object-fit: fill;
          max-width: none;
          max-height: none;
          display: block;
          user-select: none;
          pointer-events: none;
        }

        .crop-mask {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.34);
          pointer-events: none;
        }

        .crop-box {
          position: absolute;
          border: 1px solid #ffffff;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,49,49,0.8);
          cursor: move;
          touch-action: none;
        }

        .crop-box::before,
        .crop-box::after {
          content: "";
          position: absolute;
          inset: 33.333% 0 auto;
          border-top: 1px solid rgba(255,255,255,0.44);
          pointer-events: none;
        }

        .crop-box::after {
          inset: 66.666% 0 auto;
        }

        .crop-handle {
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #050505 !important;
          background: #ff3131 !important;
          padding: 0 !important;
          box-shadow: 0 0 16px rgba(255,49,49,0.48);
        }

        .crop-handle.nw { left: -10px; top: -10px; cursor: nwse-resize; }
        .crop-handle.ne { right: -10px; top: -10px; cursor: nesw-resize; }
        .crop-handle.sw { left: -10px; bottom: -10px; cursor: nesw-resize; }
        .crop-handle.se { right: -10px; bottom: -10px; cursor: nwse-resize; }

        .image-editor-tools {
          min-height: 0;
          display: grid;
          align-content: start;
          gap: 10px;
          padding: 14px;
          border-left: 1px solid #2b2b2b;
          background: #111;
        }

        .tool-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .editor-slider {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 54px;
          gap: 7px;
          align-items: center;
          border-top: 1px solid #252525;
          padding-top: 10px;
        }

        .editor-slider span {
          grid-column: 1 / -1;
          color: #c8c8c8;
          font-size: 12px;
        }

        .editor-slider input {
          width: 100%;
          accent-color: #ff3131;
        }

        .editor-slider strong {
          color: #fff;
          font-size: 12px;
          text-align: right;
        }

        .text-material-form {
          display: grid;
          gap: 7px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #141414;
        }

        .text-material-form input,
        .text-material-form textarea {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 5px;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 8px 10px;
          font: inherit;
          font-size: 12px;
          resize: vertical;
        }

        .library-grid {
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-content: start;
          gap: 10px;
        }

        .library-list {
          background: #171717;
        }

        .library-card {
          min-width: 0;
          display: grid;
          gap: 7px;
          border: 1px solid #303030;
          border-radius: 7px;
          background: #171717;
          padding: 8px;
          cursor: grab;
        }

        .library-card.active {
          border-color: #9ab7ff;
          box-shadow: 0 0 0 1px rgba(154,183,255,0.35);
        }

        .library-preview {
          aspect-ratio: 4 / 3;
          border: 1px solid #222;
          background: #0b0b0b;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .library-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .library-card strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .library-card-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .library-card button.danger {
          color: #ff9c9c;
          border-color: #6a2727;
        }

        .role-gate {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0,0,0,0.82);
        }

        .role-gate section {
          width: min(460px, 100%);
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #111;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.55);
        }

        .role-gate span {
          color: #ff3131;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .role-gate h2 {
          margin: 8px 0 18px;
          color: #fff;
          font-size: 26px;
          letter-spacing: 0;
          border: 0;
          padding: 0;
        }

        .role-gate div {
          display: grid;
          gap: 10px;
        }

        .master-login-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-bottom: 10px;
        }

        .master-login-form input {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 6px;
          background: #0b0b0b;
          color: #f4f4f4;
          padding: 0 12px;
          font: inherit;
        }

        .role-gate button {
          border: 1px solid #773030;
          background: #171717;
          color: #f4f4f4;
          border-radius: 6px;
          padding: 14px;
          cursor: pointer;
          font: inherit;
          font-size: 16px;
        }

        .role-gate button:first-child {
          border-color: #36d675;
        }

        .roll-sidebar header {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .roll-sidebar header div {
          display: grid;
          gap: 4px;
          padding: 10px;
          border-right: 1px solid #292929;
        }

        .roll-sidebar header div:last-child {
          border-right: none;
        }

        .roll-sidebar header strong {
          color: #36d675;
          font-size: 19px;
        }

        .roll-card {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
        }

        .roll-meta,
        .roll-card footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .roll-meta strong {
          font-size: 14px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .roll-meta time,
        .roll-pool,
        .roll-card footer span {
          color: #aaa;
          font-size: 12px;
        }

        .roll-pool {
          display: block;
          margin-top: 4px;
          line-height: 1.35;
        }

        .dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin: 10px 0;
        }

        .die {
          width: 31px;
          height: 31px;
          border-radius: 6px;
          border: 1px solid #555;
          display: inline-grid;
          place-items: center;
          font-weight: 700;
          font-size: 14px;
          background: #090909;
          color: #f3f3f3;
        }

        .die-success,
        .die-critical {
          color: #101810;
          background: #36d675;
          border-color: #6df0a0;
          box-shadow: 0 0 12px rgba(54, 214, 117, 0.2);
        }

        .die-critical {
          outline: 2px solid #f2ff7a;
        }

        .die-botch {
          border-color: #f3f3f3;
          color: #fff;
        }

        .roll-card footer strong {
          color: #36d675;
          font-size: 18px;
        }

        .chat-sidebar {
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
        }

        .chat-sidebar header {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .chat-sidebar header div {
          display: grid;
          gap: 4px;
          padding: 10px;
          border-right: 1px solid #292929;
          min-width: 0;
        }

        .chat-sidebar header div:last-child {
          border-right: none;
        }

        .chat-sidebar header strong {
          color: #36d675;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
        }

        .chat-login {
          border-bottom: 1px solid #292929;
          background: #121212;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .chat-login form,
        .chat-login label {
          display: grid;
          gap: 8px;
        }

        .chat-login label span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .chat-login input,
        .chat-login select,
        .chat-composer textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .chat-login select {
          height: 34px;
        }

        .chat-login button,
        .chat-composer button {
          min-width: 0;
          height: 32px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .chat-login button:disabled,
        .chat-composer button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .chat-auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .chat-auth-tabs button.active {
          border-color: #36d675;
          color: #dfffe9;
          background: #17221a;
        }

        .chat-user-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 70px;
          gap: 8px;
          align-items: center;
        }

        .chat-user-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #f2f2f2;
          font-size: 13px;
        }

        .chat-login p {
          margin: 0;
          color: #9c9c9c;
          font-size: 12px;
          line-height: 1.35;
        }

        .room-participants-panel {
          display: grid;
          gap: 7px;
          border: 1px solid #292929;
          border-radius: 7px;
          background: #0b0b0b;
          padding: 8px;
        }

        .room-participants-panel header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 0;
          background: transparent;
          padding: 0;
        }

        .room-participants-panel header strong {
          color: #f4f4f4;
          font-size: 12px;
        }

        .room-participants-panel header span {
          color: #9c9c9c;
          font-size: 11px;
        }

        .room-participants-panel > div {
          display: grid;
          gap: 6px;
          max-height: 168px;
          overflow-y: auto;
        }

        .participant-row {
          width: 100%;
          height: auto !important;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          text-align: left;
          padding: 7px !important;
        }

        .participant-row > span:last-child {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .participant-row strong,
        .participant-row small {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .participant-row strong {
          color: #f2f2f2;
          font-size: 12px;
        }

        .participant-row small {
          color: #9c9c9c;
          font-size: 11px;
        }

        .voice-panel {
          border-bottom: 1px solid #292929;
          background: #0f0f0f;
          display: grid;
          gap: 9px;
          padding: 10px;
        }

        .voice-panel header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 76px;
          gap: 8px;
          align-items: center;
          border: 0;
          background: transparent;
        }

        .voice-panel header div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .voice-panel header strong,
        .voice-participant strong,
        .voice-controls strong {
          min-width: 0;
          color: #f3f3f3;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .voice-panel header span,
        .voice-participant span,
        .voice-controls span,
        .voice-participants p {
          color: #9c9c9c;
          font-size: 11px;
        }

        .voice-panel button {
          min-width: 0;
          height: 30px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .voice-panel button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .voice-panel button.danger,
        .voice-panel button.muted {
          border-color: #703333;
          color: #ffd0d0;
          background: #271414;
        }

        .voice-controls {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
        }

        .voice-controls label,
        .voice-participant label {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(72px, 1fr) 38px;
          gap: 7px;
          align-items: center;
        }

        .voice-controls .voice-quality {
          grid-column: 1 / -1;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .voice-controls input,
        .voice-participant input {
          min-width: 0;
          width: 100%;
          accent-color: #36d675;
        }

        .voice-controls select {
          min-width: 0;
          width: 100%;
          height: 30px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 0 8px;
          font: inherit;
          font-size: 12px;
        }

        .voice-controls select:disabled {
          opacity: 0.6;
        }

        .voice-participants {
          display: grid;
          gap: 7px;
        }

        .voice-participants p {
          margin: 0;
        }

        .voice-participant {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          border: 1px solid #292929;
          border-radius: 7px;
          background: #151515;
          padding: 7px;
        }

        .voice-participant.self {
          border-color: rgba(54, 214, 117, 0.34);
          background: #122018;
        }

        .voice-participant-main,
        .voice-participant-main > div,
        .voice-participant.self > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .voice-participant audio {
          display: none;
        }

        .chat-list {
          gap: 8px;
          padding: 10px;
        }

        .chat-message {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
        }

        .chat-message.own {
          border-color: rgba(54, 214, 117, 0.42);
          background: #142019;
        }

        .chat-message-head {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .chat-avatar {
          width: 38px;
          height: 38px;
          border: 1px solid #343434;
          border-radius: 6px;
          background: #202020;
          overflow: hidden;
          display: grid;
          place-items: center;
          color: #d7d7d7;
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .chat-avatar.large {
          width: 52px;
          height: 52px;
          font-size: 20px;
        }

        .chat-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .chat-message-meta {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .diary-sidebar,
        .master-sidebar {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
        }

        .diary-sidebar > header,
        .master-sidebar > header,
        .character-preview-modal header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
          padding: 10px;
        }

        .diary-sidebar header span,
        .master-sidebar header span,
        .character-preview-modal header span,
        .character-preview-modal small {
          color: #9c9c9c;
          font-size: 12px;
        }

        .diary-sidebar header strong,
        .master-sidebar header strong,
        .character-preview-modal header strong {
          color: #f4f4f4;
          font-size: 13px;
        }

        .diary-layout {
          min-height: 0;
          display: grid;
          grid-template-columns: 145px minmax(0, 1fr);
          overflow: hidden;
        }

        .diary-list {
          min-height: 0;
          border-right: 1px solid #292929;
          background: #111;
          padding: 8px;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 8px;
        }

        .diary-list input,
        .diary-editor input,
        .diary-editor textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .diary-list button,
        .diary-editor button,
        .character-preview-actions button,
        .character-preview-actions a {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          padding: 8px 10px;
          font: inherit;
          font-size: 12px;
          text-decoration: none;
          cursor: pointer;
        }

        .diary-list > div {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 6px;
        }

        .diary-list > div button {
          display: grid;
          gap: 3px;
          text-align: left;
        }

        .diary-list > div button.active {
          border-color: #773030;
          background: #241414;
        }

        .diary-list strong,
        .diary-list span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .diary-list span {
          color: #9c9c9c;
          font-size: 10px;
        }

        .diary-editor {
          min-height: 0;
          padding: 10px;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 8px;
        }

        .diary-editor textarea {
          resize: none;
          line-height: 1.45;
        }

        .diary-editor footer,
        .character-preview-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
        }

        .diary-editor footer span {
          margin-right: auto;
          color: #9c9c9c;
          font-size: 11px;
        }

        .diary-editor .danger {
          border-color: #703333;
          color: #ffd0d0;
        }

        .master-sidebar {
          grid-template-rows: auto minmax(150px, 0.9fr) minmax(0, 1.1fr);
        }

        .master-reveal-list,
        .master-chat-panel {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid #292929;
        }

        .master-reveal-list > strong {
          color: #ffb3b3;
          font-size: 13px;
        }

        .master-reveal-list article,
        .master-chat-list article {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
          display: grid;
          gap: 5px;
        }

        .master-reveal-list article span,
        .master-reveal-list article small,
        .master-reveal-list article time,
        .master-chat-list time {
          color: #9c9c9c;
          font-size: 11px;
        }

        .master-reveal-list article strong,
        .master-chat-list article strong {
          color: #f4f4f4;
          font-size: 13px;
        }

        .master-reveal-list article p,
        .master-chat-list article p {
          margin: 0;
          color: #ddd;
          font-size: 12px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .master-chat-panel {
          border-bottom: 0;
          grid-template-rows: auto minmax(0, 1fr) auto;
        }

        .master-chat-panel label {
          display: grid;
          gap: 5px;
          color: #9c9c9c;
          font-size: 12px;
        }

        .master-chat-panel select,
        .master-chat-composer textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .master-chat-list {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 8px;
        }

        .master-chat-list article.own {
          border-color: rgba(54, 214, 117, 0.42);
          background: #142019;
        }

        .master-chat-composer {
          display: grid;
          gap: 8px;
        }

        .master-chat-composer textarea {
          resize: vertical;
        }

        .master-chat-composer button {
          min-height: 32px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .master-chat-composer button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-message-meta strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          color: #f4f4f4;
        }

        .chat-message-meta time,
        .chat-message > span {
          color: #8e8e8e;
          font-size: 11px;
        }

        .chat-message p {
          margin: 7px 0 6px;
          color: #e9e9e9;
          font-size: 13px;
          line-height: 1.42;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .chat-composer {
          display: grid;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid #292929;
          background: #101010;
        }

        .chat-composer textarea {
          min-height: 72px;
          resize: vertical;
          line-height: 1.35;
        }

        @media (max-width: 1040px) {
          html,
          body {
            overflow: auto !important;
          }

          .table-page-shell {
            padding: 14px 10px;
          }

          .table-layout {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 0;
          }

          .play-surface {
            height: min(68svh, 680px);
            min-height: 420px;
          }

          .right-rail {
            grid-template-rows: auto minmax(420px, 52svh);
          }

          .table-topbar {
            display: grid;
          }
        }

        @media (max-width: 720px) {
          .table-page-shell {
            padding: 8px;
          }

          .table-topbar {
            gap: 10px;
            margin-bottom: 8px;
          }

          h1 {
            font-size: 24px;
          }

          .table-kicker {
            font-size: 10px;
            margin-bottom: 3px;
          }

          .table-actions {
            width: 100%;
            overflow-x: auto;
            padding-bottom: 2px;
          }

          .table-actions a,
          .table-actions button {
            flex: 0 0 auto;
            padding: 8px 10px;
            font-size: 12px;
          }

          .master-password-control {
            min-width: 260px;
          }

          .table-layout {
            gap: 8px;
          }

          .play-surface {
            height: 58svh;
            min-height: 340px;
          }

          .surface-head {
            grid-template-columns: 1fr auto;
            display: grid;
            padding: 8px;
          }

          .surface-head div:nth-child(2) {
            display: none;
          }

          .zoom-tools button {
            width: 38px;
            height: 34px;
          }

          .right-rail {
            grid-template-rows: auto minmax(360px, 42svh);
            gap: 8px;
          }

          .right-tabs button,
          .sub-tabs button {
            height: 38px;
            font-size: 12px;
          }

          .layer-row {
            min-height: 76px;
          }

          .layer-name {
            min-height: 76px;
            grid-template-columns: 64px minmax(0, 1fr) 24px auto;
            gap: 9px;
            padding: 6px;
          }

          .layer-thumb {
            width: 64px !important;
            height: 54px !important;
            min-width: 64px !important;
            min-height: 54px !important;
            max-width: 64px !important;
            max-height: 54px !important;
          }

          .layer-title span {
            font-size: 17px;
          }

          .folder-toggle {
            width: 24px;
            height: 40px;
            font-size: 26px;
          }

          .layer-quick-actions {
            gap: 5px;
          }

          .layer-quick-actions button {
            width: 28px;
            height: 28px;
          }

          .media-preview-backdrop {
            padding: 8px;
          }

          .media-preview-modal {
            height: 88svh;
          }

          .image-editor-backdrop {
            padding: 8px;
          }

          .image-editor-modal {
            height: 92svh;
          }

          .image-editor-modal header {
            display: grid;
          }

          .image-editor-body {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(0, 1fr) auto;
          }

          .image-editor-tools {
            border-left: 0;
            border-top: 1px solid #2b2b2b;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .editor-slider {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </main>
  )
}
