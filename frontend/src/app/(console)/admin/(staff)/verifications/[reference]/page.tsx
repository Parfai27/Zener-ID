'use client'

import dynamic from 'next/dynamic'

// Runs in the browser only: the mock backend keeps its data in localStorage.
const Screen = dynamic(() => import('@/console/pages/admin/StaffVerificationDetail').then((m) => m.VerificationDetail), { ssr: false })

export default function Page() {
  return <Screen scope="staff" />
}
