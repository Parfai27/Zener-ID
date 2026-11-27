import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Building2, FileCheck2, Inbox, KeyRound, LayoutGrid, ListChecks, LogOut, Menu, Plus, Settings2, X } from 'lucide-react'
import { currentSession, logout, reviewQueue, verifySession } from '../api'
import { Avatar, Logo, cx, useData } from '../components/ui'

// The token is checked with the backend when the area opens; if it no longer
// works (expired, signed out elsewhere, account suspended) the person signs in again.
function useGuard(role: 'client' | 'staff') {
  const loc = useLocation()
  const nav = useNavigate()
  const signedIn = !!currentSession(role)
  useEffect(() => {
    if (!signedIn) return
    verifySession(role).then(ok => { if (!ok) nav(`/login?expired=1&next=${encodeURIComponent(loc.pathname)}`, { replace: true }) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn])
  return signedIn ? <Outlet /> : <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
}
export const RequireClient = () => useGuard('client')
export const RequireStaff = () => useGuard('staff')

// ---------------------------------------------------------------- shared shell
// The same design as the verification pages: a Paper (tint) sidebar like their
// header, the current page as a white disc-shadowed pill like the current step,
// and the content on white.
function NavItem({ to, icon, children, end, count, not }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean; count?: number; not?: string }) {
  const { pathname } = useLocation()
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx(
      'flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium no-underline transition-colors hover:no-underline',
      isActive && pathname !== not ? 'bg-white font-semibold text-brand shadow-disc' : 'text-body hover:bg-white/70',
    )}>
      {icon}
      <span>{children}</span>
      {!!count && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{count}</span>}
    </NavLink>
  )
}

const NavLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-3 pb-1.5 pt-3 text-[11px] font-semibold tracking-wider text-faint">{children}</div>
)

function Shell({ top, nav, account }: { top?: ReactNode; nav: ReactNode; account: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <div className="zid-ui flex min-h-screen text-sm">
      {/* Phone and tablet: a top bar with a menu button; the sidebar slides in. */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-tint px-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-9 place-items-center rounded-full text-ink hover:bg-white/70"><Menu size={20} /></button>
        <div><Logo /></div>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx(
        'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-none flex-col gap-1 bg-tint px-3 py-5 max-lg:transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-start justify-between px-3 pb-5 pt-2">
          <Logo />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="-mr-1 -mt-1 grid size-7 place-items-center rounded-full text-muted hover:bg-white/70 lg:hidden"><X size={16} /></button>
        </div>
        {top}
        {nav}
        <div className="mt-auto">{account}</div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-12 pt-[76px] sm:px-6 lg:px-10 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}

function Account({ name, sub, onSignOut }: { name: string; sub: string; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white p-2 shadow-disc">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">{name}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      <button type="button" title="Sign out" aria-label="Sign out" onClick={onSignOut}
        className="grid size-8 place-items-center rounded-full text-muted hover:bg-mist hover:text-ink">
        <LogOut size={16} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- the two areas
export function ClientShell() {
  const s = currentSession('client')!
  const nav = useNavigate()
  const item = (props: Parameters<typeof NavItem>[0]) => <NavItem {...props} />
  return (
    <Shell
     
      nav={<>
        <NavLabel>WORKSPACE</NavLabel>
        {item({ to: '/app', end: true, icon: <LayoutGrid size={18} />, children: 'Dashboard' })}
        {item({ to: '/app/verifications', not: '/app/verifications/new', icon: <ListChecks size={18} />, children: 'Verifications' })}
        {item({ to: '/app/verifications/new', icon: <Plus size={18} />, children: 'New verification' })}
        <NavLabel>DEVELOPERS</NavLabel>
        {item({ to: '/app/api-keys', icon: <KeyRound size={18} />, children: 'API keys' })}
        {item({ to: '/app/settings', icon: <Settings2 size={18} />, children: 'Settings' })}
      </>}
      account={<Account name={s.name} sub={s.email} onSignOut={() => { logout('client'); nav('/login') }} />}
    />
  )
}

export function AdminShell() {
  const s = currentSession('staff')!
  const nav = useNavigate()
  const q = useData(() => reviewQueue(), [])
  const item = (props: Parameters<typeof NavItem>[0]) => <NavItem {...props} />
  const role = s.staff_role ? s.staff_role[0].toUpperCase() + s.staff_role.slice(1) : s.email
  return (
    <Shell
     
      top={<div className="px-2.5 pb-3.5"><span className="inline-flex h-6 items-center rounded-full bg-brand-deep px-2.5 text-[10.5px] font-semibold tracking-[.08em] text-white">ADMIN CONSOLE</span></div>}
      nav={<>
        {item({ to: '/admin', end: true, icon: <BarChart3 size={18} />, children: 'Overview' })}
        {item({ to: '/admin/review', icon: <Inbox size={18} />, count: q.data?.length, children: 'Review queue' })}
        {item({ to: '/admin/verifications', icon: <FileCheck2 size={18} />, children: 'Verifications' })}
        {item({ to: '/admin/clients', icon: <Building2 size={18} />, children: 'Clients' })}
      </>}
      account={<Account name={s.name} sub={role} onSignOut={() => { logout('staff'); nav('/login') }} />}
    />
  )
}
