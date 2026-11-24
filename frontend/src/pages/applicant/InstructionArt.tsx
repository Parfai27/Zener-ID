// The pictures on the instruction sheets: a person and an ID card, each drawn in
// a "do" and two "don't" versions. Plain SVG (viewBox 120 × 120), so they stay
// sharp at any size and need no image files. Gradient ids are prefixed per
// picture so several can sit on one page.
import type { ReactNode } from 'react'

const C = {
  skin: '#9a6444', skinLight: '#b07a56', skinDark: '#7a4b31', lip: '#6a3424',
  hair: '#1f1714', hairShine: '#3a2c25', shirt: '#0f5246', shirtLight: '#1b6b5b', collar: '#f3f7f2',
  pine: '#06302b', mint: '#2fe0a8', paper: '#f3f7f2', ink: '#0b1614',
}

// ---------------------------------------------------------------- person
function Person({ id, children, over }: { id: string; children?: ReactNode; over?: ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden>
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" x2="1">
          <stop offset="0" stopColor={C.skinLight} /><stop offset=".55" stopColor={C.skin} /><stop offset="1" stopColor={C.skinDark} />
        </linearGradient>
        <linearGradient id={`${id}-shirt`} x1="0" x2="1">
          <stop offset="0" stopColor={C.shirtLight} /><stop offset="1" stopColor={C.shirt} />
        </linearGradient>
      </defs>
      {/* shoulders and collar */}
      <path d="M18 120c3-21 18-31 42-31s39 10 42 31z" fill={`url(#${id}-shirt)`} />
      <path d="M48 89l12 13 12-13-4-3-8 7-8-7z" fill={C.collar} />
      {/* neck, with the chin's shadow */}
      <path d="M51 74h18v14c0 5-18 5-18 0z" fill={C.skinDark} />
      <path d="M51 76c6 4 12 4 18 0v4c-6 4-12 4-18 0z" fill="#5f3a26" opacity=".5" />
      {/* ears */}
      <ellipse cx="38.5" cy="55" rx="4" ry="6.5" fill={C.skin} />
      <ellipse cx="81.5" cy="55" rx="4" ry="6.5" fill={C.skinDark} />
      {/* face */}
      <path d="M40 50c0-14 9-22 20-22s20 8 20 22c0 15-7 28-20 28S40 65 40 50z" fill={`url(#${id}-skin)`} />
      {/* short hair with a little texture */}
      <path d="M39.5 50c-2-17 8-27 20.5-27s22.5 10 20.5 27c-1.5-7-5-10.5-9-11.5-4 2.5-18 2.5-23 0-4 1-7.5 4.5-9 11.5z" fill={C.hair} />
      <path d="M47 30c4-3 9-4 14-3.6M55 26.5c6-.4 11 1.5 14 4.5" stroke={C.hairShine} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* brows, eyes, nose, mouth */}
      <path d="M46.5 46.5c2.5-1.8 6-1.8 8.5-.2M65 46.3c2.5-1.6 6-1.6 8.5.2" stroke={C.hair} strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="51" cy="53" rx="3.4" ry="2.4" fill="#fff" /><ellipse cx="69" cy="53" rx="3.4" ry="2.4" fill="#fff" />
      <circle cx="51.4" cy="53" r="1.9" fill={C.ink} /><circle cx="69.4" cy="53" r="1.9" fill={C.ink} />
      <circle cx="52" cy="52.4" r=".6" fill="#fff" /><circle cx="70" cy="52.4" r=".6" fill="#fff" />
      <path d="M60 55.5c-.6 3.5-2.2 6-3.4 7 1.4 1 4.6 1 6 0" stroke={C.skinDark} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M53.5 67c3.8 3 9.2 3 13 0-2 .2-4.3.9-6.5.9s-4.5-.7-6.5-.9z" fill={C.lip} />
      <ellipse cx="47" cy="61" rx="3.5" ry="2" fill="#c4734f" opacity=".18" /><ellipse cx="73" cy="61" rx="3.5" ry="2" fill="#c4734f" opacity=".18" />
      {children}
      {over}
    </svg>
  )
}

export const FaceArt = {
  /** Do: the face inside the oval, square to the camera. */
  oval: (
    <Person id="fo">
      <ellipse cx="60" cy="54" rx="27" ry="34" fill="none" stroke={C.pine} strokeWidth="2.4" strokeDasharray="5 4" />
      <path d="M33 30v-6h6M87 30v-6h-6M33 80v6h6M87 80v6h-6" stroke={C.mint} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </Person>
  ),
  /** Don't: a lamp behind one side, the other side in shadow. */
  light: (
    <Person id="fl" over={
      <>
        <defs>
          <radialGradient id="fl-bloom" cx="28%" cy="30%" r="45%">
            <stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset=".45" stopColor="#fff8e6" stopOpacity=".85" /><stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fl-shade" x1="0" x2="1"><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></linearGradient>
        </defs>
        <rect width="120" height="120" fill="url(#fl-shade)" />
        <rect width="120" height="120" fill="url(#fl-bloom)" />
        <g stroke="#ffd25e" strokeWidth="2.2" strokeLinecap="round">
          <path d="M22 14v6M12 24h6M15 17l4 4M29 17l-4 4" />
        </g>
        <circle cx="22" cy="24" r="4.5" fill="#ffd25e" />
      </>
    } />
  ),
  /** Don't: glasses and a cap hide the eyes and the hairline. */
  accessories: (
    <Person id="fa">
      <path d="M38 41c0-12 10-19 22-19s22 7 22 19z" fill="#24476b" />
      <path d="M58 22.5h4v4h-4z" fill="#1a3552" />
      <path d="M36 41h48c7 0 9 3.5 3 4.5H36c-3.5 0-3.5-4.5 0-4.5z" fill="#1a3552" />
      <g fill="rgba(160, 205, 235, .32)" stroke={C.ink} strokeWidth="2.2">
        <rect x="43.5" y="47.5" width="14" height="11" rx="5" />
        <rect x="62.5" y="47.5" width="14" height="11" rx="5" />
      </g>
      <path d="M57.5 52c1.6-1.2 3.4-1.2 5 0M43.5 51l-4-1.5M76.5 51l4-1.5" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M46 50l3-1.4M65 50l3-1.4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
    </Person>
  ),
}

// ---------------------------------------------------------------- ID card
function Card({ id }: { id: string }) {
  return (
    <g>
      <rect x="18" y="35" width="84" height="54" rx="6" fill="#fff" stroke="#c9d6d0" strokeWidth="1.2" />
      <path d="M18 41a6 6 0 0 1 6-6h72a6 6 0 0 1 6 6v6H18z" fill={C.pine} />
      <path d="M25 41.5h26M25 44h16" stroke="#cfe9dd" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
      <circle cx="94" cy="41" r="3.2" fill={C.mint} /><circle cx="94" cy="41" r="1.5" fill={C.pine} />
      {/* holder's photo */}
      <defs><clipPath id={`${id}-photo`}><rect x="24" y="51" width="20" height="25" rx="2.5" /></clipPath></defs>
      <rect x="24" y="51" width="20" height="25" rx="2.5" fill="#dcefe7" />
      <g clipPath={`url(#${id}-photo)`}>
        <path d="M25 76c1-6 4.5-8 9-8s8 2 9 8z" fill={C.shirt} />
        <circle cx="34" cy="62" r="5.2" fill={C.skin} />
        <path d="M28.8 61.5c-.4-4.6 2.3-7 5.2-7s5.6 2.4 5.2 7c-1-2-2.4-3-5.2-3s-4.2 1-5.2 3z" fill={C.hair} />
      </g>
      {/* name, number and dates */}
      <path d="M50 54h30M50 60h40M50 66h24M50 72h34" stroke="#9db8ad" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M50 54h12" stroke={C.pine} strokeWidth="2.2" strokeLinecap="round" />
      {/* chip and the machine-readable lines */}
      <rect x="84" y="62" width="11" height="9" rx="2" fill="#e9c46a" /><path d="M84 66.5h11M89.5 62v9" stroke="#c9a347" strokeWidth=".8" />
      <path d="M24 81.5h72M24 85.5h72" stroke={C.ink} strokeWidth="1.3" strokeDasharray="2.2 1.4" opacity=".55" />
    </g>
  )
}

/** The camera's framing corners around where the card should sit. */
const Frame = ({ color = C.pine }: { color?: string }) => (
  <path d="M12 38v-9h10M98 29h10v9M108 86v9H98M22 95H12v-9" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
)

export const DocArt = {
  /** Do: the whole card inside the frame. */
  frame: (
    <svg viewBox="0 0 120 120" aria-hidden>
      <Card id="df" /><Frame />
    </svg>
  ),
  /** Don't: a bright reflection hides part of the card. */
  glare: (
    <svg viewBox="0 0 120 120" aria-hidden>
      <defs>
        <linearGradient id="dg-streak" x1="0" x2="1" y1="0" y2=".6">
          <stop offset=".25" stopColor="#fff" stopOpacity="0" /><stop offset=".48" stopColor="#fff" stopOpacity=".97" /><stop offset=".72" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="dg-spot" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <Card id="dg" />
      <rect x="18" y="35" width="84" height="54" rx="6" fill="url(#dg-streak)" />
      <circle cx="62" cy="56" r="16" fill="url(#dg-spot)" />
      <path d="M62 44v24M50 56h24M54 48l16 16M70 48L54 64" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".95" />
      <Frame />
    </svg>
  ),
  /** Don't: the card runs out of the frame, so an edge is lost. */
  cut: (
    <svg viewBox="0 0 120 120" aria-hidden>
      <defs><clipPath id="dc-view"><rect x="12" y="29" width="96" height="66" rx="2" /></clipPath></defs>
      <g clipPath="url(#dc-view)"><g transform="translate(30 -4) rotate(-9 60 62)"><Card id="dc" /></g></g>
      <path d="M108 29v66" stroke="#d64545" strokeWidth="2" strokeDasharray="4 3" />
      <Frame />
    </svg>
  ),
}
