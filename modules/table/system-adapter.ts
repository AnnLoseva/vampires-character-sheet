import type { CharacterDerivedStats } from '@/core/systems/vtm5/rules/derived-stats'
import type {
  DisciplineRollEffectContext,
  DisciplineRollEffectResult,
} from '@/core/systems/vtm5/rules/disciplines/effects'
import type { HealthTracker, NormalizedHealth } from './types'

/** Health rules surface the table module expects from a game system. */
export type TableHealthAdapter = {
  getHealthImpairmentPenalty(parts: string[], health?: NormalizedHealth | null): number
  normalizeHealthTracker(
    tracker: HealthTracker,
    stamina?: number,
    profile?: string,
  ): NormalizedHealth
  applyHealthDamage(
    health: NormalizedHealth,
    amount: number,
    severity: 'superficial' | 'aggravated',
    options?: Record<string, unknown>,
    profile?: string,
    t?: (ru: string) => string,
    tf?: (ru: string, vars: Record<string, string | number>) => string,
  ): {
    tracker: NormalizedHealth
    warnings: string[]
    originalAmount: number
    finalAmount: number
    applied: number
    converted: number
    halved: boolean
  }
  recoverHealthDamage(
    health: NormalizedHealth,
    amount: number,
    severity: 'superficial' | 'aggravated',
    profile: string,
  ): { tracker: NormalizedHealth; recovered: number }
}

/** VTM5 (or another system) implements this contract; table runtime reads it via configureTableModule. */
export type TableSystemAdapter = {
  readonly systemId: string
  readonly rulesNamespace: string
  health: TableHealthAdapter
  getDerivedStats(characterData: unknown, rules?: unknown): CharacterDerivedStats
  applyDisciplineEffectsToRoll(
    rollContext: DisciplineRollEffectContext,
    derivedStats?: unknown,
  ): DisciplineRollEffectResult
}