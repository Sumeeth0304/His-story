import type { Metadata } from 'next'
import { EB_Garamond } from 'next/font/google'
import './globals.css'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-eb-garamond',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The Story of the Bible',
  description:
    'Explore the entire Bible as an interactive network of stories — from Creation to Revelation. Click any story to read a summary and ask questions powered by AI.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={ebGaramond.variable}>
      <body className="antialiased" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
        {children}
      </body>
    </html>
  )
}
