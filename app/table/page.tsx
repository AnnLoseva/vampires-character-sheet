'use client'

import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

function TableContent() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get('room') || 'campaign-666'
  const supabase = createClient()
  const [editor, setEditor] = useState<any>(null)

  useEffect(() => {
    if (!editor) return

    const channel = supabase.channel(`table:${roomId}`)

    // Получаем обновления от других игроков
    channel
      .on('broadcast', { event: 'canvas-update' }, ({ payload }) => {
        if (payload?.update && editor) {
          editor.store.mergeRemoteChanges(() => {
            editor.store.applyChanges(payload.update)
          })
        }
      })
      .subscribe()

    // Отправляем свои изменения
    const unsubscribe = editor.store.listen(
      (changes: any) => {                    // ← Добавили : any
        channel.send({
          type: 'broadcast',
          event: 'canvas-update',
          payload: { update: changes }
        })
      },
      { source: 'user' }
    )

    return () => {
      channel.unsubscribe()
      unsubscribe()
    }
  }, [editor, roomId, supabase])

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] overflow-hidden relative">
      {/* Верхняя панель */}
      <div className="absolute top-4 left-4 z-50 bg-black/90 border border-red-900 px-6 py-3 rounded-2xl flex items-center gap-6 shadow-2xl">
        <h1 className="text-3xl font-bold text-red-500">🦇 Вампирский Игровой Стол</h1>
        <div className="text-sm text-gray-400">
          Комната: <span className="font-mono text-red-400 bg-black px-2 py-0.5 rounded">{roomId}</span>
        </div>
        <a 
          href="/" 
          className="ml-4 px-5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-red-900 rounded-xl text-sm"
        >
          ← На главную
        </a>
      </div>

      <Tldraw
        persistenceKey={roomId}
        onMount={setEditor}
      />
    </div>
  )
}

export default function VampireTable() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center text-red-500 text-2xl">
        Загрузка стола...
      </div>
    }>
      <TableContent />
    </Suspense>
  )
}