// The dashboards' building blocks (client app and admin console), in the same
// design as the verification pages: white cards with a soft shadow, Paper (tint)
// fills, pill buttons, Manrope headings. Colours come from the theme in
// landing/landing.css: brand, brand-deep, tint, ink, body, muted, faint, line,
// mist, and the status shades ok, bad, warn with their -tint.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Search, X } from 'lucide-react'
import { subscribe } from '../api'
import type { VerificationStatus } from '../api/types'
import { initials, statusInfo } from '../lib/format'

/** Joins class names, skipping the empty ones. */
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

export type Tone = 'ok' | 'bad' | 'warn' | 'muted' | 'info'

/**
 * The official one-row Zener ID logo (public/brand). `dark` means "placed on a
 * dark background", so it uses the light logo. Brand rules: never stack, never
 * recolour, at least 80px wide.
 */
export function Logo({ dark = false, size = 'md' }: { dark?: boolean; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  // xs is the brand's minimum: 80 px wide (the logo is 517 × 79).
  const h = size === 'lg' ? 30 : size === 'sm' ? 16 : size === 'xs' ? 80 * 79 / 517 : 22
  return <img src={`/brand/zenerid-logo-${dark ? 'light' : 'dark'}.svg`} alt="Zener ID" height={h} style={{ height: h }} className="block w-auto flex-none self-start" />
}

// ---------------------------------------------------------------- buttons
// Pills, as on the verification pages: Deep Pine for the main action, an ink
// outline for the others.
const BTN_BASE = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors no-underline hover:no-underline disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:opacity-50'
const BTN_VARIANT = {
  primary: 'bg-brand-deep text-white hover:bg-brand-hover disabled:bg-mist disabled:text-faint',
  secondary: 'border border-ink/60 bg-white text-ink hover:bg-mist disabled:text-faint',
  ghost: 'text-body hover:bg-mist disabled:text-faint',
  danger: 'bg-bad text-white hover:bg-[#a51f1f] disabled:bg-mist disabled:text-faint',
}
const BTN_SIZE = { sm: 'h-8 px-3.5 text-[13px]', md: 'h-10 px-5 text-[15px]', lg: 'h-12 px-6 text-[15px]' }

export type ButtonVariant = keyof typeof BTN_VARIANT
export const buttonClass = (variant: ButtonVariant = 'secondary', size: keyof typeof BTN_SIZE = 'md', extra?: string) =>
  cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra)

export function Button({ variant = 'secondary', size = 'md', block, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof BTN_SIZE; block?: boolean }) {
  return <button type="button" {...rest} className={buttonClass(variant, size, cx(block && 'w-full', className))} />
}

// ---------------------------------------------------------------- page layout
export function PageHead({ title, sub, children, center }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cx('flex flex-wrap justify-between gap-4', center ? 'items-center' : 'items-end')}>
      <div className="min-w-0">
        <h1 className="text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Crumb({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-muted hover:text-brand"><ArrowLeft size={14} /> {children}</Link>
}

export function Card({ className, children, raised }: { className?: string; children: ReactNode; raised?: boolean }) {
  return <div className={cx('rounded-lg bg-white p-5 shadow-card sm:p-6', raised && 'sm:rounded-2xl', className)}>{children}</div>
}

export function CardHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base">{title}</h2>
      {children}
    </div>
  )
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note: ReactNode; tone?: Tone }) {
  return (
    <Card>
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="mt-1 font-display text-[28px] font-bold tracking-tight text-ink">{value}</div>
      <div className={cx('mt-0.5 text-xs font-semibold', tone ? TEXT[tone] : 'text-muted')}>{note}</div>
    </Card>
  )
}

// ---------------------------------------------------------------- status
const PILL: Record<Tone, string> = {
  ok: 'bg-ok-tint text-ok',
  bad: 'bg-bad-tint text-bad',
  warn: 'bg-warn-tint text-warn',
  muted: 'bg-mist text-muted',
  info: 'bg-mint-tint text-brand',
}
export const TEXT: Record<Tone, string> = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', muted: 'text-faint', info: 'text-brand' }

export function Pill({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold', PILL[tone])}>
      {dot && <i className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function StatusPill({ status }: { status: VerificationStatus }) {
  const s = statusInfo[status] ?? { label: status, tone: 'muted' as const }
  return <Pill tone={s.tone}>{s.label}</Pill>
}

export function CodeChip({ tone, children, className }: { tone?: 'bad' | 'warn'; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-block rounded-md px-2 py-[3px] font-mono text-[11.5px]', tone === 'bad' ? 'bg-bad-tint text-bad' : tone === 'warn' ? 'bg-warn-tint text-warn' : 'bg-mist text-body', className)}>
      {children}
    </span>
  )
}

// Notices, like the verification pages' boxes: a pale fill with a thin edge.
const BANNER: Record<Tone, string> = {
  bad: 'border-bad-fill/40 bg-bad-tint text-bad',
  ok: 'border-ok-fill/40 bg-ok-tint text-ok',
  warn: 'border-warn-fill/50 bg-warn-tint text-warn',
  info: 'border-line bg-tint text-body',
  muted: 'border-line bg-mist text-muted',
}
export function Banner({ tone, icon, title, children, action }: { tone: Tone; icon: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cx('flex items-start gap-3 rounded-2xl border p-4 text-sm', BANNER[tone])}>
      <span className="mt-px flex-none">{icon}</span>
      <div className="min-w-0 flex-1">
        {title && <b className="block font-semibold">{title}</b>}
        {children}
      </div>
      {action}
    </div>
  )
}

/** A bar with the score filled in and a tick where the threshold is. */
export function ScoreBar({ score, threshold, tone, className }: { score: number; threshold: number; tone: Tone; className?: string }) {
  const fill = tone === 'ok' ? 'bg-ok-fill' : tone === 'warn' ? 'bg-warn-fill' : 'bg-bad-fill'
  return (
    <div className={cx('relative mt-2 h-2 rounded-full bg-mist', className)}>
      <i className={cx('absolute inset-y-0 left-0 rounded-full', fill)} style={{ width: `${Math.min(1, Math.max(0, score)) * 100}%` }} />
      <b className="absolute -top-[5px] h-[18px] w-0.5 rounded-sm bg-ink" style={{ left: `${Math.min(1, threshold) * 100}%` }} title={`Threshold ${threshold}`} />
    </div>
  )
}

export function Avatar({ name, lg, className, children }: { name?: string; lg?: boolean; className?: string; children?: ReactNode }) {
  return (
    <span className={cx('grid flex-none place-items-center rounded-full bg-mint-tint font-bold text-brand', lg ? 'size-11 text-sm' : 'size-8 text-xs', className)}>
      {children ?? initials(name ?? '')}
    </span>
  )
}

export function Spinner({ sm, className }: { sm?: boolean; className?: string }) {
  return <span aria-label="Loading" className={cx('inline-block animate-spin rounded-full border-mist border-t-current', sm ? 'size-[18px] border-[3px]' : 'size-11 border-4', className)} />
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-3 p-12 text-muted"><Spinner sm className="text-brand" /> {label}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Banner tone="bad" icon={<AlertTriangle size={18} />} title="Something went wrong" action={onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}>
      {message}
    </Banner>
  )
}

// ---------------------------------------------------------------- forms
export const inputClass = 'h-11 w-full rounded-md border border-line bg-white px-3 text-ink outline-none transition-colors hover:border-brand focus:border-brand focus:ring-[3px] focus:ring-mint-tint aria-invalid:border-bad placeholder:text-faint'

export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-ink">{label}</label>
      {children}
      {error ? <span className="text-xs text-bad">{error}</span> : hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputClass, className)} />
}
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={cx(inputClass, 'pr-8', className)} />
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputClass, 'h-auto min-h-24 resize-y py-2.5', className)} />
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
      <input {...rest} className={cx(inputClass, 'rounded-full pl-10')} />
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <div className="text-xs text-bad">{children}</div>
}

/** A row of filter pills; the chosen one is filled, like a chosen document type. */
export function Chip({ active, count, onClick, children }: { active?: boolean; count?: number | string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('inline-flex h-8 items-center gap-1.5 rounded-full border-2 px-3 text-[13px] font-semibold transition-colors',
        active ? 'border-brand bg-brand text-white' : 'border-tint bg-tint text-ink hover:border-brand')}>
      {children}
      {count !== undefined && count !== '' && <span className={cx('font-medium', active ? 'text-white/75' : 'text-muted')}>{count}</span>}
    </button>
  )
}

export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: Array<[K, string]> }) {
  return (
    <div className="flex gap-6 border-b border-line">
      {items.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={cx('-mb-px border-b-2 pb-2.5 text-sm font-semibold transition-colors', value === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx('flex h-[22px] w-10 flex-none rounded-full p-0.5 transition-colors', on ? 'justify-end bg-brand' : 'justify-start bg-line')}>
      <span className="size-[18px] rounded-full bg-white shadow-disc" />
    </button>
  )
}

// ---------------------------------------------------------------- tables
export function Table({ head, children, bare }: { head?: ReactNode[]; children: ReactNode; bare?: boolean }) {
  const table = (
    <table className="w-full border-collapse text-sm">
      {head && (
        <thead>
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap border-b border-line bg-tint px-4 py-3 text-left text-xs font-semibold text-muted">{h}</th>)}</tr>
        </thead>
      )}
      <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>
    </table>
  )
  return bare ? table : <div className="overflow-x-auto rounded-lg bg-white shadow-card">{table}</div>
}

export function Tr({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return <tr onClick={onClick} className={cx(onClick && 'cursor-pointer hover:[&>td]:bg-tint')}>{children}</tr>
}

export function Td({ children, className, colSpan, muted, mono, right }: { children?: ReactNode; className?: string; colSpan?: number; muted?: boolean; mono?: boolean; right?: boolean }) {
  return (
    <td colSpan={colSpan} className={cx('border-b border-line px-4 py-3 align-middle transition-colors', muted && 'text-muted', mono && 'font-mono text-[12.5px]', right && 'text-right', className)}>
      {children}
    </td>
  )
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return <tr><td colSpan={cols} className="px-4 py-12 text-center text-faint">{children}</td></tr>
}

export function LoadingRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols}><Loading /></td></tr>
}

/** A label and its value, one per line, in a card. */
export function Kv({ k, v, mono, tone }: { k: ReactNode; v: ReactNode; mono?: boolean; tone?: Tone }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="text-muted">{k}</span>
      <span className={cx('text-right font-semibold text-ink', mono && 'font-mono text-[12.5px]', tone && TEXT[tone])}>{v}</span>
    </div>
  )
}

// ---------------------------------------------------------------- modal
// Like the verification pages' dialogs: a rounded white panel over a dim layer,
// with a round close button.
export function Modal({ open, onClose, children, width }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="zid-ui fixed inset-0 z-50 grid animate-fade place-items-center bg-ink/40 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className="relative max-h-full w-full max-w-[520px] animate-pop overflow-y-auto rounded-2xl bg-white px-6 py-5 shadow-lg" style={width ? { maxWidth: width } : undefined}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-muted hover:bg-mist"><X size={16} /></button>
        {children}
      </div>
    </div>
  )
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
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5">
        {items.map(t => (
          <div key={t.id} className="flex max-w-[380px] animate-pop items-center gap-2.5 rounded-full bg-tooltip py-2.5 pl-4 pr-3 text-sm font-medium text-white shadow-lg">
            {t.tone === 'ok' ? <CheckCircle2 size={18} className="flex-none text-lit" /> : <AlertTriangle size={18} className="flex-none text-[#ff8a8a]" />}
            <span className="flex-1">{t.text}</span>
            <X size={16} className="flex-none cursor-pointer opacity-70" onClick={() => setItems(x => x.filter(i => i.id !== t.id))} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------------------------------------------------------------- data hook
/** Runs an async loader, and runs it again when deps change or something it shows was changed here. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const loadRef = useRef(load)
  loadRef.current = load
  const run = useCallback((quiet = false) => {
    if (!quiet) setState(s => ({ ...s, loading: true, error: undefined }))
    loadRef.current().then(
      data => setState({ data, loading: false }),
      (e: Error) => setState(s => ({ ...s, error: e.message, loading: false })),
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
