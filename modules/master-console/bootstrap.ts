import { bootstrapChronicleRuntime, createVtm5ChronicleHub } from '@/core/hub'
import type { ChronicleRuntime } from '@/core/hub'

const masterConsoleHub = createVtm5ChronicleHub()

export function bootstrapMasterConsoleForRoom(room: string): ChronicleRuntime<'vtm5'> {
  const runtime = bootstrapChronicleRuntime(masterConsoleHub, {
    id: `room:${room}`,
    name: room,
    systemId: 'vtm5',
    roomId: room,
  }) as ChronicleRuntime<'vtm5'>

  if (!runtime.resolved.modules.some(module => module.id === 'master-console')) {
    throw new Error('Master console module is not registered for VTM5')
  }

  return runtime
}
