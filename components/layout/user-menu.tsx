'use client'

import { Link } from '@/components/ui/link'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { LogOut, ShieldCheck, User as UserIcon, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/overlays'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACCOUNT_NAV, roleNav } from '@/components/layout/nav'
import { useT } from '@/lib/i18n-client'

/** Account menu, or a sign-in button when signed out. */
export function UserMenu({ session }: { session: Session | null }) {
  const t = useT()

  if (!session?.user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">{t('auth.signIn')}</Link>
      </Button>
    )
  }

  const { user } = session
  const initial = (user.name ?? user.email ?? '؟').trim().charAt(0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('nav.account')}>
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user.name ?? t('nav.account')}</span>
          {user.email ? (
            // Latin on an Arabic page — isolated so the address does not
            // reorder around the Arabic name above it.
            <span className="ltr-island truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </DropdownMenuLabel>

        {/*
          The profile sits directly under the name and email it belongs to,
          rather than as one row among the sections below.

          `/account` was already in ACCOUNT_NAV, but labelled «حسابي» and
          sitting fourth in a list of destinations — so the one place that
          answers "what does this account know about me?" read as just another
          section. It is filtered out of the loop below so there is exactly one
          route to it.
        */}
        <DropdownMenuItem asChild>
          <Link href="/account" className="gap-2">
            <UserRound className="size-4" aria-hidden />
            {t('account.profileTitle')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {ACCOUNT_NAV.filter((item) => item.href !== '/account').map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <UserIcon />
              {t(item.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        {roleNav(user.role).map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <ShieldCheck />
              {t(item.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ redirectTo: '/' })}>
          <LogOut />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
