import type { Metadata } from 'next'

import { PageHeader } from '@/components/ui'

import { NewVerificationForm } from './new-verification-form'

export const metadata: Metadata = { title: 'New verification' }

export default function NewVerificationPage() {
  return (
    <>
      <PageHeader
        title="New verification"
        description="Enter your customer's details. We will create a secure link and QR code for them to verify their identity."
      />
      <NewVerificationForm />
    </>
  )
}
