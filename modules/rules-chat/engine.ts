// Движок чата-библиотекаря: понимание запроса без внешнего ИИ.
// 1) распознаёт сущности (клан, дисциплина, сила, преимущество, хищник, навык)
//    в rules.json и строит структурный ответ;
// 2) чистит запрос от слов-паразитов и фильтра издания для FTS по книгам.

export type RulesData = {
  clans: Record<string, ClanInfo>
  disciplines: Record<string, DisciplineInfo>
  advantages: { merits: Record<string, MeritInfo>; flaws: Record<string, MeritInfo> }
  predator_types: Record<string, PredatorInfo>
  skills: Record<string, unknown>
  attributes: Record<string, unknown>
}

export type ClanInfo = {
  description?: string
  disciplines?: string[]
  bane?: string
  playstyle?: string
  conflict?: string
}

export type DisciplinePower = {
  description?: string
  pool?: string
  cost?: string
  effect?: string
}

export type DisciplineInfo = {
  description?: string
  system?: string
  powers?: Record<string, Record<string, DisciplinePower>>
}

export type MeritInfo = {
  'название'?: string
  'описание'?: string
  'варианты'?: Array<{ 'название_пункта'?: string; 'точки'?: number; 'полное_описание'?: string }>
}

export type PredatorInfo = {
  description?: string
  specialty?: string
  disciplines?: string[]
  advantages?: unknown
  disadvantages?: unknown
}

export type EntityMatch =
  | { kind: 'clan'; name: string; data: ClanInfo }
  | { kind: 'discipline'; name: string; data: DisciplineInfo }
  | { kind: 'power'; name: string; discipline: string; level: string; data: DisciplinePower }
  | { kind: 'merit'; name: string; flaw: boolean; data: MeritInfo }
  | { kind: 'predator'; name: string; data: PredatorInfo }

export type ParsedQuery = {
  entities: EntityMatch[]
  ftsQuery: string
  source: string | null
}

let rulesCache: RulesData | null = null
let rulesPromise: Promise<RulesData | null> | null = null

export async function loadRules(): Promise<RulesData | null> {
  if (rulesCache) return rulesCache
  if (!rulesPromise) {
    rulesPromise = fetch('/rules.json')
      .then(res => (res.ok ? (res.json() as Promise<RulesData>) : null))
      .then(data => {
        rulesCache = data
        return data
      })
      .catch(() => null)
  }
  return rulesPromise
}

const FILLER_WORDS = new Set([
  'объясни', 'объясните', 'расскажи', 'расскажите', 'покажи', 'покажите',
  'скажи', 'скажите', 'опиши', 'опишите', 'дай', 'дайте', 'найди', 'найдите',
  'что', 'чем', 'кто', 'такое', 'такой', 'такая', 'такие', 'это', 'эта', 'этот',
  'как', 'работает', 'работают', 'значит', 'означает', 'мне', 'нам',
  'пожалуйста', 'плз', 'инфа', 'инфо', 'информация', 'подробнее', 'про', 'насчет', 'насчёт',
])

export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9-]/g, '')
}

// Грубое стемм-сравнение для русской морфологии: совпадение по началу слова.
export function stemEquals(token: string, word: string): boolean {
  if (!token || !word) return false
  if (token === word) return true
  const stem = word.length > 5 ? word.slice(0, word.length - 2) : word.slice(0, Math.max(4, word.length - 1))
  return token.startsWith(stem) && token.length <= word.length + 3
}

function nameMatches(tokens: string[], name: string): boolean {
  const words = name.toLowerCase().replace(/ё/g, 'е').split(/[\s-]+/).map(normalizeToken).filter(Boolean)
  if (words.length === 0) return false
  return words.every(word => tokens.some(token => stemEquals(token, word)))
}

const V5_HINTS = ['v5', 'в5', '5', 'пятерка', 'пятерке', 'пятой', 'пятая']
const V20_HINTS = ['v20', 'в20', '20', 'двадцатка', 'двадцатке', 'двадцатой']

export function parseQuery(question: string, rules: RulesData | null): ParsedQuery {
  const rawTokens = question.split(/\s+/).map(normalizeToken).filter(Boolean)

  let source: string | null = null
  const tokens: string[] = []
  for (const token of rawTokens) {
    if (V5_HINTS.includes(token)) { source = 'v5-corebook-ru'; continue }
    if (V20_HINTS.includes(token)) { source = 'v20-corebook-ru'; continue }
    tokens.push(token)
  }

  const entities: EntityMatch[] = []
  if (rules) {
    for (const [name, data] of Object.entries(rules.clans || {})) {
      if (nameMatches(tokens, name)) entities.push({ kind: 'clan', name, data })
    }
    for (const [name, data] of Object.entries(rules.disciplines || {})) {
      if (nameMatches(tokens, name)) entities.push({ kind: 'discipline', name, data })
    }
    // Силы дисциплин ищем, только если сама дисциплина не распознана —
    // например «Благоговение» без слова «Величие».
    if (!entities.some(e => e.kind === 'discipline')) {
      outer: for (const [disciplineName, discipline] of Object.entries(rules.disciplines || {})) {
        for (const [level, powers] of Object.entries(discipline.powers || {})) {
          for (const [powerName, power] of Object.entries(powers || {})) {
            if (nameMatches(tokens, powerName)) {
              entities.push({ kind: 'power', name: powerName, discipline: disciplineName, level, data: power })
              if (entities.length >= 3) break outer
            }
          }
        }
      }
    }
    for (const flag of [false, true] as const) {
      const group = flag ? rules.advantages?.flaws : rules.advantages?.merits
      for (const [key, data] of Object.entries(group || {})) {
        const display = data['название'] || key
        if (nameMatches(tokens, display) || nameMatches(tokens, key)) {
          entities.push({ kind: 'merit', name: display, flaw: flag, data })
        }
      }
    }
    for (const [name, data] of Object.entries(rules.predator_types || {})) {
      if (nameMatches(tokens, name)) entities.push({ kind: 'predator', name, data })
    }
  }

  const meaningful = tokens.filter(token => !FILLER_WORDS.has(token) && token.length > 1)
  const ftsQuery = meaningful.join(' ')

  return { entities: entities.slice(0, 3), ftsQuery, source }
}
