'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function CharacterSheet() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setLoading(false)
    }
    getUser()
  }, [supabase])

  const loginWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const goToOldSheet = () => {
    window.open('/old-sheet.html', '_blank')
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-3xl">Загрузка...</div>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-red-900 bg-black/90 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 py-6 flex justify-between items-center">
          <h1 className="text-5xl font-bold text-red-600 tracking-wider">🩸 VTM V5</h1>
          
          <div className="flex items-center gap-4">
            <a href="/table?room=campaign-666"
               className="px-8 py-3 bg-zinc-900 hover:bg-red-950 border border-red-800 rounded-2xl text-lg font-medium transition">
              🦇 Игровой Стол
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pt-20 pb-16 px-6 text-center">
        <div className="mb-16">
          <h2 className="text-6xl font-bold mb-4">Добро пожаловать в Маскарад</h2>
          <p className="text-xl text-gray-400">Ваш личный кабинет</p>
        </div>

        <div className="space-y-6 max-w-md mx-auto">
          {/* Кнопка Личного кабинета */}
          <button 
            onClick={() => alert('Личный кабинет (список персонажей) — скоро будет здесь')}
            className="w-full py-6 bg-zinc-900 hover:bg-zinc-800 border border-red-900 rounded-3xl text-2xl font-medium transition flex items-center justify-center gap-4"
          >
            📋 Мои сохранённые персонажи
          </button>

          {/* Переход на старый sheet */}
          <button 
            onClick={goToOldSheet}
            className="w-full py-6 bg-red-700 hover:bg-red-600 rounded-3xl text-2xl font-medium transition flex items-center justify-center gap-4"
          >
            ✍️ Создать / Редактировать персонажа
          </button>

          {/* Игровой стол */}
          <a 
            href="/table?room=campaign-666"
            className="block w-full py-6 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 rounded-3xl text-2xl font-medium transition"
          >
            🦇 Открыть Игровой Стол
          </a>
        </div>

        <div className="mt-16 text-gray-500">
          {user ? (
            <p>Вошли как <span className="text-red-400">{user.email}</span></p>
          ) : (
            <button 
              onClick={loginWithGoogle}
              className="text-red-400 hover:text-red-300 underline"
            >
              🔑 Войти через Google для сохранения персонажей
            </button>
          )}
        </div>
      </main>
    </div>
  )
}