'use client'

// Чат-библиотекарь: полнотекстовый поиск по книгам правил (book_pages).
// Ничего не выдумывает — цитирует книгу со страницей, чтобы игрок мог
// открыть свой PDF и увидеть то же самое.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase'

type BookHit = {
  source: string
  title: string
  page: number
  rank: number
  snippet: string
}

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; hits?: BookHit[] }

const SUGGESTIONS = [
  'испытание крови',
  'преклонение величие',
  'голод последствия',
  'ритуалы некромантии',
  'сложность проверки',
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
      const { data, error } = await createClient().rpc('search_book_pages', {
        p_query: trimmed,
        p_limit: 6,
      })
      if (error) throw error
      const hits = (data || []) as BookHit[]
      setMessages(prev => [
        ...prev,
        hits.length
          ? {
              role: 'assistant',
              text: t('Вот что нашлось в книгах:'),
              hits,
            }
          : {
              role: 'assistant',
              text: t('В книгах ничего не нашлось. Попробуй переформулировать — например, назови дисциплину, ритуал или термин из правил.'),
            },
      ])
    } catch (error) {
      console.error('Поиск по книгам не удался:', error)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: t('Не получилось выполнить поиск. Проверь, что ты вошёл в аккаунт, и попробуй ещё раз.') },
      ])
    } finally {
      setBusy(false)
    }
  }, [busy, t])

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
                {message.role === 'assistant' && message.hits ? (
                  <div className="rules-chat-hits">
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
          max-width: 780px;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          line-height: 1.5;
        }
        .rules-chat-message p { margin: 0; }
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
        .rules-chat-hits { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
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
