import { ScaffoldPage } from '@/components/layout/scaffold-page'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  return (
    <ScaffoldPage
      locale={locale}
      title={getTranslator(locale)('nav.admin')}
      owner="briefs/06-admin-dashboard.md"
    />
  )
}
