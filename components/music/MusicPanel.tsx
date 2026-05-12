'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { LocalAudioAdapter } from './adapters/localAudioAdapter'
import { SpotifyAdapter } from './adapters/spotifyAdapter'
import { YouTubeAdapter } from './adapters/youtubeAdapter'
import { MusicSyncEngine } from './MusicSyncEngine'
import type { MusicChannel, MusicChannelRef, MusicDropTarget, MusicLibraryItem, MusicLibraryRow, MusicProvider, MusicState, MusicSyncAdapter, MusicTreeNode } from './types'
import {
  buildMusicTree,
  getEffectiveMusicPosition,
  getMusicProvider,
  getSpotifyEmbedUrl,
  getSpotifyUri,
  getStoragePathFromPublicUrl,
  mapMusicLibraryRow,
  mapMusicRow,
  parseYouTubeUrl,
  safeStorageName,
  TABLE_MUSIC,
  TABLE_MUSIC_BUCKET,
  TABLE_MUSIC_LIBRARY,
  upsertMusicLibraryItem,
} from './utils'

type MusicPanelProps = {
  room: string
  tableRole: 'master' | 'player' | null
  channelRef?: MusicChannelRef
  hidden?: boolean
}

const emptyMusicState = (room: string): MusicState => ({
  room,
  url: '',
  activeUri: '',
  isPlaying: false,
  positionSeconds: 0,
  updatedAt: new Date(0).toISOString(),
  provider: 'none',
})

export default function MusicPanel({ room, tableRole, channelRef, hidden = false }: MusicPanelProps) {
  const isMaster = tableRole === 'master'
  const [musicLibrary, setMusicLibrary] = useState<MusicLibraryItem[]>([])
  const [selectedMusicFolderId, setSelectedMusicFolderId] = useState<string | null>(null)
  const [isMusicUploading, setIsMusicUploading] = useState(false)
  const [expandedMusicFolders, setExpandedMusicFolders] = useState<Set<string>>(new Set())
  const [draggingMusicId, setDraggingMusicId] = useState<string | null>(null)
  const [musicDropTarget, setMusicDropTarget] = useState<MusicDropTarget>(null)
  const [musicDraft, setMusicDraft] = useState('')
  const [musicStatus, setMusicStatus] = useState('Музыка не выбрана')
  const [localVolume, setLocalVolume] = useState(70)
  const [musicState, setMusicState] = useState<MusicState>(() => emptyMusicState(room))
  const [unlockVisible, setUnlockVisible] = useState(false)

  const musicFileInputRef = useRef<HTMLInputElement>(null)
  const playerShellRef = useRef<HTMLDivElement>(null)
  const playerMountRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<MusicSyncEngine | null>(null)
  const musicChannelRef = useRef<MusicChannel | null>(null)
  const adapterRef = useRef<MusicSyncAdapter | null>(null)
  const adapterProviderRef = useRef<MusicProvider>('none')
  const adapterMasterRef = useRef(isMaster)
  const musicStateRef = useRef<MusicState>(emptyMusicState(room))
  const musicLibraryRef = useRef<MusicLibraryItem[]>([])

  const musicProvider = musicState.provider || getMusicProvider(musicState.url)
  const spotifyEmbedUrl = useMemo(() => getSpotifyEmbedUrl(musicState.activeUri || musicState.url), [musicState.activeUri, musicState.url])
  const musicTree = useMemo(() => buildMusicTree(musicLibrary), [musicLibrary])

  useEffect(() => {
    const savedVolume = Number(window.localStorage.getItem('vtm-youtube-volume'))
    if (Number.isFinite(savedVolume)) setLocalVolume(Math.min(100, Math.max(0, savedVolume)))
  }, [])

  useEffect(() => {
    musicLibraryRef.current = musicLibrary
  }, [musicLibrary])

  useEffect(() => {
    musicStateRef.current = musicState
  }, [musicState])

  useEffect(() => {
    setMusicState(emptyMusicState(room))
    musicStateRef.current = emptyMusicState(room)
    setMusicDraft('')
  }, [room])

  useEffect(() => {
    engineRef.current = new MusicSyncEngine({
      room,
      isMaster,
      getChannel: () => musicChannelRef.current || channelRef?.current || null,
      onState: next => {
        musicStateRef.current = next
        setMusicState(next)
        setMusicDraft(next.url || '')
        setMusicStatus(next.url ? (next.isPlaying ? 'Играет синхронно' : 'Пауза') : 'Музыка выключена')
      },
      onStatus: setMusicStatus,
    })
  }, [room, isMaster, channelRef])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const loadMusic = async () => {
      const extended = await supabase
        .from(TABLE_MUSIC)
        .select('room, url, active_uri, is_playing, position_seconds, updated_at, provider, playlist_id, playlist_index, track_id, source_type')
        .eq('room', room)
        .maybeSingle()

      if (cancelled) return

      if (!extended.error) {
        if (extended.data) engineRef.current?.applyIncoming(mapMusicRow(extended.data))
        else setMusicStatus('Музыка не выбрана')
        return
      }

      const legacy = await supabase
        .from(TABLE_MUSIC)
        .select('room, url, active_uri, is_playing, position_seconds, updated_at')
        .eq('room', room)
        .maybeSingle()

      if (cancelled) return
      if (legacy.error) {
        console.error('Не удалось загрузить музыку комнаты:', legacy.error)
        setMusicStatus('Нет общей музыки')
        return
      }
      if (legacy.data) engineRef.current?.applyIncoming(mapMusicRow(legacy.data))
      else setMusicStatus('Музыка не выбрана')
    }

    void loadMusic()

    supabase
      .from(TABLE_MUSIC_LIBRARY)
      .select('id, room, item_type, parent_id, name, url, created_at')
      .eq('room', room)
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
      .channel(`table-music:${room}`)
      .on('broadcast', { event: 'music' }, payload => {
        const music = payload.payload as MusicState
        if (!music || music.room !== room) return
        engineRef.current?.applyIncoming(music)
      })
      .on('broadcast', { event: 'music-library' }, payload => {
        const item = payload.payload as MusicLibraryItem
        if (!item || item.room !== room) return
        setMusicLibrary(prev => {
          const next = upsertMusicLibraryItem(prev, item)
          musicLibraryRef.current = next
          return next
        })
      })
      .on('broadcast', { event: 'music-library-delete' }, payload => {
        const deleted = payload.payload as { room?: string; ids?: string[] }
        if (deleted.room !== room || !deleted.ids) return
        setMusicLibrary(prev => {
          const idSet = new Set(deleted.ids)
          const next = prev.filter(item => !idSet.has(item.id))
          musicLibraryRef.current = next
          return next
        })
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_MUSIC, filter: `room=eq.${room}` },
        payload => {
          const next = (payload.new || payload.old) as Parameters<typeof mapMusicRow>[0]
          engineRef.current?.applyIncoming(mapMusicRow(next))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_MUSIC_LIBRARY, filter: `room=eq.${room}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string }
            if (!deleted.id) return
            setMusicLibrary(prev => {
              const next = prev.filter(item => item.id !== deleted.id)
              musicLibraryRef.current = next
              return next
            })
            return
          }
          const row = payload.new as MusicLibraryRow
          setMusicLibrary(prev => {
            const next = upsertMusicLibraryItem(prev, mapMusicLibraryRow(row))
            musicLibraryRef.current = next
            return next
          })
        }
      )
      .subscribe()

    musicChannelRef.current = channel
    return () => {
      cancelled = true
      musicChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [room])

  useEffect(() => {
    if (!playerMountRef.current) return
    const provider = musicProvider
    if (adapterRef.current && (adapterProviderRef.current !== provider || adapterMasterRef.current !== isMaster)) {
      adapterRef.current.destroy()
      adapterRef.current = null
      adapterProviderRef.current = 'none'
      adapterMasterRef.current = isMaster
    }

    if (provider !== 'youtube' && provider !== 'spotify' && provider !== 'file') {
      adapterRef.current?.destroy()
      adapterRef.current = null
      if (playerMountRef.current) playerMountRef.current.innerHTML = ''
      return
    }

    if (!adapterRef.current) {
      if (provider === 'youtube') {
        adapterRef.current = new YouTubeAdapter({
          isMaster,
          volume: localVolume,
          onStatus: status => {
            setMusicStatus(status)
            if (status.includes('Включить музыку')) setUnlockVisible(true)
          },
          canPublish: () => engineRef.current?.canPublishLifecycleEvent() ?? false,
        })
      }
      if (provider === 'spotify') {
        adapterRef.current = new SpotifyAdapter({
          isMaster,
          onStatus: setMusicStatus,
          canPublish: () => engineRef.current?.canPublishLifecycleEvent() ?? false,
        })
      }
      if (provider === 'file') {
        adapterRef.current = new LocalAudioAdapter({
          isMaster,
          volume: localVolume,
          onStatus: status => {
            setMusicStatus(status)
            if (status.includes('Включить музыку')) setUnlockVisible(true)
          },
          canPublish: () => engineRef.current?.canPublishLifecycleEvent() ?? false,
        })
      }
      adapterProviderRef.current = provider
      adapterMasterRef.current = isMaster
      adapterRef.current?.mount(playerMountRef.current)
      adapterRef.current?.onStateChange(patch => {
        void engineRef.current?.publishMusicState(patch)
      })
    }

    void adapterRef.current?.load(musicState)
  }, [musicProvider, musicState, isMaster, localVolume])

  useEffect(() => {
    adapterRef.current?.setVolume?.(localVolume)
  }, [localVolume])

  useEffect(() => {
    if (!musicState.isPlaying || (musicProvider !== 'youtube' && musicProvider !== 'file')) return
    const unlock = () => {
      adapterRef.current?.play()
      setUnlockVisible(false)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [musicProvider, musicState.isPlaying])

  const broadcast = (event: string, payload: unknown) => {
    musicChannelRef.current?.send({ type: 'broadcast', event, payload })
    channelRef?.current?.send({ type: 'broadcast', event, payload })
  }

  const publishMusicState = (patch: Partial<Omit<MusicState, 'room' | 'updatedAt'>>) => {
    void engineRef.current?.publishMusicState(patch)
  }

  const applyMusicDraft = (options: { play?: boolean } = {}) => {
    if (!isMaster) return

    const normalizedUrl = musicDraft.trim()
    const provider = getMusicProvider(normalizedUrl)
    const currentMusic = musicStateRef.current

    if (!normalizedUrl) {
      if (!currentMusic.url) return
      publishMusicState({ url: '', activeUri: '', provider: 'none', playlistId: undefined, playlistIndex: undefined, trackId: undefined, isPlaying: false, positionSeconds: 0 })
      return
    }

    if (normalizedUrl === currentMusic.url) {
      if (options.play && !currentMusic.isPlaying) {
        publishMusicState({ isPlaying: true, positionSeconds: Math.max(0, Math.floor(engineRef.current?.getEffectivePosition() ?? 0)) })
      }
      return
    }

    if (provider === 'youtube') {
      const parsed = parseYouTubeUrl(normalizedUrl)
      if (!parsed.videoId && !parsed.playlistId) {
        setMusicStatus('YouTube ссылка не распознана')
        return
      }
      publishMusicState({
        url: normalizedUrl,
        provider,
        activeUri: parsed.playlistId || parsed.videoId,
        playlistId: parsed.playlistId,
        playlistIndex: parsed.playlistId ? 0 : undefined,
        trackId: parsed.videoId || undefined,
        isPlaying: Boolean(options.play),
        positionSeconds: 0,
      })
      return
    }

    if (provider === 'spotify') {
      const activeUri = getSpotifyUri(normalizedUrl)
      if (!activeUri) {
        setMusicStatus('Spotify ссылка не распознана')
        return
      }
      publishMusicState({ url: normalizedUrl, provider, activeUri, isPlaying: Boolean(options.play), positionSeconds: 0 })
      return
    }

    if (provider === 'file') {
      publishMusicState({ url: normalizedUrl, provider, activeUri: '', isPlaying: Boolean(options.play), positionSeconds: 0 })
      return
    }

    setMusicStatus('Поддерживаются YouTube, Spotify и аудиофайлы')
  }

  const setPlayerLocalVolume = (volume: number) => {
    const nextVolume = Math.min(100, Math.max(0, Math.round(volume)))
    setLocalVolume(nextVolume)
    window.localStorage.setItem('vtm-youtube-volume', String(nextVolume))
    adapterRef.current?.setVolume?.(nextVolume)
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
        const { error: uploadError } = await supabase.storage.from(TABLE_MUSIC_BUCKET).upload(storagePath, file, {
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

  const getMusicDescendantIds = (itemId: string) => {
    const ids = new Set<string>()
    const visit = (parentId: string) => {
      musicLibraryRef.current.forEach(item => {
        if (item.parentId !== parentId || ids.has(item.id)) return
        ids.add(item.id)
        visit(item.id)
      })
    }
    visit(itemId)
    return ids
  }

  const moveMusicItem = async (itemId: string, parentId: string | null) => {
    if (!isMaster) return
    const item = musicLibraryRef.current.find(entry => entry.id === itemId)
    if (!item || item.parentId === parentId) return
    if (item.itemType === 'folder' && parentId && getMusicDescendantIds(item.id).has(parentId)) return

    const nextItem = { ...item, parentId }
    const nextLibrary = musicLibraryRef.current.map(entry => (entry.id === itemId ? nextItem : entry))
    musicLibraryRef.current = nextLibrary
    setMusicLibrary(nextLibrary)
    if (parentId) setExpandedMusicFolders(prev => new Set(prev).add(parentId))
    broadcast('music-library', nextItem)

    const { error } = await createClient().from(TABLE_MUSIC_LIBRARY).update({ parent_id: parentId }).eq('id', itemId)
    if (error) {
      console.error('Не удалось переместить музыку:', error)
      setMusicStatus('Музыка не переместилась')
    }
  }

  const deleteMusicItem = async (itemId: string) => {
    if (!isMaster) return
    const deleteIds = new Set([itemId, ...getMusicDescendantIds(itemId)])
    const deletedItems = musicLibraryRef.current.filter(item => deleteIds.has(item.id))
    if (deletedItems.length === 0) return

    const nextLibrary = musicLibraryRef.current.filter(item => !deleteIds.has(item.id))
    musicLibraryRef.current = nextLibrary
    setMusicLibrary(nextLibrary)
    setSelectedMusicFolderId(prev => (prev && deleteIds.has(prev) ? null : prev))
    broadcast('music-library-delete', { room, ids: [...deleteIds] })

    const supabase = createClient()
    await supabase.from(TABLE_MUSIC_LIBRARY).delete().in('id', [...deleteIds])

    await Promise.all(deletedItems.filter(item => item.itemType === 'track').map(async item => {
      const storagePath = getStoragePathFromPublicUrl(item.url, TABLE_MUSIC_BUCKET)
      if (storagePath) {
        const { error } = await supabase.storage.from(TABLE_MUSIC_BUCKET).remove([storagePath])
        if (error) console.error('Не удалось удалить музыку из Storage:', error)
      }
    }))

    if (deletedItems.some(item => item.url && item.url === musicStateRef.current.url)) {
      publishMusicState({ url: '', activeUri: '', provider: 'none', isPlaying: false, positionSeconds: 0 })
    }
  }

  const playMusicTrack = (track: MusicLibraryItem) => {
    if (!isMaster || track.itemType !== 'track' || !track.url) return
    publishMusicState({ url: track.url, activeUri: track.id, provider: 'file', isPlaying: true, positionSeconds: 0 })
  }

  const handleMusicDragStart = (event: React.DragEvent<HTMLElement>, itemId: string) => {
    if (!isMaster) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
    setDraggingMusicId(itemId)
  }

  const handleMusicDragOver = (event: React.DragEvent<HTMLElement>, target: MusicLibraryItem | null) => {
    if (!isMaster) return
    const draggedId = draggingMusicId || event.dataTransfer.getData('text/plain')
    if (!draggedId) return
    if (target && target.itemType !== 'folder') return
    if (target && target.id === draggedId) return
    const dragged = musicLibraryRef.current.find(item => item.id === draggedId)
    if (!dragged) return
    if (dragged.itemType === 'folder' && target && getMusicDescendantIds(dragged.id).has(target.id)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setMusicDropTarget({ id: target?.id ?? null })
  }

  const handleMusicDrop = async (event: React.DragEvent<HTMLElement>, target: MusicLibraryItem | null) => {
    if (!isMaster) return
    event.preventDefault()
    const draggedId = draggingMusicId || event.dataTransfer.getData('text/plain')
    setDraggingMusicId(null)
    setMusicDropTarget(null)
    if (!draggedId) return
    await moveMusicItem(draggedId, target?.id ?? null)
  }

  const openYouTubeFullscreen = () => {
    playerShellRef.current?.requestFullscreen()
  }

  const renderMusicNode = (item: MusicTreeNode, depth = 0): React.ReactNode => {
    const isFolder = item.itemType === 'folder'
    const isExpanded = expandedMusicFolders.has(item.id)
    const isActive = musicState.activeUri === item.id || musicState.url === item.url
    const isDropTarget = musicDropTarget?.id === item.id

    return (
      <div className="music-tree-item" key={item.id}>
        <button
          type="button"
          className={`music-library-row ${isActive ? 'active' : ''} ${isFolder ? 'folder' : 'track'} ${isDropTarget ? 'drop-inside' : ''}`}
          style={{ paddingLeft: 10 + depth * 18 }}
          draggable={isMaster}
          onDragStart={event => handleMusicDragStart(event, item.id)}
          onDragOver={event => handleMusicDragOver(event, item)}
          onDrop={event => handleMusicDrop(event, item)}
          onDragEnd={() => {
            setDraggingMusicId(null)
            setMusicDropTarget(null)
          }}
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
          <span className="music-row-icon">{isFolder ? (isExpanded ? 'v' : '>') : '♪'}</span>
          <span className={`music-row-thumb ${isFolder ? 'folder' : ''}`} />
          <span className="music-row-name">{item.name}</span>
          {!isFolder && isActive ? <span className="music-row-state">{musicState.isPlaying ? 'play' : 'pause'}</span> : null}
          {isMaster ? (
            <span
              className="music-row-delete"
              role="button"
              tabIndex={0}
              onClick={event => {
                event.stopPropagation()
                deleteMusicItem(item.id)
              }}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                deleteMusicItem(item.id)
              }}
              title="Удалить"
            >
              x
            </span>
          ) : null}
        </button>
        {isFolder && isExpanded ? item.children.map(child => renderMusicNode(child, depth + 1)) : null}
      </div>
    )
  }

  const showPlayerShell = musicProvider === 'youtube' || musicProvider === 'spotify' || musicProvider === 'file'
  const youtubeLabel = musicState.playlistId ? `YouTube playlist ${musicState.playlistIndex ?? 0}` : 'YouTube'

  return (
    <section className={`music-panel table-right-panel ${hidden ? 'table-right-panel-hidden' : ''}`} aria-label="Музыка комнаты">
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
            <span>Источник: {musicProvider === 'none' ? 'не выбран' : musicProvider === 'youtube' ? youtubeLabel : musicProvider}</span>
            <span>{Math.floor(getEffectiveMusicPosition(musicState))} сек.</span>
          </div>
        </div>
      ) : (
        <div className="music-readonly">
          <p>Музыкой управляет мастер</p>
          <span>Источник: {musicProvider === 'none' ? 'не выбран' : musicProvider}</span>
        </div>
      )}

      {musicProvider === 'spotify' ? (
        <div className="music-warning">
          Spotify Embed может проигрывать только preview/ограниченное воспроизведение. Для полного трека каждый игрок должен открыть Spotify или подключить Premium playback.
        </div>
      ) : null}

      {showPlayerShell ? (
        <div className={`${musicProvider}-embed ${isMaster ? '' : 'readonly'}`} ref={playerShellRef}>
          <div ref={playerMountRef} aria-label="Музыка комнаты" />
        </div>
      ) : spotifyEmbedUrl ? (
        <iframe
          className={isMaster ? '' : 'readonly'}
          title="Музыка комнаты"
          src={spotifyEmbedUrl}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : null}

      {!isMaster && ((musicProvider === 'youtube' && musicState.url) || (musicProvider === 'file' && musicState.url)) ? (
        <div className="player-local-controls" aria-label="Локальные настройки плеера">
          <label>
            <span>Громкость</span>
            <input type="range" min="0" max="100" value={localVolume} onChange={event => setPlayerLocalVolume(Number(event.target.value))} />
            <strong>{localVolume}%</strong>
          </label>
          {unlockVisible ? <button type="button" onClick={() => { adapterRef.current?.play(); setUnlockVisible(false) }}>Включить музыку</button> : null}
          {musicProvider === 'youtube' ? <button type="button" onClick={openYouTubeFullscreen}>На весь экран</button> : null}
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
        <div className={`music-library-list ${musicDropTarget?.id === null ? 'drop-root' : ''}`} onDragOver={event => handleMusicDragOver(event, null)} onDrop={event => handleMusicDrop(event, null)}>
          {musicTree.length === 0 ? <p className="panel-empty">Музыка ещё не загружена.</p> : musicTree.map(item => renderMusicNode(item))}
        </div>
      </section>

      <style jsx>{`
        .table-right-panel {
          width: 100%;
          min-width: 0;
          min-height: 0;
          align-self: stretch;
        }
        .table-right-panel-hidden { display: none !important; }
        .music-panel {
          border: 1px solid #2b2b2b;
          background: #101010;
          border-radius: 8px;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto auto auto auto minmax(0, 1fr);
          align-self: stretch;
        }
        .music-panel header {
          border-bottom: 1px solid #2b2b2b;
          background: #111;
          display: grid;
          gap: 4px;
          padding: 12px;
        }
        .music-panel header span { color: #9c9c9c; font-size: 12px; }
        .music-panel header strong { color: #f5f5f5; font-size: 15px; }
        .music-controls { display: grid; gap: 8px; padding: 10px; }
        .music-controls input { width: 100%; box-sizing: border-box; background: #090909; color: #eee; border: 1px solid #333; border-radius: 5px; padding: 8px; font: inherit; font-size: 12px; }
        .music-meta { display: flex; justify-content: space-between; gap: 8px; color: #9c9c9c; font-size: 12px; }
        .music-warning { padding: 9px 10px; border-top: 1px solid #302b20; border-bottom: 1px solid #302b20; background: #1b1710; color: #d9c99d; font-size: 12px; line-height: 1.35; }
        .music-panel iframe { width: 100%; height: 86px; border: 0; border-top: 1px solid #252525; background: #050505; }
        .audio-player { width: 100%; border-top: 1px solid #252525; background: #050505; }
        .audio-player:not([controls]) { display: none; }
        .youtube-embed { width: 100%; aspect-ratio: 16 / 9; min-height: 230px; border-top: 1px solid #252525; background: #050505; }
        .youtube-embed > div, .file-embed > div { width: 100%; height: 100%; }
        .youtube-embed iframe { width: 100%; height: 100%; display: block; border: 0; }
        .spotify-embed { width: 100%; min-height: 86px; border-top: 1px solid #252525; background: #050505; }
        .file-embed { width: 100%; min-height: 42px; border-top: 1px solid #252525; background: #050505; }
        .music-readonly { margin: 0; padding: 10px; color: #9d9d9d; font-size: 12px; line-height: 1.35; border-bottom: 1px solid #252525; }
        .music-readonly p { margin: 0 0 4px; color: #ddd; }
        .music-panel iframe.readonly, .spotify-embed.readonly { pointer-events: none; filter: grayscale(0.35); }
        .youtube-embed.readonly { filter: grayscale(0.18); }
        .youtube-embed.readonly > div, .youtube-embed.readonly iframe { pointer-events: none; }
        .player-local-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 10px; border-top: 1px solid #252525; background: #0d0d0d; }
        .player-local-controls label { min-width: 0; display: grid; grid-template-columns: auto minmax(80px, 1fr) 42px; gap: 8px; align-items: center; color: #bdbdbd; font-size: 12px; }
        .player-local-controls input { width: 100%; accent-color: #9ab7ff; }
        .player-local-controls strong { color: #eee; font-size: 12px; text-align: right; }
        .player-local-controls button { min-width: 0; height: 30px; border: 1px solid #333; border-radius: 5px; background: #181818; color: #f4f4f4; cursor: pointer; font: inherit; font-size: 12px; white-space: nowrap; }
        .music-library { min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border-top: 1px solid #252525; overflow: hidden; }
        .music-library header { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 9px 10px; background: #121212; border-bottom: 1px solid #252525; }
        .music-library header strong { color: #f5f5f5; font-size: 13px; }
        .music-library header span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9c9c9c; font-size: 12px; }
        .music-library-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 8px 10px; border-bottom: 1px solid #252525; }
        .music-library-actions input { display: none; }
        .music-library-actions button, .music-library-row { min-width: 0; border: 1px solid #333; border-radius: 5px; background: #181818; color: #f4f4f4; cursor: pointer; font: inherit; font-size: 12px; }
        .music-library-actions button { height: 30px; }
        .music-library-actions button:disabled { cursor: not-allowed; opacity: 0.5; }
        .music-library-list { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
        .music-library-list.drop-root { box-shadow: inset 0 0 0 1px rgba(154, 183, 255, 0.6); }
        .music-library-row { width: 100%; height: 38px; border: 0; border-bottom: 1px solid #252525; border-radius: 0; background: #202020; display: grid; grid-template-columns: 18px 28px minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding-right: 10px; text-align: left; }
        .music-library-row:hover, .music-library-row.active { background: #343434; }
        .music-library-row.drop-inside { outline: 1px solid rgba(154, 183, 255, 0.9); outline-offset: -2px; background: rgba(154, 183, 255, 0.14); }
        .music-row-icon { color: #bdbdbd; text-align: center; }
        .music-row-thumb { width: 24px; height: 24px; border: 1px solid #3a3a3a; border-radius: 4px; background: linear-gradient(135deg, #222, #4d3b3b); }
        .music-row-thumb.folder { position: relative; height: 17px; background: #c9a557; border-color: #8b7034; }
        .music-row-thumb.folder::before { content: ""; position: absolute; left: 1px; top: -5px; width: 11px; height: 6px; border-radius: 2px 2px 0 0; background: #d7b562; border: 1px solid #8b7034; border-bottom: 0; }
        .music-row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .music-row-state { color: #9ab7ff; font-size: 11px; }
        .music-row-delete { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid #3a3a3a; border-radius: 3px; color: #ddd; background: #252525; font-size: 14px; }
        .music-row-delete:hover { border-color: #703333; color: #fff; background: #3a1717; }
      `}</style>
    </section>
  )
}
