import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-family-sans',
})

export const metadata: Metadata = {
  title: 'Capta+ - Gestão de Editais',
  description: 'Gestão inteligente de editais e captação de recursos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

