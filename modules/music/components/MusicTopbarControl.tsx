'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/lib/i18n/LanguageProvider'
import type { MusicLibraryItem, MusicLibraryRow, MusicState } from '../types'
import { mapMusicLibraryRow, mapMusicRow, TABLE_MUSIC, TABLE_MUSIC_LIBRARY, upsertMusicLibraryItem } from '../utils'

const MUSIC_VOLUME_STORAGE_KEY = 'vtm-youtube-volume'
const MUSIC_PLAYER_COMMAND_EVENT = 'vtm-player-command'
const MUSIC_UNLOCK_REQUEST_EVENT = 'vtm-music-unlock-request'

function clampMusicVolume(volume: number) {
  return Math.min(100, Math.max(0, Math.round(volume)))
}

function getTrackLabel(state: MusicState, library: MusicLibraryItem[]) {
  const item = library.find(
    entry => entry.itemType === 'track' && (entry.id === state.activeUri || entry.url === state.url),
  )
  if (item?.name) return item.name
  if (state.provider === 'youtube') return 'YouTube'
  try {
    const url = new URL(state.url)
    const fileName = decodeURIComponent(url.pathname.split('/').pop() || '')
    return fileName || url.hostname
  } catch {
    return state.url
  }
}

export type MusicTopbarControlProps = {
  room: string
}

export default function MusicTopbarControl({ room }: MusicTopbarControlProps) {
  const { t } = useLang()
  const [musicState, setMusicState] = useState<MusicState | null>(null)
  const [library, setLibrary] = useState<MusicLibraryItem[]>([])
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(false)
  const volumeBeforeMuteRef = useRef(70)

  const applyVolume = useCallback((nextVolume: number) => {
    const clamped = clampMusicVolume(nextVolume)
    setVolume(clamped)
    window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(clamped))
    window.dispatchEvent(new CustomEvent(MUSIC_PLAYER_COMMAND_EVENT, {
      detail: { room, command: 'set-volume', volume: clamped },
    }))
  }, [room])

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY))
    if (!Number.isFinite(saved)) return
    const clamped = clampMusicVolume(saved)
    setVolume(clamped)
    volumeBeforeMuteRef.current = clamped
    setMuted(clamped === 0)
  }, [])

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<MusicState>).detail
      if (!detail || detail.room !== room) return
      setMusicState(detail)
    }

    window.addEventListener('vtm-music-state', onState)
    return () => window.removeEventListener('vtm-music-state', onState)
  }, [room])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const loadMusicState = async () => {
      const { data } = await supabase.from(TABLE_MUSIC).select('*').eq('room', room).maybeSingle()
      if (cancelled || !data) return
      setMusicState(mapMusicRow(data))
    }

    const loadLibrary = async () => {
      const { data } = await supabase
        .from(TABLE_MUSIC_LIBRARY)
        .select('id, room, item_type, parent_id, name, url, created_at')
        .eq('room', room)
        .order('created_at', { ascending: true })
        .limit(160)

      if (cancelled || !data) return
      setLibrary(data.map(row => mapMusicLibraryRow(row as MusicLibraryRow)))
    }

    void loadMusicState()
    void loadLibrary()

    const channel = supabase
      .channel(`music-topbar:${room}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_MUSIC, filter: `room=eq.${room}` },
        payload => {
          const next = (payload.new || payload.old) as Parameters<typeof mapMusicRow>[0]
          if (next?.room) setMusicState(mapMusicRow(next))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE_MUSIC_LIBRARY, filter: `room=eq.${room}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string }
            if (!deleted.id) return
            setLibrary(prev => prev.filter(item => item.id !== deleted.id))
            return
          }
          const row = payload.new as MusicLibraryRow
          setLibrary(prev => upsertMusicLibraryItem(prev, mapMusicLibraryRow(row)))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [room])

  const trackLabel = useMemo(() => {
    if (!musicState?.url) return t('Музыка не выбрана')
    const name = getTrackLabel(musicState, library)
    if (!name) return t('Музыка не выбрана')
    return musicState.isPlaying ? name : `${name} · ${t('Пауза')}`
  }, [library, musicState, t])

  const displayVolume = muted ? 0 : volume
  const sliderDisabled = !musicState?.url

  const toggleMute = () => {
    if (muted || volume === 0) {
      setMuted(false)
      const restored = volumeBeforeMuteRef.current > 0 ? volumeBeforeMuteRef.current : 70
      applyVolume(restored)
      window.dispatchEvent(new CustomEvent(MUSIC_UNLOCK_REQUEST_EVENT))
      return
    }

    volumeBeforeMuteRef.current = volume > 0 ? volume : volumeBeforeMuteRef.current
    setMuted(true)
    applyVolume(0)
  }

  const onVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    if (next > 0) {
      setMuted(false)
      volumeBeforeMuteRef.current = next
    } else {
      setMuted(true)
    }
    applyVolume(next)
  }

  return (
    <div className="tbl-music" title={t('Громкость музыки — только у тебя')}>
      <button
        type="button"
        className={`tbl-music-note ${muted || displayVolume === 0 ? 'muted' : ''}`}
        aria-label={muted || displayVolume === 0 ? t('Включить музыку') : t('Выключить музыку')}
        onClick={toggleMute}
      >
        <span aria-hidden="true">♪</span>
      </button>
      <div className="tbl-music-body">
        <span className="tbl-music-track">{trackLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={displayVolume}
          disabled={sliderDisabled}
          aria-label={t('Громкость')}
          style={{ '--vol': `${displayVolume}%` } as CSSProperties}
          onChange={onVolumeChange}
        />
      </div>
      <span className="tbl-music-val">{displayVolume}</span>
    </div>
  )
}