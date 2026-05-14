'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'

type TableRole = 'master' | 'player'

const DEFAULT_ROOM = 'campaign-666'

function sanitizeRoom(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_.-]/g, '')
    .slice(0, 48)
}

export default function CharacterSheet() {
  const [roomDraft, setRoomDraft] = useState(DEFAULT_ROOM)
  const [role, setRole] = useState<TableRole>('player')
  const [cachedUsername, setCachedUsername] = useState('')

  useEffect(() => {
    const savedRoom = window.localStorage.getItem('vtm-table-room')
    const savedRole = window.localStorage.getItem('vtm-table-role')
    const savedUser = window.localStorage.getItem('vtm-chat-user') || window.localStorage.getItem('vtm-sheet-user')

    if (savedRoom) setRoomDraft(savedRoom)
    if (savedRole === 'master' || savedRole === 'player') setRole(savedRole)
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as { username?: string }
        if (user?.username) setCachedUsername(user.username)
      } catch {
        setCachedUsername('')
      }
    }
  }, [])

  const room = useMemo(() => sanitizeRoom(roomDraft) || DEFAULT_ROOM, [roomDraft])
  const tableHref = `/table?room=${encodeURIComponent(room)}&role=${role}`
  const sheetHref = `/character-sheet?room=${encodeURIComponent(room)}`

  const rememberTableChoice = (nextRole = role) => {
    window.localStorage.setItem('vtm-table-room', room)
    window.localStorage.setItem('vtm-table-role', nextRole)
  }

  const enterTable = (nextRole = role) => {
    rememberTableChoice(nextRole)
    window.location.href = `/table?room=${encodeURIComponent(room)}&role=${nextRole}`
  }

  const handleRoomSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    enterTable(role)
  }

  return (
    <main className="landing-shell">
      <section className="landing-hero" aria-label="Vampire table entrance">
        <div className="hero-copy">
          <p className="eyebrow">Vampire: The Masquerade V5</p>
          <h1>Войти в хронику</h1>
          <p>
            Открой стол как мастер или игрок, выбери комнату и держи листы персонажей рядом с игрой.
            Аккаунт запоминается после первого входа.
          </p>
          {cachedUsername ? <span className="session-pill">В кэше: {cachedUsername}</span> : <span className="session-pill muted">Аккаунт появится здесь после входа</span>}
        </div>

        <form className="entry-panel" onSubmit={handleRoomSubmit}>
          <label>
            <span>Комната</span>
            <input
              value={roomDraft}
              onChange={event => setRoomDraft(event.target.value)}
              placeholder="campaign-666"
              autoComplete="off"
            />
          </label>

          <div className="role-switch" aria-label="Роль на столе">
            <button
              type="button"
              className={role === 'master' ? 'active' : ''}
              onClick={() => setRole('master')}
            >
              Мастер
            </button>
            <button
              type="button"
              className={role === 'player' ? 'active' : ''}
              onClick={() => setRole('player')}
            >
              Игрок
            </button>
          </div>

          <button type="submit" className="primary-action">
            Зайти в комнату
          </button>

          <div className="quick-actions">
            <button type="button" onClick={() => enterTable('master')}>
              Сразу как мастер
            </button>
            <button type="button" onClick={() => enterTable('player')}>
              Сразу как игрок
            </button>
          </div>

          <Link href={sheetHref} onClick={() => rememberTableChoice(role)} className="sheet-link">
            Листы персонажей
          </Link>
        </form>
      </section>

      <section className="landing-bands" aria-label="Быстрые переходы">
        <Link href={tableHref} onClick={() => rememberTableChoice(role)}>
          <strong>Игровой стол</strong>
          <span>Сцена, музыка, чат, медиа и броски</span>
        </Link>
        <Link href={sheetHref} onClick={() => rememberTableChoice(role)}>
          <strong>Персонажи</strong>
          <span>Создание, редактирование и личный кабинет</span>
        </Link>
      </section>

      <style jsx>{`
        .landing-shell {
          min-height: 100vh;
          padding: 28px;
          color: #f4f1ed;
          background:
            linear-gradient(120deg, rgba(120, 14, 24, 0.34), transparent 34%),
            radial-gradient(circle at 76% 16%, rgba(164, 34, 42, 0.22), transparent 32%),
            #080808;
          font-family: "Courier New", Courier, monospace;
          display: grid;
          align-content: center;
          gap: 18px;
        }

        .landing-hero {
          width: min(1120px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.72fr);
          gap: 20px;
          align-items: stretch;
        }

        .hero-copy,
        .entry-panel,
        .landing-bands a {
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(10,10,10,0.78);
          box-shadow: 0 22px 70px rgba(0,0,0,0.34);
        }

        .hero-copy {
          min-height: 430px;
          padding: clamp(28px, 5vw, 58px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          background:
            linear-gradient(180deg, transparent, rgba(0,0,0,0.78)),
            url('/static/clan_gallery/toreador_full.png') center 18% / cover;
        }

        .eyebrow {
          margin: 0 0 14px;
          color: #ff6262;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(44px, 7vw, 88px);
          line-height: 0.95;
          letter-spacing: 0;
        }

        .hero-copy p:not(.eyebrow) {
          max-width: 590px;
          margin: 20px 0 0;
          color: #d5d0cc;
          font-size: 17px;
          line-height: 1.55;
        }

        .session-pill {
          width: fit-content;
          margin-top: 22px;
          padding: 8px 10px;
          border: 1px solid rgba(54, 214, 117, 0.42);
          border-radius: 6px;
          color: #dfffe9;
          background: rgba(20, 78, 42, 0.42);
          font-size: 13px;
        }

        .session-pill.muted {
          border-color: rgba(255,255,255,0.14);
          color: #aaa;
          background: rgba(0,0,0,0.5);
        }

        .entry-panel {
          padding: 22px;
          display: grid;
          gap: 14px;
          align-content: center;
        }

        label {
          display: grid;
          gap: 8px;
        }

        label span {
          color: #b9b1aa;
          font-size: 12px;
          text-transform: uppercase;
        }

        input {
          min-width: 0;
          height: 48px;
          border: 1px solid #3a3030;
          border-radius: 6px;
          background: #101010;
          color: #fff;
          padding: 0 13px;
          font: inherit;
          font-size: 16px;
        }

        .role-switch,
        .quick-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        button,
        .sheet-link,
        .landing-bands a {
          font: inherit;
          text-decoration: none;
        }

        .role-switch button,
        .quick-actions button,
        .sheet-link {
          min-height: 42px;
          border: 1px solid #332b2b;
          border-radius: 6px;
          background: #151515;
          color: #d9d9d9;
          cursor: pointer;
        }

        .role-switch button.active {
          border-color: #ff3131;
          background: #321112;
          color: #fff;
        }

        .primary-action {
          min-height: 54px;
          border: 0;
          border-radius: 6px;
          background: #c9212b;
          color: #fff;
          cursor: pointer;
          font-size: 17px;
          font-weight: 700;
        }

        .sheet-link {
          display: grid;
          place-items: center;
          color: #fff;
        }

        .landing-bands {
          width: min(1120px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .landing-bands a {
          min-height: 86px;
          border-radius: 8px;
          padding: 18px;
          display: grid;
          gap: 6px;
          color: #fff;
        }

        .landing-bands span {
          color: #a9a09a;
          font-size: 13px;
        }

        @media (max-width: 860px) {
          .landing-shell {
            padding: 14px;
            align-content: start;
          }

          .landing-hero,
          .landing-bands {
            grid-template-columns: 1fr;
          }

          .hero-copy {
            min-height: 360px;
          }
        }
      `}</style>
    </main>
  )
}
