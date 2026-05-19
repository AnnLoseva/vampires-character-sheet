import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VTM V5 — Character Sheet & Table',
  description: 'Вампиры: Маскарад V5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body>
        {children}
        <div id="global-music-engine" aria-hidden="true" style={{position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none'}} />
      </body>
    </html>
  )
}