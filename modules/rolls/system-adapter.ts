export type RollsDie = {
  id?: string
  kind: string
}

export type RollsRollLike = {
  id: string
  poolType: string
  poolName: string
  meta?: { rollKind?: string }
  dice: RollsDie[]
}

/** Roll rules surface the rolls module expects from a game system. */
export type RollsSystemAdapter = {
  readonly systemId: string
  readonly rulesNamespace: string
  isWillpowerRerollExcluded(roll: RollsRollLike): boolean
  getWillpowerRerollEligibleDieIds(roll: RollsRollLike): string[]
}