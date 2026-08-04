import { ScaffoldPage } from '@/components/layout/scaffold-page'
import { t } from '@/lib/i18n'

export default function AdminPage() {
  return <ScaffoldPage title={t('nav.admin')} owner="briefs/06-admin-dashboard.md" />
}
