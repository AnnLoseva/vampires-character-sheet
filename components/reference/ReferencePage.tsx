'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MarkdownRenderer from './MarkdownRenderer'
import ReferenceSidebar, { ReferenceHeading } from './ReferenceSidebar'

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

function countMatches(markdown: string, query: string) {
  const value = query.trim()
  if (!value) return 0
  return markdown.toLowerCase().split(value.toLowerCase()).length - 1
}

export default function ReferencePage() {
  const [markdown, setMarkdown] = useState('')
  const [status, setStatus] = useState('Загружаю архив...')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/reference/VtM_v5_new.md')
      .then(response => {
        if (!response.ok) throw new Error(`Markdown fetch failed: ${response.status}`)
        return response.text()
      })
      .then(text => {
        if (cancelled) return
        setMarkdown(text)
        setStatus('Архив открыт')
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) setStatus('Справочник не загрузился')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const headings = useMemo(() => collectHeadings(markdown), [markdown])
  const matches = useMemo(() => countMatches(markdown, query), [markdown, query])

  return (
    <main className="reference-shell">
      <section className="reference-hero">
        <nav aria-label="Навигация справочника">
          <Link href="/">Главная</Link>
          <Link href="/table">Игровой стол</Link>
          <Link href="/character-sheet">Лист персонажа</Link>
        </nav>
        <p>VTM V5 Archive</p>
        <h1>Справочник</h1>
        <span>{status}</span>
        <strong>Правила, кланы, дисциплины, создание персонажа и материалы для мастера в одном тёмном архиве.</strong>
        <label className="reference-search">
          <span>Поиск по справочнику</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Например: Голконда, Бруха, Голод..."
          />
        </label>
        {query.trim() ? <small>Найдено совпадений: {matches}</small> : null}
      </section>

      <section className="reference-layout">
        <ReferenceSidebar headings={headings} />
        <MarkdownRenderer markdown={markdown || '# Справочник загружается...'} />
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
          padding: 28px clamp(16px, 3vw, 44px) 60px;
          font-family: "Courier New", Courier, monospace;
          background:
            radial-gradient(circle at 18% 0%, rgba(125, 19, 25, 0.32), transparent 34rem),
            linear-gradient(180deg, rgba(45, 4, 8, 0.95), rgba(8, 5, 6, 0.98) 28rem),
            #080506;
        }

        .reference-hero {
          max-width: 1180px;
          margin: 0 auto 28px;
          display: grid;
          gap: 12px;
          border-bottom: 1px solid rgba(201, 45, 45, 0.24);
          padding-bottom: 24px;
        }

        .reference-hero nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        .reference-hero a {
          border: 1px solid rgba(158, 45, 45, 0.7);
          border-radius: 6px;
          color: #f6e4d0;
          text-decoration: none;
          padding: 9px 12px;
          background: rgba(12, 8, 8, 0.7);
        }

        .reference-hero a:hover {
          border-color: #c53030;
          color: #ffd89a;
        }

        .reference-hero p {
          margin: 12px 0 0;
          color: #c53030;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-size: 13px;
        }

        .reference-hero h1 {
          margin: 0;
          color: #fff7ed;
          font-size: clamp(42px, 7vw, 86px);
          line-height: 0.95;
          letter-spacing: 0;
        }

        .reference-hero > span {
          color: #c9a66b;
          font-size: 14px;
        }

        .reference-hero > strong {
          max-width: 760px;
          color: #e8dccc;
          font-size: clamp(16px, 2vw, 22px);
          line-height: 1.55;
          font-weight: 500;
        }

        .reference-search {
          width: min(100%, 760px);
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }

        .reference-search span,
        .reference-hero small {
          color: #b8a89a;
          font-size: 13px;
        }

        .reference-search input {
          min-height: 48px;
          box-sizing: border-box;
          border: 1px solid rgba(151, 44, 44, 0.78);
          border-radius: 8px;
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

        .reference-layout {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 30px;
          align-items: start;
        }

        :global(.reference-sidebar) {
          position: sticky;
          top: 18px;
          max-height: calc(100vh - 36px);
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
          width: min(100%, 920px);
          color: #eadfd3;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          line-height: 1.78;
        }

        :global(.reference-markdown h1),
        :global(.reference-markdown h2),
        :global(.reference-markdown h3),
        :global(.reference-markdown h4) {
          font-family: "Courier New", Courier, monospace;
          color: #fff7ed;
          letter-spacing: 0;
          line-height: 1.2;
          scroll-margin-top: 24px;
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
          min-width: 620px;
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

        @media (max-width: 900px) {
          .reference-layout {
            grid-template-columns: 1fr;
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
            padding: 18px 12px 42px;
          }

          .reference-hero nav {
            justify-content: flex-start;
          }

          .reference-hero a {
            flex: 1 1 auto;
            text-align: center;
          }
        }
      `}</style>
    </main>
  )
}
