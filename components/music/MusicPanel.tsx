'use client'

import { ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { LocalAudioAdapter } from './adapters/localAudioAdapter'
import { YouTubeAdapter } from './adapters/youtubeAdapter'
import { MusicSyncEngine } from './MusicSyncEngine'
import type { MusicChannel, MusicChannelRef, MusicDropTarget, MusicLibraryItem, MusicLibraryRow, MusicProvider, MusicState, MusicSyncAdapter, MusicTreeNode } from './types'
import {
  buildMusicTree,
  broadcastMusicChannel,
  getEffectiveMusicPosition,
  getMusicProvider,
  getStoragePathFromPublicUrl,
  isMissingColumnError,
  isMissingRelationError,
  mapMusicLibraryRow,
  mapMusicRow,
  parseYouTubeUrl,
  safeStorageName,
  TABLE_MUSIC,
  TABLE_MUSIC_BUCKET,
  TABLE_MUSIC_LIBRARY,
  upsertMusicLibraryItem,
} from './utils'

const VISIBLE_MUSIC_ENGINE_ID = 'vtm-music-visible-engine'
const VISIBLE_MUSIC_ENGINE_EVENT = 'vtm-music-visible-engine-updated'
const MUSIC_UNLOCK_NEEDED_EVENT = 'vtm-music-unlock-needed'
const MUSIC_UNLOCK_REQUEST_EVENT = 'vtm-music-unlock-request'
let supportsExtendedMusicLoad = true
let supportsMusicLibraryAutoplay = true

type MusicPanelProps = {
  room: string
  tableRole: 'master' | 'player' | null
  channelRef?: MusicChannelRef
  hidden?: boolean
  playbackEnabled?: boolean
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

export default function MusicPanel({ room, tableRole, channelRef, hidden = false, playbackEnabled = true }: MusicPanelProps) {
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
  const playerMountRef = useRef<HTMLDivElement>(null)
  const youtubeShellRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<MusicSyncEngine | null>(null)
  const musicChannelRef = useRef<MusicChannel | null>(null)
  const adapterRef = useRef<MusicSyncAdapter | null>(null)
  const adapterProviderRef = useRef<MusicProvider>('none')
  const adapterMasterRef = useRef(isMaster)
  const musicStateRef = useRef<MusicState>(emptyMusicState(room))
  const musicLibraryRef = useRef<MusicLibraryItem[]>([])
  const musicDraftEditingRef = useRef(false)
  const musicDraftDirtyRef = useRef(false)

  const musicProvider = musicState.provider || getMusicProvider(musicState.url)
  const musicTree = useMemo(() => buildMusicTree(musicLibrary), [musicLibrary])
  const [visibleEngineMountVersion, setVisibleEngineMountVersion] = useState(0)

  const getAutoplayTrack = () => {
    const flattened: MusicLibraryItem[] = []
    const traverse = (nodes: MusicTreeNode[]) => {
      nodes.forEach(node => {
        if (node.itemType === 'track') flattened.push(node)
        if (node.children.length) traverse(node.children)
      })
    }
    traverse(musicTree)
    return flattened.find(item => item.autoplay) || null
  }

  const getNextLibraryTrack = (current: MusicState | null) => {
    if (!current) return null
    const flattened: MusicLibraryItem[] = []
    const traverse = (nodes: MusicTreeNode[]) => {
      nodes.forEach(node => {
        if (node.itemType === 'track') flattened.push(node)
        if (node.children.length) traverse(node.children)
      })
    }
    traverse(musicTree)

    const currentIndex = flattened.findIndex(item => item.id === current.activeUri || item.url === current.url)
    if (currentIndex === -1 || currentIndex + 1 >= flattened.length) return null
    return flattened[currentIndex + 1]
  }

  useEffect(() => {
    if (!playbackEnabled) return

    const update = () => setVisibleEngineMountVersion(v => v + 1)
    update()
    window.addEventListener(VISIBLE_MUSIC_ENGINE_EVENT, update)
    return () => window.removeEventListener(VISIBLE_MUSIC_ENGINE_EVENT, update)
  }, [playbackEnabled])

  useLayoutEffect(() => {
    if (hidden || playbackEnabled) return

    const notify = () => window.dispatchEvent(new CustomEvent(VISIBLE_MUSIC_ENGINE_EVENT))
    notify()
    return () => {
      const visibleMount = document.getElementById(VISIBLE_MUSIC_ENGINE_ID)
      const globalMount = document.getElementById('global-music-engine')
      if (visibleMount && globalMount && visibleMount.firstChild) {
        globalMount.innerHTML = ''
        while (visibleMount.firstChild) globalMount.appendChild(visibleMount.firstChild)
      }
      notify()
    }
  }, [hidden, playbackEnabled, musicProvider])

  useEffect(() => {
    const savedVolume = Number(window.localStorage.getItem('vtm-youtube-volume'))
    if (Number.isFinite(savedVolume)) setLocalVolume(Math.min(100, Math.max(0, savedVolume)))
  }, [])

  useEffect(() => {
    const showUnlock = () => setUnlockVisible(true)
    const hideUnlock = () => setUnlockVisible(false)

    window.addEventListener(MUSIC_UNLOCK_NEEDED_EVENT, showUnlock)
    window.addEventListener(MUSIC_UNLOCK_REQUEST_EVENT, hideUnlock)
    return () => {
      window.removeEventListener(MUSIC_UNLOCK_NEEDED_EVENT, showUnlock)
      window.removeEventListener(MUSIC_UNLOCK_REQUEST_EVENT, hideUnlock)
    }
  }, [])

  useEffect(() => {
    musicLibraryRef.current = musicLibrary
  }, [musicLibrary])

  useEffect(() => {
    if (!isMaster || !playbackEnabled) return
    const currentUrl = musicStateRef.current.url
    if (currentUrl) return

    const autoplayTrack = getAutoplayTrack()
    if (autoplayTrack && autoplayTrack.itemType === 'track') {
      playMusicTrack(autoplayTrack)
    }
  }, [musicLibrary, isMaster, playbackEnabled])

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
        if (!musicDraftEditingRef.current && !musicDraftDirtyRef.current) setMusicDraft(next.url || '')
        setMusicStatus(next.url ? (next.isPlaying ? 'Играет синхронно' : 'Пауза') : 'Музыка выключена')
      },
      onStatus: setMusicStatus,
    })
  }, [room, isMaster, channelRef])

  useEffect(() => {
    const handleLocalMusicState = (event: Event) => {
      const music = (event as CustomEvent<MusicState>).detail
      if (!music || music.room !== room) return
      engineRef.current?.applyIncoming(music)
    }

    window.addEventListener('vtm-music-state', handleLocalMusicState)
    return () => window.removeEventListener('vtm-music-state', handleLocalMusicState)
  }, [room])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const loadMusic = async () => {
      try {
        if (supportsExtendedMusicLoad) {
          const extended = await supabase
            .from(TABLE_MUSIC)
            .select('room, url, active_uri, is_playing, position_seconds, updated_at, provider, playlist_id, playlist_index, track_id, source_type')
            .eq('room', room)
            .maybeSingle()

          if (cancelled) return

          if (!extended.error) {
            if (extended.data) {
              engineRef.current?.applyIncoming(mapMusicRow(extended.data))
            } else setMusicStatus('Музыка не выбрана')
            return
          }

          if (isMissingColumnError(extended.error)) {
            supportsExtendedMusicLoad = false
          } else {
            console.warn('Extended music load failed, attempting fallback:', extended.error)
          }
        }

        const fallback = await supabase.from(TABLE_MUSIC).select('*').eq('room', room).maybeSingle()
        if (cancelled) return
        if (fallback.error) {
          console.error('Не удалось загрузить музыку комнаты (fallback):', fallback.error)
          setMusicStatus('Нет общей музыки')
          return
        }
        if (fallback.data) engineRef.current?.applyIncoming(mapMusicRow(fallback.data))
        else setMusicStatus('Музыка не выбрана')
      } catch (err) {
        console.error('Unexpected error loading music:', err)
        setMusicStatus('Ошибка при загрузке музыки')
      }
    }

    void loadMusic()

    const loadMusicLibrary = async () => {
      const includeAutoplay = supportsMusicLibraryAutoplay
      const selectColumns = includeAutoplay
        ? 'id, room, item_type, parent_id, name, url, autoplay, created_at'
        : 'id, room, item_type, parent_id, name, url, created_at'

      const { data, error } = await supabase
        .from(TABLE_MUSIC_LIBRARY)
        .select(selectColumns)
        .eq('room', room)
        .order('created_at', { ascending: true })
        .limit(160)

      if (error && includeAutoplay && isMissingColumnError(error)) {
        supportsMusicLibraryAutoplay = false
        await loadMusicLibrary()
        return
      }

      if (cancelled) return
      if (error) {
        if (isMissingRelationError(error)) {
          setMusicLibrary([])
          musicLibraryRef.current = []
          return
        }
        console.error('Не удалось загрузить музыкальную библиотеку:', error)
        return
      }
      const next = (data || []).map(row => mapMusicLibraryRow(row as unknown as MusicLibraryRow))
      musicLibraryRef.current = next
      setMusicLibrary(next)
    }

    void loadMusicLibrary()

    const channelName = `table-music:${room}:${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
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
    if (!playbackEnabled) {
      adapterRef.current?.destroy()
      adapterRef.current = null
      adapterProviderRef.current = 'none'
      if (playerMountRef.current) playerMountRef.current.innerHTML = ''
      return
    }

    // allow mounting into a global hidden mount if the local player mount isn't rendered
    const provider = musicProvider
    if (adapterRef.current && (adapterProviderRef.current !== provider || adapterMasterRef.current !== isMaster)) {
      adapterRef.current.destroy()
      adapterRef.current = null
      adapterProviderRef.current = 'none'
      adapterMasterRef.current = isMaster
    }

    if (provider !== 'youtube' && provider !== 'file') {
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
            if (status.includes('Включить музыку')) {
              setUnlockVisible(true)
              window.dispatchEvent(new CustomEvent(MUSIC_UNLOCK_NEEDED_EVENT))
            }
          },
          canPublish: () => engineRef.current?.canPublishLifecycleEvent() ?? false,
        })
      }
      if (provider === 'file') {
        adapterRef.current = new LocalAudioAdapter({
          isMaster,
          volume: localVolume,
          onStatus: status => {
            setMusicStatus(status)
            if (status.includes('Включить музыку')) {
              setUnlockVisible(true)
              window.dispatchEvent(new CustomEvent(MUSIC_UNLOCK_NEEDED_EVENT))
            }
          },
          canPublish: () => engineRef.current?.canPublishLifecycleEvent() ?? false,
        })
      }
      adapterProviderRef.current = provider
      adapterMasterRef.current = isMaster
      adapterRef.current?.onStateChange(patch => {
        const currentState = musicStateRef.current
        if (
          patch.playbackEnded &&
          isMaster &&
          !currentState.playlistId &&
          (currentState.provider === 'file' || currentState.provider === 'youtube')
        ) {
          const nextTrack = getNextLibraryTrack(currentState)
          if (nextTrack) {
            publishMusicState({
              url: nextTrack.url,
              provider: getMusicProvider(nextTrack.url),
              activeUri: nextTrack.id,
              isPlaying: true,
              positionSeconds: 0,
            })
            return
          }
        }
        void engineRef.current?.publishMusicState(patch)
      })
    }

    // Always re-evaluate the best mount target (runs on every effect trigger,
    // including when visibleEngineMountVersion changes after the visible panel appears).
    const visibleMount = typeof document !== 'undefined' ? document.getElementById(VISIBLE_MUSIC_ENGINE_ID) as HTMLDivElement | null : null
    const globalMount = typeof document !== 'undefined' ? document.getElementById('global-music-engine') as HTMLDivElement | null : null
    const mountEl = visibleMount ?? (!hidden && playerMountRef.current ? playerMountRef.current : globalMount ?? playerMountRef.current)
    if (mountEl) adapterRef.current?.mount(mountEl)

    void adapterRef.current?.load(musicState)
  }, [musicProvider, musicState, isMaster, localVolume, playbackEnabled, visibleEngineMountVersion])

  useEffect(() => {
    if (!playbackEnabled) return
    adapterRef.current?.setVolume?.(localVolume)
  }, [localVolume, playbackEnabled])

  useEffect(() => {
    if (!playbackEnabled) return
    const resyncVisibleTab = () => {
      if (document.visibilityState !== 'visible') return
      void adapterRef.current?.load(musicStateRef.current)
    }
    document.addEventListener('visibilitychange', resyncVisibleTab)
    window.addEventListener('focus', resyncVisibleTab)
    return () => {
      document.removeEventListener('visibilitychange', resyncVisibleTab)
      window.removeEventListener('focus', resyncVisibleTab)
    }
  }, [playbackEnabled])

  // Listen for volume changes from the visible (non-playbackEnabled) panel instance
  useEffect(() => {
    if (!playbackEnabled) return
    const onVolume = (e: Event) => {
      const v = (e as CustomEvent<number>).detail
      if (!Number.isFinite(v)) return
      const clamped = Math.min(100, Math.max(0, Math.round(v)))
      adapterRef.current?.setVolume?.(clamped)
    }
    window.addEventListener('vtm-player-volume', onVolume)
    return () => window.removeEventListener('vtm-player-volume', onVolume)
  }, [playbackEnabled])

  useEffect(() => {
    if (!playbackEnabled) return
    const unlockFromVisiblePanel = () => {
      adapterRef.current?.play()
      setUnlockVisible(false)
    }
    window.addEventListener(MUSIC_UNLOCK_REQUEST_EVENT, unlockFromVisiblePanel)
    return () => window.removeEventListener(MUSIC_UNLOCK_REQUEST_EVENT, unlockFromVisiblePanel)
  }, [playbackEnabled])

  useEffect(() => {
    if (!playbackEnabled) return
    if (!musicState.isPlaying || (musicProvider !== 'youtube' && musicProvider !== 'file')) return
    const unlock = () => {
      adapterRef.current?.play()
      setUnlockVisible(false)
      window.dispatchEvent(new CustomEvent(MUSIC_UNLOCK_REQUEST_EVENT))
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [musicProvider, musicState.isPlaying, playbackEnabled])

  const broadcast = (event: string, payload: unknown) => {
    broadcastMusicChannel(musicChannelRef.current, event, payload)
    broadcastMusicChannel(channelRef?.current, event, payload)
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
      musicDraftDirtyRef.current = false
      publishMusicState({ url: '', activeUri: '', provider: 'none', playlistId: undefined, playlistIndex: undefined, trackId: undefined, isPlaying: false, positionSeconds: 0 })
      return
    }

    if (normalizedUrl === currentMusic.url) {
      musicDraftDirtyRef.current = false
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
      musicDraftDirtyRef.current = false
      return
    }

    if (provider === 'file') {
      publishMusicState({ url: normalizedUrl, provider, activeUri: '', isPlaying: Boolean(options.play), positionSeconds: 0 })
      musicDraftDirtyRef.current = false
      return
    }

    setMusicStatus('Поддерживаются YouTube и аудиофайлы')
  }

  const playCurrentMusic = () => {
    if (!isMaster) return
    if (musicDraftDirtyRef.current && musicDraft.trim()) {
      applyMusicDraft({ play: true })
      return
    }
    if (!musicStateRef.current.url) return
    publishMusicState({
      isPlaying: true,
      positionSeconds: Math.max(0, Math.floor(engineRef.current?.getEffectivePosition() ?? 0)),
    })
  }

  const pauseCurrentMusic = () => {
    if (!isMaster || !musicStateRef.current.url) return
    publishMusicState({
      isPlaying: false,
      positionSeconds: Math.max(0, Math.floor(engineRef.current?.getEffectivePosition() ?? 0)),
    })
  }

  const stopCurrentMusic = () => {
    if (!isMaster || !musicStateRef.current.url) return
    publishMusicState({ isPlaying: false, positionSeconds: 0 })
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

    const folderRow = {
      id: folder.id,
      room: folder.room,
      item_type: folder.itemType,
      parent_id: folder.parentId,
      name: folder.name,
      url: folder.url,
      autoplay: folder.autoplay ?? false,
      created_at: folder.createdAt,
    }
    const folderLegacyRow = {
      id: folder.id,
      room: folder.room,
      item_type: folder.itemType,
      parent_id: folder.parentId,
      name: folder.name,
      url: folder.url,
      created_at: folder.createdAt,
    }

    const supabase = createClient()
    const includeAutoplay = supportsMusicLibraryAutoplay
    let { error } = includeAutoplay
      ? await supabase.from(TABLE_MUSIC_LIBRARY).insert(folderRow)
      : await supabase.from(TABLE_MUSIC_LIBRARY).insert(folderLegacyRow)
    if (error && includeAutoplay && isMissingColumnError(error)) {
      supportsMusicLibraryAutoplay = false
      ;({ error } = await supabase.from(TABLE_MUSIC_LIBRARY).insert(folderLegacyRow))
    }

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

        const itemRow = {
          id: item.id,
          room: item.room,
          item_type: item.itemType,
          parent_id: item.parentId,
          name: item.name,
          url: item.url,
          autoplay: item.autoplay ?? false,
          created_at: item.createdAt,
        }
        const itemLegacyRow = {
          id: item.id,
          room: item.room,
          item_type: item.itemType,
          parent_id: item.parentId,
          name: item.name,
          url: item.url,
          created_at: item.createdAt,
        }

        const includeAutoplay = supportsMusicLibraryAutoplay
        let { error } = includeAutoplay
          ? await supabase.from(TABLE_MUSIC_LIBRARY).insert(itemRow)
          : await supabase.from(TABLE_MUSIC_LIBRARY).insert(itemLegacyRow)
        if (error && includeAutoplay && isMissingColumnError(error)) {
          supportsMusicLibraryAutoplay = false
          ;({ error } = await supabase.from(TABLE_MUSIC_LIBRARY).insert(itemLegacyRow))
        }

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
    const provider = getMusicProvider(track.url)
    if (provider === 'youtube') {
      const parsed = parseYouTubeUrl(track.url)
      publishMusicState({
        url: track.url,
        activeUri: parsed.playlistId || parsed.videoId || track.id,
        provider,
        playlistId: parsed.playlistId,
        playlistIndex: parsed.playlistId ? 0 : undefined,
        trackId: parsed.videoId || undefined,
        isPlaying: true,
        positionSeconds: 0,
      })
      return
    }
    if (provider !== 'file') {
      setMusicStatus('Этот трек не похож на аудиофайл')
      return
    }
    publishMusicState({ url: track.url, activeUri: track.id, provider, isPlaying: true, positionSeconds: 0 })
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

  const openYouTubeFullscreen = () => {
    const el = youtubeShellRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
  }

  const showPlayerShell = musicProvider === 'youtube' || musicProvider === 'file'
  const youtubeLabel = musicState.playlistId ? `YouTube playlist ${musicState.playlistIndex ?? 0}` : 'YouTube'

  return (
    <section className={`music-panel table-right-panel ${hidden ? 'music-panel-hidden' : ''}`} aria-label="Музыка комнаты" aria-hidden={hidden || undefined}>
      <header>
        <strong>Музыка</strong>
        <span>{isMaster ? musicStatus : 'Музыкой управляет мастер'}</span>
      </header>
      {isMaster ? (
        <form
          className="music-controls"
          onSubmit={event => {
            event.preventDefault()
            applyMusicDraft({ play: true })
          }}
        >
          <input
            value={musicDraft}
            onFocus={() => {
              musicDraftEditingRef.current = true
            }}
            onChange={event => {
              musicDraftDirtyRef.current = true
              setMusicDraft(event.target.value)
            }}
            onBlur={() => {
              musicDraftEditingRef.current = false
            }}
            placeholder="YouTube ссылка или аудиофайл"
          />
          <div className="music-link-actions" aria-label="Управление музыкой комнаты">
            <button type="button" onClick={playCurrentMusic} disabled={!musicDraft.trim() && !musicState.url}>
              Играть
            </button>
            <button type="button" onClick={pauseCurrentMusic} disabled={!musicState.url || !musicState.isPlaying}>
              Пауза
            </button>
            <button type="button" onClick={stopCurrentMusic} disabled={!musicState.url}>
              Стоп
            </button>
          </div>
          <div className="music-meta">
            <span>Источник: {musicProvider === 'none' ? 'не выбран' : musicProvider === 'youtube' ? youtubeLabel : musicProvider}</span>
            <span>{Math.floor(getEffectiveMusicPosition(musicState))} сек.</span>
          </div>
        </form>
      ) : (
        <div className="music-readonly">
          <p>Музыкой управляет мастер</p>
          <span>Источник: {musicProvider === 'none' ? 'не выбран' : musicProvider}</span>
        </div>
      )}

      {showPlayerShell ? (
        <>
          {musicProvider === 'file' ? (
            <div className="music-engine-mount file-engine">
              <div ref={playerMountRef} aria-label="Музыка комнаты" />
            </div>
          ) : !hidden ? (
            // visible web embeds when the Music panel is open
            musicProvider === 'youtube' ? (
              <div className={`youtube-embed ${!isMaster ? 'readonly' : ''}`} aria-label="YouTube плеер" ref={youtubeShellRef}>
                <div id={VISIBLE_MUSIC_ENGINE_ID} style={{ width: '100%', height: '100%' }} />
                <div ref={playerMountRef} style={{ display: 'none' }} />
              </div>
            ) : null
          ) : (
            // hidden global mount when panel is closed
            <div className="music-engine-mount web-engine" aria-hidden="true">
              <div ref={playerMountRef} aria-label="Музыка комнаты" />
            </div>
          )}

          {/* show simple placeholder when embed is hidden */}
          {(hidden && musicProvider === 'youtube') ? (
            <div className="music-web-placeholder" aria-label="Музыкальный плеер">
              <strong>{youtubeLabel}</strong>
              <span>{musicState.isPlaying ? 'Играет' : 'Пауза'} · {Math.floor(getEffectiveMusicPosition(musicState))} сек.</span>
            </div>
          ) : null}
        </>
      ) : null}

      {!isMaster && ((musicProvider === 'youtube' && musicState.url) || (musicProvider === 'file' && musicState.url)) ? (
        <div className="player-local-controls" aria-label="Локальные настройки плеера">
          <label>
            <span>Громкость</span>
            <input
              type="range"
              min="0"
              max="100"
              value={localVolume}
              onChange={event => {
                const v = Math.min(100, Math.max(0, Math.round(Number(event.target.value))))
                setLocalVolume(v)
                window.localStorage.setItem('vtm-youtube-volume', String(v))
                // Propagate to the always-hidden playbackEnabled panel that owns the adapter
                window.dispatchEvent(new CustomEvent('vtm-player-volume', { detail: v }))
                // Also set directly if this panel owns the adapter
                adapterRef.current?.setVolume?.(v)
              }}
            />
            <strong>{localVolume}%</strong>
          </label>
          {musicProvider === 'youtube' ? (
            <button type="button" onClick={openYouTubeFullscreen}>⛶ Полный экран</button>
          ) : null}
          {unlockVisible ? (
            <button
              type="button"
              onClick={() => {
                adapterRef.current?.play()
                setUnlockVisible(false)
                window.dispatchEvent(new CustomEvent(MUSIC_UNLOCK_REQUEST_EVENT))
              }}
            >
              Включить музыку
            </button>
          ) : null}
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
        .table-right-panel {
          width: 100%;
          min-width: 0;
          min-height: 0;
          align-self: stretch;
        }
        .music-panel-hidden {
          position: fixed !important;
          left: 0;
          bottom: 0;
          width: 1px !important;
          height: 1px !important;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: -1;
        }
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
        .music-link-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
        .music-link-actions button { min-width: 0; height: 30px; border: 1px solid #333; border-radius: 5px; background: #181818; color: #f4f4f4; cursor: pointer; font: inherit; font-size: 12px; }
        .music-link-actions button:hover { background: #242424; }
        .music-link-actions button:disabled { cursor: not-allowed; opacity: 0.48; }
        .music-meta { display: flex; justify-content: space-between; gap: 8px; color: #9c9c9c; font-size: 12px; }
        .music-panel iframe { width: 100%; height: 86px; border: 0; border-top: 1px solid #252525; background: #050505; }
        .music-engine-mount.web-engine {
          position: fixed;
          left: -10000px;
          bottom: 0;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .music-engine-mount.file-engine { width: 100%; border-top: 1px solid #252525; background: #050505; }
        .music-web-placeholder {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-top: 1px solid #252525;
          background: #080808;
          color: #d8d8d8;
        }
        .music-web-placeholder strong { color: #f2f2f2; font-size: 13px; }
        .music-web-placeholder span { color: #9c9c9c; font-size: 12px; }
        .audio-player { width: 100%; border-top: 1px solid #252525; background: #050505; }
        .audio-player:not([controls]) { display: none; }
        .youtube-embed { position: relative; width: 100%; aspect-ratio: 16 / 9; min-height: 230px; border-top: 1px solid #252525; background: #050505; }
        .youtube-embed > div, .file-embed > div { width: 100%; height: 100%; }
        .youtube-embed iframe { width: 100%; height: 100%; display: block; border: 0; }
        .file-embed { width: 100%; min-height: 42px; border-top: 1px solid #252525; background: #050505; }
        .music-readonly { margin: 0; padding: 10px; color: #9d9d9d; font-size: 12px; line-height: 1.35; border-bottom: 1px solid #252525; }
        .music-readonly p { margin: 0 0 4px; color: #ddd; }
        .youtube-embed.readonly { filter: grayscale(0.18); }
        .youtube-embed.readonly::after { content: ""; position: absolute; inset: 0; z-index: 2; cursor: default; }
        .player-local-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px; border-top: 1px solid #252525; background: #0d0d0d; }
        .player-local-controls label { flex: 1; min-width: 160px; display: grid; grid-template-columns: auto minmax(80px, 1fr) 42px; gap: 8px; align-items: center; color: #bdbdbd; font-size: 12px; }
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
