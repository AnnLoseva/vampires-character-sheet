/**
 * Focused regression tests for the rules-chat retrieval plan.
 * Run: npm run test:rules-chat
 */
import assert from 'node:assert/strict'
import {
  buildBookSearchPlan,
  mergeBookHitLists,
  parseQuery,
  type BookHit,
} from '../modules/rules-chat/engine'
import {
  buildCharacterToolPayload,
  selectCharacterRows,
  type LibrarianCharacterRow,
} from '../supabase/functions/librarian-chat/tools'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.error(`  ✗ ${name}`)
    throw error
  }
}

console.log('rules-chat query classification')

test('a rule question about my character still searches books', () => {
  const parsed = parseQuery('Мой персонаж не пил 2 ночи кровь. Что произойдет?', null)
  assert.equal(parsed.personal, true)
  assert.equal(parsed.searchBooks, true)
})

test('a plain sheet lookup does not search books', () => {
  const parsed = parseQuery('покажи моего персонажа', null)
  assert.equal(parsed.personal, true)
  assert.equal(parsed.searchBooks, false)
})

test('a possessive trait question still reads the character sheet', () => {
  const parsed = parseQuery('какая у меня сила?', null)
  assert.equal(parsed.personal, true)
  assert.equal(parsed.searchBooks, false)
})

test('a polite dative phrase is not mistaken for a sheet lookup', () => {
  const parsed = parseQuery('расскажи мне про клан Тореадор', null)
  assert.equal(parsed.personal, false)
  assert.equal(parsed.searchBooks, true)
})

console.log('rules-chat character tools')

const characters: LibrarianCharacterRow[] = [
  {
    id: 'bridget',
    name: 'Бриджет МакКейн',
    clan: 'Бруха',
    data: {
      backstory: 'Бриджет работает спасательницей.',
      touchstones: [{
        name: 'Кит Вэсли',
        description: 'Девушка Бриджет. Они начали встречаться и сейчас живут вместе.',
        image: 'data:image/jpeg;base64,do-not-send',
      }],
    },
  },
  {
    id: 'kit',
    name: 'Кит Вэсли',
    clan: null,
    data: {
      backstory: 'Живёт с Бриджет. Они в отношениях два года.',
      touchstones: [],
    },
  },
]

test('a partial first name finds the full character name', () => {
  assert.deepEqual(selectCharacterRows(characters, ['Кит']).map(character => character.id), ['kit'])
})

test('one request containing two names returns both character sheets', () => {
  assert.deepEqual(
    selectCharacterRows(characters, ['Бриджет и Кит']).map(character => character.id),
    ['bridget', 'kit'],
  )
})

test('character tool details preserve relationship evidence and omit images', () => {
  const payload = buildCharacterToolPayload(characters, ['Бриджет', 'Кит'])
  const serialized = JSON.stringify(payload)
  assert.match(serialized, /Девушка Бриджет/)
  assert.match(serialized, /отношениях два года/)
  assert.doesNotMatch(serialized, /base64/)
})

test('empty names return only a lightweight character overview', () => {
  const payload = buildCharacterToolPayload(characters, [])
  const serialized = JSON.stringify(payload)
  assert.match(serialized, /overview/)
  assert.doesNotMatch(serialized, /отношениях два года/)
})

console.log('rules-chat search plan')

test('natural starvation wording expands to V5 and V20 rule terms', () => {
  const plan = buildBookSearchPlan('что будет если не пить кровь 1 ночь?')
  assert.ok(plan.queries.includes('каждый пробуждение испытание крови'))
  assert.ok(plan.queries.includes('голод закат'))
  assert.ok(plan.queries.includes('воздерживаться пища'))
  assert.equal(plan.referenceQuery, 'голод')
})

test('hunger typo is normalized', () => {
  const plan = buildBookSearchPlan('Что происходит каждую ночь с голодомЮ')
  assert.equal(plan.referenceQuery, 'голод')
  assert.ok(plan.queries.includes('испытание крови голод'))
})

test('follow-up inherits topic and edition from the previous user question', () => {
  const plan = buildBookSearchPlan('а если две ночи?', ['Как работает голод в V5?'])
  assert.equal(plan.source, 'v5-corebook-ru')
  assert.ok(plan.queries.includes('голод закат'))
})

test('library inventory question does not search an unrelated page', () => {
  const plan = buildBookSearchPlan('А какие материалы у тебя вообще есть?')
  assert.equal(plan.isLibraryQuestion, true)
  assert.deepEqual(plan.queries, [])
  assert.equal(plan.referenceQuery, '')
})

console.log('rules-chat result fusion')

test('a page confirmed by several query variants outranks a single noisy hit', () => {
  const hit = (page: number): BookHit => ({
    source: 'v5-corebook-ru',
    title: 'VTM v5: Книга правил (RU)',
    page,
    rank: 1,
    snippet: `page ${page}`,
  })
  const merged = mergeBookHitLists([
    [hit(4), hit(213)],
    [hit(213), hit(221)],
    [hit(213)],
  ])
  assert.equal(merged[0]?.page, 213)
})

console.log(`\n${passed} tests passed`)
