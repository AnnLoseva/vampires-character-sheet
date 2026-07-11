import type { Module } from '@/core/hub'
import type { CharacterOption, CharacterRow } from '@/modules/table/types'
import type { VtmActorDisplayVitals, VtmActorKind, VtmActorMechanicsInput } from '@/core/systems/vtm5/adapters/actors'

export type ActorsModule = Module<'actors', 'vtm5'>
export type ActorKind = VtmActorKind
export type ActorStatus = 'active' | 'inactive' | 'missing' | 'dead' | 'archived'
export type CompactActorStats = Omit<VtmActorMechanicsInput, 'kind'> & {
  clan?: string
}

export type ActorPrivateFields = {
  secrets: string
  motivation: string
  plans: string
  notes: string
  privateData: Record<string, unknown>
}

export type ChronicleActor = {
  id: string
  chronicleId: string
  room: string
  kind: ActorKind
  characterId: string | null
  name: string
  faction: string
  actorRole: string
  status: ActorStatus
  tags: string[]
  currentSceneId: string | null
  compactStats: CompactActorStats
  imageUrl: string
  manualOverrides: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type MasterActor = ChronicleActor & {
  privateFields: ActorPrivateFields | null
  linkedCharacter: CharacterOption | null
}

export type NormalizedActor = ChronicleActor & {
  source: 'linked_character' | 'compact'
  displayName: string
  displayImage: string
  clan: string
  mechanics: VtmActorMechanicsInput
  vitals: VtmActorDisplayVitals
  linkedCharacter: CharacterOption | null
}

export type ActorPublicPayload = Pick<NormalizedActor,
  | 'id'
  | 'chronicleId'
  | 'room'
  | 'kind'
  | 'characterId'
  | 'faction'
  | 'actorRole'
  | 'status'
  | 'tags'
  | 'currentSceneId'
  | 'source'
  | 'displayName'
  | 'displayImage'
  | 'clan'
  | 'mechanics'
  | 'vitals'
  | 'updatedAt'
>

export type CharacterConversionDraft = Pick<CharacterRow, 'name' | 'clan' | 'data'>

export type ChronicleActorRow = {
  id: string
  chronicle_id: string
  room: string
  kind: ActorKind
  character_id: string | null
  name: string
  faction: string
  actor_role: string
  status: ActorStatus
  tags: string[]
  current_scene_id: string | null
  compact_stats: unknown
  image_url: string
  manual_overrides: unknown
  created_by: string
  created_at: string
  updated_at: string
}

export type ActorPrivateRow = {
  actor_id: string
  chronicle_id: string
  room: string
  secrets: string
  motivation: string
  plans: string
  notes: string
  private_data: unknown
  created_at: string
  updated_at: string
}

export type ActorBulkPatch = Partial<Pick<ChronicleActor,
  | 'faction'
  | 'actorRole'
  | 'status'
  | 'tags'
  | 'currentSceneId'
  | 'compactStats'
  | 'imageUrl'
  | 'manualOverrides'
>>

export type CreateCompactActorInput = Pick<ChronicleActor,
  | 'chronicleId'
  | 'room'
  | 'kind'
  | 'name'
  | 'faction'
  | 'actorRole'
  | 'status'
  | 'tags'
  | 'currentSceneId'
  | 'compactStats'
  | 'imageUrl'
  | 'manualOverrides'
> & {
  privateFields?: ActorPrivateFields
}
