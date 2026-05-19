import type { MusicAdapterStateChange, MusicState, MusicSyncAdapter } from '../types'
import { getEffectiveMusicPosition } from '../utils'

type LocalAudioAdapterOptions = {
  isMaster: boolean
  volume: number
  onStatus: (status: string) => void
  canPublish: () => boolean
}

export class LocalAudioAdapter implements MusicSyncAdapter {
  private audio: HTMLAudioElement | null = null
  private state: MusicState | null = null
  private callback: ((patch: MusicAdapterStateChange) => void) | null = null
  private isDestroying = false

  constructor(private options: LocalAudioAdapterOptions) {}

  mount(container: HTMLElement) {
    container.innerHTML = ''
    this.audio = document.createElement('audio')
    this.audio.className = 'audio-player'
    this.audio.controls = this.options.isMaster
    this.audio.addEventListener('play', () => this.publishElementState(true))
    this.audio.addEventListener('pause', () => this.publishElementState(false))
    this.audio.addEventListener('seeked', () => this.publishElementState(this.state?.isPlaying ?? false))
    container.appendChild(this.audio)
    if (this.state) void this.load(this.state)
  }

  load(state: MusicState) {
    this.state = state
    if (!this.audio || !state.url) return
    const duration = Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration) : 0
    const rawPosition = Math.max(0, Math.floor(getEffectiveMusicPosition(state)))
    const positionSeconds = duration > 0 ? Math.min(rawPosition, Math.max(0, duration - 0.25)) : rawPosition
    if (this.audio.src !== state.url) this.audio.src = state.url
    this.audio.volume = this.options.volume / 100
    const seekThreshold = this.options.isMaster ? 3.5 : 1.8
    if (Math.abs(this.audio.currentTime - positionSeconds) > seekThreshold) this.audio.currentTime = positionSeconds

    if (state.isPlaying && this.audio.paused) {
      this.audio.play().catch(error => {
        console.error('Браузер заблокировал автозапуск аудио:', error)
        this.options.onStatus('Нажми «Включить музыку», чтобы запустить звук')
      })
    } else if (!state.isPlaying && !this.audio.paused) {
      this.audio.pause()
    }
  }

  play() {
    void this.audio?.play()
  }

  pause() {
    this.audio?.pause()
  }

  seek(seconds: number) {
    if (!this.audio) return
    const duration = Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration) : 0
    this.audio.currentTime = duration > 0 ? Math.min(Math.max(0, Math.floor(seconds)), Math.max(0, duration - 0.25)) : Math.max(0, Math.floor(seconds))
    if (this.state?.isPlaying) void this.audio.play()
  }

  setVolume(volume: number) {
    this.options.volume = volume
    if (this.audio) this.audio.volume = volume / 100
  }

  destroy() {
    this.isDestroying = true
    this.audio?.pause()
    this.audio?.remove()
    this.audio = null
    this.isDestroying = false
  }

  onStateChange(callback: (patch: MusicAdapterStateChange) => void) {
    this.callback = callback
    return () => {
      if (this.callback === callback) this.callback = null
    }
  }

  private publishElementState(isPlaying: boolean) {
    if (this.isDestroying) return
    if (!this.options.isMaster || !this.audio || !this.options.canPublish()) return
    const duration = Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration) : 0
    const positionSeconds = Math.max(0, Math.floor(this.audio.currentTime || 0))
    this.callback?.({ isPlaying, positionSeconds: duration > 0 ? Math.min(positionSeconds, Math.floor(duration)) : positionSeconds })
  }
}
