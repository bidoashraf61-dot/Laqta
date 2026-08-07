import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: t('catalogue.creatorsTitle'),
  alternates: { canonical: '/creators' },
}

export default async function CreatorsPage() {
  const creators = await db.creator.findMany({
    where: { status: 'approved', albums: { some: { status: 'live' } } },
    orderBy: [{ lifetimeGmv: 'desc' }, { createdAt: 'asc' }],
    select: {
      handle: true,
      displayNameAr: true,
      displayNameEn: true,
      bioAr: true,
      city: true,
      _count: { select: { albums: true } },
    },
  })

  return (
    <div className="container-tight py-16">
      <PageTitle className="mb-6">{t('catalogue.creatorsTitle')}</PageTitle>

      {creators.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator) => (
            <Link
              key={creator.handle}
              href={`/creators/${creator.handle}`}
              className="rounded-lg border bg-card p-5 transition-colors hover:border-foreground/25"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-lg font-bold">
                  {creator.displayNameAr.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    <Bilingual ar={creator.displayNameAr} en={creator.displayNameEn} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {creator.city ? `${creator.city} · ` : ''}
                    <span className="numeric">{creator._count.albums}</span>{' '}
                    {t('commerce.album')}
                  </p>
                </div>
              </div>
              {creator.bioAr ? (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{creator.bioAr}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
