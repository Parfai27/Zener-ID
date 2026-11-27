// The flow's icons. One family, drawn on a 20px grid with a 1.6 stroke, so every
// glyph in the header, the document choices and the camera controls reads the
// same. Colour always comes from `currentColor`.

import { ScanFace } from 'lucide-react'

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const }
const round = { ...line, strokeLinecap: 'round' as const }

type P = { size?: number }

/** The step icons in the header: the ID card, and the face scan the app has always used. */
export function StepGlyph({ step, size = 16 }: { step: string } & P) {
  if (step === 'face') return <ScanFace size={size} strokeWidth={1.9} aria-hidden />
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      <rect x="1.8" y="4.2" width="16.4" height="11.6" rx="2" {...line} />
      <circle cx="7" cy="9.4" r="1.9" {...line} />
      <path d="M11.4 8.4h4.2M11.4 11.2h4.2M4.4 13.4c.5-1.3 1.5-2 2.6-2s2.1.7 2.6 2" {...round} />
    </svg>
  )
}

/** The same step, heavier: heads the reasons box on a refusal. */
export function StepGlyphSolid({ step, size = 16 }: { step: string } & P) {
  if (step === 'face') return <ScanFace size={size} strokeWidth={2.2} aria-hidden />
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      <rect x="1.8" y="4.2" width="16.4" height="11.6" rx="2" fill="currentColor" />
      <circle cx="7" cy="9.4" r="1.9" fill="#fff" />
      <path d="M11.4 8.4h4.2M11.4 11.2h4.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function DocGlyph({ type, size = 20 }: { type: string } & P) {
  if (type === 'passport') {
    return (
      <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
        <rect x="4" y="2.4" width="12" height="15.2" rx="2" {...line} />
        <circle cx="10" cy="8.4" r="2.6" {...line} />
        <path d="M7.2 14.2h5.6" {...round} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      <rect x="1.8" y="4.2" width="16.4" height="11.6" rx="2" {...line} />
      <circle cx="7" cy="9.4" r="1.9" {...line} />
      <path d="M11.4 8.4h4.2M11.4 11.2h4.2" {...round} />
    </svg>
  )
}

export const Tick = ({ size = 16, width = 2.2 }: P & { width?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
    <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Cross = ({ size = 16, width = 2.2 }: P & { width?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" />
  </svg>
)

export const Clock = ({ size = 16 }: P) => (
  <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
    <circle cx="10" cy="10" r="7.6" {...line} />
    <path d="M10 5.6V10l3 2" {...round} />
  </svg>
)

export const Back = () => (
  <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden>
    <path d="M12.4 4.2L6.6 10l5.8 5.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const PhoneGlyph = () => (
  <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden>
    <rect x="5.5" y="1.8" width="9" height="16.4" rx="2" {...line} />
    <path d="M8.8 15.6h2.4" {...round} />
  </svg>
)

export const LangGlyph = () => (
  <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden>
    <path d="M2.4 6.2h7.2M6 2.4v3.8M4.2 6.2c0 3.4 2 6 4.6 7.2M8.2 6.2c0 2.6-1.8 5-4.6 6.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M10.4 17.6l3.2-7.6 3.2 7.6M11.7 14.8h3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Caret = () => (
  <svg viewBox="0 0 10 10" width={10} height={10} aria-hidden><path d="M1.5 3.5L5 7l3.5-3.5z" fill="currentColor" /></svg>
)

export const Chevron = () => (
  <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden><path d="M5.5 8l4.5 4.5L14.5 8" {...round} /></svg>
)

export const CopyGlyph = () => (
  <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden>
    <rect x="7" y="7" width="9.4" height="9.4" rx="1.8" {...line} />
    <path d="M13 7V5.4a1.8 1.8 0 0 0-1.8-1.8H5.4A1.8 1.8 0 0 0 3.6 5.4v5.8A1.8 1.8 0 0 0 5.4 13H7" {...round} />
  </svg>
)

export const CloseGlyph = () => (
  <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const InfoGlyph = () => (
  <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden>
    <circle cx="10" cy="10" r="7.6" {...line} />
    <path d="M10 6.2v.1M10 9v4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export const CameraGlyph = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" {...line} />
    <circle cx="12" cy="13" r="3.4" {...line} />
  </svg>
)

export const UploadGlyph = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const FlipGlyph = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
    <path d="M4 9a8 8 0 0 1 13.3-3M20 15A8 8 0 0 1 6.7 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M4 4v5h5M20 20v-5h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** The focus mark, dead centre of the document guide. */
export const FocusMark = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden>
    <path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)
