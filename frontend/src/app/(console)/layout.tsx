import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import '@/console/styles.css'
import '@/console/shufti.css'

import type { Metadata } from 'next'

import { ToastProvider } from '@/console/components/ui'

// The admin console and the applicant flow, ported from the old Vite frontend.
// They still run on its in-browser mock (src/console/api/mock.ts) and keep their
// own stylesheet, so they have a root layout of their own.
export const metadata: Metadata = {
  title: { default: 'Zener ID', template: '%s · Zener ID' },
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
