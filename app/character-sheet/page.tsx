'use client'

export default function CharacterSheetPage() {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0a0a0a] overflow-hidden">
      <iframe 
        src="/sheet.html" 
        className="w-full h-full border-0"
        title="VTM V5 Character Sheet"
      />
    </div>
  )
}
  