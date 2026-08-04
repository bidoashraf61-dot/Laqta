import type { Metadata } from 'next'
import { TaxonomyIndex } from '@/components/catalogue/hub'
import { t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: t('catalogue.locationsTitle'),
  alternates: { canonical: '/locations' },
}

export default function LocationsPage() {
  return <TaxonomyIndex kind="location" />
}
