export type GameSystemId = 'vtm5' | (string & {})

export type ModuleId =
  | 'table'
  | 'chat'
  | 'music'
  | 'rolls'
  | 'character-sheet'
  | 'journal'
  | 'reference'
  | (string & {})

export type ChronicleRole = 'master' | 'player' | 'observer'

export type ModuleLifecycle = 'planned' | 'active' | 'legacy-bridge' | 'deprecated'

export type ModuleCapability =
  | 'table'
  | 'chat'
  | 'music'
  | 'rolls'
  | 'character-sheet'
  | 'journal'
  | 'reference'
  | 'media'
  | 'rules'
  | (string & {})

export type ModuleRoute = {
  path: string
  label: string
}

export type ModulePersistenceContract = {
  tables?: readonly string[]
  buckets?: readonly string[]
  localStorageKeys?: readonly string[]
}

export type BrowserContract = {
  postMessages?: readonly string[]
  windowEvents?: readonly string[]
  globals?: readonly string[]
}

export type GameSystem<TId extends GameSystemId = GameSystemId> = {
  id: TId
  name: string
  version?: string
  rulesNamespace: string
}

export type Module<
  TId extends ModuleId = ModuleId,
  TSystemId extends GameSystemId = GameSystemId,
> = {
  id: TId
  name: string
  lifecycle: ModuleLifecycle
  supportedSystems: readonly TSystemId[]
  capabilities: readonly ModuleCapability[]
  routes?: readonly ModuleRoute[]
  persistence?: ModulePersistenceContract
  browser?: BrowserContract
}

export type ChronicleMember = {
  id: string
  displayName: string
  role: ChronicleRole
}

export type Chronicle<TSystemId extends GameSystemId = GameSystemId> = {
  id: string
  name: string
  systemId: TSystemId
  roomId: string
  members?: readonly ChronicleMember[]
}
