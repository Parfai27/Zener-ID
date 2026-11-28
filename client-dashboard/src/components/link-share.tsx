'use client'

import { Check, Copy, Download, ExternalLink, Mail, MessageCircle, MessageSquare, Share2 } from 'lucide-react'

import { SendLinkDialog, type Channel } from './send-link-dialog'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function LinkShare({
  url,
  customerName,
  email,
  phone,
  reference,
  expiresAt,
}: {
  url: string
  customerName: string
  email?: string
  phone?: string
  reference: string
  expiresAt: string
}) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [sending, setSending] = useState<Channel | null>(null)

  useEffect(() => {
    // Drawn here, never by an outside QR service: the link is the customer's
    // whole credential for this verification.
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#06302b', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator)
  }, [url])

  const message = `Hello ${customerName}, please verify your identity using this secure link: ${url}`
  const phoneDigits = (phone ?? '').replace(/[^\d+]/g, '')

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Older browsers, or a page not served over https.
      const area = document.createElement('textarea')
      area.value = url
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Email and SMS are sent by the backend: mailto: and sms: links depend on an
  // app being set up on this computer, which most desktops do not have.
  const mailto = `mailto:${email ?? ''}?subject=${encodeURIComponent('Verify your identity')}&body=${encodeURIComponent(message)}`
  const smsto = `sms:${phoneDigits}?&body=${encodeURIComponent(message)}`
  const whatsapp = `https://wa.me/${phoneDigits.replace('+', '')}?text=${encodeURIComponent(message)}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="card p-6">
        <h2 className="text-lg font-bold text-ink">Share link</h2>
        <p className="mt-1 text-sm text-ink-3">
          Reference <span className="font-mono text-ink-2">{reference}</span> · valid until {expiresAt}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} aria-label="Verification link" onFocus={(e) => e.target.select()} className="field font-mono text-xs" />
          <button type="button" onClick={copy} className="btn-primary shrink-0">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-ink-2">Send it to your customer</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button type="button" onClick={() => setSending('email')} className="btn-secondary">
            <Mail className="size-4" /> Email
          </button>
          <button type="button" onClick={() => setSending('sms')} className="btn-secondary">
            <MessageSquare className="size-4" /> SMS
          </button>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-secondary">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: 'Verify your identity', text: message, url }).catch(() => {})}
              className="btn-secondary"
            >
              <Share2 className="size-4" /> More…
            </button>
          )}
        </div>

        <a href={url} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-evergreen hover:underline">
          Open the customer&apos;s page <ExternalLink className="size-3.5" />
        </a>
      </section>

      {sending && (
        <SendLinkDialog
          channel={sending}
          reference={reference}
          defaultTo={(sending === 'email' ? email : phone) ?? ''}
          fallbackHref={sending === 'email' ? mailto : smsto}
          onClose={() => setSending(null)}
        />
      )}

      <section className="card flex flex-col items-center p-6 text-center">
        <h2 className="text-lg font-bold text-ink">QR code</h2>
        <p className="mt-1 text-sm text-ink-3">The customer scans it with their phone camera.</p>
        <div className="mt-5 grid aspect-square w-full max-w-60 place-items-center rounded-xl border border-line bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code of the verification link" className="size-full" />
          ) : (
            <span className="text-sm text-ink-4">Drawing…</span>
          )}
        </div>
        {qr && (
          <a href={qr} download={`zenerid-${reference}.png`} className="btn-secondary mt-5 w-full">
            <Download className="size-4" /> Download QR code
          </a>
        )}
      </section>
    </div>
  )
}
