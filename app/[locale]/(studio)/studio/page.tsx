import { ScaffoldPage } from '@/components/layout/scaffold-page'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'

export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  return (
    <ScaffoldPage
      locale={locale}
      title={getTranslator(locale)('nav.studio')}
      owner="briefs/03-creator-portal.md"
    />
  )
}
