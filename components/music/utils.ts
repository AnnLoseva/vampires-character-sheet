import type { MusicChannel, MusicLibraryItem, MusicLibraryRow, MusicProvider, MusicRow, MusicState, MusicTreeNode } from './types'

export const TABLE_MUSIC = 'table_music'
export const TABLE_MUSIC_LIBRARY = 'table_music_library'
export const TABLE_MUSIC_BUCKET = 'table-music'

export function upsertMusicLibraryItem(items: MusicLibraryItem[], item: MusicLibraryItem) {
  const exists = items.some(existing => existing.id === item.id)
  const next = exists ? items.map(existing => (existing.id === item.id ? item : existing)) : [...items, item]
  return next.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 160)
}

export function mapMusicRow(row: MusicRow): MusicState {
  const provider = row.provider === 'spotify' ? 'none' : row.provider || getMusicProvider(row.url || '')
  const youtube = provider === 'youtube' ? parseYouTubeUrl(row.url || '') : { videoId: '', playlistId: undefined }
  return {
    room: row.room,
    url: row.url || '',
    activeUri: row.active_uri || '',
    isPlaying: row.is_playing ?? false,
    positionSeconds: row.position_seconds ?? 0,
    updatedAt: row.updated_at,
    provider,
    playlistId: row.playlist_id || youtube.playlistId || undefined,
    playlistIndex: typeof row.playlist_index === 'number' ? row.playlist_index : undefined,
    trackId: row.track_id || youtube.videoId || undefined,
    sourceType: row.source_type || undefined,
  }
}

export function mapMusicLibraryRow(row: MusicLibraryRow): MusicLibraryItem {
  return {
    id: row.id,
    room: row.room,
    itemType: row.item_type ?? 'track',
    parentId: row.parent_id ?? null,
    name: row.name,
    url: row.url || '',
    autoplay: row.autoplay ?? false,
    createdAt: row.created_at,
  }
}

export function buildMusicTree(musicLibrary: MusicLibraryItem[]): MusicTreeNode[] {
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
}

type DbErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

export function isMissingColumnError(error: DbErrorLike | null | undefined) {
  if (!error) return false
  const text = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .* does not exist/i.test(text) ||
    /could not find .* column/i.test(text) ||
    (/schema cache/i.test(text) && /column/i.test(text))
  )
}

export function isMissingRelationError(error: DbErrorLike | null | undefined) {
  if (!error) return false
  const text = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(text) ||
    /could not find .* table/i.test(text) ||
    (/schema cache/i.test(text) && /table/i.test(text))
  )
}

export function getMusicProvider(url: string): MusicProvider {
  const raw = url.trim()
  if (!raw) return 'none'

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube'
    if (/\.(mp3|wav|ogg|m4a|flac|webm|aac)(\?.*)?$/i.test(parsed.pathname)) return 'file'
  } catch {
    return 'none'
  }

  return 'none'
}

export function parseYouTubeUrl(url: string) {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./, '')
    const playlistId = parsed.searchParams.get('list') || undefined
    let videoId = ''

    if (host === 'youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || ''
    } else if (host.endsWith('youtube.com')) {
      videoId = parsed.searchParams.get('v') || ''
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (!videoId && parts[0] !== 'playlist') videoId = parts.pop() || ''
    }

    return { videoId, playlistId }
  } catch {
    return { videoId: '', playlistId: undefined }
  }
}

export function getYouTubeId(url: string) {
  return parseYouTubeUrl(url).videoId
}

export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  if (!videoId) return null
  try {
    const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`)
    if (!response.ok) return null
    const data = (await response.json()) as { title?: string }
    return data.title || null
  } catch {
    return null
  }
}

export function getEffectiveMusicPosition(music: MusicState, now = Date.now()) {
  if (!music.isPlaying) return music.positionSeconds
  return music.positionSeconds + Math.max(0, (now - new Date(music.updatedAt).getTime()) / 1000)
}

export function isMusicLifecycleSafe() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

export function safeStorageName(name: string) {
  const cleanName = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleanName || 'audio'
}

export function getStoragePathFromPublicUrl(publicUrl: string, bucket = TABLE_MUSIC_BUCKET) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0])
}

export function toMusicDbRow(next: MusicState) {
  return {
    room: next.room,
    url: next.url,
    active_uri: next.activeUri,
    is_playing: next.isPlaying,
    position_seconds: next.positionSeconds,
    updated_at: next.updatedAt,
    provider: next.provider || getMusicProvider(next.url),
    playlist_id: next.playlistId || null,
    playlist_index: typeof next.playlistIndex === 'number' ? next.playlistIndex : null,
    track_id: next.trackId || null,
    source_type: next.sourceType || null,
  }
}

export function toLegacyMusicDbRow(next: MusicState) {
  return {
    room: next.room,
    url: next.url,
    active_uri: next.activeUri,
    is_playing: next.isPlaying,
    position_seconds: next.positionSeconds,
    updated_at: next.updatedAt,
  }
}

export function broadcastMusicChannel(channel: MusicChannel | null | undefined, event: string, payload: unknown) {
  if (!channel) return
  if (channel.httpSend) return channel.httpSend(event, payload)
  return channel.send({ type: 'broadcast', event, payload })
}
