import type { MasterConsoleModule } from './types'

export const masterConsoleModuleDefinition: MasterConsoleModule = {
  id: 'master-console',
  name: 'Пульт рассказчика',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['master-console'],
  routes: [{ path: '/master', label: 'Пульт рассказчика' }],
  persistence: {
    localStorageKeys: ['vtm-table-room', 'vtm-table-master-password'],
  },
}
