import type { TableSystemAdapter } from '@/modules/table/system-adapter'
import { applyDisciplineEffectsToRoll } from '../rules/disciplines/effects'
import { getDerivedStats } from '../rules/derived-stats'
import {
  applyHealthDamage,
  getHealthImpairmentPenalty,
  normalizeHealthTracker,
  recoverHealthDamage,
} from '../rules/health'

export function createVtm5TableAdapter(): TableSystemAdapter {
  return {
    systemId: 'vtm5',
    rulesNamespace: 'vtm5',
    health: {
      getHealthImpairmentPenalty,
      normalizeHealthTracker,
      applyHealthDamage,
      recoverHealthDamage,
    },
    getDerivedStats,
    applyDisciplineEffectsToRoll,
  }
}