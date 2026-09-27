'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription, Spinner } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { Panel } from '@/components/dashboard/primitives'
import { saveBundleAction } from '@/app/(admin)/admin/bundles/actions'
import { BUNDLE_LIMITS, cents, overCeiling, priceBundle } from '@/lib/bundle-pricing'
import { useLocale, useMoney, usePick, useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'

/**
 * The bundle editor (DEV-62).
 *
 * The right-hand panel is the point of the screen: as albums and the price
 * change, it shows — per album — what the buyer pays, what the creator still
 * gets (always their full share: Laqta pays the discount) and what Laqta keeps.
 * An album where Laqta would keep less than nothing is marked, and save waits.
 * The numbers are `lib/bundle-pricing.ts`, the same functions checkout runs.
 *
 * Dates are typed in the owner's own clock and sent as exact instants, as on
 * the offer editor — the server runs in UTC.
 */

export type EditorAlbum = {
  id: string
  titleAr: string
  titleEn: string | null
  creatorAr: string
  creatorEn: string | null
  currency: string
  gross: number
  rate: number
}

type EditorBundle = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  pricing: 'percent_off' | 'fixed_price'
  value: string
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  albumIds: string[]
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

export function BundleEditor({ albums, bundle }: { albums: EditorAlbum[]; bundle: EditorBundle | null }) {
  const t = useT()
  const pick = usePick()
  const money = useMoney()
  const router = useRouter()
  const uiPrefix = useLocale() === 'en' ? '/en' : ''

  const [titleAr, setTitleAr] = useState(bundle?.titleAr ?? '')
  const [titleEn, setTitleEn] = useState(bundle?.titleEn ?? '')
  const [slug, setSlug] = useState(bundle?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(bundle))
  const [descriptionAr, setDescriptionAr] = useState(bundle?.descriptionAr ?? '')
  const [descriptionEn, setDescriptionEn] = useState(bundle?.descriptionEn ?? '')
  const [pricing, setPricing] = useState<'percent_off' | 'fixed_price'>(bundle?.pricing ?? 'percent_off')
  const [value, setValue] = useState(bundle?.value ?? '15')
  const [startsAt, setStartsAt] = useState(toLocalInput(bundle?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(bundle?.endsAt ?? null))
  const [isActive, setIsActive] = useState(bundle?.isActive ?? true)
  const [selected, setSelected] = useState<string[]>(bundle?.albumIds ?? [])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const byId = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums])
  const chosen = selected.map((id) => byId.get(id)).filter(Boolean) as EditorAlbum[]
  const missing = selected.filter((id) => !byId.has(id))
  const currency = chosen[0]?.currency ?? 'USD'

  const lines = chosen.map((album) => ({ albumId: album.id, gross: album.gross, rate: album.rate }))
  const numeric = Number(value)
  const priced = chosen.length >= BUNDLE_LIMITS.minAlbums && Number.isFinite(numeric)
    ? priceBundle(pricing, numeric, lines)
    : null
  const over = priced ? new Set(overCeiling(lines, priced.discounts)) : new Set<string>()
  const maxPercent = lines.length ? Math.floor(Math.min(...lines.map((line) => line.rate)) * 100) : null

  const needle = query.trim().toLowerCase()
  const candidates = albums.filter(
    (album) =>
      !selected.includes(album.id) &&
      (!needle ||
        album.titleAr.toLowerCase().includes(needle) ||
        (album.titleEn ?? '').toLowerCase().includes(needle) ||
        album.creatorAr.toLowerCase().includes(needle)),
  )

  const blocked = over.size > 0 || missing.length > 0

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveBundleAction({
        id: bundle?.id ?? null,
        slug,
        titleAr,
        titleEn,
        descriptionAr,
        descriptionEn,
        pricing,
        value,
        startsAt: toInstant(startsAt),
        endsAt: toInstant(endsAt),
        isActive,
        albumIds: selected,
      })
      if (!result.ok) {
        setError(result.message ?? t('state.error'))
        return
      }
      toast.success(result.message ?? t('dash.bundles.saved'))
      // A full load, not router.push: this codebase has seen client navigations
      // silently decline to commit (CLAUDE.md), and a new bundle must open.
      if (!bundle && result.id) window.location.assign(`${uiPrefix}/admin/bundles/${result.id}`)
      else router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      {/* ── The bundle ─────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-6">
        <Panel title={t('dash.bundles.details')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('dash.bundles.titleAr')} htmlFor="bundle-title-ar" required>
              <Input
                id="bundle-title-ar"
                dir="rtl"
                lang="ar"
                maxLength={80}
                value={titleAr}
                onChange={(event) => setTitleAr(event.target.value)}
              />
            </Field>
            <Field label={t('dash.bundles.titleEn')} htmlFor="bundle-title-en">
              <Input
                id="bundle-title-en"
                dir="ltr"
                lang="en"
                maxLength={80}
                value={titleEn}
                onChange={(event) => {
                  setTitleEn(event.target.value)
                  if (!slugTouched) setSlug(slugify(event.target.value))
                }}
              />
            </Field>
            <Field label={t('dash.bundles.slug')} htmlFor="bundle-slug" hint={t('dash.bundles.slugHint')} required className="md:col-span-2">
              <Input
                id="bundle-slug"
                dir="ltr"
                maxLength={60}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
              />
            </Field>
            <Field label={t('dash.bundles.descriptionAr')} htmlFor="bundle-desc-ar">
              <Textarea
                id="bundle-desc-ar"
                dir="rtl"
                lang="ar"
                maxLength={600}
                rows={3}
                value={descriptionAr}
                onChange={(event) => setDescriptionAr(event.target.value)}
              />
            </Field>
            <Field label={t('dash.bundles.descriptionEn')} htmlFor="bundle-desc-en">
              <Textarea
                id="bundle-desc-en"
                dir="ltr"
                lang="en"
                maxLength={600}
                rows={3}
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t('dash.bundles.albums')}>
          <p className="-mt-1 mb-4 text-sm text-muted-foreground">
            {t('dash.bundles.albumsHint', { min: BUNDLE_LIMITS.minAlbums, max: BUNDLE_LIMITS.maxAlbums })}
          </p>

          {chosen.length || missing.length ? (
            <ol className="mb-5 space-y-2">
              {chosen.map((album) => (
                <li
                  key={album.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm',
                    over.has(album.id) && 'border-destructive',
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{pick(album.titleAr, album.titleEn)}</span>
                    <span className="text-muted-foreground"> · {pick(album.creatorAr, album.creatorEn)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="numeric text-muted-foreground">{money(album.gross, album.currency)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t('dash.bundles.removeAlbum', { title: pick(album.titleAr, album.titleEn) })}
                      onClick={() => setSelected((current) => current.filter((id) => id !== album.id))}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
              {missing.map((id) => (
                <li key={id} className="flex items-center justify-between gap-3 rounded-md border border-warning px-3 py-2 text-sm">
                  <span className="text-warning">{t('dash.bundles.albumGone')}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected((current) => current.filter((other) => other !== id))}
                  >
                    {t('dash.bundles.remove')}
                  </Button>
                </li>
              ))}
            </ol>
          ) : null}

          <Field label={t('dash.bundles.addAlbum')} htmlFor="bundle-album-search" className="space-y-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="bundle-album-search"
                type="search"
                className="ps-9"
                placeholder={t('dash.bundles.searchAlbums')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </Field>
          <ul className="mt-2 max-h-72 divide-y divide-border/60 overflow-y-auto rounded-md border">
            {candidates.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">{t('dash.bundles.noAlbums')}</li>
            ) : (
              candidates.map((album) => (
                <li key={album.id}>
                  <button
                    type="button"
                    disabled={selected.length >= BUNDLE_LIMITS.maxAlbums}
                    onClick={() => setSelected((current) => [...current, album.id])}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm transition-colors duration-hover ease-lens hover:bg-muted/60 disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate">
                      {pick(album.titleAr, album.titleEn)}
                      <span className="text-muted-foreground"> · {pick(album.creatorAr, album.creatorEn)}</span>
                    </span>
                    <span className="numeric shrink-0 text-muted-foreground">{money(album.gross, album.currency)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Panel>

        <Panel title={t('dash.bundles.priceAndDates')}>
          <div className="grid gap-4 md:grid-cols-2">
            <div role="radiogroup" aria-label={t('dash.bundles.pricing')} className="flex gap-2 md:col-span-2">
              {(['percent_off', 'fixed_price'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={pricing === option}
                  onClick={() => setPricing(option)}
                  className={cn(
                    'h-10 flex-1 rounded-md border px-3 text-sm transition-colors duration-hover ease-lens',
                    pricing === option ? 'border-foreground/40 bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option === 'percent_off' ? t('dash.bundles.pricingPercent') : t('dash.bundles.pricingFixed')}
                </button>
              ))}
            </div>
            <Field
              label={pricing === 'percent_off' ? t('dash.bundles.percent') : t('dash.bundles.price')}
              htmlFor="bundle-value"
              hint={
                pricing === 'percent_off' && maxPercent !== null
                  ? t('dash.bundles.percentHint', { max: maxPercent })
                  : priced || chosen.length
                    ? t('dash.bundles.priceHint', { regular: cents(lines.reduce((sum, line) => sum + line.gross, 0)) })
                    : undefined
              }
              required
              className="md:col-span-2"
            >
              <Input
                id="bundle-value"
                type="number"
                inputMode="decimal"
                dir="ltr"
                className="numeric"
                min={pricing === 'percent_off' ? 1 : 0.01}
                max={pricing === 'percent_off' ? BUNDLE_LIMITS.maxPercent : undefined}
                step={pricing === 'percent_off' ? 1 : 0.01}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
            <Field label={t('dash.offer.startsAt')} htmlFor="bundle-starts" hint={t('dash.offer.startsHint')}>
              <Input
                id="bundle-starts"
                type="datetime-local"
                dir="ltr"
                className="numeric"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </Field>
            <Field label={t('dash.offer.endsAt')} htmlFor="bundle-ends" hint={t('dash.offer.endsHint')}>
              <Input
                id="bundle-ends"
                type="datetime-local"
                dir="ltr"
                className="numeric"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                className="size-4 accent-gold"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              {t('dash.bundles.active')}
            </label>
          </div>
        </Panel>
      </div>

      {/* ── What it costs, and who pays ──────────────────────────────────── */}
      <aside className="space-y-4 lg:sticky lg:top-20" aria-labelledby="bundle-summary">
        <Panel>
          <h2 id="bundle-summary" className="font-medium">
            {t('dash.bundles.summary')}
          </h2>
          {priced ? (
            <>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('bundle.regular')}</dt>
                  <dd className="numeric text-muted-foreground line-through">{money(priced.regular, currency)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-medium">{t('bundle.price')}</dt>
                  <dd className="numeric text-lg font-bold text-gold">{money(priced.price, currency)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t('bundle.save')}</dt>
                  <dd className="numeric text-success">{money(priced.discount, currency)}</dd>
                </div>
              </dl>

              <table className="mt-5 w-full text-xs">
                <caption className="mb-2 text-start text-muted-foreground">{t('dash.bundles.split')}</caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="pb-1 text-start font-normal">{t('dash.bundles.colAlbum')}</th>
                    <th scope="col" className="pb-1 text-end font-normal">{t('dash.bundles.colPaid')}</th>
                    <th scope="col" className="pb-1 text-end font-normal">{t('dash.bundles.colCreator')}</th>
                    <th scope="col" className="pb-1 text-end font-normal">{t('dash.bundles.colLaqta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.map((album) => {
                    const discount = priced.discounts[album.id] ?? 0
                    const paid = cents(album.gross - discount)
                    const creator = cents(album.gross - cents(album.gross * album.rate))
                    const laqta = cents(paid - creator)
                    return (
                      <tr key={album.id} className={cn('border-t border-border/60', over.has(album.id) && 'text-destructive')}>
                        <td className="max-w-0 truncate py-1.5 pe-2">{pick(album.titleAr, album.titleEn)}</td>
                        <td className="numeric py-1.5 text-end">{money(paid, album.currency)}</td>
                        <td className="numeric py-1.5 text-end">{money(creator, album.currency)}</td>
                        <td className="numeric py-1.5 text-end font-medium">{money(laqta, album.currency)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">{t('dash.bundles.whoPays')}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t('dash.bundles.summaryEmpty', { min: BUNDLE_LIMITS.minAlbums })}</p>
          )}
        </Panel>

        {over.size ? (
          <Alert variant="destructive">
            <AlertDescription>{t('dash.bundles.error.ceiling', { count: over.size, max: maxPercent ?? 0 })}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" size="lg" className="w-full" disabled={pending || blocked} onClick={save}>
          {pending ? <Spinner className="size-4 text-current" /> : null}
          {t('dash.bundles.save')}
        </Button>
      </aside>
    </div>
  )
}

/** ISO instant → the `datetime-local` value in the viewer's own clock. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` value (viewer's clock) → exact ISO instant, or ''. */
function toInstant(local: string) {
  if (!local) return ''
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
