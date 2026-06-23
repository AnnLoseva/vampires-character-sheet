'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function CharacterSheetPage() {
  const { t } = useLang()
  const [room, setRoom] = useState('campaign-666')
  const [role, setRole] = useState<'master' | 'player'>('player')
  const [characterId, setCharacterId] = useState('')
  const [isNewCharacter, setIsNewCharacter] = useState(false)
  const [newCharacterSession, setNewCharacterSession] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextRoom = params.get('room') || window.localStorage.getItem('vtm-table-room') || 'campaign-666'
    const requestedRole = params.get('role')
    const savedRole = window.localStorage.getItem('vtm-table-role')
    const nextIsNewCharacter = params.get('new') === '1'
    setRoom(nextRoom)
    setCharacterId(nextIsNewCharacter ? '' : params.get('characterId') || '')
    setIsNewCharacter(nextIsNewCharacter)
    if (requestedRole === 'master' || requestedRole === 'player') setRole(requestedRole)
    else if (savedRole === 'master' || savedRole === 'player') setRole(savedRole)
    window.localStorage.setItem('vtm-table-room', nextRoom)
    setIsReady(true)
  }, [])

  useEffect(() => {
    const handleCharacterSaved = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'vtm-character-saved' || typeof event.data.characterId !== 'string') return

      const savedCharacterId = event.data.characterId
      setCharacterId(savedCharacterId)
      setIsNewCharacter(false)

      const params = new URLSearchParams(window.location.search)
      params.delete('new')
      params.set('characterId', savedCharacterId)
      window.history.replaceState(null, '', `/character-sheet?${params.toString()}`)
    }

    window.addEventListener('message', handleCharacterSaved)
    return () => window.removeEventListener('message', handleCharacterSaved)
  }, [])

  const tableHref = useMemo(() => `/table?room=${encodeURIComponent(room)}&role=${role}`, [room, role])
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ room, role })
    if (characterId) params.set('characterId', characterId)
    if (isNewCharacter) params.set('new', '1')
    return `/old-sheet.html?${params.toString()}`
  }, [room, role, characterId, isNewCharacter])

  const startNewCharacter = () => {
    window.localStorage.removeItem('vtm-character-creation-draft-v2')
    setCharacterId('')
    setIsNewCharacter(true)
    setNewCharacterSession(current => current + 1)
    const params = new URLSearchParams({ room, role, new: '1' })
    window.history.pushState(null, '', `/character-sheet?${params.toString()}`)
  }

  return (
    <>
      <style jsx global>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100vh !important;
          height: 100dvh !important;
          width: 100vw !important;
          overflow: hidden !important;
          background: #0a0a0a !important;
        }

        iframe {
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #111;
        }
        ::-webkit-scrollbar-thumb {
          background: #991b1b;
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ff3131;
        }
      `}</style>

      <nav className="sheet-nav-links" aria-label={t('Навигация листа персонажа')}>
        <a href="/" title={t('На главную')}>{t('На главную')}</a>
        <button type="button" onClick={startNewCharacter}>
          {t('Создать нового персонажа')}
        </button>
        <a
          href={tableHref}
          onClick={() => {
            window.localStorage.setItem('vtm-table-room', room)
            window.localStorage.setItem('vtm-table-role', role)
          }}
          title={t('В игровую комнату')}
        >
          {t('В игровую комнату')}
        </a>
      </nav>

      {isReady ? (
        <iframe
          key={`${characterId || 'new'}-${newCharacterSession}`}
          src={iframeSrc}
          className="sheet-iframe"
          title="VTM V5 Character Sheet"
        />
      ) : null}

      <style jsx>{`
        .sheet-nav-links {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 2;
          min-height: 64px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          padding: 12px 18px;
          box-sizing: border-box;
          border-bottom: 1px solid #2d2d2d;
          background: #0a0a0a;
        }

        .sheet-nav-links a,
        .sheet-nav-links button {
          min-width: 92px;
          min-height: 38px;
          display: inline-grid;
          place-items: center;
          border: 1px solid #773030;
          border-radius: 6px;
          background: rgba(12,12,12,0.92);
          color: #fff;
          font-family: "Courier New", Courier, monospace;
          font-size: 14px;
          text-decoration: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          cursor: pointer;
        }

        .sheet-nav-links a:hover,
        .sheet-nav-links button:hover {
          background: #2a1111;
          border-color: #ff3131;
        }

        .sheet-iframe {
          position: fixed;
          top: 64px;
          left: 0;
          width: 100vw;
          height: calc(100vh - 64px);
          height: calc(100dvh - 64px);
          border: none;
          z-index: 1;
        }
      `}</style>
    </>
  )
}
