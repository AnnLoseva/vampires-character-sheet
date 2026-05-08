'use client'

export default function OldCharacterSheet() {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0a0a0a] overflow-hidden">
      <iframe 
        src="/old-sheet.html" 
        className="w-full h-full border-0"
        title="VTM V5 Character Sheet"
        style={{
          margin: 0,
          padding: 0,
          width: '100vw',
          height: '100vh',
          display: 'block',
        }}
      />
    </div>
  )
}