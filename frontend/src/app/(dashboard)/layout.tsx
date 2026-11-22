import type { Metadata } from 'next'
// Fonts are bundled from npm rather than fetched from Google at build time,
// so the build works offline and nothing is loaded from a third party.
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'

import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Zener ID — Company dashboard', template: '%s · Zener ID' },
  description: 'Create identity verifications for your customers and follow their results.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
