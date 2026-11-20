// Applicant verification, laid out exactly like Shufti's hosted flow:
// one 750px card (header stepper · body · "Powered by" footer), and the same
// step order: consent → face → document → verification → result.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronDown, Clock, EyeOff, FlaskConical, ImageUp, Languages, RefreshCw, ScanFace, Smartphone, Sun, X } from 'lucide-react'
import { completeSession, getSession, startSession, submitDocument, submitFace } from '../../api'
import type { DocumentType, QualityReport, SandboxOutcome, SessionView } from '../../api/types'
import { Logo, Modal, Qr } from '../../components/ui'
import { documentArt } from '../../lib/art'
import { assessQuality, loadImage, toJpeg } from '../../lib/quality'
import { useCamera } from './useCamera'
import { LANGS, LangCtx, initialLang, makeT, useLang, useT, type Lang } from './i18n'

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
const OUTCOMES: Array<[SandboxOutcome, string]> = [
  ['auto', 'Pass (default)'], ['blurry_once', 'First document photo is blurry'], ['face_mismatch', 'Fail: face does not match'],
  ['face_borderline', 'Needs review: borderline face score'], ['liveness_fail', 'Fail: liveness (photo/screen)'],
  ['name_mismatch', 'Fail: name mismatch'], ['dob_mismatch', 'Fail: date of birth mismatch'],
  ['expired_document', 'Fail: expired document'], ['underage', 'Fail: under 18'],
]
const MOVES = ['lookStraight', 'turnLeft', 'turnRight'] as const

type Side = 'front' | 'back'
type Screen =
  | { s: 'loading' } | { s: 'invalid' } | { s: 'expired' } | { s: 'consent' }
  | { s: 'face-intro' } | { s: 'face-capture' } | { s: 'face-review'; frames: string[] }
  | { s: 'doc-select' } | { s: 'doc-method'; side: Side } | { s: 'doc-capture'; side: Side }
  | { s: 'doc-review'; side: Side; url: string; quality: QualityReport; busy?: boolean }
  | { s: 'verifying' } | { s: 'done' }

/** Which header step is active: 0 face · 1 document · 2 verification · 3 result. */
function stepOf(sc: Screen): number {
  if (sc.s.startsWith('face') || sc.s === 'consent') return 0
  if (sc.s.startsWith('doc')) return 1
  if (sc.s === 'verifying') return 2
  if (sc.s === 'done') return 4
  return -1
}

// ---------------------------------------------------------------- flow
export function ApplicantFlow() {
  const { token = '' } = useParams()
  const [session, setSession] = useState<SessionView | null>(null)
  const [sc, setSc] = useState<Screen>({ s: 'loading' })
  const [country, setCountry] = useState(COUNTRIES[0])
  const [doc, setDoc] = useState<DocumentType>('id_card')
  const [shots, setShots] = useState<{ front?: string; back?: string; quality?: QualityReport }>({})
  const [modal, setModal] = useState<'phone' | 'help' | null>(null)
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = (l: Lang) => { setLangState(l); try { sessionStorage.setItem('zid.lang', l) } catch { /* private mode */ } }
  useEffect(() => { document.documentElement.lang = LANGS.find(x => x[0] === lang)![2] }, [lang])
  const t = makeT(lang)
  const [outcome, setOutcome] = useState<SandboxOutcome>(() => (sessionStorage.getItem('zid.outcome.' + token) as SandboxOutcome) || 'auto')
  useEffect(() => { sessionStorage.setItem('zid.outcome.' + token, outcome) }, [outcome, token])

  const verify = async () => {
    setSc({ s: 'verifying' })
    await completeSession(token, { outcome })
    setSc({ s: 'done' })
  }

  useEffect(() => {
    getSession(token).then(sv => {
      setSession(sv)
      if (sv.expired) return setSc({ s: 'expired' })
      const map = { consent: 'consent', face: 'face-intro', document: 'doc-select', done: 'done' } as const
      if (sv.next_step === 'verify') verify()
      else setSc({ s: map[sv.next_step] })
    }, () => setSc({ s: 'invalid' }))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const afterReview = async (side: Side, url: string, quality: QualityReport) => {
    const next = { ...shots, [side]: url, quality: side === 'front' ? quality : shots.quality }
    setShots(next)
    if (side === 'front' && DOC[doc].sides === 2) return setSc({ s: 'doc-method', side: 'back' })
    setSc({ s: 'doc-review', side, url, quality, busy: true })
    const r = await submitDocument(token, { document_type: doc, country: country.name, front: next.front!, back: next.back, quality: next.quality!, outcome })
    if (r.status === 'retake') { setShots({}); setSc({ s: 'doc-review', side: 'front', url: next.front!, quality: r.quality }) }
    else verify()
  }

  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
    <div className="sf-page">
      <div className="sf-card">
        <Header step={stepOf(sc)} onPhone={() => setModal('phone')} onHelp={() => setModal('help')} />
        <div className="sf-body">
          {sc.s === 'loading' && <div className="sf-center"><div className="sf-ring" /><p className="sf-sub">{t('loading')}</p></div>}
          {sc.s === 'invalid' && <Notice icon={<X size={34} />} tone="bad" title={t('invalidTitle')} text={t('invalidText')} />}
          {sc.s === 'expired' && <Notice icon={<Clock size={34} />} tone="muted" title={t('expiredTitle')} text={t('expiredText', { client: session?.client_name || '' })} />}
          {sc.s === 'consent' && session && <Consent session={session} onStart={async () => { await startSession(token); setSc({ s: 'face-intro' }) }} />}

          {sc.s === 'face-intro' && <FaceIntro onStart={() => setSc({ s: 'face-capture' })} />}
          {sc.s === 'face-capture' && <FaceCapture onBack={() => setSc({ s: 'face-intro' })} onDone={frames => setSc({ s: 'face-review', frames })} />}
          {sc.s === 'face-review' && (
            <FaceReview frames={sc.frames} onRetake={() => setSc({ s: 'face-capture' })}
              onContinue={async () => { await submitFace(token, { frames: sc.frames, outcome }); setSc({ s: 'doc-select' }) }} />
          )}

          {sc.s === 'doc-select' && (
            <DocSelect country={country} onCountry={c => setCountry(c)}
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
            <DocReview screen={sc} doc={doc} onRetake={() => setSc({ s: 'doc-method', side: sc.side })} onContinue={() => afterReview(sc.side, sc.url, sc.quality)} />
          )}

          {sc.s === 'verifying' && (
            <div className="sf-center"><div className="sf-ring" /><h2 className="sf-title">{t('verifyingTitle')}</h2><p className="sf-sub">{t('verifyingText')}</p></div>
          )}
          {sc.s === 'done' && (
            <div className="sf-center">
              <div className="sf-big-ic" style={{ background: '#e4f4ec', color: '#18794e' }}><Check size={40} strokeWidth={2.5} /></div>
              <h2 className="sf-title">{t('doneTitle')}</h2>
              <p className="sf-sub" style={{ maxWidth: 520 }}>{t('doneText', { name: session?.applicant_first_name || '', client: session?.client_name || '' })}</p>
              {session && <p className="sf-sub" style={{ marginTop: 8 }}>{t('reference')}: <b style={{ color: '#1f2328', fontFamily: 'var(--mono)' }}>{session.reference}</b></p>}
            </div>
          )}
        </div>
        <div className="sf-foot">© {t('poweredBy')} <span style={{ display: 'inline-flex', marginLeft: 4 }}><Logo size="sm" /></span></div>
      </div>

      {!['loading', 'invalid', 'expired', 'done', 'verifying'].includes(sc.s) && (
        <div className="sandbox">
          <div className="row" style={{ gap: 6, fontWeight: 700 }}><FlaskConical size={14} /> Sandbox · test data only</div>
          <div style={{ marginTop: 4 }}>Choose what the mock backend decides:</div>
          <select value={outcome} onChange={e => setOutcome(e.target.value as SandboxOutcome)}>{OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
      )}

      <Modal open={modal === 'phone'} onClose={() => setModal(null)} width={420}>
        <div className="sf-modal-qr">
          <Smartphone size={26} color="#0f5246" />
          <h3 className="sf-title" style={{ fontSize: 19 }}>{t('phoneTitle')}</h3>
          <p className="sf-sub">{t('phoneText')}</p>
          <Qr value={location.href} size={170} />
          <p className="sf-sub" style={{ fontSize: 12 }}>{t('phoneMock')}</p>
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

// ---------------------------------------------------------------- header
function Header({ step, onPhone, onHelp }: { step: number; onPhone: () => void; onHelp: () => void }) {
  const { lang, setLang, t } = useLang()
  const [open, setOpen] = useState(false)
  const icons = [<FaceIcon key="f" />, <CardIcon key="c" />, <BadgeIcon key="b" />, <ListIcon key="l" />]
  const names = [t('stepFace'), t('stepDocument'), t('stepVerification'), t('stepResult')]
  return (
    <div className="sf-head">
      <div className="sf-steps" aria-label="Progress">
        {icons.map((ic, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span className={`sf-line${i <= step ? '' : ' todo'}`} />}
            <span className={`sf-step ${i < step ? 'done' : i === step ? 'current' : 'upcoming'}`} title={names[i]} aria-current={i === step ? 'step' : undefined}>
              {ic}
              {i < step && <span className="badge"><Check strokeWidth={4} /></span>}
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
const CardIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <rect x="2.2" y="5" width="19.6" height="14" rx="2.4" fill="currentColor" />
    <circle cx="8.3" cy="10.6" r="2" fill="#fff" /><path d="M5.3 15.6c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5z" fill="#fff" />
    <path d="M13.8 10h4.6M13.8 13.6h4.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
const BadgeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M12 2.2l2.3 1.7 2.9-.1.9 2.7 2.4 1.7-1 2.8 1 2.8-2.4 1.7-.9 2.7-2.9-.1L12 21.8l-2.3-1.7-2.9.1-.9-2.7-2.4-1.7 1-2.8-1-2.8 2.4-1.7.9-2.7 2.9.1z" />
    <path d="M8.4 12.1l2.4 2.3 4.8-4.8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ListIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <rect x="2.8" y="3" width="18.4" height="18" rx="2.4" fill="currentColor" />
    <path d="M6.4 8h5.4M6.4 12h5.4M6.4 16h3.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13.6 13.4l1.9 1.9 3.3-3.7" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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

function Consent({ session, onStart }: { session: SessionView; onStart: () => Promise<void> }) {
  const t = useT()
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <h1 className="sf-title">{t('consentTitle')}</h1>
      <p className="sf-sub">{t('consentText', { client: session.client_name })}</p>
      <div className="sf-docs" style={{ marginTop: 22 }}>
        <div className="sf-doc" style={{ cursor: 'default' }}><span className="ic"><FaceIcon /></span><div><b>{t('stepFace')}</b><span>{t('faceCardSub')}</span></div></div>
        <div className="sf-doc" style={{ cursor: 'default' }}><span className="ic"><DocIcon d="id_card" /></span><div><b>{t('stepDocument')}</b><span>{t('docCardSub')}</span></div></div>
      </div>
      <label className="sf-check">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>{t('agree', { client: session.client_name })} <a href="#" onClick={e => e.preventDefault()}>{t('privacy')}</a> {t('and')} <a href="#" onClick={e => e.preventDefault()}>{t('terms')}</a>.</span>
      </label>
      <div className="sf-actions"><button className="sf-btn primary" disabled={!agree || busy} onClick={async () => { setBusy(true); await onStart() }}>{t('getStarted')} <ArrowRight size={17} /></button></div>
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

function FaceCapture({ onBack, onDone }: { onBack: () => void; onDone: (frames: string[]) => void }) {
  const t = useT()
  const cam = useCamera('user')
  const [move, setMove] = useState(-1)
  const frames = useRef<string[]>([])
  useEffect(() => { cam.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const run = () => {
    frames.current = []
    let i = 0
    setMove(0)
    const tick = () => {
      const s = cam.snap(480, 0.75)
      if (s) frames.current.push(s.url)
      i++
      if (i < MOVES.length) { setMove(i); setTimeout(tick, 1800) }
      else { setMove(MOVES.length); setTimeout(() => { cam.stop(); onDone(frames.current) }, 500) }
    }
    setTimeout(tick, 1800)
  }
  const running = move >= 0 && move < MOVES.length
  const noCam = cam.state === 'denied' || cam.state === 'unavailable'
  return (
    <>
      <h1 className="sf-title">{t('ovalTitle')}</h1>
      <p className="sf-sub">{running ? t('ovalRunning') : t('ovalReady')}</p>
      <div className="sf-cam">
        <video ref={cam.videoRef} className="mirror" playsInline muted style={{ display: cam.state === 'live' ? 'block' : 'none' }} />
        {cam.state === 'live' && <div className={`face-frame${move >= MOVES.length ? ' ok' : ''}`} />}
        {cam.state !== 'live' && <div className="msg">{cam.state === 'starting' ? t('cameraStarting') : cam.error ? t(cam.error) : t('cameraOff')}</div>}
        {running && <span className="prompt">{move === 1 ? <ArrowLeft size={16} /> : move === 2 ? <ArrowRight size={16} /> : <ScanFace size={16} />} {t(MOVES[move])}</span>}
      </div>
      <div className="sf-moves">
        {MOVES.map((m, i) => <span key={m} className={`sf-move${move > i ? ' done' : move === i ? ' now' : ''}`}>{move > i && <Check size={14} />}{t(m)}</span>)}
      </div>
      <div className="sf-actions">
        {!running && <button className="sf-btn ghost" onClick={onBack}>{t('back')}</button>}
        {!running && move < MOVES.length && <button className="sf-btn primary" disabled={cam.state !== 'live'} onClick={run}>{t('start')}</button>}
      </div>
      {noCam && !running && <div className="sf-links"><button className="sf-link" onClick={() => { cam.stop(); onDone([]) }}>{t('noCamera')}</button></div>}
    </>
  )
}

function FaceReview({ frames, onRetake, onContinue }: { frames: string[]; onRetake: () => void; onContinue: () => Promise<void> }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <h1 className="sf-title">{t('faceReviewTitle')}</h1>
      <p className="sf-sub">{t('faceReviewText')}</p>
      <div className="sf-preview">
        {frames[0] ? <img src={frames[0]} alt="Your selfie" /> : <div className="col" style={{ alignItems: 'center', color: '#5f6368' }}><ScanFace size={56} strokeWidth={1.2} /><span className="sf-sub">{t('noCameraSelfie')}</span></div>}
      </div>
      <div className="sf-actions">
        <button className="sf-btn ghost" onClick={onRetake} disabled={busy}><RefreshCw size={16} /> {t('retake')}</button>
        <button className="sf-btn primary" disabled={busy} onClick={async () => { setBusy(true); await onContinue() }}>{busy ? t('uploading') : t('continue')}</button>
      </div>
    </>
  )
}

function DocSelect({ country, onCountry, onPick }: { country: Country; onCountry: (c: Country) => void; onPick: (d: DocumentType) => void }) {
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
        {country.docs.map(d => (
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
    r.onload = async () => { const url = String(r.result); const img = await loadImage(url); const q = await assessQuality(url, img.naturalWidth, img.naturalHeight); onImage(toJpeg(img, img.naturalWidth, img.naturalHeight, 960), q) }
    r.readAsDataURL(f)
  }
  const sample = async (blurry: boolean) => {
    setBusy(true)
    const art = await loadImage(documentArt({ surname: 'SAMPLE', given: 'APPLICANT', dob: '1994-03-14', expiry: '2031-08-02', number: '1199480012345', title: t(DOC[doc].label).toUpperCase() + (side === 'back' ? ' (BACK)' : '') }))
    const c = document.createElement('canvas'); c.width = 1260; c.height = 840
    const ctx = c.getContext('2d')!
    if (blurry) ctx.filter = 'blur(7px)'
    ctx.drawImage(art, 0, 0, c.width, c.height)
    const url = c.toDataURL('image/jpeg', 0.85)
    onImage(url, await assessQuality(url, c.width, c.height))
  }
  return (
    <>
      <h1 className="sf-title">{t('uploadTitle', { side: sideName(t, doc, side), doc: t(DOC[doc].label) })}</h1>
      <p className="sf-sub">{t('methodSub')}</p>
      <div className="sf-docs" style={{ marginTop: 22 }}>
        <button className="sf-doc" onClick={onCamera} disabled={busy}><span className="ic"><Camera size={20} /></span><div><b>{t('takePhoto')}</b><span>{t('takePhotoSub')}</span></div></button>
        <button className="sf-doc" onClick={() => file.current?.click()} disabled={busy}><span className="ic"><ImageUp size={20} /></span><div><b>{t('uploadDevice')}</b><span>{t('uploadDeviceSub')}</span></div></button>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={e => fromFile(e.target.files?.[0])} />
      <div className="sf-links" style={{ marginTop: 22 }}>
        <button className="sf-link" disabled={busy} onClick={() => sample(false)}>{t('sampleDoc')}</button>
        <button className="sf-link muted" disabled={busy} onClick={() => sample(true)}>{t('blurrySample')}</button>
      </div>
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
    onImage(toJpeg(img, img.naturalWidth, img.naturalHeight, 960), q)
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
