'use client'

// The admin console and applicant flow were written for React Router (the old
// Vite frontend). This maps the few pieces they use onto Next.js navigation, so
// they run here unchanged.
import NextLink from 'next/link'
import { useParams as useNextParams, usePathname, useRouter } from 'next/navigation'
import { forwardRef, useEffect, type AnchorHTMLAttributes } from 'react'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean }

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, ...rest }, ref) {
  return <NextLink ref={ref} href={to} replace={replace} {...rest} />
})

export function useNavigate() {
  const router = useRouter()
  return (to: string | number, opts?: { replace?: boolean; state?: unknown }) => {
    if (typeof to === 'number') return router.back()
    if (opts?.replace) router.replace(to)
    else router.push(to)
  }
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): Partial<T> {
  const params = useNextParams() ?? {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) if (v !== undefined) out[k] = decodeURIComponent(Array.isArray(v) ? v.join('/') : v)
  return out as Partial<T>
}

/** Router state is not carried across Next navigations, so `state` is always empty. */
export function useLocation(): { pathname: string; state?: unknown } {
  return { pathname: usePathname() ?? '/', state: undefined }
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (replace) router.replace(to)
    else router.push(to)
  }, [router, to, replace])
  return null
}
