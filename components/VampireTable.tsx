'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import MusicPanel from './music/MusicPanel'

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
}

type CharacterRow = {
  id: string
  name: string
  clan: string | null
}

type ChatMessage = {
  id: string
  room: string
  userId: string
  username: string
  characterId: string | null
  characterName: string
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
  message: string
  created_at: string
}

type TableLayer = {
  id: string
  room: string
  layerType: 'image' | 'video' | 'folder'
  ownerRole: TableRole
  parentId: string | null
  name: string
  imageData: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  visible: boolean
  locked: boolean
  createdAt: string
}

type TableLayerRow = {
  id: string
  room: string
  layer_type: 'image' | 'video' | 'folder' | null
  owner_role: TableRole | null
  parent_id: string | null
  name: string
  image_data: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  z_index: number | null
  visible: boolean | null
  locked: boolean | null
  created_at: string
}

type TableRole = 'master' | 'player'

type LayerPatch = Partial<Pick<TableLayer, 'layerType' | 'ownerRole' | 'parentId' | 'name' | 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'visible' | 'locked'>>

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

type RightRailTab = 'music' | 'layers' | 'rolls' | 'chat'

const TABLE_ROLLS = 'table_rolls'
const TABLE_CHAT_MESSAGES = 'table_chat_messages'
const TABLE_IMAGES = 'table_images'
const TABLE_IMAGE_BUCKET = 'table-images'
const ROOT_LAYER_DROP_ID = '__root__'

function getRoomFromLocation() {
  if (typeof window === 'undefined') return 'campaign-666'
  return new URLSearchParams(window.location.search).get('room') || 'campaign-666'
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
    message: row.message,
    createdAt: row.created_at,
  }
}

function mapLayerRow(row: TableLayerRow): TableLayer {
  return {
    id: row.id,
    room: row.room,
    layerType: row.layer_type ?? 'image',
    ownerRole: row.owner_role ?? 'player',
    parentId: row.parent_id ?? null,
    name: row.name,
    imageData: row.image_data,
    x: row.x ?? 80,
    y: row.y ?? 80,
    width: row.width ?? 420,
    height: row.height ?? 280,
    zIndex: row.z_index ?? 1,
    visible: row.visible ?? true,
    locked: row.locked ?? false,
    createdAt: row.created_at,
  }
}

function toDbPatch(patch: LayerPatch) {
  const dbPatch: Record<string, unknown> = {}
  if (patch.layerType !== undefined) dbPatch.layer_type = patch.layerType
  if (patch.ownerRole !== undefined) dbPatch.owner_role = patch.ownerRole
  if (patch.parentId !== undefined) dbPatch.parent_id = patch.parentId
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.x !== undefined) dbPatch.x = patch.x
  if (patch.y !== undefined) dbPatch.y = patch.y
  if (patch.width !== undefined) dbPatch.width = patch.width
  if (patch.height !== undefined) dbPatch.height = patch.height
  if (patch.zIndex !== undefined) dbPatch.z_index = patch.zIndex
  if (patch.visible !== undefined) dbPatch.visible = patch.visible
  if (patch.locked !== undefined) dbPatch.locked = patch.locked
  return dbPatch
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
    return lastPart || parsed.hostname || 'internet-image'
  } catch {
    return 'internet-image'
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

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return /\.(mp4|webm|mov|m4v|ogv|ogg)(?:$|[?#])/i.test(parsed.pathname + parsed.search)
  } catch {
    return false
  }
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
    .map(url => {
      if (isImageUrlCandidate(url)) return { url, layerType: 'image' as const }
      if (isVideoUrlCandidate(url)) return { url, layerType: 'video' as const }
      return null
    })
    .filter((item): item is { url: string; layerType: 'image' | 'video' } => Boolean(item))
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [tableRole, setTableRole] = useState<TableRole | null>(null)
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [chatCharacters, setChatCharacters] = useState<CharacterOption[]>([])
  const [selectedChatCharacterId, setSelectedChatCharacterId] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [chatUsernameDraft, setChatUsernameDraft] = useState('')
  const [chatPasswordDraft, setChatPasswordDraft] = useState('')
  const [chatAuthMode, setChatAuthMode] = useState<'login' | 'register'>('login')
  const [chatStatus, setChatStatus] = useState('Чат подключается...')
  const [isChatBusy, setIsChatBusy] = useState(false)
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set())
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [isUploading, setIsUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [layerContextMenu, setLayerContextMenu] = useState<LayerContextMenu>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [layerDropTarget, setLayerDropTarget] = useState<LayerDropTarget>(null)
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('layers')
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const layersRef = useRef<TableLayer[]>([])
  const panRef = useRef(pan)
  const suppressNextContextMenuRef = useRef(false)
  const isMaster = tableRole === 'master'

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useEffect(() => {
    const savedRole = window.localStorage.getItem('vtm-table-role')
    if (savedRole === 'master' || savedRole === 'player') setTableRole(savedRole)

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
  }, [chatMessages, rightRailTab])

  useEffect(() => {
    if (!chatUser) {
      setChatCharacters([])
      setSelectedChatCharacterId('')
      return
    }

    let cancelled = false
    createClient()
      .from('characters')
      .select('id, name, clan')
      .eq('user_id', chatUser.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить персонажей:', error)
          setChatStatus('Персонажи не загрузились')
          return
        }

        const characters = (data || []).map(row => row as CharacterRow)
        setChatCharacters(characters)
        const savedId = window.localStorage.getItem(`vtm-chat-character:${chatUser.id}`)
        const nextId = savedId && characters.some(character => character.id === savedId)
          ? savedId
          : characters[0]?.id || ''
        setSelectedChatCharacterId(nextId)
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

  const chooseTableRole = (role: TableRole) => {
    window.localStorage.setItem('vtm-table-role', role)
    setTableRole(role)
  }

  const resetTableRole = () => {
    window.localStorage.removeItem('vtm-table-role')
    setTableRole(null)
  }

  useEffect(() => {
    const currentRoom = getRoomFromLocation()
    const supabase = createClient()
    let cancelled = false

    setRoom(currentRoom)

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

    supabase
      .from(TABLE_IMAGES)
      .select('id, room, layer_type, owner_role, parent_id, name, image_data, x, y, width, height, z_index, visible, locked, created_at')
      .eq('room', currentRoom)
      .order('z_index', { ascending: true })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить слои стола:', error)
          setTableStatus('Нет общей сцены')
          return
        }

        const next = sortLayers((data || []).map(row => mapLayerRow(row as TableLayerRow)))
        layersRef.current = next
        setLayers(next)
        setTableStatus('Сцена онлайн')
      })

    supabase
      .from(TABLE_CHAT_MESSAGES)
      .select('id, room, user_id, username, character_id, character_name, message, created_at')
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
        if (!layer || layer.room !== currentRoom) return
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
      .on('broadcast', { event: 'chat-message' }, payload => {
        const message = payload.payload as ChatMessage
        if (!message || message.room !== currentRoom) return
        setChatMessages(prev => mergeChatMessage(prev, message))
        setChatStatus('Чат онлайн')
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
          setLayers(prev => {
            const next = upsertLayer(prev, mapLayerRow(payload.new as TableLayerRow))
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
          setLayers(prev => {
            const next = upsertLayer(prev, mapLayerRow(payload.new as TableLayerRow))
            layersRef.current = next
            return next
          })
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

  const latest = rolls[0]
  const totalDice = useMemo(() => rolls.reduce((sum, roll) => sum + roll.diceCount, 0), [rolls])
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) || null
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

  const visibleLayers = useMemo(() => sortLayers(layers).filter(isLayerEffectivelyVisible), [layers])
  const managerLayers = useMemo(
    () => (isMaster ? layers : layers.filter(layer => layer.ownerRole !== 'master')),
    [isMaster, layers]
  )
  const selectedManagerLayer = managerLayers.find(layer => layer.id === selectedLayerId) || null
  const layerTree = useMemo<LayerTreeNode[]>(() => {
    const nodeMap = new Map<string, LayerTreeNode>()
    sortLayers(managerLayers).forEach(layer => nodeMap.set(layer.id, { ...layer, children: [] }))

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
  }, [managerLayers])
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
    window.localStorage.removeItem('vtm-chat-user')
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

  const patchLayer = async (id: string, patch: LayerPatch, options: { persist?: boolean } = { persist: true }) => {
    const existingLayer = layersRef.current.find(layer => layer.id === id)
    if (!isMaster && existingLayer?.ownerRole === 'master') return

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
    layerType: 'image' | 'video' = 'image',
    index = 0,
    point?: { x: number; y: number }
  ) => {
    const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const fitWidth = Math.min(760, Math.max(220, natural.width))
    const fitHeight = Math.max(160, Math.round((fitWidth / Math.max(1, natural.width)) * Math.max(1, natural.height)))
    const ownerRole = tableRole ?? 'player'
    const activeFolder = selectedLayer?.layerType === 'folder' && (isMaster || selectedLayer.ownerRole !== 'master') ? selectedLayer : null
    const layer: TableLayer = {
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      room,
      layerType,
      ownerRole,
      parentId: activeFolder?.id || null,
      name,
      imageData,
      x: Math.round(point?.x ?? (activeFolder?.x ?? 80) + ((layersRef.current.length + index) % 6) * 28),
      y: Math.round(point?.y ?? (activeFolder?.y ?? 70) + ((layersRef.current.length + index) % 6) * 24),
      width: fitWidth,
      height: fitHeight,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      createdAt: new Date().toISOString(),
    }

    const { error } = await createClient().from(TABLE_IMAGES).insert({
      id: layer.id,
      room: layer.room,
      layer_type: layer.layerType,
      owner_role: layer.ownerRole,
      parent_id: layer.parentId,
      name: layer.name,
      image_data: layer.imageData,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      z_index: layer.zIndex,
      visible: layer.visible,
      locked: layer.locked,
      created_at: layer.createdAt,
    })

    layersRef.current = upsertLayer(layersRef.current, layer)
    setLayers(layersRef.current)
    setSelectedLayerId(layer.id)
    broadcast('layer', layer)

    if (error) {
      console.error('Не удалось сохранить слой стола:', error)
      setTableStatus('Слой показан онлайн, но не сохранён')
      window.alert('Слой показан онлайн, но не сохранился. Нужно обновить table_images в Supabase.')
    }
  }

  const uploadFiles = async (files: FileList | File[]) => {
    const mediaFiles = Array.from(files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'))
    if (mediaFiles.length === 0) {
      window.alert('Можно загрузить только картинки или видео.')
      return
    }

    setIsUploading(true)

    try {
      const supabase = createClient()
      for (const [index, file] of mediaFiles.entries()) {
        const layerType = file.type.startsWith('video/') ? 'video' : 'image'
        const id = `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
        const objectUrl = URL.createObjectURL(file)
        const natural = await getMediaSize(objectUrl, layerType)
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
          console.error('Не удалось загрузить картинку в Storage:', uploadError)
          window.alert('Картинка не загрузилась в Supabase Storage. Проверь, что создан bucket table-images и policies из SQL.')
          continue
        }

        const { data: publicUrlData } = supabase.storage.from(TABLE_IMAGE_BUCKET).getPublicUrl(storagePath)
        await addMediaLayer(publicUrlData.publicUrl, file.name, natural, layerType, index)
      }

      setTableStatus('Сцена онлайн')
    } finally {
      setIsUploading(false)
    }
  }

  const addRemoteMediaUrls = async (items: Array<{ url: string; layerType: 'image' | 'video' }>, point?: { x: number; y: number }) => {
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
          point ? { x: point.x + index * 28, y: point.y + index * 24 } : undefined
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
      await uploadFiles(event.target.files)
      event.target.value = ''
    }
  }

  const deleteLayer = async (layerId: string) => {
    const layer = layersRef.current.find(item => item.id === layerId) || layers.find(item => item.id === layerId)
    const childIds = getDescendantIds(layerId)
    const requestedDeleteIds = new Set([layerId, ...childIds])
    const deleteIds = isMaster
      ? requestedDeleteIds
      : new Set([...requestedDeleteIds].filter(id => layersRef.current.find(item => item.id === id)?.ownerRole !== 'master'))
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

    await Promise.all(deletedLayers.filter(item => item.layerType === 'image' || item.layerType === 'video').map(async deletedLayer => {
      const storagePath = getStoragePathFromPublicUrl(deletedLayer.imageData)
      if (storagePath) {
        const { error } = await supabase.storage.from(TABLE_IMAGE_BUCKET).remove([storagePath])
        if (error) console.error('Не удалось удалить файл слоя из Storage:', error)
      }
    }))
  }

  const createFolder = async (parentId: string | null = null) => {
    const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const siblingCount = layersRef.current.filter(layer => layer.layerType === 'folder' && layer.parentId === parentId).length
    const parentFolder = parentId ? layersRef.current.find(layer => layer.id === parentId) : null
    const folder: TableLayer = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      layerType: 'folder',
      ownerRole: tableRole ?? 'player',
      parentId,
      name: `Папка ${siblingCount + 1}`,
      imageData: '',
      x: (parentFolder?.x ?? 120) + (siblingCount % 5) * 36,
      y: (parentFolder?.y ?? 120) + (siblingCount % 5) * 28,
      width: 520,
      height: 320,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      createdAt: new Date().toISOString(),
    }

    const { error } = await createClient().from(TABLE_IMAGES).insert({
      id: folder.id,
      room: folder.room,
      layer_type: folder.layerType,
      owner_role: folder.ownerRole,
      parent_id: folder.parentId,
      name: folder.name,
      image_data: folder.imageData,
      x: folder.x,
      y: folder.y,
      width: folder.width,
      height: folder.height,
      z_index: folder.zIndex,
      visible: folder.visible,
      locked: folder.locked,
      created_at: folder.createdAt,
    })

    layersRef.current = upsertLayer(layersRef.current, folder)
    setLayers(layersRef.current)
    setSelectedLayerId(folder.id)
    if (parentId) setExpandedFolders(prev => new Set(prev).add(parentId))
    broadcast('layer', folder)

    if (error) {
      console.error('Не удалось сохранить папку:', error)
      setTableStatus('Папка показана онлайн, но не сохранена')
    }
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
      .filter(layer => isMaster || layer.ownerRole !== 'master')
      .map(layer => ({ id: layer.id, patch: patchFor(layer) }))
    await patchLayers(patches)
  }

  const deleteSelectedLayers = async (ids: string[]) => {
    for (const id of ids) await deleteLayer(id)
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
    const nextZoom = Math.min(3, Math.max(0.25, Math.min((rect.width - 80) / contentWidth, (rect.height - 80) / contentHeight)))
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

  const canMoveLayer = (layer: TableLayer) => {
    if (layer.locked) return false
    return isMaster || layer.ownerRole !== 'master'
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
    const draggableLayers = isMaster ? layersRef.current : layersRef.current.filter(layer => layer.ownerRole !== 'master')
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

    const draggableLayers = isMaster ? layersRef.current : layersRef.current.filter(layer => layer.ownerRole !== 'master')
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
    if (!isMaster && layer.ownerRole === 'master') return
    if (layer.locked) return
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
    const nextZoom = Math.min(3, Math.max(0.25, zoom * (event.deltaY > 0 ? 0.9 : 1.1)))
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

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.some(file => file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      await uploadFiles(droppedFiles)
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) {
      await addRemoteMediaUrls(mediaUrls, getScenePointFromClient(event.clientX, event.clientY))
      return
    }

    if (droppedFiles.length > 0) await uploadFiles(droppedFiles)
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
          onDoubleClick={() => renameLayer(layer)}
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
          <h1>Стол: {room}</h1>
        </div>
        <div className="table-actions">
          <button type="button" className="role-pill" onClick={resetTableRole}>
            {isMaster ? 'Мастер' : tableRole === 'player' ? 'Игрок' : 'Выбрать роль'}
          </button>
          <a href="/old" title="Открыть лист персонажа">Лист</a>
          <button type="button" onClick={() => createFolder()}>Папка</button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? 'Загрузка...' : 'Добавить слой'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleImageUpload} />
        </div>
      </section>

      <section className="table-layout">
        <section className="play-surface" aria-label="Игровой стол">
          <header className="surface-head">
            <div>
              <span>{tableStatus}</span>
              <strong>{layers.length ? `${layers.length} слоёв` : 'Пустая сцена'}</strong>
            </div>
            <div>
              <span>Масштаб</span>
              <strong>{Math.round(zoom * 100)}%</strong>
            </div>
            <div className="zoom-tools">
              <button type="button" onClick={() => setZoom(prev => Math.max(0.25, prev - 0.1))}>−</button>
              <button type="button" onClick={() => setZoom(1)}>100</button>
              <button type="button" onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}>+</button>
            </div>
          </header>

          <div
            ref={sceneRef}
            className={`scene ${isDraggingOver ? 'drag-over' : ''}`}
            onPointerDown={startPan}
            onPointerMove={updateLayerDrag}
            onPointerUp={finishLayerDrag}
            onPointerCancel={finishLayerDrag}
            onPointerLeave={finishLayerDrag}
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
                  className={`scene-layer ${layer.layerType === 'folder' ? 'folder-layer' : ''} ${layer.layerType === 'video' ? 'video-layer' : ''} ${selectedLayerIds.has(layer.id) ? 'selected' : ''} ${layer.locked || (!isMaster && layer.ownerRole === 'master') ? 'locked' : ''}`}
                  key={layer.id}
                  style={{
                    left: layer.x,
                    top: layer.y,
                    width: layer.width,
                    height: layer.height,
                    zIndex: layer.zIndex,
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
                >
                  {layer.layerType === 'folder' ? (
                    <div className="folder-surface">
                      <span>{layer.name}</span>
                    </div>
                  ) : layer.layerType === 'video' ? (
                    <>
                      <video
                        src={layer.imageData}
                        controls
                        loop
                        playsInline
                        draggable={false}
                        onPointerDown={event => event.stopPropagation()}
                        onError={event => {
                          event.currentTarget.style.display = 'none'
                          event.currentTarget.parentElement?.classList.add('image-load-error')
                        }}
                      />
                      <span className="broken-image-label">{layer.name}</span>
                    </>
                  ) : (
                    <>
                      <img
                        src={layer.imageData}
                        alt=""
                        draggable={false}
                        onError={event => {
                          event.currentTarget.style.display = 'none'
                          event.currentTarget.parentElement?.classList.add('image-load-error')
                        }}
                      />
                      <span className="broken-image-label">{layer.name}</span>
                    </>
                  )}
                  {selectedLayerId === layer.id && selectedLayerIds.size <= 1 && !layer.locked && (isMaster || layer.ownerRole !== 'master') ? (
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

        <aside className="right-rail">
          <nav className="right-tabs" aria-label="Панели стола">
            <button
              type="button"
              className={rightRailTab === 'music' ? 'active' : ''}
              onClick={() => setRightRailTab('music')}
            >
              Музыка
            </button>
            <button
              type="button"
              className={rightRailTab === 'layers' ? 'active' : ''}
              onClick={() => setRightRailTab('layers')}
            >
              Изображения
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
          </nav>

          <MusicPanel room={room} tableRole={tableRole} channelRef={channelRef} hidden={rightRailTab !== 'music'} />

          <section className={`layer-panel table-right-panel ${rightRailTab === 'layers' ? '' : 'table-right-panel-hidden'}`} aria-label="Слои стола">
            <header>
              <strong>Слои</strong>
              <span>{selectedManagerLayer?.name || 'ничего не выбрано'}</span>
            </header>

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
                  <div className="chat-user-row">
                    <span>{chatUser.username}</span>
                    <button type="button" onClick={logoutChat}>Выйти</button>
                  </div>
                  <label>
                    <span>Писать как</span>
                    <select
                      value={selectedChatCharacterId}
                      onChange={event => {
                        setSelectedChatCharacterId(event.target.value)
                        window.localStorage.setItem(`vtm-chat-character:${chatUser.id}`, event.target.value)
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

            <section className="chat-list" ref={chatListRef}>
              {chatMessages.length === 0 ? (
                <p className="panel-empty">Сообщений пока нет.</p>
              ) : (
                chatMessages.map(message => (
                  <article className={`chat-message ${message.userId === chatUser?.id ? 'own' : ''}`} key={message.id}>
                    <div className="chat-message-meta">
                      <strong>{message.characterName}</strong>
                      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                    </div>
                    <p>{message.message}</p>
                    <span>{message.username}</span>
                  </article>
                ))
              )}
            </section>

            <form className="chat-composer" onSubmit={sendChatMessage}>
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
        </aside>
      </section>

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
        return (
          <div
            className="layer-context-menu"
            style={{ left: layerContextMenu.x, top: layerContextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            {singleLayer ? <button type="button" onClick={() => renameLayer(singleLayer)}>Переименовать</button> : null}
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
            {singleLayer?.layerType === 'folder' ? (
              <button type="button" onClick={() => {
                createFolder(singleLayer.id)
                setLayerContextMenu(null)
              }}>Новая папка внутри</button>
            ) : null}
            {contextLayers.some(item => item.parentId) ? (
              <button type="button" onClick={() => {
                patchSelectedLayers(ids, () => ({ parentId: null }))
                setLayerContextMenu(null)
              }}>Вынести из папки</button>
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
            <div>
              <button type="button" onClick={() => chooseTableRole('master')}>
                Мастер
              </button>
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

        .table-actions input {
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

        .table-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 420px;
          gap: 12px;
          height: calc(100vh - 106px);
          min-height: 560px;
        }

        .play-surface,
        .layer-panel,
        .roll-sidebar,
        .chat-sidebar {
          border: 1px solid #2b2b2b;
          background: #101010;
          border-radius: 8px;
          overflow: hidden;
        }

        .play-surface {
          min-width: 0;
          display: grid;
          grid-template-rows: auto 1fr;
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

        .scene {
          position: relative;
          min-height: 0;
          overflow: hidden;
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
          background: #050505;
          user-select: none;
          touch-action: none;
          cursor: move;
          box-shadow: 0 10px 30px rgba(0,0,0,0.28);
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
        .scene-layer video {
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
        }

        .scene-layer img {
          pointer-events: none;
        }

        .scene-layer video,
        .video-layer {
          background: #050505;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          grid-template-columns: 1fr 1fr;
          gap: 10px;
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
          grid-template-rows: auto auto minmax(0, 1fr) auto;
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

        .chat-message-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
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
          }

          .play-surface {
            height: 68vh;
          }

          .right-rail {
            grid-template-rows: auto 520px;
          }

          .table-topbar {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}
