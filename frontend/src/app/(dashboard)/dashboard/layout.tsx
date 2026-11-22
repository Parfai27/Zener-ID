import { Sidebar } from '@/components/sidebar'
import { api } from '@/lib/api'
import { initials } from '@/lib/format'
import type { Account } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await api<Account>('/v1/auth/me')
  const name = `${me.first_name} ${me.last_name}`

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-end gap-4 border-b border-line bg-white px-6">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-ink">{name}</p>
            <p className="text-xs text-ink-3">{me.email}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-mint-tint text-sm font-bold text-evergreen">
            {initials(name)}
          </span>
          <form action="/api/auth/logout" method="post">
            <button className="btn-secondary px-3 py-2 text-xs">Sign out</button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
