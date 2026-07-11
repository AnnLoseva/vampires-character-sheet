import { actorsMasterContribution } from '@/modules/actors/contribution'
import { overviewMasterContribution } from '@/modules/master-overview/contribution'
import { scenesMasterContribution } from '@/modules/master-scenes/contribution'
import { loreMasterContribution } from '@/modules/lore/contribution'
import { bloodBondsMasterContribution } from '@/modules/blood-bonds/contribution'
import { sessionLogMasterContribution } from '@/modules/session-log/contribution'
import type { MasterConsoleContribution } from './types'

/**
 * Static master-console contribution registry.
 * IDs are allow-listed; URL module params never become dynamic import paths.
 */
export const MASTER_CONSOLE_CONTRIBUTIONS: readonly MasterConsoleContribution[] = [
  overviewMasterContribution,
  actorsMasterContribution,
  scenesMasterContribution,
  loreMasterContribution,
  bloodBondsMasterContribution,
  sessionLogMasterContribution,
].slice().sort((a, b) => a.order - b.order)

export function getMasterContribution(id: string): MasterConsoleContribution | undefined {
  return MASTER_CONSOLE_CONTRIBUTIONS.find(item => item.id === id)
}

export const DEFAULT_MASTER_MODULE_ID = 'overview'
