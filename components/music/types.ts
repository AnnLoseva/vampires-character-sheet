import type { MutableRefObject } from 'react'

export type MusicProvider = 'none' | 'youtube' | 'spotify' | 'file'

export type MusicState = {
  room: string
  url: string
  activeUri: string
  isPlaying: boolean
  positionSeconds: number
  updatedAt: string
  provider?: MusicProvider
  playlistId?: string
  playlistIndex?: number
  trackId?: string
  sourceType?: string
}

export type MusicRow = {
  room: string
  url: string
  active_uri: string | null
  is_playing: boolean | null
  position_seconds: number | null
  updated_at: string
  provider?: MusicProvider | null
  playlist_id?: string | null
  playlist_index?: number | null
  track_id?: string | null
  source_type?: string | null
}

export type MusicLibraryItem = {
  id: string
  room: string
  itemType: 'track' | 'folder'
  parentId: string | null
  name: string
  url: string
  createdAt: string
}

export type MusicLibraryRow = {
  id: string
  room: string
  item_type: 'track' | 'folder' | null
  parent_id: string | null
  name: string
  url: string | null
  created_at: string
}

export type MusicTreeNode = MusicLibraryItem & {
  children: MusicTreeNode[]
}

export type MusicDropTarget = {
  id: string | null
} | null

export type SpotifyController = {
  loadUri: (spotifyUri: string, preferVideo?: boolean, startAt?: number) => void
  play: () => void
  pause: () => void
  resume: () => void
  seek: (seconds: number) => void
  destroy: () => void
  addListener: (event: string, callback: (event: { data: { playingURI?: string; isPaused?: boolean; position?: number } }) => void) => void
}

export type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number; theme?: string },
    callback: (controller: SpotifyController) => void
  ) => void
}

export type YouTubePlayerStateEvent = {
  data: number
  target: YouTubePlayer
}

export type YouTubePlayer = {
  loadVideoById?: (options: { videoId: string; startSeconds?: number }) => void
  cueVideoById?: (options: { videoId: string; startSeconds?: number }) => void
  loadPlaylist?: (options: { list: string; listType?: string; index?: number; startSeconds?: number }) => void
  cuePlaylist?: (options: { list: string; listType?: string; index?: number; startSeconds?: number }) => void
  nextVideo?: () => void
  previousVideo?: () => void
  setLoop?: (loopPlaylists: boolean) => void
  setShuffle?: (shufflePlaylist: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setVolume: (volume: number) => void
  getCurrentTime: () => number
  getPlaylistIndex?: () => number
  getVideoData?: () => { video_id?: string }
  destroy: () => void
}

export type YouTubeIframeApi = {
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

export type MusicAdapterStateChange = Partial<Omit<MusicState, 'room' | 'updatedAt' | 'url' | 'provider'>> & {
  url?: string
  provider?: MusicProvider
}

export type MusicSyncAdapter = {
  mount: (container: HTMLElement) => void | Promise<void>
  load: (state: MusicState) => void | Promise<void>
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  setVolume?: (volume: number) => void
  destroy: () => void
  onStateChange: (callback: (patch: MusicAdapterStateChange) => void) => () => void
}

export type MusicChannel = {
  send: (args: { type: 'broadcast'; event: string; payload: unknown }) => Promise<unknown> | unknown
}

export type MusicChannelRef = MutableRefObject<MusicChannel | null>
