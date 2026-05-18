import type { Dispatch, SetStateAction } from 'react'
import type { ChatUser, JournalEntry, RightRailTab } from '@/lib/table/types'

type JournalPanelProps = {
  rightRailTab: RightRailTab
  journalEntries: JournalEntry[]
  journalSaveStatus: string
  chatUser: ChatUser | null
  journalSearch: string
  filteredJournalEntries: JournalEntry[]
  selectedJournalEntry: JournalEntry | null | undefined
  setJournalSearch: Dispatch<SetStateAction<string>>
  createJournalEntry: () => void
  setSelectedJournalEntryId: Dispatch<SetStateAction<string>>
  updateJournalEntry: (patch: Partial<Pick<JournalEntry, 'title' | 'text'>>) => void
  persistCurrentJournal: () => void
  deleteJournalEntry: () => void
}

export default function JournalPanel({
  rightRailTab,
  journalEntries,
  journalSaveStatus,
  chatUser,
  journalSearch,
  filteredJournalEntries,
  selectedJournalEntry,
  setJournalSearch,
  createJournalEntry,
  setSelectedJournalEntryId,
  updateJournalEntry,
  persistCurrentJournal,
  deleteJournalEntry,
}: JournalPanelProps) {
  return (
    <section className={`diary-sidebar table-right-panel ${rightRailTab === 'diary' ? '' : 'table-right-panel-hidden'}`} aria-label="Дневник игрока">
      <header>
        <div>
          <span>Дневник</span>
          <strong>{journalEntries.length}</strong>
        </div>
        <div>
          <span>Статус</span>
          <strong>{journalSaveStatus}</strong>
        </div>
      </header>
      {!chatUser ? (
        <p className="panel-empty">Войдите в аккаунт, чтобы вести личный дневник комнаты.</p>
      ) : (
        <div className="diary-layout">
          <aside className="diary-list">
            <input value={journalSearch} onChange={event => setJournalSearch(event.target.value)} placeholder="Поиск в дневнике" />
            <button type="button" onClick={createJournalEntry}>Новая запись</button>
            <div>
              {filteredJournalEntries.length === 0 ? (
                <p className="panel-empty">Записей не найдено.</p>
              ) : filteredJournalEntries.map(entry => (
                <button
                  type="button"
                  className={entry.id === selectedJournalEntry?.id ? 'active' : ''}
                  key={entry.id}
                  onClick={() => setSelectedJournalEntryId(entry.id)}
                >
                  <strong>{entry.title || 'Без названия'}</strong>
                  <span>{new Date(entry.updatedAt).toLocaleString('ru-RU')}</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="diary-editor">
            {selectedJournalEntry ? (
              <>
                <input
                  value={selectedJournalEntry.title}
                  onChange={event => updateJournalEntry({ title: event.target.value })}
                  placeholder="Заголовок"
                />
                <textarea
                  value={selectedJournalEntry.text}
                  onChange={event => updateJournalEntry({ text: event.target.value })}
                  placeholder="Текст записи"
                />
                <footer>
                  <span>Обновлено: {new Date(selectedJournalEntry.updatedAt).toLocaleString('ru-RU')}</span>
                  <button type="button" onClick={persistCurrentJournal}>Сохранить</button>
                  <button type="button" className="danger" onClick={deleteJournalEntry}>Удалить</button>
                </footer>
              </>
            ) : (
              <p className="panel-empty">Создайте первую запись.</p>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
