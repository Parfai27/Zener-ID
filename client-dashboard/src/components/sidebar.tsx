'use client'

import { BadgeCheck, KeyRound, LayoutDashboard, ListChecks, Plus, Settings2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/verifications/new', label: 'New verification', icon: Plus, exact: true },
  { href: '/dashboard/verifications', label: 'All verifications', icon: ListChecks },
  { href: '/dashboard/verified', label: 'Verified users', icon: BadgeCheck },
  { href: '/dashboard/api-keys', label: 'API keys', icon: KeyRound },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || (pathname.startsWith(`${href}/`) && !pathname.endsWith('/new'))

  return (
    <aside className="bg-pine text-white lg:sticky lg:top-0 lg:h-screen">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard">
          <Image src="/brand/zenerid-logo-light.svg" alt="Zener ID" width={128} height={30} priority />
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
        {NAV.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active(href, exact) ? 'bg-pine-2 text-white' : 'text-[#a9c2ba] hover:bg-pine-2/60 hover:text-white'
            }`}
          >
            <Icon className={`size-4 ${active(href, exact) ? 'text-mint' : ''}`} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
