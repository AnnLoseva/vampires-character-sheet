'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ChatUser, JournalEntry } from '@/lib/table/types'

type JournalArchive = {
  key: string
  userId: string
  room: string
  entries: JournalEntry[]
}

const DEFAULT_ROOM = 'campaign-666'

function readStoredUser() {
  try {
    const saved = window.localStorage.getItem('vtm-chat-user') || window.localStorage.getItem('vtm-sheet-user')
    return saved ? JSON.parse(saved) as ChatUser : null
  } catch {
    return null
  }
}

function readJournalArchives() {
  return Object.keys(window.localStorage)
    .filter(key => key.startsWith('vtm-journal:'))
    .sort()
    .map(key => {
      const [, userId = 'local', room = DEFAULT_ROOM] = key.split(':')
      let entries: JournalEntry[] = []
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as JournalEntry[]
        entries = Array.isArray(parsed) ? parsed : []
      } catch {
        entries = []
      }
      return { key, userId, room, entries }
    })
}

function createJournalKey(userId: string, room: string) {
  return `vtm-journal:${userId}:${room.trim() || DEFAULT_ROOM}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU')
}

export default function JournalPage() {
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [archives, setArchives] = useState<JournalArchive[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [query, setQuery] = useState('')
  const [roomDraft, setRoomDraft] = useState(DEFAULT_ROOM)
  const [status, setStatus] = useState('Дневники загружаются...')

  const reloadArchives = () => {
    const next = readJournalArchives()
    setArchives(next)
    setSelectedKey(current => current && next.some(item => item.key === current) ? current : next[0]?.key || '')
    setStatus(next.length ? 'Локальный архив открыт' : 'Локальных дневников пока нет')
  }

  useEffect(() => {
    setChatUser(readStoredUser())
    const savedRoom = window.localStorage.getItem('vtm-table-room') || DEFAULT_ROOM
    setRoomDraft(savedRoom)
    reloadArchives()
  }, [])

  const selectedArchive = archives.find(item => item.key === selectedKey) || archives[0] || null
  const entries = selectedArchive?.entries || []
  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter(entry => `${entry.title} ${entry.text}`.toLowerCase().includes(needle))
  }, [entries, query])
  const selectedEntry = entries.find(entry => entry.id === selectedEntryId)
    || filteredEntries[0]
    || entries[0]
    || null

  const saveArchive = (archive: JournalArchive, nextEntries: JournalEntry[], nextStatus = 'Сохранено') => {
    window.localStorage.setItem(archive.key, JSON.stringify(nextEntries))
    setArchives(prev => prev.map(item => item.key === archive.key ? { ...item, entries: nextEntries } : item))
    setStatus(nextStatus)
  }

  const createArchive = () => {
    const userId = chatUser?.id || 'local'
    const key = createJournalKey(userId, roomDraft)
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, '[]')
    reloadArchives()
    setSelectedKey(key)
  }

  const createEntry = () => {
    const archive = selectedArchive
    if (!archive) {
      createArchive()
      return
    }
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: 'Новая запись',
      text: '',
      createdAt: now,
      updatedAt: now,
    }
    const next = [entry, ...archive.entries]
    saveArchive(archive, next)
    setSelectedEntryId(entry.id)
  }

  const updateEntry = (patch: Partial<Pick<JournalEntry, 'title' | 'text'>>) => {
    if (!selectedArchive || !selectedEntry) return
    const now = new Date().toISOString()
    const next = selectedArchive.entries.map(entry => entry.id === selectedEntry.id ? { ...entry, ...patch, updatedAt: now } : entry)
    saveArchive(selectedArchive, next, 'Сохранено')
  }

  const deleteEntry = () => {
    if (!selectedArchive || !selectedEntry) return
    if (!window.confirm(`Удалить запись "${selectedEntry.title || 'Без названия'}"?`)) return
    const next = selectedArchive.entries.filter(entry => entry.id !== selectedEntry.id)
    saveArchive(selectedArchive, next)
    setSelectedEntryId(next[0]?.id || '')
  }

  return (
    <main className="journal-shell">
      <section className="journal-topbar">
        <div>
          <p className="journal-kicker">VTM V5 Archive</p>
          <h1>Дневник</h1>
        </div>
        <nav aria-label="Навигация дневника">
          <Link href="/">Главная</Link>
          <Link href="/table">Игровой стол</Link>
          <Link href="/character-sheet">Лист</Link>
          <Link href="/reference">Справочник</Link>
        </nav>
      </section>

      <section className="journal-toolbar">
        <div>
          <span>{status}</span>
          <strong>{chatUser ? `Сессия: ${chatUser.username}` : 'Локальные записи этого браузера'}</strong>
        </div>
        <label>
          <span>Комната</span>
          <input value={roomDraft} onChange={event => setRoomDraft(event.target.value)} />
        </label>
        <button type="button" onClick={createArchive}>Открыть комнату</button>
        <button type="button" onClick={createEntry}>Новая запись</button>
      </section>

      <section className="journal-layout">
        <aside className="journal-sidebar" aria-label="Список дневников">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск в дневнике" />
          <div className="archive-list">
            {archives.length === 0 ? (
              <p>Создайте дневник комнаты.</p>
            ) : archives.map(archive => (
              <button
                type="button"
                className={archive.key === selectedArchive?.key ? 'active' : ''}
                key={archive.key}
                onClick={() => {
                  setSelectedKey(archive.key)
                  setSelectedEntryId(archive.entries[0]?.id || '')
                }}
              >
                <strong>{archive.room || DEFAULT_ROOM}</strong>
                <span>{archive.entries.length} записей</span>
              </button>
            ))}
          </div>
          <div className="entry-list">
            {filteredEntries.length === 0 ? (
              <p>{entries.length ? 'Записей не найдено.' : 'В этом дневнике пока пусто.'}</p>
            ) : filteredEntries.map(entry => (
              <button
                type="button"
                className={entry.id === selectedEntry?.id ? 'active' : ''}
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
              >
                <strong>{entry.title || 'Без названия'}</strong>
                <span>{formatDate(entry.updatedAt)}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="journal-editor" aria-label="Запись дневника">
          {selectedEntry ? (
            <>
              <input
                value={selectedEntry.title}
                onChange={event => updateEntry({ title: event.target.value })}
                placeholder="Заголовок"
              />
              <textarea
                value={selectedEntry.text}
                onChange={event => updateEntry({ text: event.target.value })}
                placeholder="Текст записи"
              />
              <footer>
                <span>Обновлено: {formatDate(selectedEntry.updatedAt)}</span>
                <button type="button" className="danger" onClick={deleteEntry}>Удалить</button>
              </footer>
            </>
          ) : (
            <div className="journal-empty">
              <h2>Дневник открыт отдельно</h2>
              <p>Выберите существующий дневник комнаты или создайте новую запись. Записи сохраняются локально в этом браузере, как и раньше.</p>
            </div>
          )}
        </section>
      </section>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          background: #080506;
          color: #f4eadf;
        }
      `}</style>

      <style jsx>{`
        .journal-shell {
          min-height: 100vh;
          padding: 18px clamp(14px, 2.4vw, 34px) 34px;
          font-family: "Courier New", Courier, monospace;
          background:
            radial-gradient(circle at 18% 0%, rgba(125, 19, 25, 0.28), transparent 34rem),
            linear-gradient(180deg, rgba(45, 4, 8, 0.95), rgba(8, 5, 6, 0.98) 28rem),
            #080506;
        }

        .journal-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }

        .journal-kicker {
          margin: 0 0 5px;
          color: #ff3131;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          color: #fff7ed;
          font-size: clamp(34px, 5vw, 58px);
          letter-spacing: 0;
        }

        nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        nav a,
        .journal-toolbar button,
        .journal-editor footer button {
          border: 1px solid #773030;
          border-radius: 6px;
          color: #f5f5f5;
          text-decoration: none;
          padding: 10px 14px;
          background: #141414;
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        }

        nav a:hover,
        .journal-toolbar button:hover,
        .journal-editor footer button:hover {
          border-color: #ff3131;
          background: #221111;
          color: #fff3e2;
        }

        .journal-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto auto;
          gap: 10px;
          align-items: end;
          margin-bottom: 14px;
          padding: 12px;
          border: 1px solid rgba(151, 44, 44, 0.42);
          border-radius: 8px;
          background: rgba(10, 7, 8, 0.9);
        }

        .journal-toolbar div,
        .journal-toolbar label {
          display: grid;
          gap: 6px;
        }

        .journal-toolbar span,
        .journal-sidebar span,
        .journal-editor footer span {
          color: #b8a89a;
          font-size: 13px;
        }

        .journal-toolbar strong {
          color: #ffd89a;
          font-size: 15px;
        }

        input,
        textarea {
          box-sizing: border-box;
          border: 1px solid rgba(151, 44, 44, 0.78);
          border-radius: 7px;
          background: rgba(12, 10, 10, 0.88);
          color: #fff8ef;
          padding: 0 13px;
          font: inherit;
          outline: none;
        }

        input {
          min-height: 44px;
        }

        textarea {
          min-height: 52vh;
          padding: 14px;
          resize: vertical;
          line-height: 1.65;
        }

        input:focus,
        textarea:focus {
          border-color: #d6aa65;
          box-shadow: 0 0 0 3px rgba(214, 170, 101, 0.14);
        }

        .journal-layout {
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 16px;
          min-height: calc(100vh - 190px);
        }

        .journal-sidebar,
        .journal-editor {
          border: 1px solid rgba(151, 44, 44, 0.38);
          border-radius: 8px;
          background: rgba(13, 10, 10, 0.84);
          overflow: hidden;
        }

        .journal-sidebar {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 10px;
          padding: 12px;
        }

        .archive-list,
        .entry-list {
          display: grid;
          align-content: start;
          gap: 7px;
          overflow: auto;
        }

        .archive-list {
          max-height: 180px;
          border-bottom: 1px solid rgba(151, 44, 44, 0.26);
          padding-bottom: 10px;
        }

        .archive-list button,
        .entry-list button {
          min-width: 0;
          display: grid;
          gap: 4px;
          text-align: left;
          border: 1px solid rgba(151, 44, 44, 0.24);
          border-radius: 6px;
          background: rgba(20, 20, 20, 0.72);
          color: #f5f5f5;
          padding: 10px;
          font: inherit;
          cursor: pointer;
        }

        .archive-list button.active,
        .entry-list button.active,
        .archive-list button:hover,
        .entry-list button:hover {
          border-color: #d6aa65;
          background: rgba(52, 22, 18, 0.86);
        }

        .archive-list strong,
        .entry-list strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fff7ed;
        }

        .journal-sidebar p,
        .journal-empty p {
          color: #b8a89a;
          line-height: 1.55;
        }

        .journal-editor {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 10px;
          padding: 14px;
        }

        .journal-editor > input {
          color: #fff7ed;
          font-size: clamp(22px, 3vw, 34px);
          font-weight: 700;
        }

        .journal-editor footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .journal-editor footer button.danger {
          color: #ffb8b8;
          border-color: #7d2626;
        }

        .journal-empty {
          display: grid;
          place-content: center;
          text-align: center;
          max-width: 640px;
          margin: auto;
        }

        .journal-empty h2 {
          margin: 0 0 10px;
          color: #fff7ed;
          font-size: clamp(28px, 4vw, 46px);
        }

        @media (max-width: 980px) {
          .journal-toolbar,
          .journal-layout {
            grid-template-columns: 1fr;
          }

          .journal-layout {
            min-height: 0;
          }
        }

        @media (max-width: 620px) {
          .journal-shell {
            padding: 12px 10px 32px;
          }

          .journal-topbar {
            display: grid;
          }

          nav {
            justify-content: flex-start;
          }

          nav a {
            flex: 1 1 auto;
            text-align: center;
          }

          .journal-editor footer {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}
