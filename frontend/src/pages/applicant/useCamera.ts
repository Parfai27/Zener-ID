import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable'

/** Wraps getUserMedia. Browsers allow it only on https or localhost. */
export function useCamera(facing: 'user' | 'environment') {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  // An i18n key (camBlocked | camMissing | camUnsupported) — translated by the page.
  const [error, setError] = useState<'' | 'camBlocked' | 'camMissing' | 'camUnsupported'>('')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable')
      setError('camUnsupported')
      return
    }
    setState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setState('live')
    } catch (e) {
      const name = (e as DOMException).name
      setState(name === 'NotAllowedError' ? 'denied' : 'unavailable')
      setError(name === 'NotAllowedError'
        ? 'camBlocked'
        : 'camMissing')
    }
  }, [facing])

  useEffect(() => stop, [stop])

  /** Grab the current frame as a JPEG data URL. */
  const snap = useCallback((max = 1280, quality = 0.8): { url: string; w: number; h: number } | null => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    const ctx = c.getContext('2d')!
    if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, 0, 0, c.width, c.height)
    return { url: c.toDataURL('image/jpeg', quality), w: v.videoWidth, h: v.videoHeight }
  }, [facing])

  return { videoRef, state, error, start, stop, snap }
}
