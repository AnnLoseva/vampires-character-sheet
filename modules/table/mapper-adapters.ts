import { getDerivedStats } from '@/core/systems/vtm5/rules/derived-stats'
import { getActiveEffects } from '@/core/systems/vtm5/rules/disciplines/active-effects'
import { normalizeCharacterDisciplines } from '@/core/systems/vtm5/rules/disciplines/character-disciplines'
import {
  normalizeDamageProfile,
  normalizeHealthTracker,
  toHealthTracker,
  type DamageProfile,
} from '@/core/systems/vtm5/rules/health'
import {
  getHumanityState,
  getHumanityStatus,
  normalizeMoralityState,
} from '@/core/systems/vtm5/rules/humanity'
import { isTableModuleConfigured } from './configure'
import { tableGetDerivedStats, tableHealth, tableHumanity } from './system-runtime'

/** Mapper-safe access to game-system rules with fallback before Hub bootstrap. */
export const mapperRules = {
  normalizeHealthTracker(
    tracker: unknown,
    stamina?: unknown,
    profile?: DamageProfile,
  ) {
    if (isTableModuleConfigured()) {
      return tableHealth().normalizeHealthTracker(tracker, stamina, profile)
    }
    return normalizeHealthTracker(tracker, stamina, profile)
  },
  toHealthTracker(health: Parameters<typeof toHealthTracker>[0]) {
    if (isTableModuleConfigured()) return tableHealth().toHealthTracker(health)
    return toHealthTracker(health)
  },
  normalizeDamageProfile(
    value: unknown,
    clan?: string,
    characterType?: string,
  ) {
    if (isTableModuleConfigured()) {
      return tableHealth().normalizeDamageProfile(value, clan, characterType)
    }
    return normalizeDamageProfile(value, clan, characterType)
  },
  getDerivedStats(characterData: unknown, rules?: unknown) {
    if (isTableModuleConfigured()) return tableGetDerivedStats(characterData, rules)
    return getDerivedStats(characterData, rules)
  },
  getHumanityState(data: Parameters<typeof getHumanityState>[0]) {
    if (isTableModuleConfigured()) return tableHumanity().getHumanityState(data)
    return getHumanityState(data)
  },
  getHumanityStatus(state: Parameters<typeof getHumanityStatus>[0]) {
    if (isTableModuleConfigured()) return tableHumanity().getHumanityStatus(state)
    return getHumanityStatus(state)
  },
  normalizeMoralityState,
  normalizeCharacterDisciplines,
  getActiveEffects,
}