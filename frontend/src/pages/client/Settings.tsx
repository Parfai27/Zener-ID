import { useState } from 'react'
import { RotateCcw, Send } from 'lucide-react'
import { currentSession, resetMockData } from '../../api'
import { Pill, useToast } from '../../components/ui'

export function Settings() {
  const toast = useToast()
  const s = currentSession('client')!
  const [tab, setTab] = useState('defaults')
  const [hook, setHook] = useState('https://api.example.com/kyc/webhook')
  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><p>Workspace settings for {s.name}.</p></div>
        <button className="btn btn-primary" onClick={() => toast('Settings saved (in this browser only)')}>Save changes</button>
      </div>
      <div className="tabs">
        {[['defaults', 'Verification defaults'], ['webhooks', 'Webhooks'], ['team', 'Team'], ['mock', 'Mock data']].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'defaults' && (
        <div className="card col" style={{ gap: 0, maxWidth: 760 }}>
          <Row title="Link expires after" desc="Applicants cannot open the link after this."><select className="select" style={{ width: 140 }} defaultValue="7"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></Row>
          <Row title="Accepted documents" desc="What applicants can choose from."><div className="chips">{['Passport', 'National ID', 'Driving licence'].map(x => <Pill key={x} tone="info">{x}</Pill>)}</div></Row>
          <Row title="Email the link to the applicant" desc="When an email address is given."><Toggle on /></Row>
          <Row title="Let applicants continue on a phone" desc="Shows a QR code on the first screen."><Toggle on /></Row>
        </div>
      )}
      {tab === 'webhooks' && (
        <div className="card col" style={{ gap: 14, maxWidth: 760 }}>
          <div className="row between"><span className="card-title">Decision webhook</span><Pill tone="ok">Active</Pill></div>
          <p className="muted small">We POST the decision and reasons to this URL when a verification finishes (events: <span className="mono">verification.accepted</span>, <span className="mono">verification.declined</span>, <span className="mono">verification.review</span>).</p>
          <div className="row"><input className="input mono grow" value={hook} onChange={e => setHook(e.target.value)} /><button className="btn btn-secondary" onClick={() => toast('Test event queued (mock)')}><Send size={16} /> Send test</button></div>
        </div>
      )}
      {tab === 'team' && (
        <div className="card" style={{ maxWidth: 760 }}>
          {[['Aline Bizimana', 'Owner'], ['Jean Kayitare', 'Analyst'], ['Marie Uwase', 'Analyst']].map(([n, r]) => (
            <div key={n} className="kv"><span className="k" style={{ color: 'var(--ink)', fontWeight: 600 }}>{n}</span><span className="v muted">{r}</span></div>
          ))}
        </div>
      )}
      {tab === 'mock' && (
        <div className="card col" style={{ gap: 12, maxWidth: 760 }}>
          <span className="card-title">Reset the mock data</span>
          <p className="muted small">Everything you created while testing lives in this browser’s storage. Resetting restores the sample verifications, clients and keys.</p>
          <div><button className="btn btn-secondary" onClick={() => { resetMockData(); toast('Mock data reset') }}><RotateCcw size={16} /> Reset mock data</button></div>
        </div>
      )}
    </>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="row" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
      <div className="grow"><b>{title}</b><div className="small muted">{desc}</div></div>
      {children}
    </div>
  )
}

function Toggle({ on: initial = false }: { on?: boolean }) {
  const [on, setOn] = useState(initial)
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => setOn(!on)}
      style={{ width: 40, height: 22, borderRadius: 999, border: 0, padding: 2, cursor: 'pointer', background: on ? 'var(--ink)' : 'var(--line-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s' }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff' }} />
    </button>
  )
}
