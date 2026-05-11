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
  updatedAt: string
}

type MusicRow = {
  room: string
  url: string
  updated_at: string
}

type LayerPatch = Partial<Pick<TableLayer, 'layerType' | 'parentId' | 'name' | 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'visible' | 'locked'>>

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

const TABLE_ROLLS = 'table_rolls'
const TABLE_IMAGES = 'table_images'
const TABLE_MUSIC = 'table_music'
const TABLE_IMAGE_BUCKET = 'table-images'

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
    updatedAt: row.updated_at,
  }
}

function getMusicEmbedUrl(url: string) {
  const raw = url.trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : ''
    }

    if (host.endsWith('youtube.com')) {
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : ''
    }

    if (host === 'open.spotify.com') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`
    }
  } catch {
    return ''
  }

  return ''
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [isUploading, setIsUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [musicUrl, setMusicUrl] = useState('')
  const [musicDraft, setMusicDraft] = useState('')
  const [musicStatus, setMusicStatus] = useState('Музыка не выбрана')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const layersRef = useRef<TableLayer[]>([])
  const panRef = useRef(pan)

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

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
      .select('id, room, layer_type, parent_id, name, image_data, x, y, width, height, z_index, visible, locked, created_at')
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
      .select('room, url, updated_at')
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
        setMusicUrl(music?.url || '')
        setMusicDraft(music?.url || '')
        setMusicStatus(music?.url ? 'Общая музыка' : 'Музыка не выбрана')
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
        setMusicUrl(music.url || '')
        setMusicDraft(music.url || '')
        setMusicStatus(music.url ? 'Общая музыка' : 'Музыка выключена')
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
          setMusicUrl(music.url || '')
          setMusicDraft(music.url || '')
          setMusicStatus(music.url ? 'Общая музыка' : 'Музыка выключена')
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
  const isLayerEffectivelyVisible = (layer: TableLayer) => {
    if (!layer.visible) return false
    if (!layer.parentId) return true
    const parent = layers.find(item => item.id === layer.parentId)
    return parent ? parent.visible : true
  }

  const visibleLayers = useMemo(() => sortLayers(layers).filter(isLayerEffectivelyVisible), [layers])
  const layerPanelItems = useMemo(() => sortLayers(layers).reverse(), [layers])
  const folders = useMemo(() => sortLayers(layers).filter(layer => layer.layerType === 'folder'), [layers])
  const musicEmbedUrl = useMemo(() => getMusicEmbedUrl(musicUrl), [musicUrl])

  const broadcast = (event: string, payload: unknown) => {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }

  const patchLayer = async (id: string, patch: LayerPatch, options: { persist?: boolean } = { persist: true }) => {
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
        const activeFolder = selectedLayer?.layerType === 'folder' ? selectedLayer : null
        const layer: TableLayer = {
          id,
          room,
          layerType: 'image',
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

  const deleteLayer = async (layerId: string) => {
    if (!window.confirm('Удалить слой со стола?')) return

    const deletedLayer = layersRef.current.find(layer => layer.id === layerId) || layers.find(layer => layer.id === layerId)
    const nextLayers = layersRef.current.filter(layer => layer.id !== layerId)
    layersRef.current = nextLayers
    setLayers(nextLayers)
    setSelectedLayerId(prev => (prev === layerId ? null : prev))
    broadcast('layer-delete', { id: layerId, room })
    const supabase = createClient()
    await supabase.from(TABLE_IMAGES).delete().eq('id', layerId)

    if (deletedLayer?.layerType === 'image') {
      const storagePath = getStoragePathFromPublicUrl(deletedLayer.imageData)
      if (storagePath) {
        const { error } = await supabase.storage.from(TABLE_IMAGE_BUCKET).remove([storagePath])
        if (error) console.error('Не удалось удалить файл слоя из Storage:', error)
      }
    }
  }

  const publishMusic = async (nextUrl: string) => {
    const normalizedUrl = nextUrl.trim()
    const music: MusicState = {
      room,
      url: normalizedUrl,
      updatedAt: new Date().toISOString(),
    }

    setMusicUrl(normalizedUrl)
    setMusicDraft(normalizedUrl)
    setMusicStatus(normalizedUrl ? 'Общая музыка' : 'Музыка выключена')
    broadcast('music', music)

    const { error } = await createClient().from(TABLE_MUSIC).upsert({
      room: music.room,
      url: music.url,
      updated_at: music.updatedAt,
    })

    if (error) {
      console.error('Не удалось сохранить музыку комнаты:', error)
      setMusicStatus('Музыка отправлена онлайн, но не сохранена')
    }
  }

  const createFolder = async () => {
    const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
    const folder: TableLayer = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      layerType: 'folder',
      parentId: null,
      name: `Папка ${folders.length + 1}`,
      imageData: '',
      x: 120 + (folders.length % 5) * 36,
      y: 120 + (folders.length % 5) * 28,
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
    broadcast('layer', folder)

    if (error) {
      console.error('Не удалось сохранить папку:', error)
      setTableStatus('Папка показана онлайн, но не сохранена')
    }
  }

  const moveLayerOrder = async (layerId: string, direction: 'up' | 'down') => {
    const ordered = sortLayers(layersRef.current)
    const index = ordered.findIndex(layer => layer.id === layerId)
    const targetIndex = direction === 'up' ? index + 1 : index - 1
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const current = ordered[index]
    const target = ordered[targetIndex]
    await Promise.all([
      patchLayer(current.id, { zIndex: target.zIndex }),
      patchLayer(target.id, { zIndex: current.zIndex }),
    ])
  }

  const startLayerDrag = (event: React.PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize', corner: DragState['corner'] = 'se') => {
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
        .filter(item => item.parentId === layer.id)
        .map(item => ({ id: item.id, x: item.x, y: item.y })),
    }
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
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
    if (!event.ctrlKey && !event.metaKey) {
      setPan(prev => ({ x: prev.x - event.deltaX, y: prev.y - event.deltaY }))
      return
    }

    event.preventDefault()
    const nextZoom = Math.min(3, Math.max(0.25, zoom * (event.deltaY > 0 ? 0.9 : 1.1)))
    setZoom(nextZoom)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    if (event.dataTransfer.files?.length) {
      await uploadFiles(event.dataTransfer.files)
    }
  }

  return (
    <main className="table-page-shell">
      <section className="table-topbar">
        <div>
          <p className="table-kicker">Игровой стол</p>
          <h1>Стол: {room}</h1>
        </div>
        <div className="table-actions">
          <a href="/old" title="Открыть лист персонажа">Лист</a>
          <button type="button" onClick={createFolder}>Папка</button>
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
                  className={`scene-layer ${layer.layerType === 'folder' ? 'folder-layer' : ''} ${selectedLayerId === layer.id ? 'selected' : ''} ${layer.locked ? 'locked' : ''}`}
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
                  {selectedLayerId === layer.id && !layer.locked ? (
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
          <section className="music-panel" aria-label="Музыка комнаты">
            <header>
              <strong>Музыка</strong>
              <span>{musicStatus}</span>
            </header>
            <div className="music-controls">
              <input
                value={musicDraft}
                onChange={event => setMusicDraft(event.target.value)}
                placeholder="YouTube или Spotify ссылка"
              />
              <div>
                <button type="button" onClick={() => publishMusic(musicDraft)}>
                  Включить всем
                </button>
                <button type="button" onClick={() => publishMusic('')}>
                  Стоп
                </button>
              </div>
            </div>
            {musicEmbedUrl ? (
              <iframe
                title="Музыка комнаты"
                src={musicEmbedUrl}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : null}
          </section>

          <section className="layer-panel" aria-label="Слои стола">
            <header>
              <strong>Слои</strong>
              <span>{selectedLayer?.name || 'ничего не выбрано'}</span>
            </header>

            <div className="layer-list">
              {layerPanelItems.length === 0 ? (
                <p className="panel-empty">Слоёв пока нет.</p>
              ) : (
                layerPanelItems.map(layer => (
                  <article className={`layer-row ${selectedLayerId === layer.id ? 'active' : ''}`} key={layer.id}>
                    <button type="button" className="layer-name" onClick={() => setSelectedLayerId(layer.id)}>
                      {layer.layerType === 'folder' ? <span className="folder-thumb">▣</span> : <img src={layer.imageData} alt="" />}
                      <span>{layer.name}</span>
                    </button>
                    {layer.layerType === 'image' && folders.length > 0 ? (
                      <select
                        className="folder-select"
                        value={layer.parentId || ''}
                        onChange={event => patchLayer(layer.id, { parentId: event.target.value || null })}
                      >
                        <option value="">Без папки</option>
                        {folders.map(folder => (
                          <option value={folder.id} key={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <div className="layer-tools">
                      <button type="button" onClick={() => patchLayer(layer.id, { visible: !layer.visible })} title="Показать/скрыть">
                        {layer.visible ? '👁' : '—'}
                      </button>
                      <button type="button" onClick={() => patchLayer(layer.id, { locked: !layer.locked })} title="Блокировка">
                        {layer.locked ? '🔒' : '○'}
                      </button>
                      <button type="button" onClick={() => moveLayerOrder(layer.id, 'up')} title="Выше">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveLayerOrder(layer.id, 'down')} title="Ниже">
                        ↓
                      </button>
                      <button type="button" onClick={() => deleteLayer(layer.id)} title="Удалить">
                        x
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="roll-sidebar" aria-label="История бросков">
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
        .table-actions button,
        .layer-tools button {
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

        .table-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
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
          display: grid;
          grid-template-rows: auto minmax(220px, 0.45fr) minmax(260px, 0.55fr);
          gap: 12px;
        }

        .music-panel {
          display: grid;
          grid-template-rows: auto auto auto;
        }

        .music-panel header,
        .layer-panel,
        .roll-sidebar {
          min-height: 0;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .layer-panel header {
          display: grid;
          gap: 4px;
          padding: 12px;
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

        .music-controls div {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }

        .music-controls button {
          border: 1px solid #3a3a3a;
          background: #181818;
          color: #f4f4f4;
          border-radius: 5px;
          padding: 8px;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .music-panel iframe {
          width: 100%;
          height: 86px;
          border: 0;
          border-top: 1px solid #252525;
          background: #050505;
        }

        .layer-list,
        .roll-list {
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .panel-empty {
          margin: auto;
          color: #888;
          text-align: center;
          font-size: 13px;
        }

        .layer-row {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          overflow: hidden;
        }

        .layer-row.active {
          border-color: #36d675;
        }

        .layer-name {
          width: 100%;
          border: 0;
          background: transparent;
          color: #f4f4f4;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          padding: 8px;
          cursor: pointer;
          text-align: left;
          font: inherit;
        }

        .layer-name img {
          width: 42px;
          height: 30px;
          object-fit: cover;
          background: #050505;
          border-radius: 4px;
          border: 1px solid #333;
        }

        .folder-thumb {
          width: 42px;
          height: 30px;
          display: grid;
          place-items: center;
          background: rgba(54, 214, 117, 0.08);
          color: #36d675;
          border-radius: 4px;
          border: 1px solid rgba(54, 214, 117, 0.28);
          font-size: 15px;
        }

        .layer-name span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .layer-tools {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
          padding: 0 8px 8px;
        }

        .folder-select {
          width: calc(100% - 16px);
          margin: 0 8px 8px;
          background: #090909;
          color: #ccc;
          border: 1px solid #333;
          border-radius: 5px;
          padding: 6px;
          font: inherit;
          font-size: 12px;
        }

        .layer-tools button {
          padding: 6px 0;
          border-color: #3a3a3a;
          font-size: 12px;
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
            grid-template-rows: 360px 440px;
          }

          .table-topbar {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}
