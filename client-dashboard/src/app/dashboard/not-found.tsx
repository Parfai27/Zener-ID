import { FileSearch } from 'lucide-react'

import { EmptyState } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={<FileSearch className="size-5" />}
        title="Verification not found"
        body="There is no verification with that reference on your account."
        action={{ href: '/dashboard/verifications', label: 'Back to all verifications' }}
      />
    </div>
  )
}
