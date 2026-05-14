'use client'

import Link from 'next/link'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'

type TableRole = 'master' | 'player'
type Accent = 'gold' | 'red' | 'cyan'

const DEFAULT_ROOM = 'campaign-666'

const particles = Array.from({ length: 36 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  top: `${(index * 53) % 100}%`,
  delay: `${(index % 9) * 0.7}s`,
  duration: `${7 + (index % 6)}s`,
  size: `${2 + (index % 3)}px`,
}))

const statusItems = [
  {
    label: 'Active Chronicles',
    value: '3',
    detail: 'Красная заря · Elysium · Сентябрь',
  },
  {
    label: 'Online Players',
    value: '17',
    detail: 'синхронизация комнат включена',
  },
  {
    label: 'Latest Characters',
    value: '42',
    detail: 'последние листы сохранены',
  },
  {
    label: 'System Version',
    value: 'V5',
    detail: 'companion system v1.2.3',
  },
]

function sanitizeRoom(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_.-]/g, '')
    .slice(0, 48)
}

function Sigil({ children }: { children: ReactNode }) {
  return (
    <span className="sigil" aria-hidden="true">
      {children}
    </span>
  )
}

function EntryCard({
  accent,
  title,
  description,
  button,
  children,
}: {
  accent: Accent
  title: string
  description: string
  button: ReactNode
  children: ReactNode
}) {
  return (
    <motion.article
      className={`elysium-card ${accent}`}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.015 }}
    >
      <div className="card-corners" aria-hidden="true" />
      {children}
      <h2>{title}</h2>
      <p>{description}</p>
      {button}
    </motion.article>
  )
}

function StatusPanel() {
  return (
    <motion.section
      className="status-panel"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.8 }}
      aria-label="System status"
    >
      {statusItems.map(item => (
        <div className="status-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </motion.section>
  )
}

export default function CharacterSheet() {
  const [roomDraft, setRoomDraft] = useState(DEFAULT_ROOM)
  const [role, setRole] = useState<TableRole>('player')
  const [cachedUsername, setCachedUsername] = useState('')
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothX = useSpring(mouseX, { stiffness: 45, damping: 22 })
  const smoothY = useSpring(mouseY, { stiffness: 45, damping: 22 })
  const backgroundX = useTransform(smoothX, [-1, 1], [-16, 16])
  const backgroundY = useTransform(smoothY, [-1, 1], [-12, 12])

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
    <main
      className="salon-shell"
      onMouseMove={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        mouseX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2)
        mouseY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2)
      }}
    >
      <motion.div className="salon-background" style={{ x: backgroundX, y: backgroundY }} aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="dust-field" aria-hidden="true">
        {particles.map(particle => (
          <span
            key={particle.id}
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <header className="salon-nav" aria-label="Companion system header">
        <Link href="/" className="crest" aria-label="VTM home">
          VTM
        </Link>
        <span>Welcome, Kindred</span>
        <small>{cachedUsername ? `Session: ${cachedUsername}` : 'Private archive access'}</small>
      </header>

      <section className="hero-content" aria-label="Vampire companion system">
        <motion.div
          className="title-block"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="pretitle">Elysium Digital Archive</p>
          <h1>
            <span>VAMPIRE</span>
            <span>THE MASQUERADE</span>
            <span>COMPANION SYSTEM</span>
          </h1>
          <div className="divider" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <blockquote>&quot;We are all monsters pretending to be human.&quot;</blockquote>
        </motion.div>

        <section className="card-grid" aria-label="Main entrances">
          <EntryCard
            accent="gold"
            title="Архив личности"
            description="Войдите в систему и получите доступ к персонажам, хроникам и сохранённым данным."
            button={
              <Link href={sheetHref} onClick={() => rememberTableChoice(role)} className="card-action">
                Войти в аккаунт
              </Link>
            }
          >
            <Sigil>◉</Sigil>
          </EntryCard>

          <EntryCard
            accent="red"
            title="Хроника"
            description="Подключитесь к игровой комнате, синхронизируйте листы и играйте в реальном времени."
            button={
              <form onSubmit={handleRoomSubmit} className="chronicle-form">
                <div className="room-line">
                  <input
                    value={roomDraft}
                    onChange={event => setRoomDraft(event.target.value)}
                    placeholder="Название комнаты"
                    autoComplete="off"
                  />
                  <select
                    value={role}
                    onChange={event => setRole(event.target.value as TableRole)}
                    aria-label="Роль"
                  >
                    <option value="player">Игрок</option>
                    <option value="master">Мастер</option>
                  </select>
                </div>
                <button type="submit" className="card-action">
                  Войти в игру
                </button>
              </form>
            }
          >
            <Sigil>♕</Sigil>
          </EntryCard>

          <EntryCard
            accent="cyan"
            title="Редактор персонажей"
            description="Создавайте, изменяйте и храните персонажей V5 с интерактивными системами и подсказками."
            button={
              <Link href={sheetHref} onClick={() => rememberTableChoice(role)} className="card-action">
                Открыть редактор
              </Link>
            }
          >
            <Sigil>✦</Sigil>
          </EntryCard>
        </section>

        <StatusPanel />
      </section>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

        .salon-shell {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          color: #eee8df;
          background: #030303;
          font-family: Inter, system-ui, sans-serif;
          isolation: isolate;
        }

        .salon-background {
          position: absolute;
          inset: -28px;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.74)),
            linear-gradient(90deg, rgba(0,0,0,0.9), transparent 30%, transparent 70%, rgba(0,0,0,0.9)),
            url('/static/clan_gallery/nosferatu_full.png') left 47% / 30% auto no-repeat,
            url('/static/clan_gallery/ventrue_full.png') right 42% / 30% auto no-repeat,
            radial-gradient(circle at 50% 18%, rgba(197, 156, 87, 0.16), transparent 24%),
            linear-gradient(180deg, #090706, #020202 82%);
          filter: saturate(0.76) contrast(1.16);
          transform: scale(1.05);
          z-index: -4;
        }

        .salon-background::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, transparent 0 18%, rgba(80, 18, 22, 0.22) 19%, transparent 21% 78%, rgba(12, 64, 70, 0.16) 80%, transparent 82%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 7vw);
          opacity: 0.72;
        }

        .vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 26%, transparent 0 28%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.92) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.4), transparent 18%, rgba(0,0,0,0.82));
          z-index: -2;
        }

        .dust-field {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .dust-field span {
          position: absolute;
          border-radius: 999px;
          background: rgba(238, 215, 174, 0.7);
          box-shadow: 0 0 18px rgba(238, 215, 174, 0.35);
          animation: drift linear infinite;
          opacity: 0;
        }

        .salon-nav {
          position: fixed;
          inset: 18px 24px auto;
          z-index: 3;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 16px;
          color: rgba(238, 232, 223, 0.68);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 12px;
        }

        .crest {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(201, 160, 92, 0.42);
          color: #d6b06c;
          font-family: Cinzel, Georgia, serif;
          text-decoration: none;
          transform: rotate(45deg);
          background: rgba(0,0,0,0.36);
          backdrop-filter: blur(14px);
        }

        .crest::first-letter {
          transform: rotate(-45deg);
        }

        .crest {
          font-size: 12px;
        }

        .hero-content {
          min-height: 100vh;
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 112px 0 28px;
          display: grid;
          align-content: center;
          gap: clamp(18px, 3vh, 28px);
        }

        .title-block {
          text-align: center;
          display: grid;
          justify-items: center;
        }

        .pretitle {
          margin: 0 0 12px;
          color: rgba(214, 176, 108, 0.72);
          font-size: 12px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          display: grid;
          gap: 4px;
          font-family: Cinzel, Georgia, serif;
          font-weight: 500;
          line-height: 0.95;
          letter-spacing: 0.08em;
          text-shadow: 0 10px 38px rgba(0,0,0,0.9);
        }

        h1 span:first-child {
          font-size: clamp(54px, 9vw, 116px);
          color: #e8dfd3;
        }

        h1 span:nth-child(2) {
          font-size: clamp(20px, 3.1vw, 38px);
          color: #ded3c4;
        }

        h1 span:last-child {
          font-size: clamp(16px, 2.1vw, 28px);
          color: #d22f38;
          letter-spacing: 0.26em;
        }

        .divider {
          width: min(520px, 70vw);
          margin: 24px 0 20px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          color: #b52730;
        }

        .divider span {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(181, 39, 48, 0.72));
        }

        .divider span:last-child {
          background: linear-gradient(90deg, rgba(181, 39, 48, 0.72), transparent);
        }

        .divider i {
          width: 15px;
          height: 15px;
          border: 1px solid currentColor;
          transform: rotate(45deg);
        }

        blockquote {
          margin: 0;
          color: rgba(232, 223, 211, 0.78);
          font-family: Cinzel, Georgia, serif;
          font-size: clamp(16px, 2vw, 22px);
          font-style: italic;
        }

        .card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .elysium-card {
          position: relative;
          min-height: 330px;
          padding: 28px;
          display: grid;
          align-content: end;
          justify-items: center;
          gap: 18px;
          text-align: center;
          border: 1px solid color-mix(in srgb, var(--accent) 54%, transparent);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015)),
            radial-gradient(circle at 50% 22%, color-mix(in srgb, var(--accent) 19%, transparent), transparent 42%),
            rgba(4, 4, 5, 0.62);
          box-shadow: 0 18px 72px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.03);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        .elysium-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent 34% 66%, color-mix(in srgb, var(--accent) 15%, transparent));
          opacity: 0;
          transition: opacity 260ms ease;
        }

        .elysium-card:hover::before {
          opacity: 1;
        }

        .elysium-card.gold {
          --accent: #d7ae68;
        }

        .elysium-card.red {
          --accent: #d6313a;
        }

        .elysium-card.cyan {
          --accent: #8bd5d7;
        }

        .card-corners {
          position: absolute;
          inset: 8px;
          border-top: 1px solid color-mix(in srgb, var(--accent) 44%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
          pointer-events: none;
        }

        .sigil {
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--accent) 54%, transparent);
          border-radius: 999px;
          color: var(--accent);
          font-family: Cinzel, Georgia, serif;
          font-size: 28px;
          box-shadow: 0 0 36px color-mix(in srgb, var(--accent) 20%, transparent);
        }

        .elysium-card h2 {
          margin: 0;
          color: var(--accent);
          font-family: Cinzel, Georgia, serif;
          font-size: clamp(20px, 2vw, 27px);
          font-weight: 500;
          letter-spacing: 0.06em;
        }

        .elysium-card p {
          min-height: 66px;
          margin: 0;
          color: rgba(232, 223, 211, 0.72);
          line-height: 1.55;
          font-size: 14px;
        }

        .card-action {
          position: relative;
          z-index: 1;
          min-width: 190px;
          min-height: 42px;
          border: 1px solid color-mix(in srgb, var(--accent) 58%, transparent);
          border-radius: 4px;
          background: rgba(0,0,0,0.28);
          color: #f7f2e8;
          display: inline-grid;
          place-items: center;
          padding: 0 18px;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 12px;
          transition: background 220ms ease, box-shadow 220ms ease;
          cursor: pointer;
        }

        .card-action:hover {
          background: color-mix(in srgb, var(--accent) 18%, rgba(0,0,0,0.4));
          box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 18%, transparent);
        }

        .chronicle-form {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 10px;
          width: 100%;
          justify-items: center;
        }

        .room-line {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 96px;
          gap: 8px;
          width: 100%;
        }

        input,
        select {
          min-width: 0;
          height: 38px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          background: rgba(0,0,0,0.32);
          color: #eee8df;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
        }

        select {
          color: #f3d2d2;
        }

        .status-panel {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(5,5,6,0.58);
          backdrop-filter: blur(18px);
          box-shadow: 0 18px 52px rgba(0,0,0,0.32);
        }

        .status-item {
          min-height: 112px;
          padding: 20px;
          display: grid;
          align-content: center;
          gap: 7px;
          border-right: 1px solid rgba(255,255,255,0.1);
        }

        .status-item:last-child {
          border-right: 0;
        }

        .status-item span {
          color: rgba(232, 223, 211, 0.52);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 11px;
        }

        .status-item strong {
          color: #d7ae68;
          font-family: Cinzel, Georgia, serif;
          font-size: 30px;
          font-weight: 400;
        }

        .status-item small {
          color: rgba(232, 223, 211, 0.64);
          line-height: 1.35;
        }

        @keyframes drift {
          0% {
            transform: translate3d(0, 26px, 0);
            opacity: 0;
          }
          18%,
          76% {
            opacity: 0.75;
          }
          100% {
            transform: translate3d(18px, -60px, 0);
            opacity: 0;
          }
        }

        @media (max-width: 980px) {
          .salon-nav {
            position: absolute;
          }

          .hero-content {
            align-content: start;
            padding-top: 106px;
          }

          .card-grid,
          .status-panel {
            grid-template-columns: 1fr;
          }

          .status-item {
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .status-item:last-child {
            border-bottom: 0;
          }
        }

        @media (max-width: 620px) {
          .salon-nav {
            inset: 14px;
            grid-template-columns: auto 1fr;
          }

          .salon-nav small {
            grid-column: 2;
          }

          .hero-content {
            width: min(100% - 20px, 1180px);
            padding-top: 112px;
          }

          .elysium-card {
            min-height: 300px;
            padding: 22px;
          }

          .room-line {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
