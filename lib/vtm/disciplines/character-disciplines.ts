type JsonObject = Record<string, unknown>

export type NormalizedDisciplineSources = Record<string, number>
export type NormalizedDisciplines = Record<string, NormalizedDisciplineSources>
export type NormalizedDisciplinePowers = Record<string, string[]>

export type NormalizedCharacterDisciplines = {
  disciplines: NormalizedDisciplines
  powers: NormalizedDisciplinePowers
}

const RATING_KEYS = new Set(['rating', 'dots', 'value'])
const POWER_NAME_KEYS = ['name', 'power', 'название']

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function toRating(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const rating = Number(value)
  return Number.isFinite(rating) ? Math.max(0, Math.floor(rating)) : null
}

function getPowerName(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!isObject(value)) return ''

  for (const key of POWER_NAME_KEYS) {
    if (typeof value[key] === 'string') return value[key].trim()
  }
  return ''
}

function addPower(
  powers: NormalizedDisciplinePowers,
  disciplineName: string,
  value: unknown,
) {
  const name = getPowerName(value)
  if (!disciplineName || !name) return
  const current = powers[disciplineName] || []
  if (!current.includes(name)) powers[disciplineName] = [...current, name]
}

function addPowerList(
  powers: NormalizedDisciplinePowers,
  disciplineName: string,
  value: unknown,
) {
  if (!Array.isArray(value)) return
  value.forEach((power) => addPower(powers, disciplineName, power))
}

function normalizeSources(value: unknown): NormalizedDisciplineSources {
  const directRating = toRating(value)
  if (directRating !== null) return { rating: directRating }
  if (!isObject(value)) return {}

  if (isObject(value.sources)) {
    return Object.fromEntries(
      Object.entries(value.sources).flatMap(([key, sourceValue]) => {
        const rating = toRating(sourceValue)
        return rating === null ? [] : [[key, rating]]
      }),
    )
  }

  for (const key of RATING_KEYS) {
    const rating = toRating(value[key])
    if (rating !== null) return { rating }
  }

  const sources = Object.fromEntries(
    Object.entries(value).flatMap(([key, sourceValue]) => {
      if (RATING_KEYS.has(key) || key === 'powers' || key === 'sources') return []
      const rating = toRating(sourceValue)
      return rating === null ? [] : [[key, rating]]
    }),
  )
  return sources
}

function normalizeDisciplineRecord(
  disciplines: NormalizedDisciplines,
  powers: NormalizedDisciplinePowers,
  disciplineName: string,
  value: unknown,
) {
  const name = disciplineName.trim()
  if (!name) return
  disciplines[name] = normalizeSources(value)
  if (isObject(value)) addPowerList(powers, name, value.powers)
}

function normalizeDisciplinesValue(
  disciplines: NormalizedDisciplines,
  powers: NormalizedDisciplinePowers,
  value: unknown,
) {
  if (Array.isArray(value)) {
    value.forEach((discipline) => {
      if (!isObject(discipline)) return
      const name = getPowerName(discipline.discipline ?? discipline)
      if (!name) return
      normalizeDisciplineRecord(disciplines, powers, name, discipline)
    })
    return
  }

  if (!isObject(value)) return
  Object.entries(value).forEach(([name, discipline]) => {
    normalizeDisciplineRecord(disciplines, powers, name, discipline)
  })
}

function normalizeSeparatePowers(
  powers: NormalizedDisciplinePowers,
  value: unknown,
) {
  if (Array.isArray(value)) {
    value.forEach((power) => {
      if (!isObject(power)) return
      const disciplineNameValue = power.discipline
        ?? power.disciplineName
        ?? power.discipline_name
      const disciplineName = typeof disciplineNameValue === 'string'
        ? disciplineNameValue.trim()
        : ''
      addPower(powers, disciplineName, power)
    })
    return
  }

  if (!isObject(value)) return
  Object.entries(value).forEach(([disciplineName, disciplinePowers]) => {
    addPowerList(powers, disciplineName, disciplinePowers)
  })
}

export function normalizeCharacterDisciplines(
  characterData: unknown,
): NormalizedCharacterDisciplines {
  const root = isObject(characterData) ? characterData : {}
  const data = isObject(root.data) ? root.data : root
  const disciplines: NormalizedDisciplines = {}
  const powers: NormalizedDisciplinePowers = {}

  normalizeDisciplinesValue(disciplines, powers, data.disciplines)
  normalizeSeparatePowers(powers, data.selectedPowers)
  normalizeSeparatePowers(powers, data.powers)

  Object.keys(powers).forEach((disciplineName) => {
    if (!disciplines[disciplineName]) disciplines[disciplineName] = {}
  })

  return { disciplines, powers }
}
