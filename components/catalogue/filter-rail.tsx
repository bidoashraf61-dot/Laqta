'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/toggles'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/overlays'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n-client'
import type { Locale } from '@/lib/locale'
import { specLabel } from '@/lib/spec-labels'

/**
 * The filter rail.
 *
 * State lives in the URL, not in React. A filtered view has to be shareable —
 * an agency sends "4K, AlUla, cleared for commercial" to a colleague as a link
 * — and server-rendered, because these are the pages that rank.
 *
 * Vertical (9:16) is a first-class option rather than buried under "other":
 * in this market a large share of demand is for social, and hiding it costs
 * real sales.
 */

/**
 * `label` is optional on purpose.
 *
 * Resolution, aspect and frame rate are the same string in every language, so
 * they carry their label. Everything else is a stored English term — `Drone`,
 * `golden hour` — whose display form depends on the interface language, and
 * baking one language's label into a module constant is precisely how the
 * Arabic rail ended up on the English page. Those carry a `kind` and are
 * resolved through `specLabel` at render; durations carry a message key.
 */
type Option = { value: string; label?: string; kind?: string; labelKey?: string }

/**
 * How the footage was made. First in the rail, because it is now the facet
 * buyers narrow on hardest — a brand may have to disclose synthetic media, and
 * an agency briefing "real Saudi locations" is making a factual claim.
 */
const ORIGIN: Option[] = [
  { value: 'captured', labelKey: 'catalogue.originCaptured' },
  { value: 'generated', labelKey: 'catalogue.originGenerated' },
]

/** 720p added: a lot of social work is finished at 720 and never needs more. */
const RESOLUTIONS: Option[] = [
  { value: '1280', label: '720p' },
  { value: '1920', label: '1080p' },
  { value: '3840', label: '4K' },
]

/** Orientation, in the three shapes anything is actually delivered in. */
const ASPECTS: Option[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]

const MOVEMENT: Option[] = [
  { value: 'Drone', kind: 'movement' },
  { value: 'Gimbal', kind: 'movement' },
  { value: 'Handheld', kind: 'movement' },
  { value: 'Static', kind: 'movement' },
  { value: 'Slider', kind: 'movement' },
  { value: 'Crane', kind: 'movement' },
]

const SHOT_SIZE: Option[] = [
  { value: 'Wide', kind: 'shotSize' },
  { value: 'Medium', kind: 'shotSize' },
  { value: 'Close-up', kind: 'shotSize' },
  { value: 'Aerial', kind: 'shotSize' },
]

/**
 * Duration windows, not a slider.
 *
 * An editor cutting a six-second social bumper and one looking for a thirty-
 * second establishing hold are doing different jobs. Buckets rather than a
 * two-handled range control because the buckets ARE the jobs, and a range
 * slider is the least usable control on a touch screen.
 *
 * `value` is "min-max" in seconds; an open upper bound omits the second half.
 */
const DURATION: Option[] = [
  { value: '0-5', labelKey: 'catalogue.durUnder5' },
  { value: '5-10', labelKey: 'catalogue.dur5to10' },
  { value: '10-20', labelKey: 'catalogue.dur10to20' },
  { value: '20-', labelKey: 'catalogue.dur20plus' },
]

/**
 * Time of day. Matches the values written by prisma/seed.ts.
 *
 * The Arabic labels are the plain words a Saudi editor would say out loud —
 * «نهار», «ليل» — rather than transliterated cinematography terms. «الساعة
 * الذهبية» stays because it is what the golden hour is actually called here.
 */
const PEOPLE: Option[] = [
  { value: '1', labelKey: 'catalogue.peopleWith' },
  { value: '0', labelKey: 'catalogue.peopleWithout' },
]

const TIME_OF_DAY: Option[] = [
  { value: 'golden hour', kind: 'timeOfDay' },
  { value: 'blue hour', kind: 'timeOfDay' },
  { value: 'midday', kind: 'timeOfDay' },
  { value: 'dusk', kind: 'timeOfDay' },
  { value: 'night', kind: 'timeOfDay' },
]

export function FilterRail({ className }: { className?: string }) {
  const t = useT()

  return (
    <>
      {/* Desktop: a persistent rail. */}
      <aside
        className={cn('hidden w-64 shrink-0 lg:block', className)}
        aria-label={t('catalogue.filters')}
      >
        <FilterBody />
      </aside>

      {/* Mobile: a drawer from the inline-start edge. */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="lg:hidden">
            <SlidersHorizontal />
            {t('catalogue.filters')}
          </Button>
        </SheetTrigger>
        <SheetContent side="start" className="w-80 p-0">
          <SheetHeader>
            <SheetTitle>{t('catalogue.filters')}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-5rem)] px-6 pb-6">
            <FilterBody />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FilterBody() {
  const t = useT()

  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
      // Any filter change resets pagination — page 7 of the old result set is
      // meaningless against the new one.
      next.delete('page')
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const active = (key: string, value: string) => params.get(key) === value
  const toggle = (key: string, value: string) => setParam(key, active(key, value) ? null : value)

  // Duration is one visible choice backed by TWO params, so it cannot go
  // through `toggle`. Writing them separately would also push two history
  // entries for one click.
  const durationActive = (bucket: string) => {
    const [min, max] = bucket.split('-')
    return (params.get('dmin') ?? '') === min && (params.get('dmax') ?? '') === max
  }
  const pickDuration = (bucket: string) => {
    const next = new URLSearchParams(params.toString())
    if (durationActive(bucket)) {
      next.delete('dmin')
      next.delete('dmax')
    } else {
      const [min, max] = bucket.split('-')
      min ? next.set('dmin', min) : next.delete('dmin')
      max ? next.set('dmax', max) : next.delete('dmax')
    }
    next.delete('page')
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const hasFilters = [...params.keys()].some((key) => key !== 'q' && key !== 'page')

  return (
    <div className="space-y-6">
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            const next = new URLSearchParams()
            const q = params.get('q')
            if (q) next.set('q', q)
            router.push(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false })
          }}
        >
          {t('catalogue.clearFilters')}
        </Button>
      ) : null}

      {/*
        Origin first.

        The block that stood here filtered on clearance and licence — «مرخّصة
        للاستخدام التجاري» and «تحريري فقط». Both are gone: there is one licence
        now and every live album carries it, so those controls narrowed nothing
        while occupying the top of the rail.

        Frame rate, colour profile and season went with them. A rail is not
        improved by completeness — every facet a buyer does not use is one more
        thing to read past on the way to the four they do.
      */}
      <Group title={t('catalogue.origin')}>
        <Chips
          options={ORIGIN}
          isActive={(v) => active('origin', v)}
          onPick={(v) => toggle('origin', v)}
        />
      </Group>

      <Group title={t('catalogue.orientation')}>
        <Chips
          options={ASPECTS}
          isActive={(v) => active('aspect', v)}
          onPick={(v) => toggle('aspect', v)}
        />
      </Group>

      <Group title={t('catalogue.resolution')}>
        <Chips
          options={RESOLUTIONS}
          isActive={(v) => active('minWidth', v)}
          onPick={(v) => toggle('minWidth', v)}
        />
      </Group>

      <Group title={t('catalogue.shotSize')}>
        <Chips
          options={SHOT_SIZE}
          isActive={(v) => active('shot', v)}
          onPick={(v) => toggle('shot', v)}
        />
      </Group>

      <Group title={t('catalogue.cameraMovement')}>
        <Chips
          options={MOVEMENT}
          isActive={(v) => active('movement', v)}
          onPick={(v) => toggle('movement', v)}
        />
      </Group>

      <Group title={t('catalogue.duration')}>
        <Chips
          options={DURATION}
          isActive={(v) => durationActive(v)}
          onPick={(v) => pickDuration(v)}
        />
      </Group>

      <Group title={t('catalogue.timeOfDay')}>
        <Chips
          options={TIME_OF_DAY}
          isActive={(v) => active('time', v)}
          onPick={(v) => toggle('time', v)}
        />
      </Group>

      {/*
        People: two states, not three checkboxes.

        It was «مع أشخاص» / «بدون أشخاص» / «وجوه مميّزة» as independent boxes,
        which let a buyer tick two mutually exclusive things at once and get an
        empty result with no explanation. Identifiable faces is a release
        question the review queue already settles; it was never a browsing one.
      */}
      <Group title={t('catalogue.people')}>
        <Chips
          options={PEOPLE}
          isActive={(v) => params.get('people') === v}
          onPick={(v) => setParam('people', params.get('people') === v ? null : v)}
        />
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{title}</p>
      {children}
    </div>
  )
}

/**
 * The label this option shows in the language the page is in: its own string
 * when it has one, a message key for the duration buckets, and otherwise the
 * stored technical term run through the same table the clip pages use — so a
 * chip and the spec it filters on can never disagree.
 */
function optionLabel(option: Option, t: (key: string) => string, locale: Locale): string {
  if (option.label) return option.label
  if (option.labelKey) return t(option.labelKey)
  return specLabel(option.kind ?? '', option.value, locale) ?? option.value
}

function Chips({
  options,
  isActive,
  onPick,
  numeric,
}: {
  options: Option[]
  isActive: (value: string) => boolean
  onPick: (value: string) => void
  numeric?: boolean
}) {
  const t = useT()
  const locale = useLocale()

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const label = optionLabel(option, t, locale)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            aria-pressed={isActive(option.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              numeric && 'numeric',
              // Codec and profile names are Latin identifiers, not copy — they
              // stay Latin but must be isolated inside an Arabic rail.
              /[A-Za-z]/.test(label) && 'ltr-island',
              isActive(option.value)
                ? 'border-gold bg-gold/15 text-gold'
                : 'border-input text-muted-foreground hover:border-foreground/25 hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
