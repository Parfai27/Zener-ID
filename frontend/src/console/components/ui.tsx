'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { subscribe } from '../api'
import type { VerificationStatus } from '../api/types'
import { fakeQr } from '../lib/art'
import { initials, statusInfo } from '../lib/format'

/**
 * The official one-row Zener ID logo (public/brand). `dark` means "placed on a
 * dark background", so it uses the light logo. Brand rules: never stack, never
 * recolour, at least 80px wide — the smallest size here is 16px tall ≈ 105px wide.
 */
export function Logo({ dark = false, size = 'md' }: { dark?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 30 : size === 'sm' ? 16 : 22
  return <img src={`/brand/zenerid-logo-${dark ? 'light' : 'dark'}.svg`} alt="Zener ID" height={h} style={{ height: h, width: 'auto', display: 'block', alignSelf: 'flex-start', flex: 'none' }} />
}

/** The mark alone (20:13), for tight spaces such as avatars and app tiles. */
export function BrandIcon({ dark = false, height = 13 }: { dark?: boolean; height?: number }) {
  return <img src={`/brand/zenerid-icon-${dark ? 'light' : 'dark'}.svg`} alt="" aria-hidden height={height} style={{ height, width: 'auto', display: 'block' }} />
}

export function StatusPill({ status }: { status: VerificationStatus }) {
  const s = statusInfo[status]
  return <span className={`pill ${s.tone}`}>{s.label}</span>
}

export function Pill({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'muted' | 'info'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export function Avatar({ name, lg }: { name: string; lg?: boolean }) {
  return <span className={`avatar${lg ? ' lg' : ''}`}>{initials(name)}</span>
}

export function Spinner({ sm }: { sm?: boolean }) {
  return <span className={`spinner${sm ? ' sm' : ''}`} aria-label="Loading" />
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="row" style={{ justifyContent: 'center', padding: 48, color: 'var(--ink-3)' }}>
      <Spinner sm /> {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner bad">
      <AlertTriangle size={18} />
      <div className="grow">
        <b>Something went wrong</b>
        {message}
      </div>
      {onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Modal({ open, onClose, children, width }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal style={width ? { maxWidth: width } : undefined}>{children}</div>
    </div>
  )
}

export function Qr({ value, size = 150 }: { value: string; size?: number }) {
  const svg = useMemo(() => fakeQr(value), [value])
  return <span className="qr" style={{ width: size + 18 }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', `<svg width="${size}" height="${size}" `) }} title="Mock QR code (not scannable until the backend is connected)" />
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; text: string; tone: 'ok' | 'bad' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, text, tone }])
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map(t => (
          <div key={t.id} className="toast">
            {t.tone === 'ok' ? <CheckCircle2 size={18} color="#3ddc97" /> : <AlertTriangle size={18} color="#ff8a8a" />}
            <span className="grow">{t.text}</span>
            <X size={16} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setItems(x => x.filter(i => i.id !== t.id))} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------------------------------------------------------------- data hook
/** Runs an async loader, re-runs when deps change and when the mock store changes. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const loadRef = useRef(load)
  loadRef.current = load
  const run = useCallback((quiet = false) => {
    if (!quiet) setState(s => ({ ...s, loading: true, error: undefined }))
    loadRef.current().then(
      data => setState({ data, loading: false }),
      (e: Error) => setState({ error: e.message, loading: false }),
    )
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, deps)
  useEffect(() => subscribe(() => run(true)), [run])
  return { ...state, reload: () => run() }
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text).catch(() => undefined)
}
