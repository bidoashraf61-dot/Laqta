import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { twoFactorRequired } from '@/lib/totp'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'
import { TwoFactorCard } from './two-factor-card'

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  const t = getTranslator(locale)

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
        labels={{
          twoFactor: t('security.twoFactor'),
          twoFactorWhy: t('security.twoFactorWhy'),
          enabled: t('security.enabled'),
          disabled: t('security.disabled'),
          enable: t('security.enable'),
          disable: t('security.disable'),
          setupIntro: t('security.setupIntro'),
          secretKey: t('security.secretKey'),
          enterCodeToEnable: t('security.enterCodeToEnable'),
          'security.enabledToast': t('security.enabledToast'),
          'security.disabledToast': t('security.disabledToast'),
          'security.invalidToken': t('security.invalidToken'),
          'security.twoFactorWhy': t('security.twoFactorWhy'),
        }}
      />
    </div>
  )
}
