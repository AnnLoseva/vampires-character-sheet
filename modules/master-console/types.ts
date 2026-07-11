import type { Module } from '@/core/hub'

export type MasterConsoleModule = Module<'master-console', 'vtm5'>

export type MasterConsoleRouteState =
  | { status: 'loading' }
  | { status: 'invalid-room'; message: string }
  | { status: 'locked'; room: string; denied: boolean }
  | { status: 'ready'; room: string }
