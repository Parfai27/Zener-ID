// One card, centred, the same size on every screen.
//
// A verification is a short guided task, so the card does not grow with what is
// in it: a fixed box (648 x 480 from 640px up, full bleed on a phone), the
// content scrolling inside, and the actions for a screen sitting in the footer
// beside the credit. That keeps the frame identical from step to step.
//
// Two slots are handed down through context: the footer, which `ActionBar`
// portals into, and the card itself, which sheets, dialogs and the checking
// overlay portal into so they cover the card and nothing else.
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { sessionQr } from '../../api'
import { Logo } from '../../components/ui'
import { Back, Caret, CloseGlyph, CopyGlyph, LangGlyph, PhoneGlyph, StepGlyph, Tick } from './glyphs'
import { LANGS, useLang, useT } from './i18n'

export type StepState = 'done' | 'current' | 'upcoming'
export type StepItem = { name: string; title: string; state: StepState }

const Slots = createContext<{ footer: HTMLElement | null; card: HTMLElement | null }>({ footer: null, card: null })

/** The page around the card, and the card. Also used by the page shown without a link. */
export function Card({ children, cardRef }: { children: ReactNode; cardRef?: (node: HTMLDivElement | null) => void }) {
  return (
    <div className="flex min-h-dvh justify-center bg-white sm:items-start sm:p-6">
      <div ref={cardRef} className="relative flex h-dvh w-full max-w-[648px] flex-col overflow-hidden bg-white sm:h-[480px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-lg sm:shadow-card">
        {children}
      </div>
    </div>
  )
}

export function Footer({ children }: { children?: ReactNode }) {
  const t = useT()
  return (
    <footer className="flex min-h-16 shrink-0 items-center justify-between gap-3 bg-tint px-5 py-3 sm:px-6">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">© {t('poweredBy')} <Logo size="xs" /></span>
      {children}
    </footer>
  )
}

export function Shell({ children, steps, onBack, bleed = false, token, onHelp }: {
  children: ReactNode
  /** Shown as icons in the header. Omitted when there is no session yet. */
  steps?: StepItem[] | null
  /** The back arrow, when there is somewhere to go back to. */
  onBack?: () => void
  /** Let the content run to the card's edges, which the camera needs. */
  bleed?: boolean
  /** Enables the hand-off to a phone. */
  token?: string
  onHelp?: () => void
}) {
  const t = useT()
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const [card, setCard] = useState<HTMLElement | null>(null)
  const hasSteps = !!steps?.length

  return (
    <Card cardRef={setCard}>
      <Slots.Provider value={{ footer, card }}>
        {/* From 640px: three columns, the outer two equal, so the steps sit dead
            centre. On a phone the steps get a centred row of their own. */}
        <header className={`grid shrink-0 grid-cols-2 items-center gap-x-2 bg-tint px-3 sm:h-14 sm:grid-cols-[1fr_auto_1fr] sm:gap-y-0 sm:py-0 ${hasSteps ? 'gap-y-2 py-2.5' : 'h-14'}`}>
          <div className="col-start-1 row-start-1 flex justify-start">
            {onBack && (
              <button onClick={onBack} aria-label={t('back')} className="grid size-9 place-items-center rounded-full text-ink hover:bg-white/70">
                <Back />
              </button>
            )}
          </div>
          {hasSteps && (
            <div className="col-span-2 row-start-2 flex justify-center sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <IconSteps steps={steps!} />
            </div>
          )}
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
            {token && <ContinueOnMobile token={token} />}
            <LanguageMenu />
            {onHelp && <button onClick={onHelp} className="px-1 text-xs font-medium text-brand hover:underline">{t('help')}</button>}
          </div>
        </header>

        <main id="main" className={`relative flex min-h-0 flex-1 flex-col ${bleed ? 'overflow-hidden' : 'overflow-y-auto px-5 py-5 sm:px-6 [&>*]:shrink-0'}`}>
          {children}
        </main>

        {/* The camera runs to the bottom of the card, so no strip under it. */}
        {!bleed && <Footer><div ref={setFooter} className="flex items-center justify-end gap-2" /></Footer>}
      </Slots.Provider>
    </Card>
  )
}

/** The actions for a screen, rendered into the card's footer beside the credit. */
export function ActionBar({ children }: { children: ReactNode }) {
  const { footer } = useContext(Slots)
  if (footer) return createPortal(children, footer)
  return <div className="mt-6 flex flex-wrap justify-end gap-2">{children}</div>
}

/** Portals into the card, for things that cover it: sheets, dialogs, the checking overlay. */
export function CardLayer({ children }: { children: ReactNode }) {
  const { card } = useContext(Slots)
  if (!card) return null
  return createPortal(children, card)
}

/** The heading pair every step opens with. */
export function StepHeading({ title, note }: { title: string; note?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-lg">{title}</h1>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
    </div>
  )
}

/** One button, two weights: pills sized to sit side by side in the footer. */
const WEIGHT = {
  primary: 'bg-brand-deep text-white hover:bg-brand-hover disabled:bg-mist disabled:text-faint',
  secondary: 'border border-ink/60 bg-white text-ink hover:bg-mist disabled:text-faint',
}
export function Button({ weight = 'primary', className = '', ...rest }: ComponentProps<'button'> & { weight?: keyof typeof WEIGHT }) {
  return (
    <button type="button" className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[15px] font-semibold transition-colors ${WEIGHT[weight]} ${className}`} {...rest} />
  )
}

/**
 * The steps, as a row of icons in the header: white discs joined by thin rules.
 * The current one is ringed, a finished one carries a tick, and the rules fill
 * up to the current step. Only the steps this session asked for are drawn.
 */
function IconSteps({ steps }: { steps: StepItem[] }) {
  return (
    <ol className="flex items-center" aria-label="Progress">
      {steps.map((step, i) => (
        <li key={step.name} className="flex items-center">
          {i > 0 && (
            <span aria-hidden className={`mx-1 h-0.5 w-4 rounded-full transition-colors duration-300 ${steps[i - 1].state === 'done' ? 'bg-brand' : 'bg-line'}`} />
          )}
          <span tabIndex={0} className="group relative rounded-full">
            <span
              aria-current={step.state === 'current' ? 'step' : undefined}
              className={`relative grid size-8 place-items-center rounded-full bg-white shadow-disc transition-shadow hover:shadow-disc-hover ${step.state === 'current' ? 'text-brand ring-2 ring-brand' : 'text-glyph'}`}
            >
              <StepGlyph step={step.name} />
              {step.state === 'done' && (
                <span className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-brand text-white ring-2 ring-white">
                  <Tick size={10} width={2.6} />
                </span>
              )}
              <span className="sr-only">{step.title}{step.state === 'done' ? ' ✓' : ''}</span>
            </span>
            {/* Named on hover and on focus, so the icons are not a guessing game. */}
            <span role="tooltip" className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-tooltip px-2.5 py-1.5 text-xs font-medium text-white group-focus-within:block group-hover:block">
              {step.title}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function LanguageMenu() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', close) }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink hover:border-brand">
        <span className="text-brand"><LangGlyph /></span>{lang}<Caret />
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-36 rounded-md border border-line bg-white py-1 text-sm shadow-lg">
          {LANGS.map(([k, label]) => (
            <li key={k} role="option" aria-selected={k === lang}>
              <button onClick={() => { setLang(k); setOpen(false) }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-medium text-ink hover:bg-tint">
                {label}
                {k === lang && <span className="text-brand"><Tick size={14} width={2} /></span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Carrying on by phone. Progress is kept by the backend against the link, so
 * whichever device finishes a step, the other sees it on its next look.
 */
function ContinueOnMobile({ token }: { token: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/verify/${token}`

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Older browsers: select the text in a hidden field and copy that.
      const field = Object.assign(document.createElement('textarea'), { value: link })
      document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t('phoneButton')} title={t('phoneButton')}
        className="grid size-9 place-items-center rounded-full border border-line bg-white text-brand">
        <PhoneGlyph />
      </button>
      {open && (
        <CardLayer>
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 py-6" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
            <div role="dialog" aria-modal aria-labelledby="mobile-title" className="relative max-h-full w-full max-w-[400px] overflow-y-auto rounded-2xl bg-white px-6 py-4 shadow-lg">
              <button onClick={() => setOpen(false)} aria-label={t('close')} className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-muted hover:bg-mist">
                <CloseGlyph />
              </button>
              <h2 id="mobile-title" className="pr-8 text-base font-semibold">{t('mobileTitle')}</h2>
              <p className="mt-1 text-[13px] leading-snug text-muted">{t('mobileText')}</p>
              <div className="mt-3 flex justify-center">
                <div className="rounded-lg border border-line bg-white p-2">
                  <img src={sessionQr(token)} alt={t('qrHelp')} width={116} height={116} className="block size-[116px]" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />{t('or')}<span className="h-px flex-1 bg-line" />
              </div>
              <button onClick={copy} className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-tint py-1.5 pl-5 pr-1.5 text-sm font-medium text-ink">
                {copied ? t('linkCopied') : t('copyLink')}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-brand">{copied ? <Tick size={16} width={2} /> : <CopyGlyph />}</span>
              </button>
              <p className="mt-2 text-center text-xs text-faint">{t('linkPrivate')}</p>
            </div>
          </div>
        </CardLayer>
      )}
    </>
  )
}
