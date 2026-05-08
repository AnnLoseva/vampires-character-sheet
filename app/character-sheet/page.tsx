'use client'

export default function CharacterSheetPage() {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0a0a0a] overflow-hidden z-50">
      <iframe 
        src="/sheet.html" 
        className="w-full h-full border-0"
        style={{
          margin: 0,
          padding: 0,
          width: '100vw',
          height: '100vh',
          display: 'block'
        }}
        title="VTM V5 Character Sheet"
      />
    </div>
  )
}