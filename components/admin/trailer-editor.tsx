'use client'

import { Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays'
import { SettingsForm } from '@/components/dashboard/form'
import { saveAlbumTrailer } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/**
 * An album's trailer, set from its catalogue row.
 *
 * One field, so a popover rather than an expanding panel: a table row that
 * grows a form pushes every row under it down the page, and the operator
 * loses their place in a hundred-row list. A popover keeps the row where it
 * was and returns focus to its trigger on close.
 *
 * The field takes a KEY in the public media bucket — what `npm run
 * media:upload` writes — not an upload. The suggested key is shown as code so
 * the operator can see the convention without it becoming a placeholder that
 * reads like a value already set.
 */
export function TrailerEditor({
  albumId,
  albumSlug,
  trailerKey,
}: {
  albumId: string
  albumSlug: string
  trailerKey: string | null
}) {
  const t = useT()
  const fieldId = `trailer-${albumId}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Film className="size-3.5" aria-hidden />
          {t('dash.trailerEdit')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <SettingsForm action={saveAlbumTrailer} className="space-y-4">
          <input type="hidden" name="albumId" value={albumId} />
          <Field label={t('dash.trailerKey')} htmlFor={fieldId} hint={t('dash.trailerHint')}>
            <Input
              id={fieldId}
              name="trailerKey"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              defaultValue={trailerKey ?? ''}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {t('dash.trailerConvention')}{' '}
            <code className="ltr-island rounded-sm bg-muted px-1 py-0.5 text-foreground">
              trailers/{albumSlug}.mp4
            </code>
          </p>
        </SettingsForm>
      </PopoverContent>
    </Popover>
  )
}
