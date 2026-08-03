import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { defaultLocale, isLocale } from '@/lib/i18n'

/** `/studio/*` — creator or admin. Brief 03 builds inside this shell. */
export default async function StudioLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale = isLocale(raw) ? raw : defaultLocale

  const session = await auth()
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/studio`)
  if (session.user.role !== 'creator' && session.user.role !== 'admin') {
    redirect(`/${locale}/forbidden`)
  }

  return <div className="container py-10">{children}</div>
}
