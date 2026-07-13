'use client'

// Чат-библиотекарь: структурные ответы из rules.json + цитаты из книг
// (book_pages) со страницами. Ничего не выдумывает.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase'
import {
  asText,
  buildBookSearchPlan,
  buildCharacterCards,
  loadMyCharacters,
  loadRules,
  normalizeToken,
  parseQuery,
  RULEBOOK_LIBRARY,
  searchBookPages,
  searchJournal,
  searchReference,
  type BookHit,
  type EntityMatch,
  type JournalHit,
  type PersonalCard,
  type ReferenceSearchHit,
} from '../engine'

type ChatMessage =
  | { role: 'user'; text: string }
  | {
      role: 'assistant'
      text: string
      personal?: PersonalCard[]
      journal?: JournalHit[]
      entities?: EntityMatch[]
      refHits?: Array<ReferenceSearchHit & { url: string }>
      hits?: BookHit[]
    }

const SUGGESTIONS = [
  'мой персонаж',
  'моя предыстория',
  'что было в дневнике',
  'клан Тореадор',
  'Величие',
  'голод последствия',
]

// ts_headline возвращает текст книги с <b>…</b>. Экранируем всё,
// потом возвращаем только жирное выделение.
function renderSnippet(snippet: string) {
  const escaped = snippet
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBold = escaped
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
  return { __html: withBold }
}

function Field({ label, value }: { label?: string; value: unknown }) {
  const text = asText(value)
  if (!text) return null
  return (
    <p>
      {label ? <strong>{label}: </strong> : null}
      {text}
    </p>
  )
}

function EntityCard({ entity }: { entity: EntityMatch }) {
  const { t } = useLang()
  if (entity.kind === 'clan') {
    return (
      <section className="rules-chat-card">
        <h3>{t('Клан')}: {entity.name}</h3>
        <Field value={entity.data.description} />
        <Field label={t('Дисциплины')} value={entity.data.disciplines} />
        <Field label={t('Проклятие')} value={entity.data.bane} />
        <Field label={t('Стиль игры')} value={entity.data.playstyle} />
        <Field label={t('Конфликт')} value={entity.data.conflict} />
      </section>
    )
  }
  if (entity.kind === 'discipline') {
    const levels = Object.entries(entity.data.powers || {})
    return (
      <section className="rules-chat-card">
        <h3>{t('Дисциплина')}: {entity.name}</h3>
        <Field value={entity.data.description} />
        <Field label={t('Система')} value={entity.data.system} />
        {levels.map(([level, powers]) => (
          <div key={level} className="rules-chat-card-level">
            <strong>{t('Уровень')} {level}</strong>
            {Object.entries(powers || {}).map(([powerName, power]) => {
              const description = asText(power.description)
              const pool = asText(power.pool)
              const cost = asText(power.cost)
              return (
                <div key={powerName} className="rules-chat-card-power">
                  <em>{powerName}</em>
                  {description ? <span> — {description}</span> : null}
                  {pool ? <small>{t('Пул')}: {pool}</small> : null}
                  {cost ? <small>{t('Цена')}: {cost}</small> : null}
                </div>
              )
            })}
          </div>
        ))}
      </section>
    )
  }
  if (entity.kind === 'power') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.name} <small>({entity.discipline}, {t('уровень')} {entity.level})</small></h3>
        <Field value={entity.data.description} />
        <Field label={t('Пул')} value={entity.data.pool} />
        <Field label={t('Цена')} value={entity.data.cost} />
        <Field label={t('Эффект')} value={entity.data.effect} />
      </section>
    )
  }
  if (entity.kind === 'merit') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.flaw ? t('Недостаток') : t('Преимущество')}: {entity.name}</h3>
        <Field value={entity.data['описание']} />
        {(entity.data['варианты'] || []).map(variant => (
          <Field
            key={variant['название_пункта']}
            label={`${variant['название_пункта']}${variant['точки'] ? ` (${variant['точки']})` : ''}`}
            value={variant['полное_описание']}
          />
        ))}
      </section>
    )
  }
  if (entity.kind === 'skill' || entity.kind === 'attribute') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.kind === 'skill' ? t('Навык') : t('Атрибут')}: {entity.name}</h3>
        <Field value={entity.data} />
      </section>
    )
  }
  if (entity.kind === 'topic') {
    return (
      <section className="rules-chat-card">
        <h3>{entity.name}</h3>
        <Field value={entity.data} />
      </section>
    )
  }
  return (
    <section className="rules-chat-card">
      <h3>{t('Тип хищника')}: {entity.name}</h3>
      <Field value={entity.data.description} />
      <Field label={t('Специализация')} value={entity.data.specialty} />
      <Field label={t('Дисциплины')} value={entity.data.disciplines} />
    </section>
  )
}

export default function RulesChatPage() {
  const { t } = useLang()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)))
      .catch(() => setHasSession(false))
    void loadRules()
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const ask = useCallback(async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || busy) return
    setDraft('')
    setBusy(true)
    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    try {
      const rules = await loadRules()
      const parsed = parseQuery(trimmed, rules)
      const tokens = trimmed.split(/\s+/).map(normalizeToken).filter(Boolean)
      const previousUserQuestions = messages
        .filter((message): message is Extract<ChatMessage, { role: 'user' }> => message.role === 'user')
        .map(message => message.text)
      const bookPlan = buildBookSearchPlan(trimmed, previousUserQuestions, parsed.source)

      // Личный контекст: id легаси-пользователя и активный персонаж — из
      // localStorage этого устройства; сами листы приходят только через
      // get_my_characters (сервер отдаёт исключительно листы владельца).
      let personal: PersonalCard[] = []
      let journal: JournalHit[] = []
      let legacyUserId: string | null = null
      try {
        const savedUser = window.localStorage.getItem('vtm-chat-user') || window.localStorage.getItem('vtm-sheet-user')
        legacyUserId = savedUser ? (JSON.parse(savedUser) as { id?: string }).id || null : null
      } catch { /* нет сохранённого пользователя */ }

      if (parsed.personal && !parsed.journal) {
        const characters = await loadMyCharacters()
        const activeId = legacyUserId
          ? window.localStorage.getItem(`vtm-chat-character:${legacyUserId}`)
            || window.localStorage.getItem(`vtm-home-character:${legacyUserId}`)
          : null
        personal = buildCharacterCards(tokens, characters, activeId)
        if (personal.length === 0) {
          personal = [{ title: t('Персонажи'), fields: [{ value: t('Персонажей не найдено. Создай его в «Архиве личности» на главной.') }] }]
        }
      }
      if (parsed.journal) {
        journal = searchJournal(tokens, legacyUserId)
      }

      // Для книг строим несколько коротких запросов на языке правил и
      // объединяем результаты. Так разговорная формулировка или опечатка не
      // превращают весь запрос в одно слишком строгое FTS-условие.
      const [refHits, hits] = await Promise.all([
        parsed.journal || bookPlan.isLibraryQuestion || !bookPlan.referenceQuery
          ? Promise.resolve([])
          : searchReference(bookPlan.referenceQuery),
        parsed.searchBooks ? searchBookPages(bookPlan) : Promise.resolve([]),
      ])

      // «Мозг»: DeepSeek через edge-функцию. Отвечает только по нашим
      // материалам; при недоступности — прежний локальный ответ.
      let aiAnswer = ''
      try {
        const history = messages
          .slice(-8)
          .map(message => ({ role: message.role, text: message.text }))
        const context = {
          library: RULEBOOK_LIBRARY.map(book => ({
            source: book.source,
            edition: book.edition,
            title: book.title,
          })),
          rules: parsed.entities.map(entity => ({
            name: entity.name,
            body: asText(entity.data) || '',
          })),
          books: hits.map(hit => ({
            title: hit.title,
            page: hit.page,
            snippet: hit.snippet.replace(/<\/?b>/g, ''),
          })),
          reference: refHits.map(hit => ({
            doc: hit.doc.shortTitle,
            section: hit.title,
            snippet: hit.snippet,
          })),
          character: personal.length
            ? personal
                .map(card => `${card.title}\n${card.fields
                  .map(field => `${field.label ? `${field.label}: ` : ''}${asText(field.value) || ''}`)
                  .join('\n')}`)
                .join('\n\n')
            : undefined,
          journal: journal.map(entry => ({
            title: entry.title,
            date: entry.date,
            excerpt: entry.excerpt,
          })),
        }
        const { data: aiData, error: aiError } = await createClient().functions.invoke('librarian-chat', {
          body: { question: trimmed, history, context },
        })
        if (aiError) {
          console.error('librarian-chat:', aiError)
        } else {
          aiAnswer = ((aiData as { answer?: string })?.answer || '').trim()
        }
      } catch (error) {
        console.error('librarian-chat не ответил:', error)
      }

      const hasAnything = aiAnswer.length > 0 || bookPlan.isLibraryQuestion
        || personal.length > 0 || journal.length > 0
        || parsed.entities.length > 0 || refHits.length > 0 || hits.length > 0
      setMessages(prev => [
        ...prev,
        hasAnything
          ? {
              role: 'assistant',
              text: aiAnswer
                || (bookPlan.isLibraryQuestion
                  ? t('В библиотеке доступны VTM V5 и VTM V20 на русском языке.')
                  : personal.length || journal.length
                  ? t('Вот что нашлось в твоём архиве:')
                  : parsed.entities.length
                    ? t('Вот что я знаю об этом:')
                    : t('Вот что нашлось в книгах:')),
              // При живом ИИ-ответе карточки прячем, источники оставляем.
              personal: aiAnswer ? [] : personal,
              journal,
              entities: aiAnswer ? [] : parsed.entities,
              refHits,
              hits,
            }
          : {
              role: 'assistant',
              text: parsed.journal
                ? t('В дневнике ничего не нашлось.')
                : t('Не удалось найти подходящий фрагмент. Попробуй уточнить редакцию или назвать термин из правил.'),
            },
      ])
    } catch (error) {
      console.error('Чат-библиотекарь: ошибка ответа:', error)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: t('Не получилось выполнить поиск. Проверь, что ты вошёл в аккаунт, и попробуй ещё раз.') },
      ])
    } finally {
      setBusy(false)
    }
  }, [busy, messages, t])

  return (
    <main className="rules-chat-shell">
      <header className="rules-chat-header">
        <div>
          <h1>{t('Библиотекарь')}</h1>
          <p>{t('Задай вопрос по правилам — отвечу цитатами из книг с точными страницами.')}</p>
        </div>
        <Link href="/" className="rules-chat-home">
          {t('В салон')}
        </Link>
      </header>

      {hasSession === false ? (
        <section className="rules-chat-locked">
          <p>{t('Тексты книг доступны только своим. Войди в аккаунт на главной странице и возвращайся.')}</p>
          <Link href="/" className="rules-chat-cta">{t('Войти')}</Link>
        </section>
      ) : (
        <>
          <div className="rules-chat-messages" ref={listRef}>
            {messages.length === 0 ? (
              <section className="rules-chat-empty">
                <p>{t('Например:')}</p>
                <div className="rules-chat-suggestions">
                  {SUGGESTIONS.map(suggestion => (
                    <button key={suggestion} type="button" onClick={() => void ask(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {messages.map((message, index) => (
              <article key={index} className={`rules-chat-message ${message.role}`}>
                <p>{message.text}</p>
                {message.role === 'assistant' && message.personal?.length ? (
                  <div className="rules-chat-entities">
                    {message.personal.map(card => (
                      <section className="rules-chat-card" key={card.title}>
                        <h3>{card.title}</h3>
                        {card.fields.map((field, fieldIndex) => (
                          <Field key={fieldIndex} label={field.label} value={field.value} />
                        ))}
                      </section>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.journal?.length ? (
                  <div className="rules-chat-hits">
                    <small className="rules-chat-hits-title">{t('Из дневника:')}</small>
                    {message.journal.map((entry, entryIndex) => (
                      <blockquote key={entryIndex}>
                        <span>{entry.excerpt}</span>
                        <footer>{entry.title}{entry.date ? ` — ${entry.date}` : ''}</footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.entities?.length ? (
                  <div className="rules-chat-entities">
                    {message.entities.map(entity => (
                      <EntityCard key={`${entity.kind}-${entity.name}`} entity={entity} />
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.refHits?.length ? (
                  <div className="rules-chat-hits">
                    <small className="rules-chat-hits-title">{t('В справочнике:')}</small>
                    {message.refHits.map(hit => (
                      <blockquote key={hit.url}>
                        <span>{hit.snippet}</span>
                        <footer>
                          <Link href={hit.url} className="rules-chat-ref-link">
                            {hit.doc.shortTitle} → {hit.title}
                          </Link>
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.hits?.length ? (
                  <div className="rules-chat-hits">
                    {message.entities?.length ? <small className="rules-chat-hits-title">{t('В книгах об этом:')}</small> : null}
                    {message.hits.map(hit => (
                      <blockquote key={`${hit.source}-${hit.page}`}>
                        <span dangerouslySetInnerHTML={renderSnippet(hit.snippet)} />
                        <footer>
                          {hit.title} — {t('стр.')} {hit.page}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {busy ? <article className="rules-chat-message assistant"><p>{t('Листаю книги...')}</p></article> : null}
          </div>

          <form
            className="rules-chat-input"
            onSubmit={event => {
              event.preventDefault()
              void ask(draft)
            }}
          >
            <input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder={t('Спроси про правило, дисциплину, ритуал...')}
              disabled={busy}
              autoFocus
            />
            <button type="submit" disabled={busy || !draft.trim()}>
              {t('Спросить')}
            </button>
          </form>
        </>
      )}

      <style jsx global>{`
        .rules-chat-shell {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at 20% 0%, #1a0b0e 0%, #080506 55%);
          color: #f4eadf;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          padding: 24px clamp(16px, 6vw, 96px);
        }
        .rules-chat-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          border-bottom: 1px solid rgba(139, 0, 0, 0.35);
          padding-bottom: 16px;
        }
        .rules-chat-header h1 {
          font-family: 'Cinzel', serif;
          font-size: clamp(24px, 4vw, 34px);
          margin: 0 0 4px;
          color: #d8b56a;
        }
        .rules-chat-header p {
          margin: 0;
          opacity: 0.75;
          font-size: 14px;
        }
        .rules-chat-home {
          color: #d8b56a;
          text-decoration: none;
          font-size: 14px;
          border: 1px solid rgba(216, 181, 106, 0.4);
          border-radius: 999px;
          padding: 8px 16px;
          white-space: nowrap;
        }
        .rules-chat-home:hover { background: rgba(216, 181, 106, 0.12); }
        .rules-chat-locked {
          margin: auto;
          text-align: center;
          max-width: 420px;
        }
        .rules-chat-cta {
          display: inline-block;
          margin-top: 12px;
          color: #f4eadf;
          background: #8b0000;
          padding: 10px 24px;
          border-radius: 8px;
          text-decoration: none;
        }
        .rules-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .rules-chat-empty { margin: auto; text-align: center; opacity: 0.9; }
        .rules-chat-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-top: 12px;
        }
        .rules-chat-suggestions button {
          background: rgba(139, 0, 0, 0.18);
          border: 1px solid rgba(139, 0, 0, 0.5);
          color: #f4eadf;
          border-radius: 999px;
          padding: 8px 14px;
          cursor: pointer;
          font-size: 13px;
        }
        .rules-chat-suggestions button:hover { background: rgba(139, 0, 0, 0.35); }
        .rules-chat-message {
          max-width: 820px;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          line-height: 1.55;
        }
        .rules-chat-message p { margin: 0; white-space: pre-line; }
        .rules-chat-message.user {
          align-self: flex-end;
          background: rgba(139, 0, 0, 0.3);
          border: 1px solid rgba(139, 0, 0, 0.5);
        }
        .rules-chat-message.assistant {
          align-self: flex-start;
          background: rgba(216, 181, 106, 0.07);
          border: 1px solid rgba(216, 181, 106, 0.22);
        }
        .rules-chat-entities { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
        .rules-chat-card {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(216, 181, 106, 0.35);
          border-radius: 10px;
          padding: 14px 16px;
        }
        .rules-chat-card h3 {
          margin: 0 0 8px;
          font-family: 'Cinzel', serif;
          color: #d8b56a;
          font-size: 17px;
        }
        .rules-chat-card p { margin: 0 0 8px; white-space: pre-line; }
        .rules-chat-card p:last-child { margin-bottom: 0; }
        .rules-chat-card-level { margin-top: 10px; }
        .rules-chat-card-level > strong { color: #d8b56a; display: block; margin-bottom: 4px; }
        .rules-chat-card-power { margin: 0 0 8px 12px; font-size: 14px; }
        .rules-chat-card-power em { color: #f0d9a8; font-style: normal; font-weight: 600; }
        .rules-chat-card-power small { display: block; opacity: 0.75; margin-left: 0; }
        .rules-chat-hits { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .rules-chat-hits-title { opacity: 0.7; font-style: italic; }
        .rules-chat-hits blockquote {
          margin: 0;
          padding: 10px 14px;
          border-left: 3px solid #8b0000;
          background: rgba(0, 0, 0, 0.35);
          border-radius: 0 8px 8px 0;
          font-size: 14px;
        }
        .rules-chat-hits blockquote b { color: #d8b56a; }
        .rules-chat-hits blockquote footer {
          margin-top: 8px;
          font-size: 12px;
          opacity: 0.7;
          font-style: italic;
        }
        .rules-chat-ref-link { color: #d8b56a; text-decoration: none; }
        .rules-chat-ref-link:hover { text-decoration: underline; }
        .rules-chat-input {
          display: flex;
          gap: 10px;
          padding-top: 16px;
          border-top: 1px solid rgba(139, 0, 0, 0.35);
        }
        .rules-chat-input input {
          flex: 1;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(216, 181, 106, 0.3);
          border-radius: 10px;
          color: #f4eadf;
          padding: 12px 16px;
          font-size: 15px;
          outline: none;
        }
        .rules-chat-input input:focus { border-color: #d8b56a; }
        .rules-chat-input button {
          background: #8b0000;
          color: #f4eadf;
          border: none;
          border-radius: 10px;
          padding: 12px 22px;
          font-size: 15px;
          cursor: pointer;
        }
        .rules-chat-input button:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </main>
  )
}
