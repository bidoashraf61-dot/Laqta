'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'
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
import type { Locale, Translator } from '@/lib/i18n'

/**
 * Account menu, or a sign-in button when signed out.
 *
 * `t` is passed in from the server layout rather than re-derived here: the
 * message dictionaries are the source of truth, and shipping a second copy of
 * the lookup to the client for four labels is not worth the bytes.
 */
export function UserMenu({
  locale,
  session,
  labels,
}: {
  locale: Locale
  session: Session | null
  labels: Record<string, string>
}) {
  if (!session?.user) {
    return (
      <Button asChild variant="gold" size="sm">
        <Link href={`/${locale}/sign-in`}>{labels.signIn}</Link>
      </Button>
    )
  }

  const { user } = session
  const initial = (user.name ?? user.email ?? '؟').trim().charAt(0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={labels.account}>
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user.name ?? labels.account}</span>
          {user.email ? (
            <span className="ltr-island truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {ACCOUNT_NAV.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={`/${locale}${item.href}`}>
              <UserIcon />
              {labels[item.labelKey] ?? item.labelKey}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        {roleNav(user.role).map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={`/${locale}${item.href}`}>
              <ShieldCheck />
              {labels[item.labelKey] ?? item.labelKey}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ redirectTo: `/${locale}` })}>
          <LogOut />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
