import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { defaultLocale, isLocale } from '@/lib/i18n'

/** `/admin/*` — admin only. Brief 06 builds inside this shell. */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  const locale = isLocale(raw) ? raw : defaultLocale

  const session = await auth()
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/admin`)
  if (session.user.role !== 'admin') redirect(`/${locale}/forbidden`)

  return <div className="container py-10">{children}</div>
}
