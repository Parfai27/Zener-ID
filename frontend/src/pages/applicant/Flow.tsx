// Applicant verification: one fixed card (header with the step icons, body,
// "Powered by" footer holding the screen's actions). The order follows the
// backend: consent → document → face → result. The document comes first because
// the face is compared with the photo printed on it.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { ApiError, getSession, probeDocumentFrame, probeFrame, submitDocument, submitFace, type DocumentProbe, type FrameProbe } from '../../api'
import type { DocumentType, QualityReport, SessionView } from '../../api/types'
import { assessQuality, loadImage, toJpeg } from '../../lib/quality'
import { useCamera } from './useCamera'
import { ActionBar, Button, CardLayer, Shell, StepHeading, type StepItem, type StepState } from './Shell'
import { DocumentInstructions, FaceInstructions, InfoButton } from './Instructions'
import { CameraGlyph, Chevron, Clock, Cross, DocGlyph, FlipGlyph, FocusMark, StepGlyphSolid, Tick, UploadGlyph } from './glyphs'
import { LANGS, LangCtx, initialLang, makeT, useT, type Dict, type Lang } from './i18n'

// ---------------------------------------------------------------- data
// Labels are i18n keys (see i18n.ts). `aspect` is the document's own shape, which
// the camera guide is drawn at: a passport photo page is squarer than a card.
const DOC: Record<DocumentType, { label: 'passport' | 'idCard' | 'license'; sub: 'photoPage' | 'frontBack'; sides: 1 | 2; aspect: number }> = {
  passport: { label: 'passport', sub: 'photoPage', sides: 1, aspect: 1.42 },
  id_card: { label: 'idCard', sub: 'frontBack', sides: 2, aspect: 1.586 },
  driving_license: { label: 'license', sub: 'frontBack', sides: 2, aspect: 1.586 },
}

// Document photos keep enough detail for the backend's OCR and MRZ reading: a
// licence often fills only part of a phone photo.
const DOC_MAX_PX = 2000

type Side = 'front' | 'back'
type Screen =
  | { s: 'loading' } | { s: 'invalid' } | { s: 'expired' } | { s: 'consent' } | { s: 'other' } | { s: 'attempts' }
  | { s: 'doc-select' } | { s: 'doc-capture'; side: Side; intro: boolean }
  | { s: 'doc-review'; side: Side; url: string; quality: QualityReport }
  | { s: 'doc-failed'; reasons: string[]; error?: string }
  | { s: 'face-capture' } | { s: 'face-failed'; error?: string }
  | { s: 'verifying'; what: 'document' | 'face' } | { s: 'done' }

type DocShots = { document_type: DocumentType; front: string; back?: string }

/** The steps this portal handles. Anything else a session asks for is not drawn. */
const STEPS = ['document', 'face'] as const

/**
 * The header's step icons: the ID document and the face check, as far as this
 * session asked for them. Each moves from upcoming to current to done.
 */
function stepItems(session: SessionView | null, sc: Screen, t: ReturnType<typeof makeT>): StepItem[] {
  if (!session) return []
  const titles = { document: t('stepDocument'), face: t('stepFace') }
  const current = sc.s === 'consent' || sc.s.startsWith('doc') ? 'document'
    : sc.s.startsWith('face') || sc.s === 'verifying' ? 'face' : null
  return STEPS.filter(name => session.services.includes(name)).map(name => {
    let state: StepState
    if (session.completed_steps.includes(name) || sc.s === 'done') state = 'done'
    else if (name === current) state = 'current'
    // The photos are taken and being read while the face check runs.
    else if (name === 'document' && current === 'face') state = 'done'
    else state = 'upcoming'
    return { name, title: titles[name], state }
  })
}

const outOfAttempts = (e: unknown) => e instanceof ApiError && e.status === 409 && /attempt/i.test(e.message)

// ---------------------------------------------------------------- flow
export function ApplicantFlow() {
  const { token = '' } = useParams()
  const [session, setSession] = useState<SessionView | null>(null)
  const [sc, setSc] = useState<Screen>({ s: 'loading' })
  const [doc, setDoc] = useState<DocumentType>('id_card')
  const [shots, setShots] = useState<{ front?: string; back?: string }>({})
  const [help, setHelp] = useState(false)
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = (l: Lang) => { setLangState(l); try { sessionStorage.setItem('zid.lang', l) } catch { /* private mode */ } }
  useEffect(() => { document.documentElement.lang = LANGS.find(x => x[0] === lang)![2] }, [lang])
  const t = makeT(lang)

  useEffect(() => {
    getSession(token).then(sv => {
      setSession(sv)
      if (sv.expired) return setSc({ s: 'expired' })
      if (sv.next_step === 'done') return setSc({ s: 'done' })
      if (sv.next_step === 'other') return setSc({ s: 'other' })
      if (sv.next_step === 'face') return setSc({ s: 'face-capture' })
      // Nothing done yet: ask for consent first. Coming back part-way: carry on.
      setSc(sv.completed_steps.length ? { s: 'doc-select' } : { s: 'consent' })
    }, () => setSc({ s: 'invalid' }))
  }, [token])

  // The person goes through every step first (document photos, then the face
  // check); nothing is shown as decided until both are in. The document is sent
  // the moment its photos are taken, quietly, so the backend reads it (OCR, MRZ,
  // the portrait: tens of seconds on a laptop) while the person does the face
  // check; the checking screen then waits for that answer, sends the face, and
  // shows the result. A rejected document sends them back to retake the document
  // only: the face capture already taken is reused.
  type DocAnswer = { ok: true; decision: string; reasons: string[] } | { ok: false; error: unknown }
  const docJob = useRef<Promise<DocAnswer> | null>(null)
  const startDocument = (shots: DocShots) => {
    docJob.current = submitDocument(token, shots).then(
      r => ({ ok: true as const, decision: r.decision, reasons: r.reasons }),
      error => ({ ok: false as const, error }),
    )
  }
  const [pendingDoc, setPendingDoc] = useState<DocShots | null>(null)
  const [pendingFace, setPendingFace] = useState<FaceCaptureResult | null>(null)
  const [docDone, setDocDone] = useState(false)
  useEffect(() => { if (session?.completed_steps.includes('document')) setDocDone(true) }, [session])

  const failure = (e: unknown, step: 'doc' | 'face'): Screen => {
    if (outOfAttempts(e)) return { s: 'attempts' }
    if (e instanceof ApiError && e.status === 410) return { s: 'expired' }
    const error = e instanceof ApiError && e.status >= 400 && e.status < 500 ? e.message : t('netError')
    return step === 'doc' ? { s: 'doc-failed', reasons: [], error } : { s: 'face-failed', error }
  }

  const verify = async (docShots: DocShots | null, face: FaceCaptureResult) => {
    let documentPassed = docDone
    if (!documentPassed) {
      if (!docShots) return setSc({ s: 'doc-select' })
      setSc({ s: 'verifying', what: 'document' })
      if (!docJob.current) startDocument(docShots)
      const answer = await docJob.current!
      docJob.current = null
      setPendingDoc(null)
      if (!answer.ok) return setSc(failure(answer.error, 'doc'))
      if (answer.decision !== 'pass' && answer.decision !== 'review') return setSc({ s: 'doc-failed', reasons: answer.reasons })
      documentPassed = true
      setDocDone(true)
    }
    setSc({ s: 'verifying', what: 'face' })
    try {
      const r = await submitFace(token, face)
      setPendingFace(null)
      setSc(r.decision === 'pass' || r.decision === 'review' ? { s: 'done' } : { s: 'face-failed' })
    } catch (e) {
      setPendingFace(null)
      setSc(failure(e, 'face'))
    }
  }

  const afterReview = (side: Side, url: string) => {
    const next = { ...shots, [side]: url }
    setShots(next)
    if (side === 'front' && DOC[doc].sides === 2) return setSc({ s: 'doc-capture', side: 'back', intro: false })
    const docShots: DocShots = { document_type: doc, front: next.front!, back: next.back }
    setPendingDoc(docShots)
    setShots({})
    startDocument(docShots)
    // Retaking the document after a rejection: the face is already captured.
    if (pendingFace) verify(docShots, pendingFace)
    else setSc({ s: 'face-capture' })
  }

  const afterFace = (capture: FaceCaptureResult) => {
    setPendingFace(capture)
    verify(pendingDoc, capture)
  }

  const pick = (d: DocumentType) => { setDoc(d); setShots({}); setSc({ s: 'doc-capture', side: 'front', intro: true }) }
  const steps = stepItems(session, sc, t)

  // Where the header's back arrow goes, on the screens that have one.
  const back = help ? () => setHelp(false)
    : sc.s === 'doc-capture' ? () => setSc({ s: 'doc-select' })
      : sc.s === 'doc-review' ? () => setSc({ s: 'doc-capture', side: sc.side, intro: false })
        : undefined
  const bleed = !help && (sc.s === 'consent' || sc.s === 'doc-capture' || sc.s === 'face-capture')

  let body: ReactNode
  if (help) body = <HelpView />
  else switch (sc.s) {
    case 'loading': body = <p className="py-16 text-center text-faint" role="status">{t('loading')}</p>; break
    case 'invalid': body = (
      <>
        <h1 className="text-xl">{t('invalidTitle')}</h1>
        <div className="mt-4 rounded-2xl border border-bad-fill/40 bg-bad-tint p-4 text-bad" role="alert"><p className="flex items-center gap-2 font-semibold"><Cross size={16} />{t('invalidTitle')}</p><p className="mt-2 text-sm text-muted">{t('invalidText')}</p></div>
      </>
    ); break
    case 'expired': body = <><h1 className="text-xl">{t('expiredTitle')}</h1><p className="mt-3 text-muted">{t('expiredText')}</p></>; break
    case 'other': body = <><h1 className="text-xl">{t('otherStepTitle')}</h1><p className="mt-3 text-muted">{t('otherStepText')}</p></>; break
    case 'attempts': body = (
      <>
        <h1 className="flex items-center gap-3 text-xl"><Mark tone="wait"><Clock size={16} /></Mark>{t('verifyingTitle')}</h1>
        <p className="mt-3 text-muted">{t('attemptsUsed')}</p>
      </>
    ); break
    case 'consent': body = (
      // The document choice stays visible behind the panel, so the person can see
      // what they are about to be asked for while they decide.
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div aria-hidden className="pointer-events-none flex min-h-0 flex-1 select-none flex-col overflow-hidden px-5 py-5 blur-[3px] sm:px-6">
          <DocSelect allowed={session?.document_types} onPick={() => undefined} />
        </div>
        <ConsentPanel onAgree={() => setSc({ s: 'doc-select' })} />
      </div>
    ); break
    case 'doc-select': body = <DocSelect allowed={session?.document_types} onPick={pick} />; break
    case 'doc-capture': body = (
      <DocCapture key={sc.side} doc={doc} side={sc.side} intro={sc.intro}
        onImage={(url, q) => setSc({ s: 'doc-review', side: sc.side, url, quality: q })} />
    ); break
    case 'doc-review': body = (
      <DocReview screen={sc} doc={doc} onRetake={() => setSc({ s: 'doc-capture', side: sc.side, intro: false })} onContinue={() => afterReview(sc.side, sc.url)} />
    ); break
    case 'doc-failed': body = (
      <Failed step="document" title={t('stepDocument')} lines={[sc.error || t('docFailedText')]} codes={sc.reasons}
        onRetry={() => setSc({ s: 'doc-capture', side: 'front', intro: false })} onCancel={() => setSc({ s: 'doc-select' })} />
    ); break
    case 'face-capture': body = <FaceCapture token={token} onDone={afterFace} onFail={error => setSc({ s: 'face-failed', error })} />; break
    case 'face-failed': body = (
      <Failed step="face" title={t('stepFace')} lines={[sc.error || t('faceFailedText')]} codes={[]}
        onRetry={() => setSc({ s: 'face-capture' })} onCancel={() => setSc({ s: 'face-capture' })} />
    ); break
    case 'verifying': body = (
      <>
        <StepHeading title={t('verifyingTitle')} note={t('verifyingText')} />
        <Checking label={sc.what === 'document' ? t('checkingDocument') : t('checkingFace')} />
      </>
    ); break
    case 'done': body = <Done steps={steps} redirect={safeRedirect(session?.redirect_url)} />; break
  }

  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
      <Shell steps={steps} onBack={back} bleed={bleed} token={session ? token : undefined} onHelp={help ? undefined : () => setHelp(true)}>
        {body}
      </Shell>
    </LangCtx.Provider>
  )
}

// ---------------------------------------------------------------- shared pieces of the camera screens
const STARTING = 'absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-night/85 p-6 text-center text-sm font-medium text-[#cfd8d4] backdrop-blur-sm'
const SPINNER = 'size-10 animate-spin rounded-full border-2 border-white/20 border-t-lit'
/** The hint, on a white pill inside the frame where the eye already is. */
const PILL = 'absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[92%] text-balance rounded-full bg-citrus px-4 py-1.5 text-center text-sm font-medium text-brand-deep shadow-sm'

// ---------------------------------------------------------------- outcomes

/** The blurred card and the spinner, while an answer is worked out. */
function Checking({ label }: { label: string }) {
  return (
    <CardLayer>
      <div role="status" aria-live="polite" className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-white/55 backdrop-blur-[6px]">
        <span className="relative block size-16">
          <span className="absolute inset-0 rounded-full border-[3px] border-brand/15" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand" />
        </span>
        <p className="font-display text-lg font-bold text-ink">{label}</p>
      </div>
    </CardLayer>
  )
}

const MARK = {
  ok: { glow: 'bg-ok-fill/30', dot: 'bg-ok-fill text-white' },
  bad: { glow: 'bg-bad-fill/25', dot: 'bg-bad-fill text-white' },
  wait: { glow: 'bg-warn-fill/40', dot: 'bg-warn-fill text-ink' },
}

/** The disc that heads an outcome: a glow behind a solid mark. */
function Mark({ tone, children }: { tone: 'ok' | 'bad' | 'wait'; children: ReactNode }) {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center">
      <span aria-hidden className={`absolute inset-0 rounded-full blur-[6px] ${MARK[tone].glow}`} />
      <span className={`relative grid size-8 place-items-center rounded-full border-2 border-white ${MARK[tone].dot}`}>{children}</span>
    </span>
  )
}

/** "Couldn't verify, Try again!", with the reasons boxed under the step's name. */
function Failed({ step, title, lines, codes, onRetry, onCancel }: {
  step: 'document' | 'face'; title: string; lines: string[]; codes: string[]; onRetry: () => void; onCancel: () => void
}) {
  const t = useT()
  return (
    <section aria-live="polite">
      <h1 className="flex items-center gap-3 text-xl"><Mark tone="bad"><Cross size={16} width={2} /></Mark>{t('couldntVerify')}</h1>
      <div className="mt-5 overflow-hidden rounded-md border border-ink/40">
        <p className="flex items-center gap-2.5 bg-tint px-4 py-3 text-sm font-semibold text-ink"><span className="text-[#4b5566]"><StepGlyphSolid step={step} /></span>{title}</p>
        <ul className="space-y-3 px-4 py-4">
          {lines.map(line => <li key={line} className="flex items-start gap-2.5 text-sm text-ink"><span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-bad-fill text-white"><Cross size={8} width={3} /></span>{line}</li>)}
          {codes.length > 0 && <li className="font-mono text-xs text-muted">{codes.join(' · ')}</li>}
        </ul>
      </div>
      <ActionBar>
        <Button weight="secondary" onClick={onCancel}>{t('cancel')}</Button>
        <Button onClick={onRetry}>{t('tryAgain')}</Button>
      </ActionBar>
    </section>
  )
}

/**
 * The company's redirect, only if it is a web address: never a javascript: or
 * data: value. Plain http is allowed only for a local development address.
 */
function safeRedirect(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return u.href
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return u.href
  } catch { /* not a URL */ }
  return null
}

function Done({ steps, redirect }: { steps: StepItem[]; redirect: string | null }) {
  const t = useT()
  const [closeRefused, setCloseRefused] = useState(false)
  const finished = steps.filter(s => s.state === 'done')
  return (
    <section aria-live="polite">
      <h1 className="flex items-center gap-3 text-xl"><Mark tone="ok"><Tick size={16} /></Mark>{t('doneTitle')}</h1>
      {finished.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-md border border-ink/40">
          <p className="bg-tint px-4 py-3 text-sm font-semibold text-ink">{t('doneList')}</p>
          <ul className="space-y-3 px-4 py-4">{finished.map(s => <li key={s.name} className="flex items-center gap-2.5 text-sm text-ink"><span className="grid size-4 shrink-0 place-items-center rounded-full bg-ok-fill text-white"><Tick size={10} width={2.6} /></span>{s.title}</li>)}</ul>
        </div>
      )}
      <p className="mt-5 text-sm text-muted">{t('doneText')}</p>
      {closeRefused && <p className="mt-3 text-sm font-medium text-ink" role="status">{t('closeTab')}</p>}
      <ActionBar>
        <Button onClick={() => {
          // Back to the company that asked for the check, when they said where.
          if (redirect) { window.location.assign(redirect); return }
          window.close()
          // Still here a moment later means the browser would not close the tab.
          window.setTimeout(() => setCloseRefused(true), 300)
        }}>{t('okay')}</Button>
      </ActionBar>
    </section>
  )
}

/** Help: the few things that fix almost every problem, one answer open at a time. */
function HelpView() {
  const t = useT()
  const [open, setOpen] = useState(0)
  const items: Array<[keyof Dict, keyof Dict]> = [['helpLight', 'helpLightText'], ['helpCamera', 'helpCameraText'], ['helpPhone', 'helpPhoneText']]
  return (
    <>
      <h1 className="text-xl">{t('help')}</h1>
      <p className="mt-1 text-sm text-muted">{t('helpTitle')}</p>
      <ul className="mt-5 space-y-2">
        {items.map(([q, a], i) => {
          const expanded = open === i
          return (
            <li key={q} className={`overflow-hidden rounded-xl border transition-colors ${expanded ? 'border-brand/40 bg-tint' : 'border-line bg-white'}`}>
              <h2>
                <button id={`help-q-${i}`} aria-expanded={expanded} aria-controls={`help-a-${i}`} onClick={() => setOpen(expanded ? -1 : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-sans text-sm font-semibold text-ink">
                  {t(q)}
                  <span className={`shrink-0 text-muted transition-transform duration-200 ${expanded ? 'rotate-180 text-brand' : ''}`}><Chevron /></span>
                </button>
              </h2>
              {/* Rows that grow from 0 to their content's height, so opening is smooth. */}
              <div id={`help-a-${i}`} role="region" aria-labelledby={`help-q-${i}`}
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-3.5 text-sm text-muted">{t(a)}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// ---------------------------------------------------------------- consent

const LINK = 'font-medium text-brand underline-offset-2 hover:underline'

/**
 * Consent, in front of the first step. It rises over the document choice, which
 * stays visible but blurred behind it. Ticking the box is the agreement: the
 * panel drops away and the screen behind comes into focus.
 */
function ConsentPanel({ onAgree }: { onAgree: () => void }) {
  const t = useT()
  const [ticked, setTicked] = useState(false)
  return (
    <div onAnimationEnd={e => { if (e.animationName === 'drop') onAgree() }}
      className={`absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-line bg-white px-5 py-5 shadow-panel sm:px-6 ${ticked ? 'animate-drop' : 'animate-lift'}`}>
      <h2 className="text-lg font-semibold">{t('consentTitle')}</h2>
      <p className="mt-0.5 text-sm leading-snug text-muted">{t('consentText')}</p>
      <label className="mt-4 flex items-start gap-3 rounded-2xl bg-tint p-3 ring-1 ring-line">
        <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
          <input type="checkbox" checked={ticked} disabled={ticked} onChange={e => e.target.checked && setTicked(true)}
            className="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-brand/60 bg-white transition-colors checked:border-brand checked:bg-brand" />
          <span className="pointer-events-none absolute hidden text-white peer-checked:block"><Tick size={14} width={2.6} /></span>
        </span>
        <span className="text-sm text-ink">{t('agree')} <a href="#" className={LINK} onClick={e => e.preventDefault()}>{t('privacy')}</a> {t('and')} <a href="#" className={LINK} onClick={e => e.preventDefault()}>{t('terms')}</a>.</span>
      </label>
      <p className="mt-3 text-xs text-muted">{t('consentNote')}</p>
    </div>
  )
}

// ---------------------------------------------------------------- document

/* Written out whole so Tailwind sees each class. */
const COLUMNS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }

/** The documents, in the order they are offered. */
const DOC_ORDER: DocumentType[] = ['passport', 'id_card', 'driving_license']

function DocSelect({ allowed, onPick }: { allowed?: DocumentType[]; onPick: (d: DocumentType) => void }) {
  const t = useT()
  const narrowed = DOC_ORDER.filter(d => !allowed || allowed.includes(d))
  // Never empty: an unexpected list from the backend falls back to every type.
  const docs = narrowed.length ? narrowed : DOC_ORDER
  return (
    <>
      <StepHeading title={t('docTypeTitle')} note={t('docTypeSub')} />
      <ul className={`grid grid-cols-1 gap-3 ${COLUMNS[docs.length] ?? 'sm:grid-cols-3'}`}>
        {docs.map(d => (
          <li key={d}>
            <button className="flex h-[52px] w-full items-center gap-3 rounded-full border-2 border-tint bg-tint px-1.5 text-left transition-colors hover:border-brand" onClick={() => onPick(d)}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand"><DocGlyph type={d} /></span>
              <span className="min-w-0 pr-2">
                <b className="block truncate text-sm font-semibold text-ink">{t(DOC[d].label)}</b>
                <span className="block truncate text-xs text-muted">{t(DOC[d].sub)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

const sideName = (t: ReturnType<typeof useT>, doc: DocumentType, side: Side) => t(DOC[doc].sides === 1 ? 'sidePhoto' : side === 'front' ? 'sideFront' : 'sideBack')

type Box = { left: number; top: number; width: number; height: number }
/** Where a w x h frame lands when shown `object-fit: contain` in the stage. */
function fitContain(w: number, h: number, sw: number, sh: number): Box {
  if (!w || !h || !sw || !sh) return { left: 0, top: 0, width: 0, height: 0 }
  const scale = Math.min(sw / w, sh / h)
  return { left: (sw - w * scale) / 2, top: (sh - h * scale) / 2, width: w * scale, height: h * scale }
}
/** The guide: the document's own shape, as wide as it can be inside the shown frame. */
function guideBox(frame: Box, aspect: number): Box {
  let width = frame.width * 0.88
  let height = width / aspect
  if (height > frame.height * 0.82) { height = frame.height * 0.82; width = height * aspect }
  return { left: frame.left + (frame.width - width) / 2, top: frame.top + (frame.height - height) / 2, width, height }
}

// Auto-capture: frames cropped to the guide go to /v1/document/frame, and the
// photo takes itself once the server has called a few in a row usable.
const DOC_READY_FRAMES = 3     // consecutive usable frames before the photo is taken
const DOC_GIVE_UP_AFTER = 7    // unusable frames before suggesting the Capture button
const DOC_PROBE_GAP_MS = 400   // a while loop with a pause, so slow answers never stack
const CARD_HINT: Record<string, keyof Dict> = {
  NO_DOCUMENT_IN_VIEW: 'cardNoDoc', DOCUMENT_NOT_DETECTED: 'cardNotDetected', FIT_THE_CARD_IN_THE_BOX: 'cardFit',
  TURN_THE_CARD_UPRIGHT: 'cardUpright', SHOW_THE_BACK: 'cardShowBack', PORTRAIT_NOT_VISIBLE: 'cardPortrait',
  MOVE_CLOSER: 'cardCloser', IMAGE_LOW_RESOLUTION: 'cardCloser', GLARE_ON_THE_CARD: 'cardGlare', IMAGE_GLARE: 'cardGlare',
  IMAGE_BLURRY: 'cardBlur', TOO_DARK: 'cardDark', IMAGE_TOO_DARK: 'cardDark', TOO_BRIGHT: 'cardBright', HOLD_STILL: 'cardStill',
}
const wait = (ms: number) => new Promise(r => window.setTimeout(r, ms))
type Tone = 'idle' | 'ready' | 'taking'
const GUIDE_EDGE: Record<Tone, string> = { idle: 'border-citrus', ready: 'border-lit', taking: 'border-lit animate-pulse' }

/**
 * The document camera. The whole frame is shown, never cropped, so nothing the
 * person is holding is hidden off an edge they cannot see; the guide is drawn at
 * measured pixel positions inside it, at the document's own aspect ratio. While
 * the camera is open the part under the guide is checked by the server, and the
 * photo is taken by itself as soon as it is good enough. Capture and Upload stay
 * there for anyone who would rather not wait.
 */
function DocCapture({ doc, side, intro, onImage }: { doc: DocumentType; side: Side; intro: boolean; onImage: (url: string, q: QualityReport) => void }) {
  const t = useT()
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const cam = useCamera(facing)
  const [showing, setShowing] = useState(intro)
  const [busy, setBusy] = useState(false)
  const [tone, setTone] = useState<Tone>('idle')
  const [hint, setHint] = useState<string | null>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [frame, setFrame] = useState({ width: 1280, height: 960 })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => { cam.start(); return () => cam.stop() }, [facing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const ro = new ResizeObserver(([e]) => setStage({ width: e.contentRect.width, height: e.contentRect.height }))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const shown = useMemo(() => fitContain(frame.width, frame.height, stage.width, stage.height), [frame, stage])
  const guide = useMemo(() => guideBox(shown, DOC[doc].aspect), [shown, doc])

  /** The frame as the camera sees it, never mirrored: a document must read the right way round. */
  const grab = () => {
    const v = cam.videoRef.current
    if (!v || !v.videoWidth) return null
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return { url: c.toDataURL('image/jpeg', 0.8), w: v.videoWidth, h: v.videoHeight }
  }

  /**
   * The part of the frame under the guide, mapped back into camera pixels, with a
   * small margin so the document's own edges survive: what the server judges is
   * exactly what the person lined up.
   */
  const cropToGuide = (): Promise<Blob | null> => {
    const v = cam.videoRef.current
    const { shown, guide } = geometry.current
    if (!v || !v.videoWidth || !shown.width) return Promise.resolve(null)
    const scale = v.videoWidth / shown.width
    const mx = guide.width * scale * 0.06, my = guide.height * scale * 0.06
    const left = Math.max(0, (guide.left - shown.left) * scale - mx)
    const top = Math.max(0, (guide.top - shown.top) * scale - my)
    const width = Math.min(v.videoWidth - left, guide.width * scale + 2 * mx)
    const height = Math.min(v.videoHeight - top, guide.height * scale + 2 * my)
    const c = document.createElement('canvas')
    c.width = Math.round(width); c.height = Math.round(height)
    c.getContext('2d')!.drawImage(v, left, top, width, height, 0, 0, c.width, c.height)
    return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.7))
  }

  const capture = async () => {
    const s = grab()
    if (!s) return
    setBusy(true)
    const q = await assessQuality(s.url, s.w, s.h)
    const img = await loadImage(s.url)
    cam.stop()
    onImage(toJpeg(img, img.naturalWidth, img.naturalHeight, DOC_MAX_PX, 0.9), q)
  }

  // The loop reads these through refs, so it always sees the latest guide,
  // language and capture without restarting on every render.
  const geometry = useRef({ shown, guide })
  geometry.current = { shown, guide }
  const latest = useRef({ t, capture })
  latest.current = { t, capture }

  const live = cam.state === 'live'
  useEffect(() => {
    // Not while the instructions are up: it would take the photo behind them.
    if (showing || !live || busy) return
    let running = true
    let good = 0
    let misses = 0
    ;(async () => {
      while (running) {
        const blob = await cropToGuide()
        if (!blob) { await wait(250); continue }
        let probe: DocumentProbe
        try {
          probe = await probeDocumentFrame(blob, side)
        } catch {
          // Guidance only: a failed probe never blocks the person, they can press Capture.
          await wait(1000); continue
        }
        if (!running) return
        const { t } = latest.current
        if (probe.usable) {
          good += 1
          setTone('ready'); setHint(t('cardHold'))
          if (good >= DOC_READY_FRAMES) {
            running = false
            setTone('taking')
            await latest.current.capture()
            return
          }
        } else {
          good = 0; misses += 1
          setTone('idle')
          const code = probe.hints[0]
          setHint(misses >= DOC_GIVE_UP_AFTER ? t('cardGiveUp') : code && CARD_HINT[code] ? t(CARD_HINT[code]) : null)
        }
        await wait(DOC_PROBE_GAP_MS)
      }
    })()
    return () => { running = false }
  }, [showing, live, busy, side]) // eslint-disable-line react-hooks/exhaustive-deps

  const fromFile = (f?: File) => {
    if (!f) return
    setBusy(true)
    const r = new FileReader()
    r.onload = async () => { const url = String(r.result); const img = await loadImage(url); const q = await assessQuality(url, img.naturalWidth, img.naturalHeight); cam.stop(); onImage(toJpeg(img, img.naturalWidth, img.naturalHeight, DOC_MAX_PX, 0.9), q) }
    r.readAsDataURL(f)
  }

  const pill = cam.error ? t(cam.error) : hint ?? t('captureText')
  return (
    <div className="on-night relative flex min-h-0 flex-1 flex-col bg-night">
      {showing && <DocumentInstructions onClose={() => setShowing(false)} />}
      <h1 className="shrink-0 px-4 py-3 text-center text-sm font-semibold text-white">{t('captureTitle', { side: sideName(t, doc, side), doc: t(DOC[doc].label) })}</h1>

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-night">
        {(cam.state === 'starting' || cam.error) && <div className={STARTING}>{cam.state === 'starting' && <span className={SPINNER} />}<p>{cam.state === 'starting' ? t('cameraStarting') : t(cam.error as keyof Dict)}</p></div>}
        <video ref={cam.videoRef} className="size-full object-contain" playsInline muted onLoadedMetadata={e => { const v = e.currentTarget; if (v.videoWidth) setFrame({ width: v.videoWidth, height: v.videoHeight }) }} style={{ display: live ? 'block' : 'none' }} />
        {guide.width > 0 && (
          <div className={`absolute rounded-2xl border-[3px] transition-colors duration-200 ${GUIDE_EDGE[tone]}`} style={{ left: guide.left, top: guide.top, width: guide.width, height: guide.height }}>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lit"><FocusMark /></span>
            <p className={PILL} aria-live="polite">{pill}</p>
          </div>
        )}
      </div>

      <div className="relative flex shrink-0 items-center justify-center gap-7 px-4 py-3">
        <span className="absolute left-4"><InfoButton dark onClick={() => setShowing(true)} /></span>
        <RoundAction label={t('capture')} onClick={capture} disabled={!live || busy}><CameraGlyph /></RoundAction>
        <RoundAction label={t('upload')} onClick={() => file.current?.click()} disabled={busy}><UploadGlyph /></RoundAction>
        <input ref={file} type="file" accept="image/jpeg,image/png" hidden onChange={e => { fromFile(e.target.files?.[0]); e.target.value = '' }} />
        <button className="absolute right-4 grid size-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" onClick={() => setFacing(f => (f === 'environment' ? 'user' : 'environment'))} aria-label={t('switchCamera')}><FlipGlyph /></button>
      </div>
    </div>
  )
}

function RoundAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button className="group flex flex-col items-center gap-1.5 disabled:opacity-45" onClick={onClick} disabled={disabled}>
      <span className="grid size-12 place-items-center rounded-full bg-lit text-brand-deep transition-colors group-enabled:group-hover:bg-lit-hover">{children}</span>
      <span className="text-xs font-medium text-white">{label}</span>
    </button>
  )
}

function DocReview({ screen, doc, onRetake, onContinue }: {
  screen: Extract<Screen, { s: 'doc-review' }>; doc: DocumentType; onRetake: () => void; onContinue: () => void
}) {
  const t = useT()
  const q = screen.quality
  const code = q.problems[0]
  const problem = q.ok ? '' : t(code === 'blur' ? 'errBlur' : code === 'dark' ? 'errDark' : code === 'bright' ? 'errBright' : 'errSmall')
  return (
    <div className="flex flex-1 flex-col items-center">
      <h1 className="text-center text-lg">{t('checkText', { side: sideName(t, doc, screen.side), doc: t(DOC[doc].label) })}</h1>
      <div className="mt-5 flex min-h-0 w-full justify-center">
        <img src={screen.url} alt={t('checkTitle')} className={`max-h-[200px] max-w-full rounded-lg object-contain shadow-sm ${problem ? 'outline-2 outline-offset-2 outline-bad-fill' : ''}`} />
      </div>
      {problem
        ? <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-bad"><Cross size={14} />{problem}</p>
        : <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-ok"><Tick size={14} />{t('qualityOk')}</p>}
      <ActionBar>
        <Button weight="secondary" onClick={onRetake}>{t('retake')}</Button>
        {!problem && <Button onClick={onContinue}>{t('continue')}</Button>}
      </ActionBar>
    </div>
  )
}

// ---------------------------------------------------------------- guided face capture
// The same capture the backend's own page does (app/web/verify.html): frames go to
// /v1/face/frame for live guidance, the resting pose is learned first, then each
// movement is waited for until the server sees it, then a still facing the camera
// is taken as the portrait identity is decided on. Frames are sent unmirrored.
type Move = 'up' | 'down' | 'left' | 'right'
const CHALLENGE = 'full'
const MOVES: Move[] = ['up', 'down', 'left', 'right']
const MOVE_KEY: Record<Move | 'centre', keyof Dict> = { up: 'moveUp', down: 'moveDown', left: 'moveLeft', right: 'moveRight', centre: 'moveCentre' }
const HINT_KEY: Record<string, keyof Dict> = {
  NO_FACE: 'hintNoFace', MULTIPLE_FACES: 'hintMultiple', MOVE_CLOSER: 'hintCloser', MOVE_BACK: 'hintBack',
  OFF_CENTRE: 'hintCentre', TOO_DARK: 'hintDark', TOO_BRIGHT: 'hintBright', UNEVEN_LIGHTING: 'hintUneven', HOLD_STILL: 'hintSteady',
}
const READY_FRAMES = 3          // consecutive good frames before asking anyone to move
const READY_TIMEOUT_MS = 12000  // then start anyway: guidance must never trap anyone
const CALIBRATION_FRAMES = 4
const STEP_TIMEOUT_MS = 25000
const PORTRAIT_HOLD_FRAMES = 2
const PORTRAIT_MAX_DEGREES = 8
const PORTRAIT_ATTEMPTS = 6
// The liveness clip: 3 seconds of video from the moment the first head movement
// is asked for, sent with the frames and kept as evidence.
const CLIP_SECONDS = 3
const CLIP_BITRATE = 600_000
const CLIP_MAX_BYTES = 4 * 1024 * 1024
// The steps of the check, for the progress bar: the resting pose, each movement, the photo.
const SEGMENTS = 1 + MOVES.length + 1

export interface FaceCaptureResult {
  frames: Blob[]; portrait: Blob | null; video: Blob | null; challenge: string; steps: Array<{ index: number; step: string }>
}

/**
 * The face check. The camera opens at once with the instructions sheet over it,
 * and the check starts when the sheet is closed. The ring around the oval only
 * fills when the server reports the movement it asked for.
 */
function FaceCapture({ token, onDone, onFail }: { token: string; onDone: (r: FaceCaptureResult) => void; onFail: (error: string) => void }) {
  const t = useT()
  const cam = useCamera('user')
  const [phase, setPhase] = useState<'ready' | 'check' | 'centre' | Move | 'photo'>('ready')
  const [done, setDone] = useState(0)
  const [hint, setHint] = useState('')
  const [ok, setOk] = useState(false)
  const [showing, setShowing] = useState(true)
  // Each run of the capture has a number; a run keeps going only while it is the
  // latest one and the page is still open. Leaving the page bumps the number, so
  // an old run stops at its next step. (Set again on every mount: React's
  // development mode mounts twice.)
  const mounted = useRef(true)
  const runId = useRef(0)
  const alive = (id: number) => mounted.current && runId.current === id

  useEffect(() => {
    mounted.current = true
    cam.start()
    return () => { mounted.current = false; runId.current++; cam.stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const grab = () => new Promise<Blob>((resolve, reject) => {
    const v = cam.videoRef.current
    if (!v || !v.videoWidth) return reject(new Error('no video'))
    const size = Math.min(v.videoWidth, v.videoHeight)
    const c = document.createElement('canvas')
    c.width = 720; c.height = 720 // detail matters for the face match
    c.getContext('2d')!.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 720, 720)
    c.toBlob(b => (b ? resolve(b) : reject(new Error('no frame'))), 'image/jpeg', 0.95)
  })

  const show = (r: FrameProbe) => {
    const code = r.hints[0]
    setHint(code ? t(HINT_KEY[code] ?? 'hintCentre') : '')
    setOk(r.usable)
  }

  /** Keep sending frames until `accept` says this one will do, or time runs out. */
  const waitFor = async (id: number, accept: (r: FrameProbe) => boolean, timeout: number, calibrate = false) => {
    const deadline = Date.now() + timeout
    while (alive(id) && Date.now() < deadline) {
      const blob = await grab()
      const r = await probeFrame(token, blob, calibrate)
      if (!alive(id)) return null
      show(r)
      if (r.usable && accept(r)) return blob
    }
    return null
  }

  const run = async () => {
    const id = ++runId.current
    setDone(0)
    const kept: Blob[] = []
    const steps: Array<{ index: number; step: string }> = []

    // The liveness clip: 3 seconds from the first head movement, so the evidence
    // shows the person moving rather than sitting still for the camera check.
    let clip: Blob | null = null
    let recorder: MediaRecorder | null = null
    const chunks: Blob[] = []
    const startClip = () => {
      const stream = cam.videoRef.current?.srcObject as MediaStream | null
      if (!stream || typeof MediaRecorder === 'undefined') return
      try {
        const mimeType = ['video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type))
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: CLIP_BITRATE })
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        // The plain type, without the codecs Chrome adds ("video/webm;codecs=vp8").
        recorder.onstop = () => { clip = new Blob(chunks, { type: (recorder?.mimeType || 'video/webm').split(';')[0] }) }
        recorder.start()
        window.setTimeout(() => { if (recorder?.state === 'recording') recorder.stop() }, CLIP_SECONDS * 1000)
      } catch { recorder = null }
    }
    const stopClip = () => new Promise<Blob | null>(resolve => {
      // A clip the backend would refuse is left out rather than failing the check.
      const usable = () => (clip && clip.size > 0 && clip.size <= CLIP_MAX_BYTES ? clip : null)
      if (!recorder) return resolve(null)
      if (recorder.state === 'inactive') return resolve(usable())
      const prev = recorder.onstop
      recorder.onstop = ev => { prev?.call(recorder!, ev); resolve(usable()) }
      recorder.stop()
    })

    try {
      // 0. Light, sharpness and framing first, before asking anyone to move.
      setPhase('check')
      const deadline = Date.now() + READY_TIMEOUT_MS
      let good = 0
      while (alive(id) && Date.now() < deadline && good < READY_FRAMES) {
        const r = await probeFrame(token, await grab())
        if (!alive(id)) break
        show(r)
        good = r.usable ? good + 1 : 0
      }

      // 1. The resting pose, kept on the server against this link.
      if (!alive(id)) return
      setPhase('centre')
      for (let i = 0; i < CALIBRATION_FRAMES; i++) {
        const blob = await waitFor(id, () => true, 40000, true)
        if (!blob) throw new Error(t('faceLost'))
        kept.push(blob)
      }
      setDone(1)

      // 2. One movement at a time; each is waited for until the server sees it.
      startClip()
      for (const move of MOVES) {
        setPhase(move)
        const blob = await waitFor(id, r => r.direction === move, STEP_TIMEOUT_MS)
        if (!blob) throw new Error(t('faceMissed'))
        // A second frame straight after: the server needs to see the movement held.
        steps.push({ index: kept.length, step: move })
        kept.push(blob, await grab())
        setDone(d => d + 1)
      }
      const video = await stopClip()

      // 3. The portrait: square to the camera and held for a moment.
      setPhase('photo')
      let square = 0
      let portrait: Blob | null = null
      for (let i = 0; i < PORTRAIT_ATTEMPTS && square < PORTRAIT_HOLD_FRAMES; i++) {
        const blob = await waitFor(id, r => r.direction === 'centre' && Math.abs(r.yaw ?? 99) <= PORTRAIT_MAX_DEGREES && Math.abs(r.pitch ?? 99) <= PORTRAIT_MAX_DEGREES, STEP_TIMEOUT_MS)
        if (!blob) { square = 0; continue }
        square += 1
        kept.push(blob)
        portrait = blob
      }
      if (square < PORTRAIT_HOLD_FRAMES) throw new Error(t('faceLost'))
      setDone(SEGMENTS)

      cam.stop()
      if (alive(id)) onDone({ frames: kept, portrait, video, challenge: CHALLENGE, steps })
    } catch (e) {
      await stopClip()
      if (!alive(id)) return
      onFail(e instanceof ApiError ? t('netError') : (e as Error).message || t('faceLost'))
    }
  }

  const live = cam.state === 'live'
  const running = phase !== 'ready'
  // Closing the instructions is the start: the person has just read what to do.
  const closeSheet = () => { setShowing(false); if (!running && live) run() }
  const prompt = phase === 'ready' ? t('ovalTitle') : phase === 'check' ? t('moveCheck') : phase === 'photo' ? t('movePhoto') : t(MOVE_KEY[phase])

  return (
    <div className="on-night relative flex min-h-0 flex-1 flex-col bg-night">
      {showing && <FaceInstructions onClose={closeSheet} />}
      <h1 aria-live="polite" className="shrink-0 px-4 py-3 text-center text-base font-semibold text-white">{prompt}</h1>
      {/* A size container, so the stage can be the largest square that fits. */}
      <div className="flex min-h-0 flex-1 px-4">
        <div className="flex size-full items-center justify-center [container-type:size]">
          <FaceStage video={cam.videoRef} live={live} starting={cam.state === 'starting'} message={cam.state === 'starting' ? t('cameraStarting') : cam.error ? t(cam.error) : null}
            phase={phase} done={done} usable={running && ok} progress={t('ofN', { n: String(done), m: String(SEGMENTS) })} />
        </div>
      </div>
      <div className="relative flex min-h-16 shrink-0 items-center justify-center px-14 py-3">
        <span className="absolute left-4"><InfoButton dark onClick={() => setShowing(true)} /></span>
        {!running && !showing && <button className="h-10 rounded-full bg-lit px-6 text-[15px] font-semibold text-brand-deep hover:bg-lit-hover disabled:opacity-45" disabled={!live} onClick={run}>{t('start')}</button>}
        {/* What to fix, under the picture rather than over the face. */}
        {running && hint && <p aria-live="polite" className="rounded-full bg-citrus px-4 py-1.5 text-center text-sm font-medium text-brand-deep">{hint}</p>}
      </div>
    </div>
  )
}

/* The face oval, centred, as a path that starts at the top. */
const OVAL = 'M 100 22 A 60 78 0 1 1 100 178 A 60 78 0 1 1 100 22 Z'

const ARROW: Record<Move, ReactNode> = {
  up: <ArrowUp size={16} strokeWidth={2.4} aria-hidden />,
  down: <ArrowDown size={16} strokeWidth={2.4} aria-hidden />,
  left: <ArrowLeft size={16} strokeWidth={2.4} aria-hidden />,
  right: <ArrowRight size={16} strokeWidth={2.4} aria-hidden />,
}
/* Each badge sits on the side of the oval the head turns towards. The preview is
   mirrored, so the person's left is the screen's left. */
const BADGE_AT: Record<Move, string> = {
  up: 'left-1/2 top-1.5 -translate-x-1/2',
  down: 'bottom-3.5 left-1/2 -translate-x-1/2',
  left: 'left-1.5 top-1/2 -translate-y-1/2',
  right: 'right-1.5 top-1/2 -translate-y-1/2',
}

/**
 * A square stage showing the centre square of the frame, which is exactly the
 * square that gets sent, mirrored like a mirror. Around the oval, one badge per
 * head movement: Citrus while it is being asked for, Mint once the server has
 * seen it. The brand bar along the bottom edge shows how far the whole check is.
 */
function FaceStage({ video, live, starting, message, phase, done, usable, progress }: {
  video: React.MutableRefObject<HTMLVideoElement | null>; live: boolean; starting: boolean; message: string | null
  phase: 'ready' | 'check' | 'centre' | Move | 'photo'; done: number; usable: boolean; progress: string
}) {
  // Movement i is done once the resting pose (1) and the movements before it are.
  const moveState = (move: Move, i: number) => (done >= i + 2 ? 'done' : phase === move ? 'now' : 'todo')
  const ring = done >= SEGMENTS ? 'var(--color-lit)' : phase === 'photo' ? 'var(--color-citrus)' : usable ? 'rgba(47, 224, 168, 0.75)' : 'rgba(255, 255, 255, 0.45)'

  return (
    <div className="relative aspect-square w-[min(100cqw,100cqh)] overflow-hidden rounded-2xl bg-night ring-1 ring-white/10">
      <video ref={video} className="size-full scale-x-[-1] object-cover" playsInline muted style={{ display: live ? 'block' : 'none' }} />
      {message && <div className={STARTING}>{starting && <span className={SPINNER} />}<p>{message}</p></div>}
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        <defs>
          <mask id="face-oval-mask"><rect width="200" height="200" fill="white" /><path d={OVAL} fill="black" /></mask>
        </defs>
        {/* Everything outside the oval goes dark, so the eye lands on the face. */}
        <rect width="200" height="200" fill="rgba(11, 22, 20, 0.64)" mask="url(#face-oval-mask)" />
        <path d={OVAL} fill="none" strokeWidth="3" stroke={ring} className="transition-[stroke] duration-300" />
      </svg>

      {MOVES.map((move, i) => {
        const state = moveState(move, i)
        return (
          <span key={move} className={`absolute grid size-7 place-items-center rounded-full transition-colors duration-300 ${BADGE_AT[move]} ${
            state === 'done' ? 'bg-lit text-brand-deep' : state === 'now' ? 'bg-citrus text-brand-deep ring-4 ring-citrus/30' : 'bg-white/15 text-white/75'
          }`}>
            {state === 'done' ? <Tick size={14} width={2.6} /> : ARROW[move]}
          </span>
        )
      })}

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={SEGMENTS} aria-valuenow={done} aria-valuetext={progress}>
        <div className="h-full bg-brand-bar transition-[width] duration-500" style={{ width: `${(done / SEGMENTS) * 100}%` }} />
      </div>
    </div>
  )
}
