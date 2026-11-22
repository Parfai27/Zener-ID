import { KeyRound, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'

import { Badge, EmptyState, PageHeader } from '@/components/ui'
import { api } from '@/lib/api'
import { dateOnly, dateTime, timeAgo, type Tone } from '@/lib/format'
import { BACKEND_URL } from '@/lib/session'
import type { ApiKeyList, ApiKeyState } from '@/lib/types'

import { CreateKeyButton, KeyActions } from './key-actions'

export const metadata: Metadata = { title: 'API keys' }

const STATE: Record<ApiKeyState, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'ok' },
  expiring: { label: 'Expiring soon', tone: 'warn' },
  suspended: { label: 'Suspended', tone: 'warn' },
  expired: { label: 'Expired', tone: 'muted' },
  revoked: { label: 'Revoked', tone: 'muted' },
}

export default async function ApiKeysPage() {
  const keys = await api<ApiKeyList>('/v1/api-keys', { page_size: 100 })

  return (
    <>
      <PageHeader
        title="API keys"
        description="Create and read verifications from your own application instead of this dashboard."
        action={<CreateKeyButton />}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl bg-info-tint px-5 py-4 text-sm text-info">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          A new key is shown <b>once</b>. Only a hash of it is stored, so it can never be shown again. Revoke a key
          straight away if it leaks.
        </p>
      </div>

      <section className="card">
        {keys.items.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="size-5" />}
            title="No API keys yet"
            body="Create a key when you want your own servers to open verifications through the API."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-4">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Key</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 font-medium">Last used</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {keys.items.map((k) => {
                  const state = STATE[k.state] ?? { label: k.state, tone: 'muted' as Tone }
                  return (
                    <tr key={k.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5 font-semibold text-ink">{k.name}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{k.prefix}••••••••</td>
                      <td className="px-5 py-3.5 text-ink-3">{dateTime(k.created_at)}</td>
                      <td className="px-5 py-3.5 text-ink-3">{dateOnly(k.expires_at)}</td>
                      <td className="px-5 py-3.5 text-ink-3">{k.last_used_at ? timeAgo(k.last_used_at) : 'Never'}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <KeyActions id={k.id} name={k.name} prefix={k.prefix} revoked={k.state === 'revoked'} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-4">Base URL</p>
          <p className="mt-1 font-mono text-sm text-ink">{BACKEND_URL}/v1</p>
          <p className="mt-2 text-xs text-ink-3">
            Send the key in the <span className="font-mono">X-API-Key</span> header, e.g.{' '}
            <span className="font-mono">POST /v1/verifications</span>.
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-4">Documentation</p>
          <p className="mt-1 text-sm font-semibold text-ink">OpenAPI reference and examples</p>
          <p className="mt-2 text-xs text-ink-3">
            Served by the backend at <span className="font-mono">{BACKEND_URL}/docs</span>.
          </p>
        </div>
      </div>
    </>
  )
}
