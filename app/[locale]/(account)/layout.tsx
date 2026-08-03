import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { defaultLocale, isLocale } from '@/lib/i18n'

/**
 * `/account/*` — any authenticated user.
 *
 * middleware.ts already blocks this path, so reaching the redirect below means
 * the middleware matcher has a hole. Keeping the check here is the point:
 * middleware is the gate, the layout is the lock, and a route that ships
 * without a matcher entry still cannot leak a stranger's library.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale = isLocale(raw) ? raw : defaultLocale

  const session = await auth()
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/account`)

  return <div className="container py-10">{children}</div>
}
