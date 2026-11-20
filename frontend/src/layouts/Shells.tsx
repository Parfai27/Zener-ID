import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Building2, FileCheck2, Inbox, KeyRound, LayoutGrid, ListChecks, LogOut, Plus, Settings2, ShieldCheck } from 'lucide-react'
import { currentSession, logout, reviewQueue } from '../api'
import { Avatar, Logo, useData } from '../components/ui'

function NavItem({ to, icon, children, end, count, not }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean; count?: number; not?: string }) {
  const { pathname } = useLocation()
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive && pathname !== not ? ' active' : ''}`}>
      {icon}
      <span>{children}</span>
      {!!count && <span className="count">{count}</span>}
    </NavLink>
  )
}

export function RequireClient() {
  const loc = useLocation()
  if (!currentSession('client')) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  return <Outlet />
}

export function RequireStaff() {
  const loc = useLocation()
  if (!currentSession('staff')) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

export function ClientShell() {
  const s = currentSession('client')!
  const nav = useNavigate()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><Logo /></div>
        <div className="nav-label">WORKSPACE</div>
        <NavItem to="/app" end icon={<LayoutGrid size={18} />}>Dashboard</NavItem>
        <NavItem to="/app/verifications" not="/app/verifications/new" icon={<ListChecks size={18} />}>Verifications</NavItem>
        <NavItem to="/app/verifications/new" icon={<Plus size={18} />}>New verification</NavItem>
        <div className="nav-label">DEVELOPERS</div>
        <NavItem to="/app/api-keys" icon={<KeyRound size={18} />}>API keys</NavItem>
        <NavItem to="/app/settings" icon={<Settings2 size={18} />}>Settings</NavItem>
        <div className="foot">
          <div className="banner info" style={{ flexDirection: 'column', gap: 4 }}>
            <b style={{ fontSize: 13 }}>Mock mode</b>
            <span className="small">Data is stored in this browser only. Nothing reaches the backend yet.</span>
          </div>
          <div className="account">
            <Avatar name={s.name} />
            <div className="grow">
              <div style={{ fontWeight: 650, fontSize: 13 }}>{s.name}</div>
              <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</div>
            </div>
            <button className="btn btn-ghost btn-sm" title="Sign out" onClick={() => { logout('client'); nav('/login') }}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

export function AdminShell() {
  const s = currentSession('staff')!
  const nav = useNavigate()
  const q = useData(() => reviewQueue(), [])
  return (
    <div className="shell">
      <aside className="sidebar dark">
        <div className="brand"><Logo dark /></div>
        <div style={{ padding: '0 10px 14px' }}><span className="pill plain" style={{ background: 'var(--sidebar-2)', color: 'var(--sidebar-text)', fontSize: 10.5, letterSpacing: '.08em' }}>ADMIN CONSOLE</span></div>
        <NavItem to="/admin" end icon={<BarChart3 size={18} />}>Overview</NavItem>
        <NavItem to="/admin/review" icon={<Inbox size={18} />} count={q.data?.length}>Review queue</NavItem>
        <NavItem to="/admin/verifications" icon={<FileCheck2 size={18} />}>Verifications</NavItem>
        <NavItem to="/admin/clients" icon={<Building2 size={18} />}>Clients</NavItem>
        <div className="foot">
          <div className="account">
            <Avatar name={s.name} />
            <div className="grow">
              <div style={{ fontWeight: 650, fontSize: 13 }}>{s.name}</div>
              <div className="small" style={{ color: 'var(--sidebar-text)' }}>Senior reviewer</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--sidebar-text)' }} title="Sign out" onClick={() => { logout('staff'); nav('/admin/login') }}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

export function AuthSplit({ title, children, dark }: { title: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <div className="auth">
      <div className={`auth-side${dark ? ' ink' : ''}`}>
        <div className="brand-bars" aria-hidden><i /><i /></div>
        <Logo dark size="lg" />
        <div style={{ flex: 1 }} />
        <h1>{title}</h1>
        <div className="col" style={{ gap: 10, position: 'relative', zIndex: 1 }}>
          {(dark
            ? ['Review queue with full evidence', 'Every decision logged with a note', 'Restricted to staff accounts']
            : ['Document OCR with MRZ check digits', 'Liveness and 1:1 face match', 'Decision with reasons in seconds']
          ).map(t => (
            <div key={t} className="row" style={{ gap: 10, color: '#d4e3dd' }}><ShieldCheck size={18} color="#2fe0a8" />{t}</div>
          ))}
        </div>
        <div className="small" style={{ color: '#8fa8a0', position: 'relative', zIndex: 1, marginTop: 28 }}>© 2026 Zener ID · Mock build, no backend connected</div>
      </div>
      <div className="auth-form"><div className="box">{children}</div></div>
    </div>
  )
}
