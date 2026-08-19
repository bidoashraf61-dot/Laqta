import type { Metadata } from 'next'
import { BadgeCheck, Download, FolderHeart, Library, Receipt, ShieldCheck } from 'lucide-react'
import { Link } from '@/components/ui/link'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDate, t } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/typography'
import { UserText } from '@/components/ui/bilingual'
import { requestLocale } from '@/lib/locale-request'
import { countryName } from '@/lib/countries'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('nav.account') }
}

/**
 * The account hub.
 *
 * ── What this replaced ──────────────────────────────────────────────────────
 * A scaffold. It rendered a card per section whose entire body was
 * «هذه الصفحة قيد الإعداد» — and none of the cards were links, so the hub of
 * the signed-in area was a dead end that also lied: every one of those sections
 * had been built and was reachable from the sidebar, just not from here.
 *
 * ── Why the details are read-only for now ───────────────────────────────────
 * The page shows what the account actually holds and says plainly when a field
 * is empty, rather than hiding the gap. Editing lives behind one link to
 * `/account/security`, which already owns the credential flows — a second
 * profile form here would be a second place to change an email, and two ways to
 * change a login is how accounts get lost.
 */
export default async function AccountPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const session = await auth()
  const userId = session?.user?.id

  // The session carries a name and role; everything else has to come from the
  // record, and the record is the thing the reader is here to check.
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          emailVerified: true,
          phone: true,
          phoneVerified: true,
          image: true,
          country: true,
          createdAt: true,
          role: true,
        },
      })
    : null

  const sections = [
    {
      href: '/account/library',
      icon: Library,
      label: t('nav.library'),
      body: t('account.hubLibraryBody'),
    },
    {
      href: '/account/purchases',
      icon: Receipt,
      label: t('nav.orders'),
      body: t('account.hubPurchasesBody'),
    },
    {
      href: '/account/downloads',
      icon: Download,
      label: t('nav.downloads'),
      body: t('account.hubDownloadsBody'),
    },
    {
      href: '/account/boards',
      icon: FolderHeart,
      label: t('nav.boards'),
      body: t('account.hubBoardsBody'),
    },
    {
      href: '/account/security',
      icon: ShieldCheck,
      label: t('security.title'),
      body: t('account.hubSecurityBody'),
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>{t('nav.account')}</PageTitle>
        <Badge variant="neutral">{t(`role.${user?.role ?? 'buyer'}`)}</Badge>
      </div>

      {/* ── Who you are ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle as="h2">{t('account.profileTitle')}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/account/profile">{t('account.profileEdit')}</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name ?? t('nav.account')}
              className="size-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-20 shrink-0 place-items-center rounded-full bg-secondary font-display text-3xl font-bold text-secondary-foreground"
            >
              {(user?.name ?? '؟').charAt(0)}
            </span>
          )}

          <dl className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label={t('account.profileName')}>
              {user?.name ? <UserText>{user.name}</UserText> : null}
            </Field>

            <Field
              label={t('account.profileEmail')}
              // Whether a channel is verified is the useful half of showing it:
              // an unverified email is why a receipt never arrived.
              verified={user?.email ? Boolean(user.emailVerified) : undefined}
            >
              {user?.email ? <span className="ltr-island">{user.email}</span> : null}
            </Field>

            <Field
              label={t('account.profilePhone')}
              verified={user?.phone ? Boolean(user.phoneVerified) : undefined}
            >
              {user?.phone ? <span className="ltr-island numeric">{user.phone}</span> : null}
            </Field>

            <Field label={t('account.profileCountry')}>
              {user?.country ? countryName(user.country) : null}
            </Field>

            <Field label={t('account.profileMember')}>
              {user?.createdAt ? <span className="numeric">{formatDate(user.createdAt)}</span> : null}
            </Field>
          </dl>
        </CardContent>
      </Card>

      {/* ── Where you can go ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            {/* `interactive` is what gives the card its hover — and the card is
                a link now, which the scaffold's cards never were. */}
            <Card interactive className="h-full">
              <CardHeader>
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-md bg-gold/12 text-gold"
                >
                  <section.icon className="size-5" />
                </span>
                <CardTitle as="h2" className="pt-2 transition-colors group-hover:text-gold">
                  {section.label}
                </CardTitle>
                <CardDescription>{section.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * One field, and an honest empty state.
 *
 * A missing value renders «غير مضاف» rather than a blank line: a blank reads as
 * a page that failed to load its data, and the reader cannot tell whether the
 * field is empty or the page is broken.
 */
function Field({
  label,
  verified,
  children,
}: {
  label: string
  verified?: boolean
  children?: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {children ?? <span className="text-muted-foreground">{t('account.profileNotSet')}</span>}
        {verified === true ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <BadgeCheck className="size-3.5" aria-hidden />
            {t('account.profileVerified')}
          </span>
        ) : verified === false ? (
          <span className="text-xs text-warning">{t('account.profileUnverified')}</span>
        ) : null}
      </dd>
    </div>
  )
}
