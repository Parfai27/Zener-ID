'use client'

import dynamic from 'next/dynamic'

// Runs in the browser only: the mock backend keeps its data in localStorage.
const Screen = dynamic(() => import('@/console/pages/applicant/Flow').then((m) => m.ApplicantFlow), { ssr: false })

export default function Page() {
  return <Screen />
}
