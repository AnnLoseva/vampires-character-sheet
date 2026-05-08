'use client'

export default function OldCharacterSheet() {
  return (
    <>
      <style jsx global>{`
        html, body, #__next, div {
          margin: 0 !important;
          padding: 0 !important;
          height: 100vh !important;
          width: 100vw !important;
          overflow: hidden !important;
          background: #0a0a0a !important;
        }
        
        iframe {
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Красный скроллбар */
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #111;
        }
        ::-webkit-scrollbar-thumb {
          background: #991b1b;
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ff3131;
        }
      `}</style>

      <iframe 
        src="/old-sheet.html" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          border: 'none',
          zIndex: 9999,
        }}
        title="VTM V5 Character Sheet"
      />
    </>
  )
}