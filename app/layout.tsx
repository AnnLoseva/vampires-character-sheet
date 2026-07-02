import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { GlobalMusicEngineMount } from '@/modules/music/components/GlobalMusicEngineMount'

export const metadata: Metadata = {
  title: 'VTM V5 — Character Sheet & Table',
  description: 'Вампиры: Маскарад V5',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <GlobalMusicEngineMount />
      </body>
    </html>
  )
}
