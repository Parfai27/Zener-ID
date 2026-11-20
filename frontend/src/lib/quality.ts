import type { QualityReport } from '../api/types'

/** Load a data URL / object URL into an <img>. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read this image.'))
    img.src = src
  })
}

/** Downscale to keep localStorage small, return a JPEG data URL. */
export function toJpeg(source: CanvasImageSource, w: number, h: number, max = 720, quality = 0.72): string {
  const scale = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

/**
 * The same three checks the backend runs before OCR (blur, light, size),
 * done in the browser so the retake message appears instantly.
 * Sharpness = variance of the Laplacian on a 320px greyscale copy.
 */
export async function assessQuality(src: string, naturalW?: number, naturalH?: number): Promise<QualityReport> {
  const img = await loadImage(src)
  const W = 320
  const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)
  const g = new Float32Array(W * H)
  let sum = 0
  for (let i = 0; i < W * H; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    g[i] = v
    sum += v
  }
  const brightness = sum / (W * H)
  let lsum = 0, lsq = 0, n = 0
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const lap = g[i - W] + g[i + W] + g[i - 1] + g[i + 1] - 4 * g[i]
      lsum += lap
      lsq += lap * lap
      n++
    }
  const mean = lsum / n
  const sharpness = lsq / n - mean * mean
  const width = naturalW ?? img.naturalWidth
  const height = naturalH ?? img.naturalHeight
  const problems: QualityReport['problems'] = []
  if (sharpness < 60) problems.push('blur')
  if (brightness < 45) problems.push('dark')
  if (brightness > 235) problems.push('bright')
  if (Math.max(width, height) < 480) problems.push('small')
  return { sharpness: Math.round(sharpness), brightness: Math.round(brightness), width, height, ok: problems.length === 0, problems }
}
