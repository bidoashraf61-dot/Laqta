'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/toggles'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/toggles'
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

const RESOLUTIONS: Option[] = [
  { value: '1920', label: '1080p' },
  { value: '3840', label: '4K' },
]

const ASPECTS: Option[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '2.39:1', label: '2.39:1' },
]

const FRAME_RATES: Option[] = [
  { value: '24', label: '24' },
  { value: '25', label: '25' },
  { value: '30', label: '30' },
  { value: '50', label: '50' },
  { value: '60', label: '60' },
]

const COLOUR: Option[] = [
  { value: 'D-Log', label: 'LOG' },
  { value: 'S-Log3', label: 'S-Log3' },
  { value: 'Rec.709', label: 'Rec.709' },
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
 * Every competitor exposes duration, and it was the largest gap in this rail:
 * an editor cutting a six-second social bumper and one looking for a thirty-
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

/** Matches the values written by prisma/seed.ts. */
const TIME_OF_DAY: Option[] = [
  { value: 'golden hour', kind: 'timeOfDay' },
  { value: 'blue hour', kind: 'timeOfDay' },
  { value: 'dusk', kind: 'timeOfDay' },
  { value: 'night', kind: 'timeOfDay' },
  { value: 'midday', kind: 'timeOfDay' },
]

const SEASON: Option[] = [
  { value: 'winter', kind: 'season' },
  { value: 'spring', kind: 'season' },
  { value: 'summer', kind: 'season' },
  { value: 'autumn', kind: 'season' },
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

      {/* The filter agencies use to the exclusion of all others — first, and
          not buried among the technical facets. */}
      <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-3">
        <CheckRow
          id="cleared"
          label={t('catalogue.clearedOnly')}
          checked={params.get('cleared') === '1'}
          onChange={(on) => setParam('cleared', on ? '1' : null)}
        />
        <CheckRow
          id="editorial"
          label={t('catalogue.editorialOnly')}
          checked={params.get('editorial') === '1'}
          onChange={(on) => setParam('editorial', on ? '1' : null)}
        />
      </div>

      <Group title={t('catalogue.resolution')}>
        <Chips
          options={RESOLUTIONS}
          isActive={(v) => active('minWidth', v)}
          onPick={(v) => toggle('minWidth', v)}
        />
      </Group>

      <Group title={t('catalogue.aspect')}>
        <Chips
          options={ASPECTS}
          isActive={(v) => active('aspect', v)}
          onPick={(v) => toggle('aspect', v)}
        />
      </Group>

      <Group title={t('catalogue.frameRate')}>
        <Chips
          options={FRAME_RATES}
          isActive={(v) => active('fps', v)}
          onPick={(v) => toggle('fps', v)}
          numeric
        />
      </Group>

      <Group title={t('catalogue.colourProfile')}>
        <Chips
          options={COLOUR}
          isActive={(v) => active('colour', v)}
          onPick={(v) => toggle('colour', v)}
        />
      </Group>

      <Group title={t('catalogue.cameraMovement')}>
        <Chips
          options={MOVEMENT}
          isActive={(v) => active('movement', v)}
          onPick={(v) => toggle('movement', v)}
        />
      </Group>

      <Group title={t('catalogue.shotSize')}>
        <Chips
          options={SHOT_SIZE}
          isActive={(v) => active('shot', v)}
          onPick={(v) => toggle('shot', v)}
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

      <Group title={t('catalogue.season')}>
        <Chips
          options={SEASON}
          isActive={(v) => active('season', v)}
          onPick={(v) => toggle('season', v)}
        />
      </Group>

      <Separator />

      <Group title={t('catalogue.people')}>
        <div className="space-y-2">
          <CheckRow
            id="with-people"
            label={t('catalogue.peopleWith')}
            checked={params.get('people') === '1'}
            onChange={(on) => setParam('people', on ? '1' : null)}
          />
          <CheckRow
            id="without-people"
            label={t('catalogue.peopleWithout')}
            checked={params.get('people') === '0'}
            onChange={(on) => setParam('people', on ? '0' : null)}
          />
          <CheckRow
            id="faces"
            label={t('catalogue.identifiableFaces')}
            checked={params.get('faces') === '1'}
            onChange={(on) => setParam('faces', on ? '1' : null)}
          />
        </div>
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

function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  )
}
