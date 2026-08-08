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
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

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

type Option = { value: string; label: string }

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
  { value: 'Drone', label: 'درون' },
  { value: 'Gimbal', label: 'جيمبل' },
  { value: 'Handheld', label: 'محمولة' },
  { value: 'Static', label: 'ثابتة' },
  { value: 'Slider', label: 'سلايدر' },
  { value: 'Crane', label: 'كرين' },
]

const SHOT_SIZE: Option[] = [
  { value: 'Wide', label: 'واسعة' },
  { value: 'Medium', label: 'متوسطة' },
  { value: 'Close-up', label: 'قريبة' },
  { value: 'Aerial', label: 'جوية' },
]

export function FilterRail({ className }: { className?: string }) {
  return (
    <>
      {/* Desktop: a persistent rail. */}
      <aside className={cn('hidden w-64 shrink-0 lg:block', className)} aria-label={t('catalogue.filters')}>
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
        <Chips options={RESOLUTIONS} isActive={(v) => active('minWidth', v)} onPick={(v) => toggle('minWidth', v)} />
      </Group>

      <Group title={t('catalogue.aspect')}>
        <Chips options={ASPECTS} isActive={(v) => active('aspect', v)} onPick={(v) => toggle('aspect', v)} />
      </Group>

      <Group title={t('catalogue.frameRate')}>
        <Chips options={FRAME_RATES} isActive={(v) => active('fps', v)} onPick={(v) => toggle('fps', v)} numeric />
      </Group>

      <Group title={t('catalogue.colourProfile')}>
        <Chips options={COLOUR} isActive={(v) => active('colour', v)} onPick={(v) => toggle('colour', v)} />
      </Group>

      <Group title={t('catalogue.cameraMovement')}>
        <Chips options={MOVEMENT} isActive={(v) => active('movement', v)} onPick={(v) => toggle('movement', v)} />
      </Group>

      <Group title={t('catalogue.shotSize')}>
        <Chips options={SHOT_SIZE} isActive={(v) => active('shot', v)} onPick={(v) => toggle('shot', v)} />
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
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
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
            /[A-Za-z]/.test(option.label) && 'ltr-island',
            isActive(option.value)
              ? 'border-gold bg-gold/15 text-gold'
              : 'border-input text-muted-foreground hover:border-foreground/25 hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
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
