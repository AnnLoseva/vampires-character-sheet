export type Die = {
  value: number
  kind: 'fail' | 'success' | 'critical' | 'botch'
}

export type RollMessage = {
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

export type RollRow = {
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

export type ChatUser = {
  id: string
  username: string
}

export type CharacterOption = {
  id: string
  name: string
  clan: string | null
  image: string
  username?: string
  userId?: string
  concept?: string
  predator?: string
  generation?: string
  type?: string
  notes?: string
  appearance?: string
  backstory?: string
  freeExp?: number
  inventory: InventoryItem[]
  attributes: Record<string, number>
  skills: Record<string, number | { dots?: number; specs?: string[] }>
  disciplines: Record<string, Record<string, number>>
  selectedPowers: Record<string, unknown>
}

export type CharacterRow = {
  id: string
  user_id?: string | null
  users?: { username?: string | null } | null
  name: string
  clan: string | null
  data: {
    characterImage?: string
    image?: string
    portrait?: string
    concept?: string
    predator?: string
    generation?: string
    type?: string
    notes?: string
    appearance?: string
    backstory?: string
    freeExp?: number
    experience?: number
    inventory?: InventoryItem[]
    attributes?: Record<string, number>
    skills?: Record<string, number | { dots?: number; specs?: string[] }>
    disciplines?: Record<string, Record<string, number>>
    selectedPowers?: Record<string, unknown>
  } | null
}

export type InventoryItem = {
  id: string
  name: string
  description: string
  quantity: number
  category: string
  note: string
  createdAt: string
  updatedAt: string
  collapsed?: boolean
}

export type ActiveParticipant = {
  userId: string
  username: string
  characterId: string | null
  characterName: string
  characterClan: string | null
  characterImage: string
  updatedAt: string
}

export type JournalEntry = {
  id: string
  title: string
  text: string
  updatedAt: string
  createdAt: string
}

export type MasterReveal = {
  id: string
  room: string
  kind: string
  title: string
  body: string
  meta: string
  characterName: string
  userId: string
  username: string
  createdAt: string
}

export type MasterWhisper = {
  id: string
  room: string
  fromUserId: string
  fromUsername: string
  toUserId: string | null
  message: string
  fromMaster: boolean
  createdAt: string
}

export type ChatMessage = {
  id: string
  room: string
  userId: string
  username: string
  characterId: string | null
  characterName: string
  characterImage: string
  message: string
  createdAt: string
}

export type ChatMessageRow = {
  id: string
  room: string
  user_id: string
  username: string
  character_id: string | null
  character_name: string
  character_image: string | null
  message: string
  created_at: string
}

export type VoiceParticipant = {
  id: string
  username: string
  characterName: string
  characterImage: string
  volume: number
  muted: boolean
  connected: boolean
}

export type VoiceSignal = {
  type: 'join' | 'offer' | 'answer' | 'ice' | 'leave' | 'mute'
  room: string
  from: string
  to?: string
  username?: string
  characterName?: string
  characterImage?: string
  muted?: boolean
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export type TableLayer = {
  id: string
  room: string
  sceneId: string | null
  layerType: 'image' | 'video' | 'folder' | 'text' | 'file'
  ownerRole: TableRole
  ownerId: string | null
  parentId: string | null
  name: string
  imageData: string
  x: number
  y: number
  width: number
  height: number
  cropX: number | null
  cropY: number | null
  cropWidth: number | null
  cropHeight: number | null
  zIndex: number
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
  onTable: boolean
  createdAt: string
}

export type TableLayerRow = {
  id: string
  room: string
  scene_id?: string | null
  layer_type: 'image' | 'video' | 'folder' | 'text' | 'file' | null
  owner_role: TableRole | null
  owner_id?: string | null
  parent_id: string | null
  name: string
  image_data: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  crop_x?: number | null
  crop_y?: number | null
  crop_width?: number | null
  crop_height?: number | null
  z_index: number | null
  visible: boolean | null
  locked: boolean | null
  opacity?: number | null
  blend_mode?: BlendMode | null
  rotation?: number | null
  flip_x?: boolean | null
  flip_y?: boolean | null
  brightness?: number | null
  contrast?: number | null
  saturation?: number | null
  on_table?: boolean | null
  created_at: string
}

export type TableRole = 'master' | 'player'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'luminosity'

export type LayerPatch = Partial<Pick<TableLayer, 'sceneId' | 'layerType' | 'ownerRole' | 'ownerId' | 'parentId' | 'name' | 'imageData' | 'x' | 'y' | 'width' | 'height' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight' | 'zIndex' | 'visible' | 'locked' | 'opacity' | 'blendMode' | 'rotation' | 'flipX' | 'flipY' | 'brightness' | 'contrast' | 'saturation' | 'onTable'>>

export type ImageEditorState = {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
}

export type ImageEditorDraft = {
  layerId: string
  state: ImageEditorState
  history: ImageEditorState[]
  future: ImageEditorState[]
  aspectLocked: boolean
  drag: null | {
    handle: 'nw' | 'ne' | 'sw' | 'se' | 'move'
    startX: number
    startY: number
    initial: ImageEditorState
  }
}

export type TableScene = {
  id: string
  room: string
  name: string
  thumbnailUrl: string
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type TableSceneRow = {
  id: string
  room: string
  name: string
  thumbnail_url: string | null
  is_active: boolean | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SceneMusicTrack = {
  id: string
  room: string
  sceneId: string
  title: string
  url: string
  sourceType: string
  orderIndex: number
  isDefault: boolean
  autoplay: boolean
  createdAt: string
  updatedAt: string
}

export type SceneMusicRow = {
  id: string
  room: string
  scene_id: string
  title: string
  url: string
  source_type: string | null
  order_index: number | null
  is_default: boolean | null
  autoplay: boolean | null
  created_at: string
  updated_at: string
}

export type DragState = {
  id: string
  mode: 'move' | 'resize' | 'pan' | 'select'
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

export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
} | null

export type TouchGestureState = {
  mode: 'pan' | 'pinch'
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
  startDistance: number
  startZoom: number
  worldCenterX: number
  worldCenterY: number
}

export type LayerTreeNode = TableLayer & {
  children: LayerTreeNode[]
}

export type LayerContextMenu = {
  layerId: string | null
  x: number
  y: number
} | null

export type LayerDropPlacement = 'before' | 'after' | 'inside'

export type LayerDropTarget = {
  layerId: string
  placement: LayerDropPlacement
} | null

export type RightRailTab = 'media' | 'rolls' | 'chat' | 'diary' | 'master'
export type MediaTab = 'music' | 'layers' | 'library'
export type LeftToolbarTab = 'scenes' | 'layers' | 'media'
export type ChatPanelTab = 'text' | 'voice'
export type VoiceQuality = 'balanced' | 'clear'
