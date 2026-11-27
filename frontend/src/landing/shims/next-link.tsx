// Stand-in for `next/link` so the landing components (written for Next.js) run
// unchanged in this Vite + React Router app. Paths inside the app use the
// router; anchors, other sites and mail links stay plain <a> tags.
import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { Link as RouterLink } from 'react-router-dom'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  prefetch?: boolean
  scroll?: boolean
  replace?: boolean
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _prefetch, scroll: _scroll, replace, ...rest }, ref) {
  void _prefetch
  void _scroll
  const inApp = href.startsWith('/') && !href.startsWith('//') && !href.includes('#')
  if (inApp) return <RouterLink ref={ref} to={href} replace={replace} {...rest} />
  return <a ref={ref} href={href} {...rest} />
})

export default Link
