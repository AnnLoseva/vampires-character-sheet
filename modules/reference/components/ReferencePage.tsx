'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/LanguageProvider'
import MarkdownRenderer from './MarkdownRenderer'
import ReferenceSidebar, { ReferenceHeading } from './ReferenceSidebar'

type SearchResult = {
  title: string
  level: 2 | 3
  slug: string
  snippet: string
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function plainHeadingText(value: string) {
  return value
    .replace(/[`*_~[\]()]/g, '')
    .replace(/#+\s*/g, '')
    .trim()
}

function collectHeadings(markdown: string): ReferenceHeading[] {
  const slugCounts = new Map<string, number>()
  return markdown
    .split(/\r?\n/)
    .map(line => /^(#{2,3})\s+(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map(match => {
      const title = plainHeadingText(match[2])
      const baseSlug = makeSlug(title) || 'section'
      const count = slugCounts.get(baseSlug) || 0
      slugCounts.set(baseSlug, count + 1)
      return {
        id: count === 0 ? baseSlug : `${baseSlug}-${count}`,
        title,
        level: match[1].length as 2 | 3,
      }
    })
}

function getSearchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length >= 2)
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`*_#[\]()>|~.-]/g, ' ')
    .replace(/\s+/g, ' ')
}

function getFirstHeading(markdown: string, fallback: string) {
  return markdown.split(/\r?\n/).find(line => /^#\s+/.test(line)) || fallback
}

function getSearchSnippet(text: string, terms: string[]) {
  const plain = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_#[\]()>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = plain.toLowerCase()
  const firstIndex = terms
    .map(term => lower.indexOf(term))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, firstIndex - 90)
  const end = Math.min(plain.length, firstIndex + 210)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < plain.length ? '...' : ''
  return `${prefix}${plain.slice(start, end)}${suffix}`
}

function filterMarkdown(
  markdown: string,
  query: string,
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  const terms = getSearchTerms(query)
  if (terms.length === 0) return { markdown, results: [] as SearchResult[] }

  const lines = markdown.split(/\r?\n/)
  const title = getFirstHeading(markdown, `# ${t('Справочник')}`)
  const blocks: Array<{ heading: string; title: string; level: 2 | 3; content: string }> = []
  let current: string[] = []
  let currentHeading = ''
  let currentTitle = ''
  let currentLevel: 2 | 3 = 2

  const flush = () => {
    if (!currentHeading) return
    blocks.push({
      heading: currentHeading,
      title: currentTitle,
      level: currentLevel,
      content: current.join('\n').trim(),
    })
  }

  lines.forEach(line => {
    const headingMatch = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (headingMatch) {
      flush()
      currentHeading = line
      currentTitle = plainHeadingText(headingMatch[2])
      currentLevel = headingMatch[1].length as 2 | 3
      current = [line]
      return
    }
    if (currentHeading) current.push(line)
  })
  flush()

  const slugCounts = new Map<string, number>()
  const matchingBlocks = blocks.filter(block => {
    const haystack = normalizeSearchText(`${block.title} ${block.content}`)
    return terms.every(term => haystack.includes(term))
  })

  const results = matchingBlocks.map(block => {
    const baseSlug = makeSlug(block.title) || 'section'
    const count = slugCounts.get(baseSlug) || 0
    slugCounts.set(baseSlug, count + 1)
    return {
      title: block.title,
      level: block.level,
      slug: count === 0 ? baseSlug : `${baseSlug}-${count}`,
      snippet: getSearchSnippet(block.content, terms),
    }
  })

  if (matchingBlocks.length === 0) {
    return {
      markdown: `${title}\n\n## ${t('Ничего не найдено')}\n\n${tf('По запросу **{query}** разделы не найдены. Попробуйте другое слово или более общий термин.', { query: query.trim() })}`,
      results,
    }
  }

  return {
    markdown: `${title}\n\n> ${tf('Показаны только разделы, где найдены все слова запроса: **{query}**.', { query: query.trim() })}\n\n${matchingBlocks.map(block => block.content).join('\n\n')}`,
    results,
  }
}

const STATUS_TEXT: Record<'loading' | 'ready' | 'error', string> = {
  loading: 'Загружаю архив...',
  ready: 'Архив открыт',
  error: 'Справочник не загрузился',
}

export default function ReferencePage() {
  const { lang, t, tf } = useLang()
  const [markdown, setMarkdown] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [matchCount, setMatchCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const path = lang === 'en' ? '/reference/VtM_v5_new_eng.md' : '/reference/VtM_v5_new.md'
    setStatus('loading')
    fetch(path)
      .then(response => {
        if (!response.ok) throw new Error(`Markdown fetch failed: ${response.status}`)
        return response.text()
      })
      .then(text => {
        if (cancelled) return
        setMarkdown(text)
        setStatus('ready')
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [lang])

  const searchState = useMemo(() => filterMarkdown(markdown, query, t, tf), [markdown, query, t, tf])
  const searchTerms = useMemo(() => getSearchTerms(query), [query])
  const headings = useMemo(() => collectHeadings(searchState.markdown), [searchState.markdown])
  const isSearching = searchTerms.length > 0

  useEffect(() => {
    setActiveMatchIndex(0)
  }, [query, searchState.markdown])

  useEffect(() => {
    if (!isSearching) {
      setMatchCount(0)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const matches = Array.from(document.querySelectorAll<HTMLElement>('.reference-search-hit'))
      setMatchCount(matches.length)
      if (matches.length === 0) return

      const nextIndex = Math.min(activeMatchIndex, matches.length - 1)
      if (nextIndex !== activeMatchIndex) {
        setActiveMatchIndex(nextIndex)
        return
      }

      matches[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeMatchIndex, isSearching, searchState.markdown])

  const goToPreviousMatch = () => {
    if (matchCount === 0) return
    setActiveMatchIndex(current => (current - 1 + matchCount) % matchCount)
  }

  const goToNextMatch = () => {
    if (matchCount === 0) return
    setActiveMatchIndex(current => (current + 1) % matchCount)
  }

  return (
    <main className="reference-shell">
      <section className="reference-topbar">
        <div>
          <p className="reference-kicker">VTM V5 Archive</p>
          <h1>{t('Справочник')}</h1>
        </div>
        <nav aria-label={t('Навигация справочника')}>
          <Link href="/">{t('Главная')}</Link>
          <Link href="/table">{t('Игровой стол')}</Link>
          <Link href="/character-sheet">{t('Лист')}</Link>
        </nav>
      </section>

      <section className="reference-intro">
        <span>{t(STATUS_TEXT[status])}</span>
        <strong>{t('Правила, кланы, дисциплины, создание персонажа и материалы для мастера в одном тёмном архиве.')}</strong>
      </section>

      <section className="reference-searchbar" aria-label={t('Поиск по справочнику')}>
        <label className="reference-search">
          <span>{t('Поиск по словам')}</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('Например: Голконда Бруха Голод')}
          />
        </label>
        <div className="reference-search-status">
          {isSearching ? (
            <>
              <strong>{tf('Найдено разделов: {count}', { count: searchState.results.length })}</strong>
              <span>{matchCount ? tf('Совпадение {current} из {total}', { current: activeMatchIndex + 1, total: matchCount }) : t('Совпадений нет')}</span>
              <div className="reference-match-controls" aria-label={t('Переход по совпадениям')}>
                <button type="button" onClick={goToPreviousMatch} disabled={matchCount === 0}>{t('Назад')}</button>
                <button type="button" onClick={goToNextMatch} disabled={matchCount === 0}>{t('Вперёд')}</button>
              </div>
              <button type="button" onClick={() => setQuery('')}>{t('Сбросить')}</button>
            </>
          ) : (
            <span>{t('Введите одно или несколько слов, чтобы оставить только подходящие разделы.')}</span>
          )}
        </div>
      </section>

      {isSearching && searchState.results.length > 0 ? (
        <section className="reference-results" aria-label={t('Результаты поиска')}>
          {searchState.results.slice(0, 12).map(result => (
            <a href={`#${result.slug}`} key={`${result.slug}-${result.title}`}>
              <span>{result.level === 2 ? t('Раздел') : t('Подраздел')}</span>
              <strong>{result.title}</strong>
              <small>{result.snippet}</small>
            </a>
          ))}
        </section>
      ) : null}

      <section className="reference-layout">
        <ReferenceSidebar headings={headings} />
        <MarkdownRenderer
          activeMatchIndex={activeMatchIndex}
          markdown={searchState.markdown || `# ${t('Справочник загружается...')}`}
          searchTerms={isSearching ? searchTerms : []}
        />
      </section>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          background: #080506;
          color: #f4eadf;
          scroll-behavior: smooth;
        }

        body {
          overflow-x: hidden;
        }
      `}</style>

      <style jsx>{`
        .reference-shell {
          min-height: 100vh;
          min-height: 100dvh;
          overflow-x: hidden;
          padding: 18px clamp(14px, 2.4vw, 34px) 60px;
          font-family: "Courier New", Courier, monospace;
          background:
            radial-gradient(circle at 18% 0%, rgba(125, 19, 25, 0.32), transparent 34rem),
            linear-gradient(180deg, rgba(45, 4, 8, 0.95), rgba(8, 5, 6, 0.98) 28rem),
            #080506;
        }

        .reference-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }

        .reference-topbar > div {
          min-width: 0;
        }

        .reference-kicker {
          margin: 0 0 5px;
          color: #ff3131;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        .reference-topbar h1 {
          margin: 0;
          color: #fff7ed;
          font-size: clamp(34px, 5vw, 58px);
          letter-spacing: 0;
        }

        .reference-topbar nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        .reference-topbar a,
        .reference-search-status button,
        .reference-match-controls button {
          border: 1px solid #773030;
          border-radius: 6px;
          color: #f5f5f5;
          text-decoration: none;
          padding: 10px 14px;
          background: #141414;
          font: inherit;
          font-size: 14px;
          line-height: 1.2;
          text-align: center;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
          transition: border-color 180ms ease, background 180ms ease, color 180ms ease, transform 180ms ease;
        }

        .reference-topbar a:hover,
        .reference-search-status button:hover,
        .reference-match-controls button:hover:not(:disabled) {
          border-color: #ff3131;
          background: #221111;
          color: #fff3e2;
          transform: translateY(-1px);
        }

        .reference-search-status button:disabled,
        .reference-match-controls button:disabled {
          opacity: 0.45;
          cursor: default;
          transform: none;
        }

        .reference-topbar a:nth-child(2) {
          border-color: #36d675;
          color: #dfffe9;
        }

        .reference-topbar a:nth-child(2):hover {
          border-color: #66f19a;
          background: #112218;
        }

        .reference-intro {
          display: grid;
          gap: 8px;
          max-width: 1180px;
          margin-bottom: 16px;
        }

        .reference-intro span {
          color: #c9a66b;
          font-size: 14px;
        }

        .reference-intro strong {
          max-width: 920px;
          color: #e8dccc;
          font-size: clamp(16px, 2vw, 22px);
          line-height: 1.5;
          font-weight: 500;
        }

        .reference-searchbar {
          position: sticky;
          top: 0;
          z-index: 20;
          display: grid;
          grid-template-columns: minmax(0, 680px) minmax(220px, 1fr);
          gap: 12px;
          align-items: end;
          margin: 0 0 20px;
          padding: 12px;
          border: 1px solid rgba(151, 44, 44, 0.42);
          border-radius: 8px;
          background: rgba(10, 7, 8, 0.96);
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(12px);
        }

        .reference-search {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .reference-search span,
        .reference-search-status span,
        .reference-results span {
          color: #b8a89a;
          font-size: 13px;
        }

        .reference-search input {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          box-sizing: border-box;
          border: 1px solid rgba(151, 44, 44, 0.78);
          border-radius: 7px;
          background: rgba(12, 10, 10, 0.88);
          color: #fff8ef;
          padding: 0 15px;
          font: inherit;
          font-size: 15px;
          outline: none;
        }

        .reference-search input:focus {
          border-color: #d6aa65;
          box-shadow: 0 0 0 3px rgba(214, 170, 101, 0.14);
        }

        .reference-search-status {
          min-height: 46px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: flex-end;
        }

        .reference-search-status strong {
          color: #ffd89a;
          font-size: 14px;
        }

        .reference-match-controls {
          display: flex;
          gap: 8px;
        }

        .reference-results {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 10px;
          margin: 0 0 20px;
        }

        .reference-results a {
          display: grid;
          gap: 5px;
          border: 1px solid rgba(151, 44, 44, 0.34);
          border-radius: 8px;
          background: rgba(15, 10, 11, 0.74);
          color: #eadfd3;
          padding: 12px;
          text-decoration: none;
        }

        .reference-results a:hover {
          border-color: #c53030;
          background: rgba(54, 12, 15, 0.72);
        }

        .reference-results strong {
          color: #ffd89a;
        }

        .reference-results small {
          color: #cdbfb0;
          line-height: 1.45;
        }

        .reference-layout {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
          gap: 28px;
          align-items: start;
          min-width: 0;
        }

        :global(.reference-sidebar) {
          position: sticky;
          top: 92px;
          max-height: calc(100vh - 112px);
          overflow: auto;
          border: 1px solid rgba(151, 44, 44, 0.38);
          border-radius: 8px;
          background: rgba(13, 10, 10, 0.84);
        }

        :global(.reference-sidebar-inner) {
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        :global(.reference-sidebar span) {
          color: #d6aa65;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        :global(.reference-sidebar nav) {
          display: grid;
          gap: 4px;
        }

        :global(.reference-sidebar a) {
          color: #cdbfb0;
          text-decoration: none;
          border-radius: 5px;
          padding: 7px 8px;
          line-height: 1.35;
          font-size: 13px;
        }

        :global(.reference-sidebar a.level-3) {
          padding-left: 20px;
          color: #a99b90;
          font-size: 12px;
        }

        :global(.reference-sidebar a:hover) {
          background: rgba(140, 28, 34, 0.28);
          color: #ffd89a;
        }

        :global(.reference-markdown) {
          width: 100%;
          min-width: 0;
          max-width: none;
          color: #eadfd3;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          line-height: 1.78;
          overflow-wrap: anywhere;
        }

        :global(.reference-markdown h1),
        :global(.reference-markdown h2),
        :global(.reference-markdown h3),
        :global(.reference-markdown h4) {
          font-family: "Courier New", Courier, monospace;
          color: #fff7ed;
          letter-spacing: 0;
          line-height: 1.2;
          scroll-margin-top: 118px;
        }

        :global(.reference-markdown h1) {
          margin: 0 0 28px;
          font-size: clamp(34px, 5vw, 56px);
        }

        :global(.reference-markdown h2) {
          margin: 54px 0 18px;
          padding-top: 24px;
          border-top: 1px solid rgba(151, 44, 44, 0.42);
          font-size: clamp(28px, 4vw, 42px);
        }

        :global(.reference-markdown h3) {
          margin: 34px 0 12px;
          color: #f3c77f;
          font-size: clamp(22px, 3vw, 30px);
        }

        :global(.reference-markdown h4) {
          margin: 26px 0 8px;
          color: #f0d5ac;
          font-size: 20px;
        }

        :global(.reference-markdown p),
        :global(.reference-markdown ul),
        :global(.reference-markdown ol),
        :global(.reference-markdown blockquote) {
          max-width: 1180px;
          margin: 0 0 18px;
        }

        :global(.reference-markdown strong) {
          color: #fff1dc;
        }

        :global(.reference-markdown a) {
          color: #ffb36b;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
        }

        :global(.reference-highlight-fragment) {
          display: contents;
        }

        :global(.reference-search-hit) {
          border-radius: 4px;
          background: rgba(255, 49, 49, 0.22);
          color: #fff6ee;
          padding: 0 3px;
          box-shadow: 0 0 12px rgba(255, 49, 49, 0.28);
        }

        :global(.reference-search-hit.active) {
          background: rgba(255, 49, 49, 0.5);
          color: #ffffff;
          box-shadow:
            0 0 0 1px rgba(255, 210, 150, 0.52),
            0 0 18px rgba(255, 49, 49, 0.68);
        }

        :global(.reference-markdown blockquote) {
          border-left: 3px solid #9f2d2d;
          background: rgba(82, 12, 18, 0.22);
          padding: 14px 18px;
          color: #dccfc1;
        }

        :global(.reference-markdown ul),
        :global(.reference-markdown ol) {
          padding-left: 1.35em;
        }

        :global(.reference-markdown li) {
          margin: 8px 0;
        }

        :global(.reference-markdown input[type="checkbox"]) {
          accent-color: #b92a2a;
          margin-right: 8px;
        }

        :global(.reference-markdown code) {
          border: 1px solid rgba(214, 170, 101, 0.22);
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.34);
          color: #ffd89a;
          padding: 2px 5px;
          font-family: "Courier New", Courier, monospace;
          font-size: 0.88em;
        }

        :global(.reference-markdown pre) {
          overflow-x: auto;
          border: 1px solid rgba(151, 44, 44, 0.36);
          border-radius: 8px;
          background: #0f0b0c;
          padding: 16px;
        }

        :global(.reference-markdown img) {
          max-width: 100%;
          height: auto;
        }

        :global(.reference-markdown pre code) {
          border: 0;
          background: transparent;
          padding: 0;
        }

        :global(.reference-table-wrap) {
          max-width: 100%;
          overflow-x: auto;
          margin: 24px 0;
          border: 1px solid rgba(151, 44, 44, 0.38);
          border-radius: 8px;
          background: rgba(10, 8, 8, 0.74);
        }

        :global(.reference-markdown table) {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          font-family: "Courier New", Courier, monospace;
          font-size: 14px;
          line-height: 1.45;
        }

        :global(.reference-markdown th),
        :global(.reference-markdown td) {
          border-bottom: 1px solid rgba(151, 44, 44, 0.24);
          padding: 11px 12px;
          vertical-align: top;
        }

        :global(.reference-markdown th) {
          color: #ffd89a;
          background: rgba(72, 13, 18, 0.7);
          text-align: left;
        }

        :global(.reference-markdown tr:nth-child(even) td) {
          background: rgba(255, 255, 255, 0.025);
        }

        @media (max-width: 980px) {
          .reference-searchbar,
          .reference-layout {
            grid-template-columns: 1fr;
          }

          .reference-searchbar {
            top: 0;
          }

          :global(.reference-sidebar) {
            position: relative;
            top: auto;
            max-height: 270px;
          }

          :global(.reference-markdown) {
            width: 100%;
            font-size: 17px;
          }
        }

        @media (max-width: 620px) {
          .reference-shell {
            padding: 12px 10px 42px;
          }

          .reference-topbar {
            display: grid;
          }

          .reference-topbar nav {
            justify-content: flex-start;
          }

          .reference-topbar a {
            flex: 1 1 120px;
            text-align: center;
          }

          .reference-search-status {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  )
}
