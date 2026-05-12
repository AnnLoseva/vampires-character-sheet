import { createClient } from '@/lib/supabase'
import type { MusicChannel, MusicState } from './types'
import { getEffectiveMusicPosition, getMusicProvider, isMusicLifecycleSafe, TABLE_MUSIC, toMusicDbRow } from './utils'

type MusicEngineOptions = {
  room: string
  isMaster: boolean
  getChannel: () => MusicChannel | null
  onState: (state: MusicState) => void
  onStatus: (status: string) => void
}

const POSITION_ONLY_THROTTLE_MS = 1800

export class MusicSyncEngine {
  private state: MusicState
  private lastPersistAt = 0
  private lifecycleLocked = false

  constructor(private options: MusicEngineOptions) {
    this.state = {
      room: options.room,
      url: '',
      activeUri: '',
      isPlaying: false,
      positionSeconds: 0,
      updatedAt: new Date(0).toISOString(),
      provider: 'none',
    }

    if (typeof window !== 'undefined') {
      const lock = () => {
        this.lifecycleLocked = true
      }
      window.addEventListener('pagehide', lock)
      window.addEventListener('beforeunload', lock)
    }
  }

  getCurrentState() {
    return this.state
  }

  getEffectivePosition() {
    return getEffectiveMusicPosition(this.state)
  }

  canPublishLifecycleEvent() {
    return !this.lifecycleLocked && isMusicLifecycleSafe()
  }

  applyIncoming(next: MusicState) {
    if (!next || next.room !== this.options.room) return
    this.state = {
      ...next,
      provider: next.provider || getMusicProvider(next.url),
    }
    this.options.onState(this.state)
  }

  async publishMusicState(patch: Partial<Omit<MusicState, 'room' | 'updatedAt'>>, options: { persist?: boolean } = {}) {
    if (!this.options.isMaster) {
      this.options.onStatus('Музыкой управляет мастер')
      return
    }

    const nowMs = Date.now()
    const current = this.state
    const next: MusicState = {
      ...current,
      ...patch,
      room: this.options.room,
      url: (patch.url ?? current.url).trim(),
      activeUri: patch.activeUri ?? current.activeUri,
      provider: patch.provider ?? current.provider ?? getMusicProvider(patch.url ?? current.url),
      isPlaying: patch.isPlaying ?? current.isPlaying,
      positionSeconds: Math.max(0, Math.floor(patch.positionSeconds ?? current.positionSeconds)),
      updatedAt: new Date(nowMs).toISOString(),
    }

    this.state = next
    this.options.onState(next)
    this.options.getChannel()?.send({ type: 'broadcast', event: 'music', payload: next })

    const onlyPosition = Object.keys(patch).every(key => key === 'positionSeconds' || key === 'updatedAt')
    if (options.persist === false || (onlyPosition && nowMs - this.lastPersistAt < POSITION_ONLY_THROTTLE_MS)) return
    this.lastPersistAt = nowMs

    const supabase = createClient()
    const { error } = await supabase.from(TABLE_MUSIC).upsert(toMusicDbRow(next))
    if (!error) return

    const legacy = await supabase.from(TABLE_MUSIC).upsert({
      room: next.room,
      url: next.url,
      active_uri: next.activeUri,
      is_playing: next.isPlaying,
      position_seconds: next.positionSeconds,
      updated_at: next.updatedAt,
    })

    if (legacy.error) {
      console.error('Не удалось сохранить музыку комнаты:', legacy.error)
      this.options.onStatus('Музыка отправлена онлайн, но не сохранена')
    }
  }
}
