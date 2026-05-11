'use client'

import { useEffect, useMemo, useState } from 'react'

type Die = {
  value: number
  kind: 'fail' | 'success' | 'critical' | 'botch'
}

type RollMessage = {
  id: string
  room: string
  characterName: string
  poolName: string
  poolType: string
  diceCount: number
  dice: Die[]
  successes: number
  createdAt: string
}

const STORAGE_PREFIX = 'vtm-table-rolls:'
const CHANNEL_NAME = 'vtm-table-rolls'

function getRoomFromLocation() {
  if (typeof window === 'undefined') return 'campaign-666'
  return new URLSearchParams(window.location.search).get('room') || 'campaign-666'
}

function getStorageKey(room: string) {
  return `${STORAGE_PREFIX}${room}`
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function loadHistory(room: string): RollMessage[] {
  try {
    const raw = window.localStorage.getItem(getStorageKey(room))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(room: string, rolls: RollMessage[]) {
  window.localStorage.setItem(getStorageKey(room), JSON.stringify(rolls.slice(0, 80)))
}

function mergeRoll(rolls: RollMessage[], roll: RollMessage) {
  if (rolls.some(item => item.id === roll.id)) return rolls
  return [roll, ...rolls].slice(0, 80)
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [rolls, setRolls] = useState<RollMessage[]>([])

  useEffect(() => {
    const currentRoom = getRoomFromLocation()
    setRoom(currentRoom)
    setRolls(loadHistory(currentRoom))

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null

    const receiveRoll = (roll: RollMessage) => {
      if (!roll || roll.room !== currentRoom) return
      setRolls(prev => {
        const next = mergeRoll(prev, roll)
        saveHistory(currentRoom, next)
        return next
      })
    }

    if (channel) {
      channel.onmessage = event => receiveRoll(event.data)
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === getStorageKey(currentRoom)) {
        setRolls(loadHistory(currentRoom))
        return
      }

      if (event.key === 'vtm-table-last-roll' && event.newValue) {
        try {
          receiveRoll(JSON.parse(event.newValue))
        } catch {
          // Ignore malformed external events.
        }
      }
    }

    window.addEventListener('storage', onStorage)

    return () => {
      channel?.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const latest = rolls[0]
  const totalDice = useMemo(() => rolls.reduce((sum, roll) => sum + roll.diceCount, 0), [rolls])

  const clearHistory = () => {
    if (!window.confirm('Очистить историю бросков этого стола?')) return
    setRolls([])
    saveHistory(room, [])
  }

  return (
    <main className="table-page-shell">
      <section className="table-topbar">
        <div>
          <p className="table-kicker">Игровой стол</p>
          <h1>Стол: {room}</h1>
        </div>
        <div className="table-actions">
          <a href="/old" title="Открыть лист персонажа">Лист</a>
          <button type="button" onClick={clearHistory} disabled={rolls.length === 0}>
            Очистить
          </button>
        </div>
      </section>

      <section className="table-layout">
        <aside className="table-status">
          <div>
            <span>Бросков</span>
            <strong>{rolls.length}</strong>
          </div>
          <div>
            <span>Кубиков</span>
            <strong>{totalDice}</strong>
          </div>
          <div>
            <span>Последний результат</span>
            <strong>{latest ? latest.successes : 0}</strong>
          </div>
        </aside>

        <section className="table-chat" aria-label="История бросков">
          {rolls.length === 0 ? (
            <div className="table-empty">
              <h2>История бросков пока пуста</h2>
              <p>Зафиксируй лист персонажа, нажми на навык или специальность и брось к10.</p>
            </div>
          ) : (
            rolls.map(roll => (
              <article className="roll-card" key={roll.id}>
                <header>
                  <div>
                    <strong>{roll.characterName}</strong>
                    <span>{roll.poolName}</span>
                  </div>
                  <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
                </header>

                <div className="dice-row" aria-label={`Результаты кубиков: ${roll.dice.map(die => die.value).join(', ')}`}>
                  {roll.dice.map((die, index) => (
                    <span className={`die die-${die.kind}`} key={`${roll.id}-${index}`}>
                      {die.value}
                    </span>
                  ))}
                </div>

                <footer>
                  <span>{roll.diceCount}к10</span>
                  <strong>Успехов: {roll.successes}</strong>
                </footer>
              </article>
            ))
          )}
        </section>
      </section>

      <style jsx global>{`
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-height: 100vh !important;
          background: #090909 !important;
          color: #f4f4f4 !important;
          display: block !important;
          overflow-x: hidden !important;
        }
      `}</style>
      <style jsx>{`
        .table-page-shell {
          min-height: 100vh;
          padding: 28px;
          font-family: "Courier New", Courier, monospace;
          background:
            linear-gradient(180deg, rgba(120, 0, 0, 0.18), rgba(0, 0, 0, 0) 260px),
            #090909;
        }

        .table-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          max-width: 1240px;
          margin: 0 auto 24px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 18px;
        }

        .table-kicker {
          margin: 0 0 6px;
          color: #ff3131;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          font-size: clamp(30px, 5vw, 56px);
          letter-spacing: 0;
        }

        .table-actions {
          display: flex;
          gap: 10px;
        }

        .table-actions a,
        .table-actions button {
          border: 1px solid #773030;
          background: #141414;
          color: #f5f5f5;
          border-radius: 6px;
          padding: 11px 15px;
          font: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .table-actions button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .table-layout {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 18px;
          max-width: 1240px;
          margin: 0 auto;
          align-items: start;
        }

        .table-status {
          display: grid;
          gap: 10px;
          position: sticky;
          top: 22px;
        }

        .table-status div {
          border: 1px solid #2b2b2b;
          background: #111;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .table-status span {
          color: #9c9c9c;
          font-size: 13px;
        }

        .table-status strong {
          color: #36d675;
          font-size: 26px;
        }

        .table-chat {
          min-height: 68vh;
          border: 1px solid #2b2b2b;
          background: #0f0f0f;
          border-radius: 8px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .table-empty {
          min-height: 50vh;
          display: grid;
          place-content: center;
          text-align: center;
          color: #aaa;
          padding: 24px;
        }

        .table-empty h2 {
          margin: 0 0 10px;
          color: #fff;
          text-transform: none;
          letter-spacing: 0;
          border: 0;
          padding: 0;
        }

        .table-empty p {
          margin: 0;
          max-width: 520px;
        }

        .roll-card {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 16px;
        }

        .roll-card header,
        .roll-card footer {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }

        .roll-card header strong {
          display: block;
          font-size: 18px;
        }

        .roll-card header span,
        .roll-card time,
        .roll-card footer span {
          color: #aaa;
          font-size: 13px;
        }

        .dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 15px 0;
        }

        .die {
          width: 42px;
          height: 42px;
          border-radius: 7px;
          border: 1px solid #555;
          display: inline-grid;
          place-items: center;
          font-weight: 700;
          font-size: 18px;
          background: #090909;
          color: #f3f3f3;
        }

        .die-success,
        .die-critical {
          color: #101810;
          background: #36d675;
          border-color: #6df0a0;
          box-shadow: 0 0 16px rgba(54, 214, 117, 0.22);
        }

        .die-critical {
          outline: 2px solid #f2ff7a;
        }

        .die-botch {
          border-color: #f3f3f3;
          color: #fff;
        }

        .roll-card footer strong {
          color: #36d675;
          font-size: 20px;
        }

        @media (max-width: 820px) {
          .table-page-shell {
            padding: 18px 12px;
          }

          .table-topbar,
          .table-layout {
            grid-template-columns: 1fr;
          }

          .table-topbar {
            display: grid;
          }

          .table-status {
            position: static;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .table-status div {
            display: grid;
            gap: 6px;
          }
        }
      `}</style>
    </main>
  )
}
