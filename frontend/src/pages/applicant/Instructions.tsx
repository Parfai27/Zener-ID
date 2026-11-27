// The instructions, as a sheet that lifts over the screen they are about.
//
// Shown when a capture opens and again from the info button, because the few
// things that ruin a capture are worth saying before somebody has taken three
// bad ones. The camera stays visible above the sheet, dimmed, so the person can
// see what they are about to do while they read.
import type { ReactNode } from 'react'
import { CardLayer } from './Shell'
import { CloseGlyph, Cross, InfoGlyph, Tick } from './glyphs'
import { useT } from './i18n'

export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const t = useT()
  return (
    <CardLayer>
      <div aria-hidden className="absolute inset-0 z-30 bg-ink/35" onClick={onClose} />
      <div role="dialog" aria-modal aria-label={label}
        className="absolute inset-x-0 bottom-0 z-30 max-h-[calc(100%-5rem)] animate-lift overflow-y-auto rounded-t-[28px] bg-white px-5 pb-8 pt-6 shadow-sheet sm:px-8">
        <button onClick={onClose} aria-label={t('close')} className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-faint hover:bg-mist hover:text-ink">
          <CloseGlyph />
        </button>
        <h2 className="text-center text-lg font-semibold">{label}</h2>
        {children}
      </div>
    </CardLayer>
  )
}

const Good = () => (
  <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-white ring-2 ring-white"><Tick size={12} width={2.4} /></span>
)
const Bad = () => (
  <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-bad-fill text-white ring-2 ring-white"><Cross size={10} width={2.6} /></span>
)

/** A glow behind the good example, the way the eye is drawn to it. */
function Halo({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid place-items-center">
      <span aria-hidden className="absolute size-28 rounded-full bg-citrus-tint" />
      <span aria-hidden className="absolute -right-3 -top-1 size-5 rounded-full bg-citrus/85" />
      <span aria-hidden className="absolute -bottom-1 -left-3 size-4 rounded-full bg-citrus/70" />
      <div className="relative">{children}</div>
    </div>
  )
}

/* --------------------------------------------------------------- document */

type CardKind = 'plain' | 'glare' | 'expired' | 'blur' | 'distant'

function IdCard({ kind = 'plain', large = false }: { kind?: CardKind; large?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[4px] border border-line bg-white shadow-sm ${large ? 'h-[74px] w-[118px]' : 'h-11 w-[70px]'} ${kind === 'blur' ? 'blur-[1.2px]' : ''} ${kind === 'distant' ? 'scale-[0.55]' : ''}`}>
      <div className={`w-full bg-[#4b5566] ${large ? 'h-3.5' : 'h-2'}`} />
      <div className={`flex ${large ? 'gap-2 p-1.5' : 'gap-1 p-1'}`}>
        <div className={`rounded-[2px] bg-[#c9a78a] ${large ? 'h-9 w-7' : 'h-5 w-4'}`} />
        <div className="flex-1 space-y-1 pt-0.5">
          <div className="h-0.5 w-full rounded bg-[#a9b3c2]" />
          <div className="h-0.5 w-3/4 rounded bg-brand/70" />
          <div className="h-0.5 w-full rounded bg-[#a9b3c2]" />
          <div className="h-0.5 w-2/3 rounded bg-bad-fill/70" />
        </div>
      </div>
      {kind === 'glare' && <div className="absolute inset-0 bg-linear-to-br from-white via-white/30 to-transparent" />}
      {kind === 'expired' && <div className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded-sm bg-bad-fill px-1 text-[6px] font-bold text-white">EXPIRED</div>}
    </div>
  )
}

export function DocumentInstructions({ onClose }: { onClose: () => void }) {
  const t = useT()
  const avoid: Array<{ kind: CardKind; label: string }> = [
    { kind: 'glare', label: t('docTip2') },
    { kind: 'expired', label: t('docTipExpired') },
    { kind: 'blur', label: t('docTipBlur') },
    { kind: 'distant', label: t('docTipDistant') },
  ]
  return (
    <Sheet label={t('instructionsTitle')} onClose={onClose}>
      <figure className="mt-5 flex flex-col items-center">
        <Halo><div className="relative"><IdCard large /><Good /></div></Halo>
        <figcaption className="mt-5 text-center text-sm text-muted">{t('docTip1')}</figcaption>
      </figure>
      <ul className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4">
        {avoid.map(item => (
          <li key={item.kind} className="flex flex-col items-center gap-2.5">
            <div className="relative grid h-12 place-items-center"><div className="relative"><IdCard kind={item.kind} /><Bad /></div></div>
            <span className="text-center text-xs text-muted">{item.label}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

/* ------------------------------------------------------------------- face */

function Face({ kind = 'plain', size = 64 }: { kind?: 'plain' | 'lighting' | 'accessories'; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="block rounded-full">
      <circle cx="32" cy="32" r="32" fill="#eef8c8" />
      <path d="M12 64c1.5-11 9.5-17 20-17s18.5 6 20 17z" fill="#8a6a57" />
      <ellipse cx="32" cy="30" rx="12" ry="14.5" fill="#7a513a" />
      <path d="M19.5 25c0-9 5.5-14 12.5-14s12.5 5 12.5 14c-2-4.5-6.5-6.5-12.5-6.5S21.5 20.5 19.5 25z" fill="#1f1a17" />
      <circle cx="27.2" cy="30.5" r="1.3" fill="#1f1a17" />
      <circle cx="36.8" cy="30.5" r="1.3" fill="#1f1a17" />
      <path d="M28.5 37.5c2.2 1.4 4.8 1.4 7 0" fill="none" stroke="#3a261b" strokeWidth="1.2" strokeLinecap="round" />
      {kind === 'lighting' && <circle cx="30" cy="27" r="13" fill="white" opacity="0.72" />}
      {kind === 'accessories' && (
        <g fill="none" stroke="#111" strokeWidth="1.8">
          <circle cx="27" cy="30.5" r="4.2" /><circle cx="37" cy="30.5" r="4.2" />
          <path d="M31.2 30.5h1.6M22.8 30l-3-1M41.2 30l3-1" />
        </g>
      )}
    </svg>
  )
}

export function FaceInstructions({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <Sheet label={t('instructionsTitle')} onClose={onClose}>
      <figure className="mt-5 flex flex-col items-center">
        <div className="relative rounded-full p-1.5 ring-8 ring-citrus-tint"><Face size={72} /><Good /></div>
        <figcaption className="mt-3 text-center text-sm text-muted">{t('faceTip1')}</figcaption>
      </figure>
      <ul className="mt-6 grid grid-cols-2 gap-4">
        {([['lighting', t('faceTip2')], ['accessories', t('faceTip3')]] as const).map(([kind, label]) => (
          <li key={kind} className="flex flex-col items-center gap-2">
            <div className="relative rounded-full p-1 ring-4 ring-citrus-tint"><Face kind={kind} size={60} /><Bad /></div>
            <span className="text-center text-xs text-muted">{label}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

/** The round info button that brings the sheet back. */
export function InfoButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  const t = useT()
  return (
    <button onClick={onClick} aria-label={t('showInstructions')}
      className={`grid size-8 place-items-center rounded-full ${dark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-mist text-muted hover:bg-line hover:text-ink'}`}>
      <InfoGlyph />
    </button>
  )
}
