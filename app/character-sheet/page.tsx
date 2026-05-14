'use client'

import { useEffect, useMemo, useState } from 'react'

export default function CharacterSheetPage() {
  const [room, setRoom] = useState('campaign-666')
  const [role, setRole] = useState<'master' | 'player'>('player')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextRoom = params.get('room') || window.localStorage.getItem('vtm-table-room') || 'campaign-666'
    const savedRole = window.localStorage.getItem('vtm-table-role')
    setRoom(nextRoom)
    if (savedRole === 'master' || savedRole === 'player') setRole(savedRole)
    window.localStorage.setItem('vtm-table-room', nextRoom)
  }, [])

  const tableHref = useMemo(() => `/table?room=${encodeURIComponent(room)}&role=${role}`, [room, role])
  const iframeSrc = useMemo(() => `/old-sheet.html?room=${encodeURIComponent(room)}`, [room])

  return (
    <>
      <style jsx global>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100vh !important;
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

      <a
        href={tableHref}
        onClick={() => {
          window.localStorage.setItem('vtm-table-room', room)
          window.localStorage.setItem('vtm-table-role', role)
        }}
        className="table-return-link"
        title="Вернуться на игровой стол"
      >
        На стол
      </a>

      <iframe
        src={iframeSrc}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          border: 'none',
          zIndex: 9999,
        }}
        title="VTM V5 Character Sheet"
      />

      <style jsx>{`
        .table-return-link {
          position: fixed;
          right: 18px;
          top: 18px;
          z-index: 10001;
          min-width: 92px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid #773030;
          border-radius: 6px;
          background: rgba(12,12,12,0.92);
          color: #fff;
          font-family: "Courier New", Courier, monospace;
          font-size: 14px;
          text-decoration: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        }

        .table-return-link:hover {
          background: #2a1111;
          border-color: #ff3131;
        }
      `}</style>
    </>
  )
}
