'use client'

export default function CharacterSheetPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600 mb-8">🩸 ЛИСТ ПЕРСОНАЖА</h1>
        <p className="text-3xl text-gray-400">Страница успешно открылась!</p>
        
        <div className="mt-12">
          <button 
            onClick={() => window.history.back()}
            className="px-8 py-4 bg-red-700 hover:bg-red-600 rounded-2xl text-xl"
          >
            ← Вернуться назад
          </button>
        </div>
      </div>
    </div>
  )
}

  