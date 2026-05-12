'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

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

type TableLayer = {
  id: string
  room: string
  layerType: 'image' | 'folder'
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
  layer_type: 'image' | 'folder' | null
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

type MusicState = {
  room: string
  url: string
  activeUri: string
  isPlaying: boolean
  positionSeconds: number
  updatedAt: string
}

type MusicRow = {
  room: string
  url: string
  active_uri: string | null
  is_playing: boolean | null
  position_seconds: number | null
  updated_at: string
}

type MusicLibraryItem = {
  id: string
  room: string
  itemType: 'track' | 'folder'
  parentId: string | null
  name: string
  url: string
  createdAt: string
}

type MusicLibraryRow = {
  id: string
  room: string
  item_type: 'track' | 'folder' | null
  parent_id: string | null
  name: string
  url: string | null
  created_at: string
}

type MusicTreeNode = MusicLibraryItem & {
  children: MusicTreeNode[]
}

type SpotifyController = {
  loadUri: (spotifyUri: string, preferVideo?: boolean, startAt?: number) => void
  play: () => void
  pause: () => void
  resume: () => void
  seek: (seconds: number) => void
  destroy: () => void
  addListener: (event: string, callback: (event: { data: { playingURI?: string; isPaused?: boolean; position?: number } }) => void) => void
}

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number; theme?: string },
    callback: (controller: SpotifyController) => void
  ) => void
}

type YouTubePlayerStateEvent = {
  data: number
  target: YouTubePlayer
}

type YouTubePlayer = {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setVolume: (volume: number) => void
  getCurrentTime: () => number
  getVideoData: () => { video_id?: string }
  destroy: () => void
}

type YouTubeIframeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string
      height?: string | number
      width?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void
        onStateChange?: (event: YouTubePlayerStateEvent) => void
        onAutoplayBlocked?: () => void
      }
    }
  ) => YouTubePlayer
}

type TableRole = 'master' | 'player'

type LayerPatch = Partial<Pick<TableLayer, 'layerType' | 'ownerRole' | 'parentId' | 'name' | 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'visible' | 'locked'>>

type DragState = {
  id: string
  mode: 'move' | 'resize' | 'pan'
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

type LayerTreeNode = TableLayer & {
  children: LayerTreeNode[]
}

type LayerContextMenu = {
  layerId: string
  x: number
  y: number
} | null

type LayerDropPlacement = 'before' | 'after' | 'inside'

type LayerDropTarget = {
  layerId: string
  placement: LayerDropPlacement
} | null

type RightRailTab = 'music' | 'layers' | 'rolls'

const TABLE_ROLLS = 'table_rolls'
const TABLE_IMAGES = 'table_images'
const TABLE_MUSIC = 'table_music'
const TABLE_MUSIC_LIBRARY = 'table_music_library'
const TABLE_IMAGE_BUCKET = 'table-images'
const TABLE_MUSIC_BUCKET = 'table-music'
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

function upsertLayer(layers: TableLayer[], layer: TableLayer) {
  const exists = layers.some(item => item.id === layer.id)
  const next = exists ? layers.map(item => (item.id === layer.id ? layer : item)) : [...layers, layer]
  return sortLayers(next).slice(0, 80)
}

function upsertMusicLibraryItem(items: MusicLibraryItem[], item: MusicLibraryItem) {
  const exists = items.some(existing => existing.id === item.id)
  const next = exists ? items.map(existing => (existing.id === item.id ? item : existing)) : [...items, item]
  return next.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 160)
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

function safeStorageName(name: string) {
  const cleanName = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleanName || 'image'
}

function getStoragePathFromPublicUrl(publicUrl: string) {
  const marker = `/storage/v1/object/public/${TABLE_IMAGE_BUCKET}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0])
}

function mapMusicRow(row: MusicRow): MusicState {
  return {
    room: row.room,
    url: row.url || '',
    activeUri: row.active_uri || '',
    isPlaying: row.is_playing ?? false,
    positionSeconds: row.position_seconds ?? 0,
    updatedAt: row.updated_at,
  }
}

function mapMusicLibraryRow(row: MusicLibraryRow): MusicLibraryItem {
  return {
    id: row.id,
    room: row.room,
    itemType: row.item_type ?? 'track',
    parentId: row.parent_id ?? null,
    name: row.name,
    url: row.url || '',
    createdAt: row.created_at,
  }
}

function getSpotifyUri(url: string) {
  try {
    const parsed = new URL(url.trim())
    if (parsed.hostname.replace(/^www\./, '') !== 'open.spotify.com') return ''

    const [type, id] = parsed.pathname.split('/').filter(Boolean)
    return type && id ? `spotify:${type}:${id}` : ''
  } catch {
    return ''
  }
}

function getMusicProvider(url: string) {
  const raw = url.trim()
  if (!raw) return 'none'

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube'
    if (host === 'open.spotify.com') return 'spotify'
    if (/\.(mp3|wav|ogg|m4a|flac|webm|aac)(\?.*)?$/i.test(parsed.pathname)) return 'file'
  } catch {
    return 'none'
  }

  return 'none'
}

function getYouTubeId(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] || ''
    }

    if (host.endsWith('youtube.com')) {
      return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop() || ''
    }
  } catch {
    return ''
  }

  return ''
}

function getSpotifyEmbedUrl(url: string) {
  const raw = url.trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'open.spotify.com') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`
    }
  } catch {
    return ''
  }

  return ''
}

function loadYouTubeIframeApi() {
  return new Promise<YouTubeIframeApi>((resolve, reject) => {
    const win = window as typeof window & {
      YT?: YouTubeIframeApi
      __youtubeIframeApiResolvers?: Array<(api: YouTubeIframeApi) => void>
      onYouTubeIframeAPIReady?: () => void
    }

    if (win.YT?.Player) {
      resolve(win.YT)
      return
    }

    win.__youtubeIframeApiResolvers = win.__youtubeIframeApiResolvers || []
    win.__youtubeIframeApiResolvers.push(resolve)
    win.onYouTubeIframeAPIReady = () => {
      if (!win.YT?.Player) return
      win.__youtubeIframeApiResolvers?.splice(0).forEach(callback => callback(win.YT as YouTubeIframeApi))
    }

    if (document.querySelector('script[data-youtube-iframe-api="true"]')) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.dataset.youtubeIframeApi = 'true'
    script.onerror = () => reject(new Error('YouTube IFrame API failed to load'))
    document.body.appendChild(script)
  })
}

function loadSpotifyIframeApi() {
  return new Promise<SpotifyIframeApi>((resolve, reject) => {
    const win = window as typeof window & {
      __spotifyIframeApi?: SpotifyIframeApi
      __spotifyIframeApiResolvers?: Array<(api: SpotifyIframeApi) => void>
      onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void
    }

    if (win.__spotifyIframeApi) {
      resolve(win.__spotifyIframeApi)
      return
    }

    win.__spotifyIframeApiResolvers = win.__spotifyIframeApiResolvers || []
    win.__spotifyIframeApiResolvers.push(resolve)
    win.onSpotifyIframeApiReady = api => {
      win.__spotifyIframeApi = api
      win.__spotifyIframeApiResolvers?.splice(0).forEach(callback => callback(api))
    }

    if (document.querySelector('script[data-spotify-iframe-api="true"]')) return

    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    script.dataset.spotifyIframeApi = 'true'
    script.onerror = () => reject(new Error('Spotify iFrame API failed to load'))
    document.body.appendChild(script)
  })
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [tableRole, setTableRole] = useState<TableRole | null>(null)
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [musicLibrary, setMusicLibrary] = useState<MusicLibraryItem[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedMusicFolderId, setSelectedMusicFolderId] = useState<string | null>(null)
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [isUploading, setIsUploading] = useState(false)
  const [isMusicUploading, setIsMusicUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [musicUrl, setMusicUrl] = useState('')
  const [musicActiveUri, setMusicActiveUri] = useState('')
  const [musicDraft, setMusicDraft] = useState('')
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicPositionSeconds, setMusicPositionSeconds] = useState(0)
  const [musicUpdatedAt, setMusicUpdatedAt] = useState(new Date(0).toISOString())
  const [musicStatus, setMusicStatus] = useState('Музыка не выбрана')
  const [localYouTubeVolume, setLocalYouTubeVolume] = useState(70)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedMusicFolders, setExpandedMusicFolders] = useState<Set<string>>(new Set())
  const [layerContextMenu, setLayerContextMenu] = useState<LayerContextMenu>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [layerDropTarget, setLayerDropTarget] = useState<LayerDropTarget>(null)
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('layers')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const musicFileInputRef = useRef<HTMLInputElement>(null)
  const audioPlayerRef = useRef<HTMLAudioElement>(null)
  const youtubeShellRef = useRef<HTMLDivElement>(null)
  const youtubeMountRef = useRef<HTMLDivElement>(null)
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null)
  const youtubeVideoIdRef = useRef('')
  const youtubeLastPublishRef = useRef(0)
  const spotifyMountRef = useRef<HTMLDivElement>(null)
  const spotifyControllerRef = useRef<SpotifyController | null>(null)
  const spotifyLastPublishRef = useRef(0)
  const musicStateRef = useRef<MusicState>({
    room: 'campaign-666',
    url: '',
    activeUri: '',
    isPlaying: false,
    positionSeconds: 0,
    updatedAt: new Date(0).toISOString(),
  })
  const sceneRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const layersRef = useRef<TableLayer[]>([])
  const musicLibraryRef = useRef<MusicLibraryItem[]>([])
  const panRef = useRef(pan)
  const isMaster = tableRole === 'master'

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    musicLibraryRef.current = musicLibrary
  }, [musicLibrary])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useEffect(() => {
    const savedRole = window.localStorage.getItem('vtm-table-role')
    if (savedRole === 'master' || savedRole === 'player') setTableRole(savedRole)
  }, [])

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
    const savedVolume = Number(window.localStorage.getItem('vtm-youtube-volume'))
    if (Number.isFinite(savedVolume)) setLocalYouTubeVolume(Math.min(100, Math.max(0, savedVolume)))
  }, [])

  const applyMusicState = (music: MusicState) => {
    musicStateRef.current = music
    setMusicUrl(music.url || '')
    setMusicActiveUri(music.activeUri || '')
    setMusicDraft(music.url || '')
    setMusicPlaying(music.isPlaying)
    setMusicPositionSeconds(music.positionSeconds)
    setMusicUpdatedAt(music.updatedAt)
    setMusicStatus(music.url ? (music.isPlaying ? 'Играет синхронно' : 'Пауза') : 'Музыка выключена')
  }

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
      .from(TABLE_MUSIC)
      .select('room, url, active_uri, is_playing, position_seconds, updated_at')
      .eq('room', currentRoom)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить музыку комнаты:', error)
          setMusicStatus('Нет общей музыки')
          return
        }

        const music = data ? mapMusicRow(data as MusicRow) : null
        if (music) applyMusicState(music)
        else setMusicStatus('Музыка не выбрана')
      })

    supabase
      .from(TABLE_MUSIC_LIBRARY)
      .select('id, room, item_type, parent_id, name, url, created_at')
      .eq('room', currentRoom)
      .order('created_at', { ascending: true })
      .limit(160)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить музыкальную библиотеку:', error)
          return
        }

        const next = (data || []).map(row => mapMusicLibraryRow(row as MusicLibraryRow))
        musicLibraryRef.current = next
        setMusicLibrary(next)
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
      })
      .on('broadcast', { event: 'music' }, payload => {
        const music = payload.payload as MusicState
        if (!music || music.room !== currentRoom) return
        applyMusicState(music)
      })
      .on('broadcast', { event: 'music-library' }, payload => {
        const item = payload.payload as MusicLibraryItem
        if (!item || item.room !== currentRoom) return
        setMusicLibrary(prev => {
          const next = upsertMusicLibraryItem(prev, item)
          musicLibraryRef.current = next
          return next
        })
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
          event: '*',
          schema: 'public',
          table: TABLE_MUSIC,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          const next = (payload.new || payload.old) as MusicRow
          const music = mapMusicRow(next)
          applyMusicState(music)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_MUSIC_LIBRARY,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          setMusicLibrary(prev => {
            const next = upsertMusicLibraryItem(prev, mapMusicLibraryRow(payload.new as MusicLibraryRow))
            musicLibraryRef.current = next
            return next
          })
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
  const musicTree = useMemo<MusicTreeNode[]>(() => {
    const nodeMap = new Map<string, MusicTreeNode>()
    musicLibrary.forEach(item => nodeMap.set(item.id, { ...item, children: [] }))

    const roots: MusicTreeNode[] = []
    nodeMap.forEach(node => {
      const parent = node.parentId ? nodeMap.get(node.parentId) : null
      if (parent && parent.id !== node.id) parent.children.push(node)
      else roots.push(node)
    })

    const sortNodes = (nodes: MusicTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.itemType !== b.itemType) return a.itemType === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name, 'ru')
      })
      nodes.forEach(node => sortNodes(node.children))
      return nodes
    }

    return sortNodes(roots)
  }, [musicLibrary])
  const spotifyEmbedUrl = useMemo(() => getSpotifyEmbedUrl(musicUrl), [musicUrl])
  const musicProvider = useMemo(() => getMusicProvider(musicUrl), [musicUrl])
  const youtubeVideoId = useMemo(() => (
    musicProvider === 'youtube' ? musicActiveUri || getYouTubeId(musicUrl) : ''
  ), [musicProvider, musicActiveUri, musicUrl])

  const broadcast = (event: string, payload: unknown) => {
    channelRef.current?.send({ type: 'broadcast', event, payload })
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

  const uploadFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      window.alert('Можно загрузить только картинки.')
      return
    }

    setIsUploading(true)

    try {
      const supabase = createClient()
      for (const [index, file] of imageFiles.entries()) {
        const id = `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
        const objectUrl = URL.createObjectURL(file)
        const natural = await getImageSize(objectUrl)
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
        const imageData = publicUrlData.publicUrl
        const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
        const fitWidth = Math.min(760, Math.max(220, natural.width))
        const fitHeight = Math.max(160, Math.round((fitWidth / natural.width) * natural.height))
        const ownerRole = tableRole ?? 'player'
        const activeFolder = selectedLayer?.layerType === 'folder' && (isMaster || selectedLayer.ownerRole !== 'master') ? selectedLayer : null
        const layer: TableLayer = {
          id,
          room,
          layerType: 'image',
          ownerRole,
          parentId: activeFolder?.id || null,
          name: file.name,
          imageData,
          x: (activeFolder?.x ?? 80) + ((layersRef.current.length + index) % 6) * 28,
          y: (activeFolder?.y ?? 70) + ((layersRef.current.length + index) % 6) * 24,
          width: fitWidth,
          height: fitHeight,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          createdAt: new Date().toISOString(),
        }

        const { error } = await supabase.from(TABLE_IMAGES).insert({
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

      setTableStatus('Сцена онлайн')
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

  const createMusicFolder = async () => {
    if (!isMaster) return
    const name = window.prompt('Название папки музыки', 'Новая папка')?.trim()
    if (!name) return

    const folder: MusicLibraryItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      itemType: 'folder',
      parentId: selectedMusicFolderId,
      name,
      url: '',
      createdAt: new Date().toISOString(),
    }

    const { error } = await createClient().from(TABLE_MUSIC_LIBRARY).insert({
      id: folder.id,
      room: folder.room,
      item_type: folder.itemType,
      parent_id: folder.parentId,
      name: folder.name,
      url: folder.url,
      created_at: folder.createdAt,
    })

    const next = upsertMusicLibraryItem(musicLibraryRef.current, folder)
    musicLibraryRef.current = next
    setMusicLibrary(next)
    setSelectedMusicFolderId(folder.id)
    if (folder.parentId) setExpandedMusicFolders(prev => new Set(prev).add(folder.parentId as string))
    broadcast('music-library', folder)

    if (error) {
      console.error('Не удалось сохранить папку музыки:', error)
      setMusicStatus('Папка музыки не сохранилась')
    }
  }

  const uploadMusicFiles = async (files: FileList | File[]) => {
    if (!isMaster) return
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'))
    if (audioFiles.length === 0) {
      window.alert('Можно загрузить только аудиофайлы.')
      return
    }

    setIsMusicUploading(true)

    try {
      const supabase = createClient()
      for (const [index, file] of audioFiles.entries()) {
        const id = `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
        const storagePath = `${room}/${id}-${safeStorageName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from(TABLE_MUSIC_BUCKET)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'audio/mpeg',
          })

        if (uploadError) {
          console.error('Не удалось загрузить музыку в Storage:', uploadError)
          window.alert('Музыка не загрузилась в Supabase Storage. Проверь bucket table-music и policies из SQL.')
          continue
        }

        const { data: publicUrlData } = supabase.storage.from(TABLE_MUSIC_BUCKET).getPublicUrl(storagePath)
        const item: MusicLibraryItem = {
          id,
          room,
          itemType: 'track',
          parentId: selectedMusicFolderId,
          name: file.name,
          url: publicUrlData.publicUrl,
          createdAt: new Date().toISOString(),
        }

        const { error } = await supabase.from(TABLE_MUSIC_LIBRARY).insert({
          id: item.id,
          room: item.room,
          item_type: item.itemType,
          parent_id: item.parentId,
          name: item.name,
          url: item.url,
          created_at: item.createdAt,
        })

        const next = upsertMusicLibraryItem(musicLibraryRef.current, item)
        musicLibraryRef.current = next
        setMusicLibrary(next)
        broadcast('music-library', item)

        if (error) {
          console.error('Не удалось сохранить трек:', error)
          setMusicStatus('Трек загружен, но не сохранён в библиотеке')
        }
      }
    } finally {
      setIsMusicUploading(false)
    }
  }

  const handleMusicUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadMusicFiles(event.target.files)
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
    const prompt = layer?.layerType === 'folder' && childIds.size > 0
      ? `Удалить папку «${layer.name}» и ${childIds.size} вложенных слоёв?`
      : 'Удалить слой со стола?'
    if (!window.confirm(prompt)) return

    const deletedLayers = layersRef.current.filter(item => deleteIds.has(item.id))
    const nextLayers = layersRef.current.filter(item => !deleteIds.has(item.id))
    layersRef.current = nextLayers
    setLayers(nextLayers)
    setSelectedLayerId(prev => (prev && deleteIds.has(prev) ? null : prev))
    deleteIds.forEach(id => broadcast('layer-delete', { id, room }))
    const supabase = createClient()
    await supabase.from(TABLE_IMAGES).delete().in('id', [...deleteIds])

    await Promise.all(deletedLayers.filter(item => item.layerType === 'image').map(async deletedLayer => {
      const storagePath = getStoragePathFromPublicUrl(deletedLayer.imageData)
      if (storagePath) {
        const { error } = await supabase.storage.from(TABLE_IMAGE_BUCKET).remove([storagePath])
        if (error) console.error('Не удалось удалить файл слоя из Storage:', error)
      }
    }))
  }

  const getEffectiveMusicPosition = () => {
    const music = musicStateRef.current
    if (!music.isPlaying) return music.positionSeconds
    return music.positionSeconds + Math.max(0, (Date.now() - new Date(music.updatedAt).getTime()) / 1000)
  }

  const controlSpotify = (action: 'play' | 'pause' | 'seek', positionSeconds?: number) => {
    const controller = spotifyControllerRef.current
    if (!controller) return

    if (action === 'pause') controller.pause()
    if (action === 'play') controller.resume()
    if (action === 'seek' && positionSeconds !== undefined) {
      controller.seek(Math.max(0, Math.floor(positionSeconds)))
      if (musicPlaying) controller.resume()
    }
  }

  const setPlayerLocalVolume = (volume: number) => {
    const nextVolume = Math.min(100, Math.max(0, Math.round(volume)))
    setLocalYouTubeVolume(nextVolume)
    window.localStorage.setItem('vtm-youtube-volume', String(nextVolume))
    youtubePlayerRef.current?.setVolume(nextVolume)
  }

  const openYouTubeFullscreen = () => {
    youtubeShellRef.current?.requestFullscreen()
  }

  const publishMusicState = async (patch: Partial<Omit<MusicState, 'room' | 'updatedAt'>>) => {
    if (!isMaster) {
      setMusicStatus('Музыкой управляет мастер')
      return
    }

    const current = musicStateRef.current
    const now = new Date().toISOString()
    const next: MusicState = {
      room,
      url: (patch.url ?? current.url).trim(),
      activeUri: patch.activeUri ?? current.activeUri,
      isPlaying: patch.isPlaying ?? current.isPlaying,
      positionSeconds: Math.max(0, Math.floor(patch.positionSeconds ?? current.positionSeconds)),
      updatedAt: now,
    }

    applyMusicState(next)
    broadcast('music', next)

    const { error } = await createClient().from(TABLE_MUSIC).upsert({
      room: next.room,
      url: next.url,
      active_uri: next.activeUri,
      is_playing: next.isPlaying,
      position_seconds: next.positionSeconds,
      updated_at: next.updatedAt,
    })

    if (error) {
      console.error('Не удалось сохранить музыку комнаты:', error)
      setMusicStatus('Музыка отправлена онлайн, но не сохранена')
    }
  }

  const applyMusicDraft = (options: { play?: boolean } = {}) => {
    if (!isMaster) return

    const normalizedUrl = musicDraft.trim()
    const provider = getMusicProvider(normalizedUrl)
    const currentMusic = musicStateRef.current

    if (!normalizedUrl) {
      if (!currentMusic.url) return
      publishMusicState({ url: '', activeUri: '', isPlaying: false, positionSeconds: 0 })
      return
    }

    if (normalizedUrl === currentMusic.url) {
      if (options.play && !currentMusic.isPlaying) {
        publishMusicState({
          isPlaying: true,
          positionSeconds: Math.max(0, Math.floor(getEffectiveMusicPosition())),
        })
      }
      return
    }

    if (provider === 'youtube') {
      const videoId = getYouTubeId(normalizedUrl)
      if (!videoId) {
        setMusicStatus('YouTube ссылка не распознана')
        return
      }
      publishMusicState({ url: normalizedUrl, activeUri: videoId, isPlaying: Boolean(options.play), positionSeconds: 0 })
      return
    }

    if (provider === 'spotify') {
      const activeUri = getSpotifyUri(normalizedUrl)
      if (!activeUri) {
        setMusicStatus('Spotify ссылка не распознана')
        return
      }
      publishMusicState({ url: normalizedUrl, activeUri, isPlaying: Boolean(options.play), positionSeconds: 0 })
      return
    }

    if (provider === 'file') {
      publishMusicState({ url: normalizedUrl, activeUri: '', isPlaying: Boolean(options.play), positionSeconds: 0 })
      return
    }

    setMusicStatus('Поддерживаются YouTube, Spotify и аудиофайлы')
  }

  const playMusicTrack = (track: MusicLibraryItem) => {
    if (!isMaster || track.itemType !== 'track' || !track.url) return
    publishMusicState({
      url: track.url,
      activeUri: track.id,
      isPlaying: true,
      positionSeconds: 0,
    })
  }

  const publishAudioElementState = (isPlaying: boolean) => {
    const audio = audioPlayerRef.current
    if (!isMaster || !audio || musicProvider !== 'file') return
    publishMusicState({
      isPlaying,
      positionSeconds: Math.max(0, Math.floor(audio.currentTime || 0)),
    })
  }

  useEffect(() => {
    if (musicProvider !== 'youtube' || !youtubeVideoId || !youtubeMountRef.current) {
      youtubePlayerRef.current?.destroy()
      youtubePlayerRef.current = null
      youtubeVideoIdRef.current = ''
      return
    }

    let cancelled = false
    const container = youtubeMountRef.current

    loadYouTubeIframeApi()
      .then(api => {
        if (cancelled) return

        const syncPlayer = (player: YouTubePlayer) => {
          const currentMusic = musicStateRef.current
          const nextVideoId = currentMusic.activeUri || getYouTubeId(currentMusic.url)
          if (!nextVideoId) return

          const positionSeconds = Math.max(0, Math.floor(getEffectiveMusicPosition()))
          const loadedVideoId = player.getVideoData().video_id || youtubeVideoIdRef.current

          if (loadedVideoId !== nextVideoId) {
            if (currentMusic.isPlaying) player.loadVideoById({ videoId: nextVideoId, startSeconds: positionSeconds })
            else player.cueVideoById({ videoId: nextVideoId, startSeconds: positionSeconds })
            youtubeVideoIdRef.current = nextVideoId
          } else {
            player.seekTo(positionSeconds, true)
            if (currentMusic.isPlaying) player.playVideo()
            else player.pauseVideo()
          }
        }

        if (!youtubePlayerRef.current) {
          container.innerHTML = ''
          youtubePlayerRef.current = new api.Player(container, {
            videoId: youtubeVideoId,
            width: '100%',
            height: 260,
            playerVars: {
              autoplay: 0,
              controls: 1,
              enablejsapi: 1,
              origin: window.location.origin,
              playsinline: 1,
            },
            events: {
              onReady: event => {
                if (cancelled) return
                youtubeVideoIdRef.current = youtubeVideoId
                event.target.setVolume(localYouTubeVolume)
                syncPlayer(event.target)
              },
              onStateChange: event => {
                if (event.data === 1) setMusicStatus('Играет синхронно')
                if (event.data === 2) setMusicStatus('Пауза')
                if (event.data === 0) setMusicStatus('Пауза')

                if (!isMaster || (event.data !== 0 && event.data !== 1 && event.data !== 2)) return

                const positionSeconds = Math.max(0, Math.floor(event.target.getCurrentTime() || 0))
                const nextPlaying = event.data === 1
                const currentMusic = musicStateRef.current
                const stateChanged = currentMusic.isPlaying !== nextPlaying
                const positionChanged = Math.abs(positionSeconds - getEffectiveMusicPosition()) > 1

                if (stateChanged || positionChanged) {
                  youtubeLastPublishRef.current = Date.now()
                  publishMusicState({
                    isPlaying: nextPlaying,
                    positionSeconds: event.data === 0 ? 0 : positionSeconds,
                  })
                }
              },
              onAutoplayBlocked: () => {
                if (musicStateRef.current.isPlaying) setMusicStatus('Нажми на страницу, чтобы включить музыку')
              },
            },
          })
          return
        }

        syncPlayer(youtubePlayerRef.current)
      })
      .catch(error => {
        console.error('YouTube IFrame API не загрузился:', error)
        setMusicStatus('YouTube API недоступен')
      })

    return () => {
      cancelled = true
    }
  }, [musicProvider, youtubeVideoId, musicPlaying, musicPositionSeconds, musicUpdatedAt, isMaster])

  useEffect(() => {
    if (musicProvider !== 'youtube' || !musicPlaying) return

    const unlock = () => {
      youtubePlayerRef.current?.playVideo()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }

    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [musicProvider, musicPlaying])

  useEffect(() => {
    if (musicProvider !== 'youtube') return
    youtubePlayerRef.current?.setVolume(localYouTubeVolume)
  }, [musicProvider, localYouTubeVolume])

  useEffect(() => {
    if (!isMaster || musicProvider !== 'youtube' || !youtubeVideoId) return

    const interval = window.setInterval(() => {
      const player = youtubePlayerRef.current
      if (!player) return

      const now = Date.now()
      if (now - youtubeLastPublishRef.current < 900) return

      const positionSeconds = Math.max(0, Math.floor(player.getCurrentTime() || 0))
      const currentMusic = musicStateRef.current
      const expectedPosition = currentMusic.isPlaying
        ? currentMusic.positionSeconds + Math.max(0, (now - new Date(currentMusic.updatedAt).getTime()) / 1000)
        : currentMusic.positionSeconds

      if (Math.abs(positionSeconds - expectedPosition) <= 2) return

      youtubeLastPublishRef.current = now
      publishMusicState({
        isPlaying: currentMusic.isPlaying,
        positionSeconds,
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isMaster, musicProvider, youtubeVideoId])

  useEffect(() => {
    if (musicProvider !== 'spotify' || !musicUrl || !spotifyMountRef.current) return

    let cancelled = false
    const container = spotifyMountRef.current
    const uri = musicActiveUri || getSpotifyUri(musicUrl)
    if (!uri) return

    container.innerHTML = ''
    spotifyControllerRef.current?.destroy()
    spotifyControllerRef.current = null

    loadSpotifyIframeApi()
      .then(api => {
        if (cancelled) return

        api.createController(
          container,
          {
            uri,
            width: '100%',
            height: 86,
            theme: 'dark',
          },
          controller => {
            if (cancelled) {
              controller.destroy()
              return
            }

            spotifyControllerRef.current = controller
            controller.addListener('ready', () => {
              const positionSeconds = Math.max(0, Math.floor(getEffectiveMusicPosition()))
              controller.seek(positionSeconds)
              if (musicPlaying) controller.resume()
              else controller.pause()
            })
            controller.addListener('playback_update', event => {
              if (!isMaster) return
              const now = Date.now()
              const nextPosition = Math.max(0, Math.floor((event.data.position || 0) / 1000))
              const currentMusic = musicStateRef.current
              const nextPlaying = typeof event.data.isPaused === 'boolean' ? !event.data.isPaused : currentMusic.isPlaying
              const nextUri = event.data.playingURI || currentMusic.activeUri
              const positionChanged = Math.abs(nextPosition - getEffectiveMusicPosition()) > 2
              const stateChanged = nextPlaying !== currentMusic.isPlaying || nextUri !== currentMusic.activeUri

              if (positionChanged && !stateChanged && now - spotifyLastPublishRef.current < 1800) return

              if (positionChanged || stateChanged) {
                spotifyLastPublishRef.current = now
                publishMusicState({
                  isPlaying: nextPlaying,
                  positionSeconds: nextPosition,
                  activeUri: nextUri,
                })
              }
            })
          }
        )
      })
      .catch(error => {
        console.error('Spotify iFrame API не загрузился:', error)
        setMusicStatus('Spotify API недоступен')
      })

    return () => {
      cancelled = true
      spotifyControllerRef.current?.destroy()
      spotifyControllerRef.current = null
    }
  }, [musicProvider, musicUrl, musicActiveUri, isMaster])

  useEffect(() => {
    if (musicProvider !== 'spotify') return
    const controller = spotifyControllerRef.current
    if (!controller) return

    const positionSeconds = Math.max(0, Math.floor(getEffectiveMusicPosition()))
    controller.seek(positionSeconds)
    if (musicPlaying) controller.resume()
    else controller.pause()
  }, [musicProvider, musicPlaying, musicPositionSeconds, musicUpdatedAt])

  useEffect(() => {
    if (musicProvider !== 'file' || !musicUrl) return
    const audio = audioPlayerRef.current
    if (!audio) return

    const positionSeconds = Math.max(0, Math.floor(getEffectiveMusicPosition()))
    if (audio.src !== musicUrl) audio.src = musicUrl
    if (Math.abs(audio.currentTime - positionSeconds) > 1.2) audio.currentTime = positionSeconds

    if (musicPlaying) {
      audio.play().catch(error => {
        console.error('Браузер заблокировал автозапуск аудио:', error)
        setMusicStatus('Нажми на страницу, чтобы включить музыку')
      })
    } else {
      audio.pause()
    }
  }, [musicProvider, musicUrl, musicPlaying, musicPositionSeconds, musicUpdatedAt])

  useEffect(() => {
    if (musicProvider !== 'file' || !musicPlaying) return

    const unlock = () => {
      audioPlayerRef.current?.play().catch(() => undefined)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }

    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [musicProvider, musicPlaying])

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

  const startLayerDrag = (event: React.PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize', corner: DragState['corner'] = 'se') => {
    if (event.button !== 0) return
    if (!isMaster && layer.ownerRole === 'master') return
    if (layer.locked) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedLayerId(layer.id)
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
        .filter(item => getDescendantIds(layer.id).has(item.id))
        .map(item => ({ id: item.id, x: item.x, y: item.y })),
    }
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 2) return
    const target = event.target as HTMLElement
    if (!target.classList.contains('scene') && !target.classList.contains('scene-world')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
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
      setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy })
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
    if (event.dataTransfer.files?.length) {
      await uploadFiles(event.dataTransfer.files)
    }
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
          className={`layer-row ${selectedLayerId === layer.id ? 'active' : ''} ${draggingLayerId === layer.id ? 'dragging' : ''} ${!isEffectivelyVisible ? 'hidden' : ''} ${layer.locked ? 'locked' : ''} ${
            isDropTarget ? `drop-${layerDropTarget?.placement}` : ''
          }`}
          draggable={canDragLayer}
          onDragStart={event => handleLayerDragStart(event, layer.id)}
          onDragOver={event => handleLayerDragOver(event, layer)}
          onDrop={event => handleLayerDrop(event, layer)}
          onDragEnd={handleLayerDragEnd}
          onClick={() => setSelectedLayerId(layer.id)}
          onContextMenu={event => {
            event.preventDefault()
            setSelectedLayerId(layer.id)
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

  const renderMusicNode = (item: MusicTreeNode, depth = 0): React.ReactNode => {
    const isFolder = item.itemType === 'folder'
    const isExpanded = expandedMusicFolders.has(item.id)
    const isActive = musicActiveUri === item.id || musicUrl === item.url

    return (
      <div className="music-tree-item" key={item.id}>
        <button
          type="button"
          className={`music-library-row ${isActive ? 'active' : ''} ${isFolder ? 'folder' : 'track'}`}
          style={{ paddingLeft: 10 + depth * 18 }}
          onClick={() => {
            if (isFolder) {
              setSelectedMusicFolderId(item.id)
              setExpandedMusicFolders(prev => {
                const next = new Set(prev)
                if (next.has(item.id)) next.delete(item.id)
                else next.add(item.id)
                return next
              })
            } else {
              playMusicTrack(item)
            }
          }}
        >
          <span className="music-row-icon">{isFolder ? (isExpanded ? '▾' : '▸') : '♪'}</span>
          <span className={`music-row-thumb ${isFolder ? 'folder' : ''}`} />
          <span className="music-row-name">{item.name}</span>
          {!isFolder && isActive ? <span className="music-row-state">{musicPlaying ? 'play' : 'pause'}</span> : null}
        </button>
        {isFolder && isExpanded ? item.children.map(child => renderMusicNode(child, depth + 1)) : null}
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
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} />
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
            onContextMenu={event => event.preventDefault()}
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
                  className={`scene-layer ${layer.layerType === 'folder' ? 'folder-layer' : ''} ${selectedLayerId === layer.id ? 'selected' : ''} ${layer.locked || (!isMaster && layer.ownerRole === 'master') ? 'locked' : ''}`}
                  key={layer.id}
                  style={{
                    left: layer.x,
                    top: layer.y,
                    width: layer.width,
                    height: layer.height,
                    zIndex: layer.zIndex,
                  }}
                  onPointerDown={event => startLayerDrag(event, layer, 'move')}
                >
                  {layer.layerType === 'folder' ? (
                    <div className="folder-surface">
                      <span>{layer.name}</span>
                    </div>
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
                  {selectedLayerId === layer.id && !layer.locked && (isMaster || layer.ownerRole !== 'master') ? (
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
          </nav>

          <section className={`music-panel table-right-panel ${rightRailTab === 'music' ? '' : 'table-right-panel-hidden'}`} aria-label="Музыка комнаты">
            <header>
              <strong>Музыка</strong>
              <span>{isMaster ? musicStatus : 'Музыкой управляет мастер'}</span>
            </header>
            {isMaster ? (
              <div className="music-controls">
                <input
                  value={musicDraft}
                  onChange={event => setMusicDraft(event.target.value)}
                  onBlur={() => applyMusicDraft()}
                  onKeyDown={event => {
                    if (event.key !== 'Enter') return
                    applyMusicDraft({ play: true })
                  }}
                  placeholder="YouTube или Spotify ссылка, Enter чтобы применить"
                />
                <div className="music-meta">
                  <span>Источник: {musicProvider === 'none' ? 'не выбран' : musicProvider}</span>
                  <span>{Math.floor(getEffectiveMusicPosition())} сек.</span>
                </div>
              </div>
            ) : (
              <div className="music-readonly">
                <p>Музыкой управляет мастер</p>
                <span>Источник: {musicProvider === 'none' ? 'не выбран' : musicProvider}</span>
              </div>
            )}
            {musicProvider === 'spotify' && musicUrl ? (
              <div className={`spotify-embed ${isMaster ? '' : 'readonly'}`} ref={spotifyMountRef} />
            ) : musicProvider === 'youtube' && youtubeVideoId ? (
              <div
                className={`youtube-embed ${isMaster ? '' : 'readonly'}`}
                ref={youtubeShellRef}
              >
                <div ref={youtubeMountRef} aria-label="Музыка комнаты" />
              </div>
            ) : spotifyEmbedUrl ? (
              <iframe
                className={isMaster ? '' : 'readonly'}
                title="Музыка комнаты"
                src={spotifyEmbedUrl}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : musicProvider === 'file' && musicUrl ? (
              <audio
                ref={audioPlayerRef}
                className="audio-player"
                src={musicUrl}
                controls={isMaster}
                onPlay={() => publishAudioElementState(true)}
                onPause={() => publishAudioElementState(false)}
                onSeeked={() => publishAudioElementState(musicPlaying)}
              />
            ) : null}
            {!isMaster && musicProvider === 'youtube' && youtubeVideoId ? (
              <div className="player-local-controls" aria-label="Локальные настройки плеера">
                <label>
                  <span>Громкость</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localYouTubeVolume}
                    onChange={event => setPlayerLocalVolume(Number(event.target.value))}
                  />
                  <strong>{localYouTubeVolume}%</strong>
                </label>
                <button type="button" onClick={openYouTubeFullscreen}>На весь экран</button>
              </div>
            ) : null}
            <section className="music-library" aria-label="Музыкальная библиотека">
              <header>
                <strong>Библиотека</strong>
                <span>{selectedMusicFolderId ? musicLibrary.find(item => item.id === selectedMusicFolderId)?.name || 'папка' : 'корень'}</span>
              </header>
              {isMaster ? (
                <div className="music-library-actions">
                  <button type="button" onClick={() => musicFileInputRef.current?.click()} disabled={isMusicUploading}>
                    {isMusicUploading ? 'Загрузка...' : 'Загрузить'}
                  </button>
                  <button type="button" onClick={createMusicFolder}>Папка</button>
                  <button type="button" onClick={() => setSelectedMusicFolderId(null)}>Корень</button>
                  <input ref={musicFileInputRef} type="file" accept="audio/*" multiple onChange={handleMusicUpload} />
                </div>
              ) : (
                <p className="music-readonly">Треки запускает мастер.</p>
              )}
              <div className="music-library-list">
                {musicTree.length === 0 ? (
                  <p className="panel-empty">Музыка ещё не загружена.</p>
                ) : (
                  musicTree.map(item => renderMusicNode(item))
                )}
              </div>
            </section>
          </section>

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
        </aside>
      </section>

      {layerContextMenu ? (() => {
        const layer = layers.find(item => item.id === layerContextMenu.layerId)
        if (!layer) return null
        return (
          <div
            className="layer-context-menu"
            style={{ left: layerContextMenu.x, top: layerContextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <button type="button" onClick={() => renameLayer(layer)}>Переименовать</button>
            <button type="button" onClick={() => {
              patchLayer(layer.id, { visible: !layer.visible })
              setLayerContextMenu(null)
            }}>
              {layer.visible ? 'Скрыть' : 'Показать'}
            </button>
            <button type="button" onClick={() => {
              patchLayer(layer.id, { locked: !layer.locked })
              setLayerContextMenu(null)
            }}>
              {layer.locked ? 'Разблокировать' : 'Заблокировать'}
            </button>
            {layer.layerType === 'folder' ? (
              <button type="button" onClick={() => {
                createFolder(layer.id)
                setLayerContextMenu(null)
              }}>Новая папка внутри</button>
            ) : null}
            {layer.parentId ? (
              <button type="button" onClick={() => {
                patchLayer(layer.id, { parentId: null })
                setLayerContextMenu(null)
              }}>Вынести из папки</button>
            ) : null}
            <button type="button" className="danger" onClick={() => {
              deleteLayer(layer.id)
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
        .music-panel,
        .layer-panel,
        .roll-sidebar {
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
        .music-panel header,
        .layer-panel header,
        .roll-sidebar header {
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
        .music-panel header span,
        .layer-panel header span,
        .roll-sidebar header span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .surface-head strong,
        .music-panel header strong,
        .layer-panel header strong,
        .roll-sidebar header strong {
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

        .scene-layer img {
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
          pointer-events: none;
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        .music-panel {
          display: grid;
          grid-template-rows: auto auto auto auto minmax(0, 1fr);
          align-self: stretch;
          overflow: hidden;
        }

        .music-panel header,
        .layer-panel,
        .roll-sidebar {
          min-height: 0;
          height: 100%;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .layer-panel header {
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          background: #3f3f3f;
          border-bottom-color: #2d2d2d;
        }

        .music-panel header {
          display: grid;
          gap: 4px;
          padding: 12px;
        }

        .music-controls {
          display: grid;
          gap: 8px;
          padding: 10px;
        }

        .music-controls input {
          width: 100%;
          box-sizing: border-box;
          background: #090909;
          color: #eee;
          border: 1px solid #333;
          border-radius: 5px;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .music-meta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #9c9c9c;
          font-size: 12px;
        }

        .music-panel iframe {
          width: 100%;
          height: 86px;
          border: 0;
          border-top: 1px solid #252525;
          background: #050505;
        }

        .audio-player {
          width: 100%;
          border-top: 1px solid #252525;
          background: #050505;
        }

        .audio-player:not([controls]) {
          display: none;
        }

        .youtube-embed {
          width: 100%;
          aspect-ratio: 16 / 9;
          min-height: 230px;
          border-top: 1px solid #252525;
          background: #050505;
        }

        .youtube-embed > div {
          width: 100%;
          height: 100%;
        }

        .youtube-embed iframe {
          width: 100%;
          height: 100%;
          display: block;
          border: 0;
        }

        .spotify-embed {
          width: 100%;
          min-height: 86px;
          border-top: 1px solid #252525;
          background: #050505;
        }

        .music-readonly {
          margin: 0;
          padding: 10px;
          color: #9d9d9d;
          font-size: 12px;
          line-height: 1.35;
          border-bottom: 1px solid #252525;
        }

        .music-readonly p {
          margin: 0 0 4px;
          color: #ddd;
        }

        .music-panel iframe.readonly,
        .spotify-embed.readonly {
          pointer-events: none;
          filter: grayscale(0.35);
        }

        .youtube-embed.readonly {
          filter: grayscale(0.18);
        }

        .player-local-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border-top: 1px solid #252525;
          background: #0d0d0d;
        }

        .player-local-controls label {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(80px, 1fr) 42px;
          gap: 8px;
          align-items: center;
          color: #bdbdbd;
          font-size: 12px;
        }

        .player-local-controls input {
          width: 100%;
          accent-color: #9ab7ff;
        }

        .player-local-controls strong {
          color: #eee;
          font-size: 12px;
          text-align: right;
        }

        .player-local-controls button {
          min-width: 0;
          height: 30px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #181818;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          white-space: nowrap;
        }

        .music-library {
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          border-top: 1px solid #252525;
          overflow: hidden;
        }

        .music-library header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 9px 10px;
          background: #121212;
          border-bottom: 1px solid #252525;
        }

        .music-library header strong {
          color: #f5f5f5;
          font-size: 13px;
        }

        .music-library header span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #9c9c9c;
          font-size: 12px;
        }

        .music-library-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 8px 10px;
          border-bottom: 1px solid #252525;
        }

        .music-library-actions input {
          display: none;
        }

        .music-library-actions button,
        .music-library-row {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 5px;
          background: #181818;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .music-library-actions button {
          height: 30px;
        }

        .music-library-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .music-library-list {
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .music-library-row {
          width: 100%;
          height: 38px;
          border: 0;
          border-bottom: 1px solid #252525;
          border-radius: 0;
          background: #202020;
          display: grid;
          grid-template-columns: 18px 28px minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          padding-right: 10px;
          text-align: left;
        }

        .music-library-row:hover,
        .music-library-row.active {
          background: #343434;
        }

        .music-row-icon {
          color: #bdbdbd;
          text-align: center;
        }

        .music-row-thumb {
          width: 24px;
          height: 24px;
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          background: linear-gradient(135deg, #222, #4d3b3b);
        }

        .music-row-thumb.folder {
          position: relative;
          height: 17px;
          background: #c9a557;
          border-color: #8b7034;
        }

        .music-row-thumb.folder::before {
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

        .music-row-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .music-row-state {
          color: #9ab7ff;
          font-size: 11px;
        }

        .layer-list,
        .roll-list {
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
