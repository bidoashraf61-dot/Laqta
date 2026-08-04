import type { Metadata } from 'next'
import { TaxonomyIndex } from '@/components/catalogue/hub'
import { t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: t('catalogue.categoriesTitle'),
  alternates: { canonical: '/categories' },
}

export default function CategoriesPage() {
  return <TaxonomyIndex kind="category" />
}
