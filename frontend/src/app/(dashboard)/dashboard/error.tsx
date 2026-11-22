'use client'

import { ErrorPanel } from '@/components/ui'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <ErrorPanel message={error.message || 'The page could not be loaded.'} />
      <button type="button" onClick={reset} className="btn-secondary">
        Try again
      </button>
    </div>
  )
}
