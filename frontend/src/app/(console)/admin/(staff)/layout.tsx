'use client'

import dynamic from 'next/dynamic'

// The staff session lives in this browser (mock), so the shell renders there only.
const Shell = dynamic(
  () =>
    import('@/console/layouts/Shells').then(({ AdminShell, RequireStaff }) => {
      function StaffShell({ children }: { children: React.ReactNode }) {
        return (
          <RequireStaff>
            <AdminShell>{children}</AdminShell>
          </RequireStaff>
        )
      }
      return StaffShell
    }),
  { ssr: false },
)

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>
}
