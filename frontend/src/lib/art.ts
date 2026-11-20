// Placeholder artwork for seeded verifications (no real people or documents).
// Everything is generated SVG, encoded as data: URLs.

const enc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const hue = (seed: string) => {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export function faceArt(seed: string, dark = false): string {
  const h = hue(seed)
  const bg = dark ? `hsl(${h},18%,30%)` : `hsl(${h},28%,82%)`
  const skin = `hsl(${(h + 25) % 360},30%,${dark ? 55 : 62}%)`
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
  <rect width="320" height="240" fill="${bg}"/>
  <ellipse cx="160" cy="250" rx="110" ry="70" fill="hsl(${h},20%,${dark ? 22 : 45}%)"/>
  <ellipse cx="160" cy="112" rx="52" ry="64" fill="${skin}"/>
  <path d="M108 100c0-40 22-60 52-60s52 20 52 60c-12-18-30-26-52-26s-40 8-52 26z" fill="hsl(${h},25%,18%)"/>
  </svg>`)
}

export function documentArt(opts: { surname: string; given: string; dob: string; expiry: string; number: string; country?: string; title?: string }): string {
  const { surname, given, dob, expiry, number, country = 'RWA', title = 'PASSPORT' } = opts
  const mrz1 = `P<${country}${surname}<<${given}`.padEnd(44, '<').slice(0, 44)
  const mrz2 = `${number.padEnd(9, '<')}4${country}${dob.replace(/-/g, '').slice(2)}6F${expiry.replace(/-/g, '').slice(2)}8`.padEnd(44, '<').slice(0, 44)
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 280" font-family="Arial, sans-serif">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef2f8"/><stop offset="1" stop-color="#d6deeb"/></linearGradient></defs>
  <rect width="420" height="280" rx="14" fill="url(#g)"/>
  <text x="22" y="30" font-size="11" font-weight="700" fill="#1e3a8a">SPECIMEN · ${title} · ${country}</text>
  <rect x="22" y="44" width="104" height="132" rx="6" fill="#b8c4d6"/>
  <circle cx="74" cy="96" r="24" fill="#fff" opacity=".8"/><rect x="40" y="128" width="68" height="40" rx="20" fill="#fff" opacity=".8"/>
  ${[['Surname', surname], ['Given names', given], ['Date of birth', dob], ['Document no.', number], ['Date of expiry', expiry]]
    .map(([k, v], i) => `<text x="146" y="${54 + i * 27}" font-size="8" fill="#55607a">${k}</text><text x="146" y="${66 + i * 27}" font-size="12" font-weight="700" fill="#0b1426">${v}</text>`)
    .join('')}
  <text x="22" y="236" font-size="10.5" font-family="Courier New, monospace" fill="#0b1426">${mrz1.replace(/</g, '&lt;')}</text>
  <text x="22" y="254" font-size="10.5" font-family="Courier New, monospace" fill="#0b1426">${mrz2.replace(/</g, '&lt;')}</text>
  </svg>`)
}

/** A QR-looking pattern for the mock. It is NOT scannable; the real backend
 *  serves a genuine code at /verify/{token}/qr.svg. */
export function fakeQr(seed: string, size = 25): string {
  let s = 0
  for (const c of seed) s = (s * 33 + c.charCodeAt(0)) >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  let d = ''
  const finder = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if ((x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)) continue
      if (rnd() > 0.5) d += `M${x} ${y}h1v1h-1z`
    }
  d += finder(0, 0) + finder(size - 7, 0) + finder(0, size - 7)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${size + 2} ${size + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${size + 2}" height="${size + 2}" fill="#fff"/><path fill-rule="evenodd" fill="#0b1426" d="${d}"/></svg>`
}
