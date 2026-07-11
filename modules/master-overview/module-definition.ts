import type { MasterOverviewModule } from './types'
import { MASTER_PLOT_HOOKS, MASTER_SESSION_NOTES } from './constants'
import { MASTER_ACTION_LOG, CHRONICLE_SESSIONS } from '@/modules/master-console/persistence/constants'
import { CHRONICLE_ACTORS } from '@/modules/actors/constants'
import { TABLE_SCENES, TABLE_ROLLS } from '@/modules/table/constants'

export const masterOverviewModuleDefinition: MasterOverviewModule = {
  id: 'master-overview',
  name: 'Обзор ночи',
  lifecycle: 'active',
  supportedSystems: ['vtm5'],
  capabilities: ['master-overview'],
  persistence: {
    tables: [
      MASTER_SESSION_NOTES,
      MASTER_PLOT_HOOKS,
      MASTER_ACTION_LOG,
      CHRONICLE_SESSIONS,
      CHRONICLE_ACTORS,
      TABLE_SCENES,
      TABLE_ROLLS,
    ],
  },
}
