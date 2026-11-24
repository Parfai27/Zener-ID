// Instruction sheets, shown on the pages where people most need guidance (the
// face check and the document photo), the way Shufti shows them: a sheet slides
// up over the page with drawn examples marked do / don't, and the close button
// slides it back down. The pictures are drawn here, in the brand colours.
import { useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { useT } from './i18n'

export type Tip = { art: ReactNode; label: string; ok: boolean }

export function InstructionSheet({ tips, onClose }: { tips: Tip[]; onClose: () => void }) {
  const t = useT()
  const [leaving, setLeaving] = useState(false)
  const close = () => { if (leaving) return; setLeaving(true); window.setTimeout(onClose, 260) }
  const [first, ...rest] = tips
  return (
    <>
      <div className={`sf-dim${leaving ? ' out' : ''}`} onMouseDown={close} />
      <div className={`sf-sheet sf-instructions${leaving ? ' out' : ''}`} role="dialog" aria-modal aria-labelledby="sf-instr-title">
        <button className="sf-sheet-close" onClick={close} aria-label={t('close')}><X size={20} strokeWidth={1.7} /></button>
        <h2 id="sf-instr-title" className="sf-sheet-title">{t('instructionsTitle')}</h2>
        <div className="sf-tipgrid">
          <TipItem tip={first} wide />
          <div className="sf-tiprow">{rest.map(tip => <TipItem key={tip.label} tip={tip} />)}</div>
        </div>
      </div>
    </>
  )
}

function TipItem({ tip, wide }: { tip: Tip; wide?: boolean }) {
  return (
    <figure className={`sf-tipitem${wide ? ' wide' : ''}`}>
      <span className={`sf-tipart ${tip.ok ? 'ok' : 'no'}`}>
        {tip.art}
        <span className="mark" aria-hidden>{tip.ok ? <Check size={11} strokeWidth={3.5} /> : <X size={11} strokeWidth={3.5} />}</span>
      </span>
      <figcaption>{tip.label}</figcaption>
    </figure>
  )
}

