'use client'

import { Tldraw } from 'tldraw'
import { useSearchParams } from 'next/navigation'

export default function VampireTable() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get('room') || 'default-campaign-666'

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] overflow-hidden relative">
      {/* Верхняя панель */}
      <div className="absolute top-4 left-4 z-50 bg-black/90 border border-red-900 px-6 py-3 rounded-xl flex items-center gap-4 shadow-2xl">
        <h1 className="text-3xl text-red-500 font-bold flex items-center gap-3">
          🦇 Вампирский Стол
        </h1>
        <div className="text-sm text-gray-400">
          Комната: <span className="font-mono text-red-400">{roomId}</span>
        </div>
      </div>

      <Tldraw
        persistenceKey={roomId}
        onMount={(editor) => {
          console.log(`🦇 Игровой стол запущен — комната: ${roomId}`)
        }}
      />
    </div>
  )
}