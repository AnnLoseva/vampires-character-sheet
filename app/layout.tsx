import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { GlobalMusicEngineMount } from '@/modules/music/components/GlobalMusicEngineMount'
import { Analytics } from '@vercel/analytics/next'

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
      <head>
        {/* ранний preconnect: все данные и портреты идут с Supabase */}
        <link rel="preconnect" href="https://klhxbaagarqxaqnrvurr.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://klhxbaagarqxaqnrvurr.supabase.co" />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <GlobalMusicEngineMount />
        <Analytics />
      </body>
    </html>
  )
}
