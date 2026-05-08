'use client'

import Link from 'next/link'

export default function CharacterSheet() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="text-center space-y-16">
        <div>
          <h1 className="text-7xl font-bold text-red-600 tracking-widest mb-4">🩸 VTM V5</h1>
          <p className="text-2xl text-gray-400">Вампиры: Маскарад — 5 редакция</p>
        </div>

        <div className="space-y-6 max-w-md mx-auto">
          <Link
            href="/old"
            className="block w-full py-6 bg-red-700 hover:bg-red-600 rounded-3xl text-2xl font-medium transition-all active:scale-95"
          >
            ✍️ Создать / Редактировать персонажа
          </Link>

          <Link
            href="/table?room=campaign-666"
            className="block w-full py-6 bg-zinc-900 hover:bg-zinc-800 border border-red-800 rounded-3xl text-2xl font-medium transition-all active:scale-95"
          >
            🦇 Открыть Игровой Стол
          </Link>
        </div>
      </div>
    </div>
  )
}