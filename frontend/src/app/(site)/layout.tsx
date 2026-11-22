import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import '@/landing/landing.css'

import type { Metadata } from 'next'

import { SITE } from '@/landing/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Zener ID: identity verification and AML screening',
  description:
    'Identity verification and AML screening: ID documents, liveness, deepfake checks, proof of address and sanctions screening in one flow.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  manifest: '/site.webmanifest',
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
