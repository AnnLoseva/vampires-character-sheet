import type { MusicAdapterStateChange, MusicState, MusicSyncAdapter, SpotifyController, SpotifyIframeApi } from '../types'
import { getEffectiveMusicPosition, getSpotifyUri } from '../utils'

type SpotifyAdapterOptions = {
  isMaster: boolean
  onStatus: (status: string) => void
  canPublish: () => boolean
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

export class SpotifyAdapter implements MusicSyncAdapter {
  private container: HTMLElement | null = null
  private controller: SpotifyController | null = null
  private state: MusicState | null = null
  private callback: ((patch: MusicAdapterStateChange) => void) | null = null
  private lastPublishAt = 0
  private mountedUri = ''
  private cancelled = false

  constructor(private options: SpotifyAdapterOptions) {}

  mount(container: HTMLElement) {
    this.container = container
    this.cancelled = false
    void this.ensureController()
  }

  async load(state: MusicState) {
    this.state = state
    const uri = state.activeUri || getSpotifyUri(state.url)
    if (uri && this.controller && this.mountedUri === uri) {
      this.controller.loadUri(uri)
      this.syncController()
      return
    }
    await this.ensureController(true)
  }

  play() {
    this.controller?.resume()
  }

  pause() {
    this.controller?.pause()
  }

  seek(seconds: number) {
    this.controller?.seek(Math.max(0, Math.floor(seconds)))
    if (this.state?.isPlaying) this.controller?.resume()
  }

  destroy() {
    this.cancelled = true
    this.controller?.destroy()
    this.controller = null
    this.mountedUri = ''
  }

  onStateChange(callback: (patch: MusicAdapterStateChange) => void) {
    this.callback = callback
    return () => {
      if (this.callback === callback) this.callback = null
    }
  }

  private async ensureController(force = false) {
    if (!this.container || !this.state) return
    const uri = this.state.activeUri || getSpotifyUri(this.state.url)
    if (!uri) return
    if (this.controller && !force && this.mountedUri === uri) return

    this.container.innerHTML = ''
    this.controller?.destroy()
    this.controller = null
    this.mountedUri = uri

    const api = await loadSpotifyIframeApi()
    if (this.cancelled || !this.container) return

    api.createController(
      this.container,
      { uri, width: '100%', height: 86, theme: 'dark' },
      controller => {
        if (this.cancelled) {
          controller.destroy()
          return
        }

        this.controller = controller
        controller.addListener('ready', () => this.syncController())
        controller.addListener('playback_update', event => {
          if (this.cancelled) return
          if (!this.options.isMaster || !this.options.canPublish()) return
          const now = Date.now()
          const nextPosition = Math.max(0, Math.floor((event.data.position || 0) / 1000))
          const currentMusic = this.state
          if (!currentMusic) return
          const nextPlaying = typeof event.data.isPaused === 'boolean' ? !event.data.isPaused : currentMusic.isPlaying
          const nextUri = event.data.playingURI || currentMusic.activeUri
          const positionChanged = Math.abs(nextPosition - getEffectiveMusicPosition(currentMusic)) > 2
          const stateChanged = nextPlaying !== currentMusic.isPlaying || nextUri !== currentMusic.activeUri

          if (positionChanged && !stateChanged && now - this.lastPublishAt < 1800) return

          if (positionChanged || stateChanged) {
            this.lastPublishAt = now
            this.callback?.({ isPlaying: nextPlaying, positionSeconds: nextPosition, activeUri: nextUri })
          }
        })
      }
    )
  }

  private syncController() {
    if (!this.controller || !this.state) return
    const positionSeconds = Math.max(0, Math.floor(getEffectiveMusicPosition(this.state)))
    if (!this.options.isMaster) this.controller.seek(positionSeconds)
    if (this.state.isPlaying) this.controller.resume()
    else this.controller.pause()
  }
}

export class SpotifyWebPlaybackSdkAdapterStub {
  // TODO: Requires Spotify OAuth, a user access token, and Premium on every user's account.
  // TODO: Spotify policy does not allow using Premium playback as an unlicensed stream from GM to players.
}
