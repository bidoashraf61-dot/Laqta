'use client'

import * as React from 'react'
import { Star } from 'lucide-react'
import { reviewAlbum } from '@/app/(public)/actions'
import { Button } from '@/components/ui/button'
import { SubHeadline } from '@/components/ui/typography'
import { UserText } from '@/components/ui/bilingual'
import type { AlbumReviewData } from '@/lib/reviews'
import { formatDate, formatNumber } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n-client'

/**
 * Buyer reviews, under the album they are about.
 *
 * ── Stars are never the only signal ─────────────────────────────────────────
 * Every rating is printed as a number beside its stars. A row of glyphs is
 * unreadable to a screen reader and ambiguous at a glance ("is that four or
 * five?"), and shape alone fails the same people colour alone fails.
 *
 * ── The count travels with the average ──────────────────────────────────────
 * An average without its sample size is not a rating, it is a rumour. "5.0"
 * from one buyer must not read as stronger than "4.6" from ninety, so the
 * count is always beside the figure.
 */

function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'size-4',
            n <= Math.round(value) ? 'fill-gold text-gold' : 'text-muted-foreground/40',
          )}
        />
      ))}
    </span>
  )
}

export function AlbumReviews({
  albumId,
  reviews,
  ratingAvg,
  ratingCount,
  canReview,
  signedIn,
  ownReview,
}: {
  albumId: string
  reviews: AlbumReviewData[]
  ratingAvg: number | null
  ratingCount: number
  canReview: boolean
  signedIn: boolean
  /** The viewer's existing review, so the form opens on what they gave. */
  ownReview: { rating: number; bodyAr: string | null } | null
}) {
  const t = useT()

  const [state, setState] = React.useState<{ ok: boolean; messageKey: string } | null>(null)
  const [rating, setRating] = React.useState(ownReview?.rating ?? 5)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(formData: FormData) {
    startTransition(async () => setState(await reviewAlbum(formData)))
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <SubHeadline as="h2" size="panel" weight="strong">
          {t('review.title')}
        </SubHeadline>
        {ratingCount > 0 && ratingAvg != null ? (
          <p className="flex items-center gap-2 text-sm">
            <Stars value={ratingAvg} />
            {/* The number, always — not just the glyphs. */}
            <span className="numeric font-bold">{ratingAvg.toFixed(1)}</span>
            <span className="text-muted-foreground">
              {t('review.outOf')} · <span className="numeric">{formatNumber(ratingCount)}</span>{' '}
              {t('review.count')}
            </span>
          </p>
        ) : null}
      </div>

      {canReview ? (
        <form action={onSubmit} className="space-y-3 rounded-lg border bg-card p-5">
          <input type="hidden" name="albumId" value={albumId} />
          <fieldset>
            <legend className="text-sm font-medium">{t('review.ratingLabel')}</legend>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer p-1">
                  {/* A real radio underneath: keyboard reachable, announced,
                      and submitted without JavaScript if the transition fails. */}
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    onChange={() => setRating(n)}
                    className="sr-only"
                  />
                  <span className="sr-only">{n}</span>
                  <Star
                    aria-hidden
                    className={cn(
                      'size-6 transition-colors',
                      n <= rating ? 'fill-gold text-gold' : 'text-muted-foreground/40',
                    )}
                  />
                </label>
              ))}
              <span className="numeric ms-2 text-sm text-muted-foreground">{rating}/5</span>
            </div>
          </fieldset>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t('review.bodyLabel')}</span>
            <textarea
              name="body"
              rows={3}
              maxLength={1200}
              defaultValue={ownReview?.bodyAr ?? ''}
              placeholder={t('review.bodyPlaceholder')}
              className="rounded-md border border-input bg-background p-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="gold" size="sm" disabled={pending}>
              {t('review.submit')}
            </Button>
            <p role="status" aria-live="polite" className="text-sm">
              {state ? (
                <span className={state.ok ? 'text-success' : 'text-destructive'}>
                  {t(state.messageKey)}
                </span>
              ) : null}
            </p>
          </div>
        </form>
      ) : (
        // Say WHY the form is absent. A missing control with no explanation
        // reads as a broken page.
        <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          {signedIn ? t('review.mustOwn') : t('review.signInFirst')}
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('review.none')}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={review.rating} />
                <span className="numeric text-sm font-bold">{review.rating}/5</span>
                <UserText className="text-sm font-medium">{review.authorNameAr}</UserText>
                <span className="numeric text-xs text-muted-foreground">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              {review.bodyAr ? (
                <UserText className="mt-2 block font-serif text-base leading-relaxed text-muted-foreground">
                  {review.bodyAr}
                </UserText>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
