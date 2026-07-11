import type { ComponentType } from 'react'
import type { Module } from '@/core/hub'

export type MasterConsoleModule = Module<'master-console', 'vtm5'>

export type MasterConsoleRouteState =
  | { status: 'loading' }
  | { status: 'invalid-room'; message: string }
  | { status: 'locked'; room: string; denied: boolean }
  | { status: 'ready'; room: string }

/** Request from a master module into the shared right-rail roller. */
export type MasterRollRequest = {
  source: string
  actorId: string
  displayName: string
  hunger: number
  characterId: string | null
  traits: readonly string[]
  dice: number
  mode: 'pool' | 'rouse'
}

export type MasterModuleProps = {
  room: string
  role: 'master' | 'observer'
  instanceId?: string
  deepLinkParams?: Readonly<Record<string, string>>
  onRequestRoll?: (request: MasterRollRequest) => void
}

export type MasterSearchProvider = {
  id: string
  search: (query: string) => Promise<readonly { id: string; title: string; href?: string }[]>
}

export type MasterCommandProvider = {
  id: string
  commands: readonly { id: string; title: string; run: () => void | Promise<void> }[]
}

export type MasterExportProvider = {
  id: string
  export: (options?: { includeSecrets?: boolean }) => Promise<unknown>
}

/**
 * UI contribution contract for master-console modules.
 * Lives here (not in core/hub): loader/sizes/export are React shell concerns.
 */
export type MasterConsoleContribution = {
  id: string
  title: string
  shortTitle?: string
  icon: string
  order: number
  supportedSystems: readonly string[]
  allowedRoles: readonly ('master' | 'observer')[]
  defaultSize: { width: number; height: number }
  minSize?: { width: number; height: number }
  singleton?: boolean
  detachable?: boolean
  loader: () => Promise<{ default: ComponentType<MasterModuleProps> }>
  searchProvider?: MasterSearchProvider
  commandProvider?: MasterCommandProvider
  exportProvider?: MasterExportProvider
  deepLinks?: readonly string[]
}
