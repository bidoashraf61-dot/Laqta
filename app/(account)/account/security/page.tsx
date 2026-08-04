import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { twoFactorRequired } from '@/lib/totp'
import { t } from '@/lib/i18n'
import { TwoFactorCard } from './two-factor-card'

export const metadata = { title: t('security.title') }

export default async function SecurityPage() {
  const sessionUser = await requireUser()
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { twoFactorEnabled: true, role: true },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-headline font-semibold">{t('security.title')}</h1>
      <TwoFactorCard
        enabled={Boolean(user?.twoFactorEnabled)}
        mandatory={twoFactorRequired(user?.role ?? 'buyer')}
      />
    </div>
  )
}
