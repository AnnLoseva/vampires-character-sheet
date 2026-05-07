'use client'

export default function OldSheet() {
  return (
    <div className="h-screen w-screen">
      <iframe 
        src="/old-sheet.html" 
        className="w-full h-full border-0"
        title="Character Sheet"
      />
    </div>
  )
}