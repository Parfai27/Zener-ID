import 'server-only'

import { notFound } from 'next/navigation'

import { ApiError, api } from './api'
import { decodeParam } from './format'
import type { VerificationDetail } from './types'

/** One of this company's verifications, by the [reference] route param; 404 if it is not theirs. */
export async function getVerification(referenceParam: string): Promise<VerificationDetail> {
  try {
    return await api<VerificationDetail>(`/v1/verifications/${encodeURIComponent(decodeParam(referenceParam))}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }
}
