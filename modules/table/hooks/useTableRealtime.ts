'use client'

/** Table room Realtime channel: broadcast + postgres_changes. Supabase client from api/realtime-api. */
import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatUser } from '@/modules/chat/types'
import { broadcastMusicChannel } from '@/modules/music/utils'
import type { MusicChannel } from '@/modules/music/types'
import { getTableSupabaseClient, removeTableRoomChannel } from '../api/realtime-api'
import {
  TABLE_IMAGES,
  TABLE_ROLLS,
  TABLE_SCENE_MUSIC,
  TABLE_SCENES,
} from '../constants'
import {
  mapLayerRow,
  mapRollRow,
  mapSceneMusicRow,
  mapSceneRow,
} from '../mappers'
import type {
  ActiveParticipant,
  LayerPatch,
  MasterReveal,
  MasterWhisper,
  OpposedRollProposal,
  RightRailTab,
  RollMessage,
  RollRow,
  SceneMusicRow,
  SceneMusicTrack,
  TableLayer,
  TableLayerRow,
  TableScene,
  TableSceneRow,
  VoiceSignal,
} from '../types'
import { mergeRoll, sortLayers, upsertLayer } from '../utils/layer-utils'
import { sortSceneMusic, upsertScene } from '../utils/scene-utils'

export type UseTableRealtimeOptions = {
  room: string
  tf: (key: string, vars: Record<string, string | number>) => string
  chatUserRef: MutableRefObject<ChatUser | null>
  activeSceneIdRef: MutableRefObject<string | null>
  layersRef: MutableRefObject<TableLayer[]>
  setRolls: Dispatch<SetStateAction<RollMessage[]>>
  setLayers: Dispatch<SetStateAction<TableLayer[]>>
  setScenes: Dispatch<SetStateAction<TableScene[]>>
  setSceneMusic: Dispatch<SetStateAction<SceneMusicTrack[]>>
  setActiveSceneId: Dispatch<SetStateAction<string | null>>
  setSelectedSceneId: Dispatch<SetStateAction<string | null>>
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>
  setSelectedLayerIds: Dispatch<SetStateAction<Set<string>>>
  setConnectionText: Dispatch<SetStateAction<string>>
  setTableStatus: Dispatch<SetStateAction<string>>
  setHandNotice: Dispatch<SetStateAction<string>>
  setIncomingOpposedProposal: Dispatch<SetStateAction<OpposedRollProposal | null>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  setRoomParticipants: Dispatch<SetStateAction<ActiveParticipant[]>>
  setMasterReveals: Dispatch<SetStateAction<MasterReveal[]>>
  setMasterWhispers: Dispatch<SetStateAction<MasterWhisper[]>>
  setZoom: Dispatch<SetStateAction<number>>
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>
  loadLayersForScene: (targetRoom: string, sceneId: string) => void | Promise<void>
  loadSceneMusic: (targetRoom: string, sceneId: string) => void | Promise<void>
  ensureDefaultScene: (targetRoom: string) => Promise<string | null>
  onRollRef: MutableRefObject<((roll: RollMessage) => void) | null>
  onVoiceSignalRef: MutableRefObject<((signal: VoiceSignal) => void | Promise<void>) | null>
}

export function useTableRealtime(options: UseTableRealtimeOptions) {
  const channelRef = useRef<MusicChannel | null>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  })

  const broadcast = useCallback((event: string, payload: unknown) => {
    broadcastMusicChannel(channelRef.current, event, payload)
  }, [])

  useEffect(() => {
    const {
      room: currentRoom,
      tf,
      chatUserRef,
      activeSceneIdRef,
      layersRef,
      setRolls,
      setLayers,
      setScenes,
      setSceneMusic,
      setActiveSceneId,
      setSelectedSceneId,
      setSelectedLayerId,
      setSelectedLayerIds,
      setConnectionText,
      setTableStatus,
      setHandNotice,
      setIncomingOpposedProposal,
      setRightRailTab,
      setRoomParticipants,
      setMasterReveals,
      setMasterWhispers,
      setZoom,
      setPan,
      loadLayersForScene,
      loadSceneMusic,
      ensureDefaultScene,
      onRollRef,
      onVoiceSignalRef,
    } = optionsRef.current

    const supabase = getTableSupabaseClient()
    let cancelled = false

    ensureDefaultScene(currentRoom).then(sceneId => {
      if (cancelled || !sceneId) return
      void loadLayersForScene(currentRoom, sceneId)
      void loadSceneMusic(currentRoom, sceneId)
    })

    const channel = supabase
      .channel(`table-room:${currentRoom}`)
      .on('broadcast', { event: 'roll' }, payload => {
        const roll = payload.payload as RollMessage
        if (!roll || roll.room !== currentRoom) return
        setRolls(prev => mergeRoll(prev, roll))
        onRollRef.current?.(roll)
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
        const scene = payload.payload as { room?: string; sceneId?: string; fade?: boolean }
        if (scene.room !== currentRoom || !scene.sceneId) return
        // Optional smooth fade when master publishes from /master shell.
        if (scene.fade && typeof document !== 'undefined') {
          const root = document.querySelector('.scene-viewport, .table-scene, [data-table-canvas]') as HTMLElement | null
          if (root) {
            root.style.transition = 'opacity 0.45s ease'
            root.style.opacity = '0.35'
            window.setTimeout(() => {
              root.style.opacity = '1'
            }, 120)
          }
        }
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
        void onVoiceSignalRef.current?.(payload.payload as VoiceSignal)
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
          onRollRef.current?.(roll)
          setConnectionText('Онлайн')
        },
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
        },
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
        },
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
        },
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
        },
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
        },
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnectionText('Онлайн')
        if (status === 'CHANNEL_ERROR') setConnectionText('Realtime недоступен')
        if (status === 'TIMED_OUT') setConnectionText('Повтор подключения')
      })

    channelRef.current = channel as MusicChannel

    return () => {
      cancelled = true
      channelRef.current = null
      removeTableRoomChannel(supabase, channel)
    }
  }, [options.room])

  return { channelRef, broadcast }
}