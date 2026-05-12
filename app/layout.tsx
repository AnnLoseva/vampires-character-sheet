import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
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
        <SpeedInsights />
      </body>
    </html>
  )
}