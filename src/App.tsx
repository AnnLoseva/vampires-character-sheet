import { useState } from 'react'
import './App.css'

function App() {
  const [page, setPage] = useState<'home' | 'sheet' | 'table'>('home')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {page === 'home' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-12">
            <h1 className="text-7xl font-bold text-red-600">🩸 VTM V5</h1>
            <p className="text-2xl text-gray-400">Вампиры: Маскарад — 5 редакция</p>

            <div className="space-y-6 max-w-md mx-auto">
              <button
                onClick={() => setPage('sheet')}
                className="block w-full py-6 bg-red-700 hover:bg-red-600 rounded-3xl text-2xl font-medium"
              >
                ✍️ Лист Персонажа
              </button>

              <button
                onClick={() => setPage('table')}
                className="block w-full py-6 bg-zinc-900 hover:bg-zinc-800 border border-red-800 rounded-3xl text-2xl font-medium"
              >
                🦇 Игровой Стол
              </button>
            </div>
          </div>
        </div>
      )}

      {page === 'sheet' && (
        <div className="fixed inset-0 bg-black z-50">
          <iframe 
            src="/sheet.html" 
            className="w-full h-full border-0"
          />
          <button 
            onClick={() => setPage('home')}
            className="fixed top-4 left-4 z-50 bg-red-900 hover:bg-red-800 px-6 py-3 rounded-xl"
          >
            ← На главную
          </button>
        </div>
      )}

      {page === 'table' && (
        <div className="fixed inset-0 z-50">
          {/* Сюда позже поставим tldraw */}
          <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center text-3xl">
            Игровой Стол (скоро будет tldraw)
          </div>
          <button 
            onClick={() => setPage('home')}
            className="fixed top-4 left-4 z-50 bg-red-900 hover:bg-red-800 px-6 py-3 rounded-xl"
          >
            ← На главную
          </button>
        </div>
      )}
    </div>
  )
}

export default App