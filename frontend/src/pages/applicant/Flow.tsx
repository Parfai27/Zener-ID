// Applicant verification, laid out like Shufti's hosted flow: one 750px card
// (header stepper · body · "Powered by" footer). The order follows the backend:
// consent → document → face → verification → result. The document comes first
// because the face is compared with the photo printed on it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, Camera, Check, CheckCircle2, ChevronDown, ClipboardCheck, Clock, EyeOff, IdCard, ImageUp, Languages, RefreshCw, ScanFace, Smartphone, Sun, X } from 'lucide-react'
import { ApiError, getSession, probeFrame, sessionQr, submitDocument, submitFace, type FrameProbe } from '../../api'
import type { DocumentType, QualityReport, SessionView } from '../../api/types'
import { Logo, Modal } from '../../components/ui'
import { assessQuality, loadImage, toJpeg } from '../../lib/quality'
import { useCamera } from './useCamera'
import { LANGS, LangCtx, initialLang, makeT, useLang, useT, type Dict, type Lang } from './i18n'

// ---------------------------------------------------------------- data
type Country = { name: string; docs: DocumentType[] }
const COUNTRIES: Country[] = [
  { name: 'Rwanda', docs: ['passport', 'id_card', 'driving_license'] },
  { name: 'Kenya', docs: ['passport', 'id_card', 'driving_license'] },
  { name: 'Uganda', docs: ['passport', 'id_card', 'driving_license'] },
  { name: 'Tanzania', docs: ['passport', 'id_card', 'driving_license'] },
  { name: 'Burundi', docs: ['passport', 'id_card'] },
  { name: 'DR Congo', docs: ['passport', 'id_card'] },
  { name: 'Other country', docs: ['passport'] },
]
// Labels are i18n keys (see i18n.ts).
const DOC: Record<DocumentType, { label: 'passport' | 'idCard' | 'license'; sub: 'photoPage' | 'frontBack'; sides: 1 | 2 }> = {
  passport: { label: 'passport', sub: 'photoPage', sides: 1 },
  id_card: { label: 'idCard', sub: 'frontBack', sides: 2 },
  driving_license: { label: 'license', sub: 'frontBack', sides: 2 },
}

// Document photos keep enough detail for the backend's OCR and MRZ reading: a
// licence often fills only part of a phone photo.
const DOC_MAX_PX = 2000

type Side = 'front' | 'back'
type Screen =
  | { s: 'loading' } | { s: 'invalid' } | { s: 'expired' } | { s: 'consent' } | { s: 'other' } | { s: 'attempts' }
  | { s: 'doc-select' } | { s: 'doc-method'; side: Side } | { s: 'doc-capture'; side: Side }
  | { s: 'doc-review'; side: Side; url: string; quality: QualityReport; busy?: boolean }
  | { s: 'doc-failed'; reasons: string[]; error?: string }
  | { s: 'face-intro' } | { s: 'face-capture' } | { s: 'face-failed'; error?: string }
  | { s: 'verifying'; what: 'document' | 'face' } | { s: 'done' }

/** Which header step is active: 0 document · 1 face · 2 verification · 3 result. */
function stepOf(sc: Screen): number {
  if (sc.s.startsWith('doc') || sc.s === 'consent') return 0
  if (sc.s.startsWith('face')) return 1
  if (sc.s === 'verifying') return 2
  if (sc.s === 'done' || sc.s === 'attempts') return 4
  return -1
}

type DocShots = { document_type: DocumentType; front: string; back?: string }

/** The backend's "no attempts left" refusal, so the page can say it in the person's language. */
const outOfAttempts = (e: unknown) => e instanceof ApiError && e.status === 409 && /attempt/i.test(e.message)

// ---------------------------------------------------------------- flow
export function ApplicantFlow() {
  const { token = '' } = useParams()
  const [session, setSession] = useState<SessionView | null>(null)
  const [sc, setSc] = useState<Screen>({ s: 'loading' })
  const [country, setCountry] = useState(COUNTRIES[0])
  const [doc, setDoc] = useState<DocumentType>('id_card')
  const [shots, setShots] = useState<{ front?: string; back?: string }>({})
  const [modal, setModal] = useState<'phone' | 'help' | null>(null)
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
      if (sv.next_step === 'face') return setSc({ s: 'face-intro' })
      // Nothing done yet: ask for consent first. Coming back part-way: carry on.
      setSc(sv.completed_steps.length ? { s: 'doc-select' } : { s: 'consent' })
    }, () => setSc({ s: 'invalid' }))
  }, [token])

  // The person goes through every step first (document photos, then the face
  // check); nothing is shown as decided until the Verification step. The document
  // is sent the moment its photos are taken, quietly, so the backend reads it
  // (OCR, MRZ, the portrait: tens of seconds on a laptop) while the person does
  // the face check; the Verification step then waits for that answer, sends the
  // face, and shows the result. A rejected document sends them back to retake the
  // document only: the face capture already taken is reused.
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
    if (side === 'front' && DOC[doc].sides === 2) return setSc({ s: 'doc-method', side: 'back' })
    const docShots: DocShots = { document_type: doc, front: next.front!, back: next.back }
    setPendingDoc(docShots)
    setShots({})
    startDocument(docShots)
    // Retaking the document after a rejection: the face is already captured.
    if (pendingFace) verify(docShots, pendingFace)
    else setSc({ s: 'face-intro' })
  }

  const afterFace = (capture: FaceCaptureResult) => {
    setPendingFace(capture)
    verify(pendingDoc, capture)
  }

  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
    <div className="sf-page">
      <div className="sf-card">
        <Header step={stepOf(sc)} onPhone={() => setModal('phone')} onHelp={() => setModal('help')} />
        <div className="sf-body">
          {sc.s === 'loading' && <div className="sf-center"><div className="sf-ring" /><p className="sf-sub">{t('loading')}</p></div>}
          {sc.s === 'invalid' && <Notice icon={<X size={34} />} tone="bad" title={t('invalidTitle')} text={t('invalidText')} />}
          {sc.s === 'expired' && <Notice icon={<Clock size={34} />} tone="muted" title={t('expiredTitle')} text={t('expiredText')} />}
          {sc.s === 'other' && <Notice icon={<ArrowRight size={34} />} tone="muted" title={t('otherStepTitle')} text={t('otherStepText')} />}
          {sc.s === 'attempts' && <Notice icon={<Clock size={34} />} tone="muted" title={t('verifyingTitle')} text={t('attemptsUsed')} />}
          {sc.s === 'consent' && <Consent onStart={() => setSc({ s: 'doc-select' })} />}

          {sc.s === 'doc-select' && (
            <DocSelect country={country} allowed={session?.document_types} onCountry={c => setCountry(c)}
              onPick={d => { setDoc(d); setShots({}); setSc({ s: 'doc-method', side: 'front' }) }} />
          )}
          {sc.s === 'doc-method' && (
            <DocMethod doc={doc} side={sc.side} onBack={() => setSc(sc.side === 'back' ? { s: 'doc-method', side: 'front' } : { s: 'doc-select' })}
              onCamera={() => setSc({ s: 'doc-capture', side: sc.side })}
              onImage={(url, q) => setSc({ s: 'doc-review', side: sc.side, url, quality: q })} />
          )}
          {sc.s === 'doc-capture' && (
            <DocCapture doc={doc} side={sc.side} onBack={() => setSc({ s: 'doc-method', side: sc.side })}
              onImage={(url, q) => setSc({ s: 'doc-review', side: sc.side, url, quality: q })} />
          )}
          {sc.s === 'doc-review' && (
            <DocReview screen={sc} doc={doc} onRetake={() => setSc({ s: 'doc-method', side: sc.side })} onContinue={() => afterReview(sc.side, sc.url)} />
          )}
          {sc.s === 'doc-failed' && (
            <Failed title={t('docFailedTitle')} text={sc.error || t('docFailedText')} codes={sc.reasons} onRetry={() => setSc({ s: 'doc-method', side: 'front' })} />
          )}

          {sc.s === 'face-intro' && <FaceIntro onStart={() => setSc({ s: 'face-capture' })} />}
          {sc.s === 'face-capture' && <FaceCapture token={token} onBack={() => setSc({ s: 'face-intro' })} onDone={afterFace} />}
          {sc.s === 'face-failed' && (
            <Failed title={t('faceFailedTitle')} text={sc.error || t('faceFailedText')} codes={[]} onRetry={() => setSc({ s: 'face-capture' })} />
          )}

          {sc.s === 'verifying' && (
            <div className="sf-center"><div className="sf-ring" /><h2 className="sf-title">{t('verifyingTitle')}</h2><p className="sf-sub">{sc.what === 'document' ? t('checkingDocument') : t('checkingFace')}</p><p className="sf-sub" style={{ marginTop: 4 }}>{t('verifyingText')}</p></div>
          )}
          {sc.s === 'done' && (
            <div className="sf-center">
              <div className="sf-big-ic" style={{ background: '#e4f4ec', color: '#18794e' }}><Check size={40} strokeWidth={2.5} /></div>
              <h2 className="sf-title">{t('doneTitle')}</h2>
              <p className="sf-sub" style={{ maxWidth: 520 }}>{t('doneText')}</p>
              {session && <p className="sf-sub" style={{ marginTop: 8 }}>{t('reference')}: <b style={{ color: '#1f2328', fontFamily: 'var(--mono)' }}>{session.reference}</b></p>}
            </div>
          )}
        </div>
        <div className="sf-foot">© {t('poweredBy')} <span style={{ display: 'inline-flex', marginLeft: 4 }}><Logo size="xs" /></span></div>
      </div>

      <Modal open={modal === 'phone'} onClose={() => setModal(null)} width={420}>
        <div className="sf-modal-qr">
          <Smartphone size={26} color="#0f5246" />
          <h3 className="sf-title" style={{ fontSize: 19 }}>{t('phoneTitle')}</h3>
          <p className="sf-sub">{t('phoneText')}</p>
          <img src={sessionQr(token)} width={170} height={170} alt={t('phoneTitle')} style={{ background: '#fff' }} />
          <button className="sf-btn primary" onClick={() => setModal(null)}>{t('close')}</button>
        </div>
      </Modal>
      <Modal open={modal === 'help'} onClose={() => setModal(null)} width={480}>
        <div className="col" style={{ gap: 12 }}>
          <h3 className="sf-title" style={{ fontSize: 19 }}>{t('helpTitle')}</h3>
          <Tip icon={<Sun size={20} />} title={t('helpLight')}>{t('helpLightText')}</Tip>
          <Tip icon={<Camera size={20} />} title={t('helpCamera')}>{t('helpCameraText')}</Tip>
          <Tip icon={<Smartphone size={20} />} title={t('helpPhone')}>{t('helpPhoneText')}</Tip>
          <div className="sf-actions"><button className="sf-btn primary" onClick={() => setModal(null)}>{t('gotIt')}</button></div>
        </div>
      </Modal>
    </div>
    </LangCtx.Provider>
  )
}

function Failed({ title, text, codes, onRetry }: { title: string; text: string; codes: string[]; onRetry: () => void }) {
  const t = useT()
  return (
    <div className="sf-center">
      <div className="sf-big-ic" style={{ background: '#fdeaea', color: '#c62828' }}><AlertCircle size={36} /></div>
      <h2 className="sf-title">{title}</h2>
      <p className="sf-sub" style={{ maxWidth: 480 }}>{text}</p>
      {codes.length > 0 && <p className="sf-sub" style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{codes.join(' · ')}</p>}
      <div className="sf-actions" style={{ justifyContent: 'center' }}><button className="sf-btn primary" onClick={onRetry}><RefreshCw size={16} /> {t('tryAgain')}</button></div>
    </div>
  )
}

// ---------------------------------------------------------------- header
function Header({ step, onPhone, onHelp }: { step: number; onPhone: () => void; onHelp: () => void }) {
  const { lang, setLang, t } = useLang()
  const [open, setOpen] = useState(false)
  // One family of line icons at one size, so every step reads the same; a finished
  // step keeps its icon and gets a tick badge on top.
  const icons = [IdCard, ScanFace, BadgeCheck, ClipboardCheck]
  const names = [t('stepDocument'), t('stepFace'), t('stepVerification'), t('stepResult')]
  return (
    <div className="sf-head">
      <div className="sf-steps" aria-label="Progress">
        {icons.map((Icon, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span className={`sf-line${i <= step ? '' : ' todo'}`} />}
            <span className={`sf-step ${i < step ? 'done' : i === step ? 'current' : 'upcoming'}`} title={names[i]} aria-label={`${names[i]}${i < step ? ' ✓' : ''}`} aria-current={i === step ? 'step' : undefined}>
              <Icon strokeWidth={2} />
              {i < step && <span className="badge" aria-hidden><Check strokeWidth={3.5} /></span>}
            </span>
          </span>
        ))}
      </div>
      <div className="sf-tools">
        <button className="sf-phone" onClick={onPhone} aria-label={t('phoneButton')} title={t('phoneButton')}><Smartphone size={17} /></button>
        <div className="sf-lang" onClick={() => setOpen(!open)} role="button" aria-haspopup="menu">
          <Languages size={17} color="#0f5246" /> {lang} <ChevronDown size={14} strokeWidth={3} />
          {open && (
            <div className="sf-lang-menu" role="menu">
              {LANGS.map(([k, l]) => (
                <button key={k} role="menuitemradio" aria-checked={k === lang} style={k === lang ? { fontWeight: 700, color: '#0f5246' } : undefined} onClick={e => { e.stopPropagation(); setLang(k); setOpen(false) }}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <button className="sf-help" onClick={onHelp}>{t('help')}</button>
      </div>
    </div>
  )
}

// Solid glyphs matching the Shufti header icons.
const FaceIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12.6 2.2c-4.1 0-7.1 3-7.1 6.8 0 2 .7 3.5 1.9 4.7V21c0 .5.4.9.9.9h6.3c.5 0 .9-.4.9-.9v-2.1h1.9c1 0 1.7-.8 1.7-1.7v-2.4l1.5-.6c.4-.2.6-.6.4-1l-1.6-3.2c-.4-4.2-3-7.8-6.8-7.8z" /></svg>
)
const DocIcon = ({ d }: { d: DocumentType }) =>
  d === 'passport' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><rect x="4.5" y="2.5" width="15" height="19" rx="2" fill="currentColor" /><circle cx="12" cy="10" r="3.2" fill="none" stroke="#fff" strokeWidth="1.6" /><path d="M8.5 17h7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ) : d === 'driving_license' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><rect x="2.2" y="5" width="19.6" height="14" rx="2.4" fill="currentColor" /><path d="M5.6 10h6M5.6 13.6h4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><circle cx="16.4" cy="10.6" r="2" fill="#fff" /><path d="M13.4 15.6c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5z" fill="#fff" /></svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><rect x="2.2" y="5" width="19.6" height="14" rx="2.4" fill="currentColor" /><circle cx="8.3" cy="10.6" r="2" fill="#fff" /><path d="M5.3 15.6c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5z" fill="#fff" /><path d="M13.8 10h4.6M13.8 13.6h4.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
  )

// ---------------------------------------------------------------- flags (drawn, circular)
function Flag({ country }: { country: string }) {
  const f: Record<string, ReactNode> = {
    Rwanda: <><rect width="24" height="12" fill="#00a1de" /><rect y="12" width="24" height="6" fill="#fad201" /><rect y="18" width="24" height="6" fill="#20603d" /><circle cx="17.5" cy="6" r="2.3" fill="#fad201" /></>,
    Kenya: <><rect width="24" height="24" fill="#fff" /><rect width="24" height="7.4" fill="#000" /><rect y="8.6" width="24" height="6.8" fill="#bb0000" /><rect y="16.6" width="24" height="7.4" fill="#006600" /><ellipse cx="12" cy="12" rx="2.6" ry="4.6" fill="#bb0000" stroke="#000" strokeWidth=".8" /></>,
    Uganda: <>{['#000', '#fcdc04', '#d90000', '#000', '#fcdc04', '#d90000'].map((c, i) => <rect key={i} y={i * 4} width="24" height="4" fill={c} />)}<circle cx="12" cy="12" r="3.6" fill="#fff" /></>,
    Tanzania: <><rect width="24" height="24" fill="#00a3dd" /><path d="M0 0h24L0 24z" fill="#1eb53a" /><path d="M0 24L24 0" stroke="#fcd116" strokeWidth="9" /><path d="M0 24L24 0" stroke="#000" strokeWidth="6" /></>,
    Burundi: <><rect width="24" height="24" fill="#ce1126" /><path d="M0 0L12 12 0 24zM24 0L12 12 24 24z" fill="#1eb53a" /><path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="3" /><circle cx="12" cy="12" r="4.6" fill="#fff" /></>,
    'DR Congo': <><rect width="24" height="24" fill="#007fff" /><path d="M0 24L24 0" stroke="#f7d618" strokeWidth="9" /><path d="M0 24L24 0" stroke="#ce1021" strokeWidth="6" /><path d="M5 2.5l1 2.6 2.8.1-2.2 1.7.8 2.7L5 8l-2.4 1.6.8-2.7-2.2-1.7 2.8-.1z" fill="#f7d618" /></>,
  }
  return (
    <svg className="sf-flag" viewBox="0 0 24 24" aria-hidden>
      {f[country] || <><rect width="24" height="24" fill="#dcf7ec" /><circle cx="12" cy="12" r="7" fill="none" stroke="#0f5246" strokeWidth="1.5" /><path d="M5 12h14M12 5c2.4 2.6 2.4 11.4 0 14M12 5c-2.4 2.6-2.4 11.4 0 14" fill="none" stroke="#0f5246" strokeWidth="1.2" /></>}
    </svg>
  )
}

// ---------------------------------------------------------------- screens
function Notice({ icon, title, text, tone }: { icon: ReactNode; title: string; text: string; tone: 'bad' | 'muted' }) {
  return (
    <div className="sf-center">
      <div className="sf-big-ic" style={{ background: tone === 'bad' ? '#fdeaea' : '#f3f7f2', color: tone === 'bad' ? '#c62828' : '#5f6368' }}>{icon}</div>
      <h2 className="sf-title">{title}</h2><p className="sf-sub" style={{ maxWidth: 480 }}>{text}</p>
    </div>
  )
}

function Tip({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="sf-tip"><span className="ic">{icon}</span><div><b>{title}</b>{children}</div></div>
}

function Consent({ onStart }: { onStart: () => void }) {
  const t = useT()
  const [agree, setAgree] = useState(false)
  return (
    <>
      <h1 className="sf-title">{t('consentTitle')}</h1>
      <p className="sf-sub">{t('consentText')}</p>
      <div className="sf-docs" style={{ marginTop: 22 }}>
        <div className="sf-doc" style={{ cursor: 'default' }}><span className="ic"><DocIcon d="id_card" /></span><div><b>{t('stepDocument')}</b><span>{t('docCardSub')}</span></div></div>
        <div className="sf-doc" style={{ cursor: 'default' }}><span className="ic"><FaceIcon /></span><div><b>{t('stepFace')}</b><span>{t('faceCardSub')}</span></div></div>
      </div>
      <label className="sf-check">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>{t('agree')} <a href="#" onClick={e => e.preventDefault()}>{t('privacy')}</a> {t('and')} <a href="#" onClick={e => e.preventDefault()}>{t('terms')}</a>.</span>
      </label>
      <div className="sf-actions"><button className="sf-btn primary" disabled={!agree} onClick={onStart}>{t('getStarted')} <ArrowRight size={17} /></button></div>
    </>
  )
}

function FaceIntro({ onStart }: { onStart: () => void }) {
  const t = useT()
  return (
    <>
      <h1 className="sf-title">{t('stepFace')}</h1>
      <p className="sf-sub">{t('faceText')}</p>
      <div className="sf-tips" style={{ marginTop: 22 }}>
        <Tip icon={<Sun size={20} />} title={t('tipLight')}><span style={{ display: 'block', color: '#5f6368', fontSize: 13 }}>{t('tipLightSub')}</span></Tip>
        <Tip icon={<EyeOff size={20} />} title={t('tipGlasses')}><span style={{ display: 'block', color: '#5f6368', fontSize: 13 }}>{t('tipGlassesSub')}</span></Tip>
        <Tip icon={<ScanFace size={20} />} title={t('tipPrompts')}><span style={{ display: 'block', color: '#5f6368', fontSize: 13 }}>{t('tipPromptsSub')}</span></Tip>
      </div>
      <div className="sf-preview" style={{ height: 170, background: 'linear-gradient(135deg,#f3f7f2,#dcf7ec)' }}><ScanFace size={74} color="#0f5246" strokeWidth={1.2} /></div>
      <div className="sf-actions"><button className="sf-btn primary" onClick={onStart}><Camera size={17} /> {t('startFace')}</button></div>
    </>
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
const CLIP_SECONDS = 3

export interface FaceCaptureResult {
  frames: Blob[]; portrait: Blob | null; video: Blob | null; challenge: string; steps: Array<{ index: number; step: string }>
}

function FaceCapture({ token, onBack, onDone }: { token: string; onBack: () => void; onDone: (r: FaceCaptureResult) => void }) {
  const t = useT()
  const cam = useCamera('user')
  const [phase, setPhase] = useState<'ready' | 'check' | 'centre' | Move | 'photo'>('ready')
  const [done, setDone] = useState<Move[]>([])
  const [hint, setHint] = useState('')
  const [ok, setOk] = useState(false)
  const [problem, setProblem] = useState('')
  // Each run of the capture has a number; a run keeps going only while it is the
  // latest one and the page is still open. Leaving the page or pressing Cancel
  // bumps the number, so an old run stops at its next step. (Set again on every
  // mount: React's development mode mounts twice.)
  const mounted = useRef(true)
  const runId = useRef(0)
  const alive = (id: number) => mounted.current && runId.current === id

  useEffect(() => {
    mounted.current = true
    cam.start()
    return () => { mounted.current = false; runId.current++ }
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

  const cancel = () => { runId.current++; setPhase('ready'); setHint(''); setOk(false); setDone([]) }

  const run = async () => {
    const id = ++runId.current
    setProblem(''); setDone([])
    const kept: Blob[] = []
    const steps: Array<{ index: number; step: string }> = []

    // A few seconds of the challenge, kept as evidence of how the check went.
    let clip: Blob | null = null
    let recorder: MediaRecorder | null = null
    const chunks: Blob[] = []
    const stream = cam.videoRef.current?.srcObject as MediaStream | null
    if (stream && typeof MediaRecorder !== 'undefined') {
      try {
        recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined })
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        // The plain type, without the codecs Chrome adds ("video/webm;codecs=vp8").
        recorder.onstop = () => { clip = new Blob(chunks, { type: (recorder?.mimeType || 'video/webm').split(';')[0] }) }
        recorder.start()
        window.setTimeout(() => { if (recorder?.state === 'recording') recorder.stop() }, CLIP_SECONDS * 1000)
      } catch { recorder = null }
    }
    const stopClip = () => new Promise<Blob | null>(resolve => {
      if (!recorder) return resolve(null)
      if (recorder.state === 'inactive') return resolve(clip)
      const prev = recorder.onstop
      recorder.onstop = ev => { prev?.call(recorder!, ev); resolve(clip) }
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

      // 2. One movement at a time; each is waited for until the server sees it.
      for (const move of MOVES) {
        setPhase(move)
        const blob = await waitFor(id, r => r.direction === move, STEP_TIMEOUT_MS)
        if (!blob) throw new Error(t('faceMissed'))
        // A second frame straight after: the server needs to see the movement held.
        steps.push({ index: kept.length, step: move })
        kept.push(blob, await grab())
        setDone(d => [...d, move])
      }

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

      const video = await stopClip()
      cam.stop()
      if (alive(id)) onDone({ frames: kept, portrait, video, challenge: CHALLENGE, steps })
    } catch (e) {
      await stopClip()
      if (!alive(id)) return
      setPhase('ready'); setHint(''); setOk(false)
      setProblem(e instanceof ApiError ? t('netError') : (e as Error).message || t('faceLost'))
    }
  }

  const running = phase !== 'ready'
  const prompt = phase === 'check' ? t('moveCheck') : phase === 'photo' ? t('movePhoto') : phase === 'ready' ? '' : t(MOVE_KEY[phase])
  const arrow = phase === 'up' ? <ArrowUp size={16} /> : phase === 'down' ? <ArrowDown size={16} /> : phase === 'left' ? <ArrowLeft size={16} /> : phase === 'right' ? <ArrowRight size={16} /> : <ScanFace size={16} />
  return (
    <>
      <h1 className="sf-title">{t('ovalTitle')}</h1>
      <p className="sf-sub">{running ? (hint || t('ovalRunning')) : t('ovalReady')}</p>
      <div className="sf-cam">
        <video ref={cam.videoRef} className="mirror" playsInline muted style={{ display: cam.state === 'live' ? 'block' : 'none' }} />
        {cam.state === 'live' && <div className={`face-frame${running && ok ? ' ok' : ''}`} />}
        {cam.state !== 'live' && <div className="msg">{cam.state === 'starting' ? t('cameraStarting') : cam.error ? t(cam.error) : t('cameraOff')}</div>}
        {running && <span className="prompt">{arrow} {prompt}</span>}
      </div>
      <div className="sf-moves">
        {MOVES.map(m => <span key={m} className={`sf-move${done.includes(m) ? ' done' : phase === m ? ' now' : ''}`}>{done.includes(m) ? <Check size={14} /> : null}{m === 'up' ? <ArrowUp size={14} /> : m === 'down' ? <ArrowDown size={14} /> : m === 'left' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</span>)}
      </div>
      {problem && <div className="sf-error" style={{ marginTop: 12 }}><AlertCircle size={17} /> {problem}</div>}
      <div className="sf-actions">
        {!running && <button className="sf-btn ghost" onClick={() => { cam.stop(); onBack() }}>{t('back')}</button>}
        {!running && <button className="sf-btn primary" disabled={cam.state !== 'live'} onClick={run}>{problem ? t('tryAgain') : t('start')}</button>}
        {running && <button className="sf-btn ghost" onClick={cancel}>{t('cancel')}</button>}
      </div>
    </>
  )
}

function DocSelect({ country, allowed, onCountry, onPick }: { country: Country; allowed?: DocumentType[]; onCountry: (c: Country) => void; onPick: (d: DocumentType) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const cname = (c: Country) => (c.name === 'Other country' ? t('otherCountry') : c.name)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const list = COUNTRIES.filter(c => cname(c).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <h1 className="sf-title">{t('countryTitle')}</h1>
      <div className="sf-select" ref={ref}>
        <button className="sf-select-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
          <Flag country={country.name} /> {cname(country)} <ChevronDown className="chev" size={18} />
        </button>
        {open && (
          <div className="sf-options" role="listbox">
            <input autoFocus placeholder={t('searchCountry')} value={q} onChange={e => setQ(e.target.value)} />
            {list.map(c => (
              <button key={c.name} role="option" aria-selected={c.name === country.name} className={`sf-option${c.name === country.name ? ' on' : ''}`} onClick={() => { onCountry(c); setOpen(false); setQ('') }}>
                <Flag country={c.name} /> {cname(c)}
              </button>
            ))}
            {list.length === 0 && <div className="sf-sub" style={{ padding: 10 }}>{t('noCountry')}</div>}
          </div>
        )}
      </div>
      <div className="sf-gap" />
      <h2 className="sf-title">{t('docTypeTitle')}</h2>
      <p className="sf-sub">{t('docTypeSub')}</p>
      <div className="sf-docs">
        {country.docs.filter(d => !allowed || allowed.includes(d)).map(d => (
          <button key={d} className="sf-doc" onClick={() => onPick(d)}>
            <span className="ic"><DocIcon d={d} /></span>
            <div><b>{t(DOC[d].label)}</b><span>{t(DOC[d].sub)}</span></div>
          </button>
        ))}
      </div>
    </>
  )
}

const sideName = (t: ReturnType<typeof useT>, doc: DocumentType, side: Side) => t(DOC[doc].sides === 1 ? 'sidePhoto' : side === 'front' ? 'sideFront' : 'sideBack')

function DocMethod({ doc, side, onBack, onCamera, onImage }: {
  doc: DocumentType; side: Side; onBack: () => void; onCamera: () => void; onImage: (url: string, q: QualityReport) => void
}) {
  const t = useT()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const fromFile = (f?: File) => {
    if (!f) return
    setBusy(true)
    const r = new FileReader()
    r.onload = async () => { const url = String(r.result); const img = await loadImage(url); const q = await assessQuality(url, img.naturalWidth, img.naturalHeight); onImage(toJpeg(img, img.naturalWidth, img.naturalHeight, DOC_MAX_PX, 0.9), q) }
    r.readAsDataURL(f)
  }
  return (
    <>
      <h1 className="sf-title">{t('uploadTitle', { side: sideName(t, doc, side), doc: t(DOC[doc].label) })}</h1>
      <p className="sf-sub">{t('methodSub')}</p>
      <div className="sf-docs" style={{ marginTop: 22 }}>
        <button className="sf-doc" onClick={onCamera} disabled={busy}><span className="ic"><Camera size={20} /></span><div><b>{t('takePhoto')}</b><span>{t('takePhotoSub')}</span></div></button>
        <button className="sf-doc" onClick={() => file.current?.click()} disabled={busy}><span className="ic"><ImageUp size={20} /></span><div><b>{t('uploadDevice')}</b><span>{t('uploadDeviceSub')}</span></div></button>
      </div>
      <input ref={file} type="file" accept="image/jpeg,image/png" hidden onChange={e => fromFile(e.target.files?.[0])} />
      <div className="sf-actions"><button className="sf-btn ghost" onClick={onBack}>{t('back')}</button></div>
    </>
  )
}

function DocCapture({ doc, side, onBack, onImage }: { doc: DocumentType; side: Side; onBack: () => void; onImage: (url: string, q: QualityReport) => void }) {
  const t = useT()
  const cam = useCamera('environment')
  const [busy, setBusy] = useState(false)
  useEffect(() => { cam.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const capture = async () => {
    const s = cam.snap()
    if (!s) return
    setBusy(true)
    const q = await assessQuality(s.url, s.w, s.h)
    const img = await loadImage(s.url)
    cam.stop()
    onImage(toJpeg(img, img.naturalWidth, img.naturalHeight, DOC_MAX_PX, 0.9), q)
  }
  return (
    <>
      <h1 className="sf-title">{t('captureTitle', { side: sideName(t, doc, side), doc: t(DOC[doc].label) })}</h1>
      <p className="sf-sub">{t('captureText')}</p>
      <div className="sf-cam">
        <video ref={cam.videoRef} playsInline muted style={{ display: cam.state === 'live' ? 'block' : 'none' }} />
        {cam.state === 'live' && <div className="doc-frame" />}
        {cam.state !== 'live' && <div className="msg">{cam.state === 'starting' ? t('cameraStarting') : cam.error ? t(cam.error) : t('cameraOff')}</div>}
      </div>
      <div className="sf-actions">
        <button className="sf-btn ghost" onClick={() => { cam.stop(); onBack() }}>{t('back')}</button>
        <button className="sf-btn primary" disabled={cam.state !== 'live' || busy} onClick={capture}><Camera size={17} /> {t('capture')}</button>
      </div>
    </>
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
    <>
      <h1 className="sf-title">{t('checkTitle')}</h1>
      <p className="sf-sub">{t('checkText', { side: sideName(t, doc, screen.side), doc: t(DOC[doc].label) })}</p>
      <div className="sf-preview" style={problem ? { outline: '2px solid #e57373', outlineOffset: -2 } : undefined}><img src={screen.url} alt={t('checkTitle')} /></div>
      {problem ? <div className="sf-error"><AlertCircle size={17} /> {problem}</div> : <div className="sf-okmsg"><CheckCircle2 size={17} /> {t('qualityOk')}</div>}
      <div className="sf-actions">
        <button className="sf-btn ghost" onClick={onRetake} disabled={screen.busy}><RefreshCw size={16} /> {t('retake')}</button>
        {!problem && <button className="sf-btn primary" onClick={onContinue} disabled={screen.busy}>{screen.busy ? t('uploading') : t('continue')}</button>}
      </div>
    </>
  )
}
