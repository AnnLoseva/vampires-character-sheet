import { bootstrapChronicleRuntime, createVtm5ChronicleHub } from '@/core/hub'
import type { ChronicleRuntime } from '@/core/hub'

const tableHub = createVtm5ChronicleHub()

/** Bootstrap VTM5 adapters for a campaign table room. Idempotent per page load. */
export function bootstrapTableForRoom(room: string): ChronicleRuntime<'vtm5'> {
  return bootstrapChronicleRuntime(tableHub, {
    id: `room:${room}`,
    name: room,
    systemId: 'vtm5',
    roomId: room,
  }) as ChronicleRuntime<'vtm5'>
}