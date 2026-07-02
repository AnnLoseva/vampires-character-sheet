import type { RollsModule } from './types'

export const rollsModuleDefinition: RollsModule = {
  id: 'rolls',
  name: 'Броски',
  lifecycle: 'planned',
  supportedSystems: ['vtm5'],
  capabilities: ['rolls'],
}