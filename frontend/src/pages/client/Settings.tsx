import { useState, type ReactNode } from 'react'
import { Send } from 'lucide-react'
import { currentSession } from '../../api'
import { Button, Card, Input, PageHead, Pill, Select, Tabs, Toggle, useToast } from '../../components/ui'

export function Settings() {
  const toast = useToast()
  const s = currentSession('client')!
  const [tab, setTab] = useState<'defaults' | 'webhooks' | 'team'>('defaults')
  const [hook, setHook] = useState('')
  const [email, setEmail] = useState(true)
  const [phone, setPhone] = useState(true)
  return (
    <>
      <PageHead title="Settings" sub={`Workspace settings for ${s.name}.`}>
        <Button variant="primary" onClick={() => toast('Settings saved (in this browser only)')}>Save changes</Button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} items={[['defaults', 'Verification defaults'], ['webhooks', 'Webhooks'], ['team', 'Team']]} />
      {tab === 'defaults' && (
        <Card className="max-w-[760px] !py-2 sm:!py-2">
          <Row title="Link expires after" desc="Applicants cannot open the link after this."><Select className="!w-[140px]" defaultValue="7"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></Select></Row>
          <Row title="Accepted documents" desc="What applicants can choose from."><div className="flex flex-wrap gap-2">{['Passport', 'National ID', 'Driving licence'].map(x => <Pill key={x} tone="info">{x}</Pill>)}</div></Row>
          <Row title="Email the link to the applicant" desc="When an email address is given."><Toggle on={email} onChange={setEmail} label="Email the link" /></Row>
          <Row title="Let applicants continue on a phone" desc="Shows a QR code on the first screen."><Toggle on={phone} onChange={setPhone} label="Continue on a phone" /></Row>
        </Card>
      )}
      {tab === 'webhooks' && (
        <Card className="flex max-w-[760px] flex-col gap-3.5">
          <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">Decision webhook</span>{hook.trim() ? <Pill tone="ok">Active</Pill> : <Pill tone="muted">Not set</Pill>}</div>
          <p className="text-[12.5px] text-muted">We POST the decision and reasons to this URL when a verification finishes (events: <span className="font-mono">verification.accepted</span>, <span className="font-mono">verification.declined</span>, <span className="font-mono">verification.review</span>).</p>
          <div className="flex gap-2">
            <Input className="font-mono" value={hook} placeholder="https://your-server.com/webhooks/zenerid" onChange={e => setHook(e.target.value)} />
            <Button onClick={() => toast('Webhooks are not connected yet', 'bad')}><Send size={16} /> Send test</Button>
          </div>
        </Card>
      )}
      {tab === 'team' && (
        <Card className="max-w-[760px]">
          <div className="flex items-center justify-between gap-3">
            <div><div className="font-semibold">{s.name}</div><div className="text-[12.5px] text-muted">{s.email}</div></div>
            <span className="text-muted">Owner</span>
          </div>
        </Card>
      )}
    </>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1"><b>{title}</b><div className="text-[12.5px] text-muted">{desc}</div></div>
      {children}
    </div>
  )
}
