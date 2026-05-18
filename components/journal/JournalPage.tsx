'use client'

import Link from 'next/link'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatUser, JournalAttachment, JournalEntry } from '@/lib/table/types'
import { extractImageUrlsFromHtml } from '@/lib/table/media-utils'
import JournalEditor, { type JournalEditorHandle } from './JournalEditor'

type JournalArchive = {
  key: string
  userId: string
  room: string
  entries: JournalEntry[]
}

const DEFAULT_ROOM = 'campaign-666'

// ─── markdown → HTML converter (for legacy entries) ──────────────────────────

function markdownToHtml(text: string): string {
  if (!text) return ''
  // Already HTML? Pass through.
  if (text.trim().startsWith('<')) return text

  const lines = text.split('\n')
  const htmlLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    // blank line → paragraph break
    if (!line.trim()) {
      htmlLines.push('')
      i++
      continue
    }
    // heading
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^(#+)/)?.[1] ?? '#').length
      const content = convertInline(line.replace(/^#+\s*/, ''))
      htmlLines.push(`<h${level}>${content}</h${level}>`)
      i++
      continue
    }
    // horizontal rule
    if (/^---+$/.test(line.trim())) {
      htmlLines.push('<hr>')
      i++
      continue
    }
    // Otherwise plain paragraph line
    htmlLines.push(convertInline(line))
    i++
  }

  // Group non-empty lines into paragraphs
  const chunks: string[] = []
  let buf: string[] = []
  for (const l of htmlLines) {
    if (l === '') {
      if (buf.length) { chunks.push(`<p>${buf.join('<br>')}</p>`); buf = [] }
    } else if (l.startsWith('<h') || l.startsWith('<hr')) {
      if (buf.length) { chunks.push(`<p>${buf.join('<br>')}</p>`); buf = [] }
      chunks.push(l)
    } else {
      buf.push(l)
    }
  }
  if (buf.length) chunks.push(`<p>${buf.join('<br>')}</p>`)

  return chunks.join('') || `<p>${text}</p>`
}

function convertInline(text: string): string {
  return text
    // images first (before links)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

// ─── local storage helpers ────────────────────────────────────────────────────

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

function getEntryAttachments(entry: JournalEntry | null | undefined) {
  return Array.isArray(entry?.attachments) ? entry.attachments : []
}

function getLinkTitle(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Ссылка'
  } catch {
    return 'Ссылка'
  }
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function getDroppedImageUrls(dataTransfer: DataTransfer) {
  const urls: string[] = []
  urls.push(...extractImageUrlsFromHtml(dataTransfer.getData('text/html')))
  urls.push(
    ...dataTransfer
      .getData('text/uri-list')
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith('#'))
  )
  const plain = dataTransfer.getData('text/plain').trim()
  if (/^(https?:|data:image\/|blob:)/i.test(plain)) urls.push(plain)
  return [...new Set(urls.map(url => url.trim()).filter(Boolean))]
}

function getDroppedTableLayer(dataTransfer: DataTransfer) {
  try {
    const raw = dataTransfer.getData('application/x-vtm-layer')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { url?: string; title?: string; layerType?: string }
    if (!parsed.url) return null
    return parsed
  } catch {
    return null
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [chatUser, setChatUser] = useState<ChatUser | null>(null)
  const [archives, setArchives] = useState<JournalArchive[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [query, setQuery] = useState('')
  const [roomDraft, setRoomDraft] = useState(DEFAULT_ROOM)
  const [status, setStatus] = useState('Дневники загружаются...')
  const [imageUrlDraft, setImageUrlDraft] = useState('')
  const [imageTitleDraft, setImageTitleDraft] = useState('')
  const [linkUrlDraft, setLinkUrlDraft] = useState('')
  const [linkTitleDraft, setLinkTitleDraft] = useState('')
  const [dragOverJournal, setDragOverJournal] = useState(false)

  const editorRef = useRef<JournalEditorHandle>(null)

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
    return entries.filter(entry => {
      const attachments = getEntryAttachments(entry).map(item => `${item.title} ${item.url}`).join(' ')
      return `${entry.title} ${entry.text} ${attachments}`.toLowerCase().includes(needle)
    })
  }, [entries, query])
  const selectedEntry = entries.find(entry => entry.id === selectedEntryId)
    || filteredEntries[0]
    || entries[0]
    || null

  // Text for the editor: convert legacy markdown to HTML on the fly
  const editorValue = useMemo(
    () => markdownToHtml(selectedEntry?.text ?? ''),
    // We intentionally only recompute when entry ID changes (not on every keystroke)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEntry?.id],
  )

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

  const updateEntry = (patch: Partial<Pick<JournalEntry, 'title' | 'text' | 'attachments'>>) => {
    if (!selectedArchive || !selectedEntry) return
    const now = new Date().toISOString()
    const next = selectedArchive.entries.map(entry =>
      entry.id === selectedEntry.id ? { ...entry, ...patch, updatedAt: now } : entry
    )
    saveArchive(selectedArchive, next, 'Сохранено')
  }

  // Insert image directly into the editor via ref
  const insertImageIntoEditor = async (src: string, alt = 'Изображение') => {
    editorRef.current?.insertImage(src, alt)
    setStatus('Изображение вставлено')
  }

  const handleAddImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!imageUrlDraft.trim() || !selectedEntry) return
    await insertImageIntoEditor(imageUrlDraft.trim(), imageTitleDraft.trim() || 'Изображение')
    setImageUrlDraft('')
    setImageTitleDraft('')
  }

  const handleAddLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!linkUrlDraft.trim() || !selectedEntry) return
    const url = linkUrlDraft.trim()
    const title = linkTitleDraft.trim() || getLinkTitle(url)
    const linkHtml = `<a href="${url}" target="_blank" rel="noreferrer">${title}</a>`
    editorRef.current?.focus()
    // Insert as raw HTML via execCommand (simple approach for links)
    document.execCommand('insertHTML', false, ` ${linkHtml} `)
    setLinkUrlDraft('')
    setLinkTitleDraft('')
    setStatus('Ссылка вставлена')
  }

  const handleJournalDrop = async (event: React.DragEvent<HTMLElement>) => {
    // Let the editor handle drops when focus is inside it.
    // This handler only fires on the outer wrapper — pass images dropped on the panel chrome.
    const target = event.target as HTMLElement
    if (target.closest('.je-content')) return // editor handles it

    event.preventDefault()
    setDragOverJournal(false)
    if (!selectedEntry) {
      setStatus('Сначала создайте запись дневника')
      return
    }

    const items: string[] = []

    const droppedLayer = getDroppedTableLayer(event.dataTransfer)
    if (droppedLayer?.url && (droppedLayer.layerType === 'image' || droppedLayer.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i))) {
      await insertImageIntoEditor(droppedLayer.url, droppedLayer.title || 'Изображение')
      items.push(droppedLayer.url)
    }

    for (const file of Array.from(event.dataTransfer.files || [])) {
      if (!file.type.startsWith('image/')) continue
      try {
        const src = await readImageFileAsDataUrl(file)
        await insertImageIntoEditor(src, file.name)
        items.push(src)
      } catch {
        setStatus('Одно из изображений не прочиталось')
      }
    }

    getDroppedImageUrls(event.dataTransfer).forEach(async url => {
      await insertImageIntoEditor(url, getLinkTitle(url))
      items.push(url)
    })

    if (items.length === 0) {
      setStatus('Перетащите изображение, ссылку на изображение или медиа со стола')
    } else {
      setStatus(`Вставлено изображений: ${items.length}`)
    }
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

        <section
          className={`journal-editor ${dragOverJournal ? 'drag-over' : ''}`}
          aria-label="Запись дневника"
          onDragEnter={event => { event.preventDefault(); setDragOverJournal(true) }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOverJournal(true) }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverJournal(false)
          }}
          onDrop={handleJournalDrop}
        >
          {selectedEntry ? (
            <>
              {/* Title */}
              <input
                value={selectedEntry.title}
                onChange={event => updateEntry({ title: event.target.value })}
                placeholder="Заголовок"
              />

              {/* Rich text editor */}
              <div className="je-wrapper">
                <JournalEditor
                  ref={editorRef}
                  value={editorValue}
                  onChange={html => updateEntry({ text: html })}
                  placeholder="Текст записи…"
                />
              </div>

              {/* Media tools */}
              <section className="journal-media-tools" aria-label="Вставка медиа в дневник">
                <div className="journal-drop-hint">
                  Перетащите картинку прямо в текст — или вставьте через форму ниже.
                  Кликните на вставленную картинку, чтобы изменить её размер.
                </div>
                <form onSubmit={handleAddImage}>
                  <strong>Изображение</strong>
                  <input
                    value={imageUrlDraft}
                    onChange={event => setImageUrlDraft(event.target.value)}
                    placeholder="Ссылка на изображение"
                  />
                  <input
                    value={imageTitleDraft}
                    onChange={event => setImageTitleDraft(event.target.value)}
                    placeholder="Название"
                  />
                  <button type="submit">Вставить</button>
                </form>
                <form onSubmit={handleAddLink}>
                  <strong>Ссылка</strong>
                  <input
                    value={linkUrlDraft}
                    onChange={event => setLinkUrlDraft(event.target.value)}
                    placeholder="Адрес ссылки"
                  />
                  <input
                    value={linkTitleDraft}
                    onChange={event => setLinkTitleDraft(event.target.value)}
                    placeholder="Текст ссылки"
                  />
                  <button type="submit">Вставить</button>
                </form>
              </section>

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
        .journal-editor footer button,
        .journal-media-tools button {
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
        .journal-editor footer button:hover,
        .journal-media-tools button:hover {
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

        input {
          box-sizing: border-box;
          border: 1px solid rgba(151, 44, 44, 0.78);
          border-radius: 7px;
          background: rgba(12, 10, 10, 0.88);
          color: #fff8ef;
          padding: 0 13px;
          font: inherit;
          outline: none;
          min-height: 44px;
        }

        input:focus {
          border-color: #d6aa65;
          box-shadow: 0 0 0 3px rgba(214, 170, 101, 0.14);
        }

        .journal-layout {
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 16px;
          height: calc(100vh - 186px);
          min-height: 680px;
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
          min-height: 0;
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
          grid-template-rows: auto 1fr auto auto;
          gap: 0;
          min-height: 0;
          overflow: auto;
          padding: 14px;
          outline: 1px solid transparent;
          transition: border-color 160ms ease, outline-color 160ms ease, box-shadow 160ms ease;
        }

        .journal-editor.drag-over {
          border-color: #ff3131;
          outline-color: rgba(255, 49, 49, 0.34);
          box-shadow: 0 0 0 3px rgba(255, 49, 49, 0.12), 0 0 34px rgba(255, 49, 49, 0.18);
        }

        .journal-editor > input {
          color: #fff7ed;
          font-size: clamp(22px, 3vw, 34px);
          font-weight: 700;
          margin-bottom: 10px;
        }

        /* Rich text editor wrapper */
        .je-wrapper {
          min-height: 0;
          overflow: hidden;
          border: 1px solid rgba(151, 44, 44, 0.5);
          border-radius: 8px;
          background: rgba(10, 7, 8, 0.7);
          display: grid;
          margin-bottom: 10px;
        }

        .journal-editor footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding-top: 4px;
        }

        .journal-editor footer button.danger {
          color: #ffb8b8;
          border-color: #7d2626;
        }

        .journal-media-tools {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .journal-drop-hint {
          grid-column: 1 / -1;
          border: 1px dashed rgba(214, 170, 101, 0.44);
          border-radius: 7px;
          background: rgba(82, 12, 18, 0.18);
          color: #d8c3aa;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.45;
        }

        .journal-media-tools form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr) auto;
          gap: 8px;
          align-items: end;
          border: 1px solid rgba(151, 44, 44, 0.26);
          border-radius: 7px;
          background: rgba(18, 14, 13, 0.76);
          padding: 10px;
        }

        .journal-media-tools strong {
          grid-column: 1 / -1;
          color: #ffd89a;
          font-size: 14px;
        }

        .journal-media-tools input {
          min-width: 0;
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
            height: auto;
            min-height: 0;
          }

          .journal-media-tools {
            grid-template-columns: 1fr;
          }

          .journal-media-tools form {
            grid-template-columns: 1fr;
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
