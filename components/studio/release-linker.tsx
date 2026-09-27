'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/toggles'
import { toast } from '@/components/ui/toast'
import { setReleaseClips } from '@/app/(studio)/studio/actions'
import { useT } from '@/lib/i18n-client'

export type LinkableClip = {
  id: string
  titleAr: string
  albumTitleAr: string
  identifiableFaces: boolean
  hasPeople: boolean
}

/**
 * Attach a release to the clips it covers.
 *
 * A disclosure rather than a modal: linking is a refinement of a row that is
 * already on screen, and interrupting the whole page to tick three checkboxes
 * is disproportionate. The selection posts whole — unchecking is a real edit,
 * not a no-op — so what the creator sees is what the submission gate reads.
 */
export function ReleaseLinker({
  releaseId,
  clips,
  linked,
}: {
  releaseId: string
  clips: LinkableClip[]
  linked: string[]
}) {
  const t = useT()

  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(linked))
  const [pending, startTransition] = useTransition()

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (clips.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('dash.noLinkableClips')}</p>
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Link2 className="size-3.5" />
        {t('dash.linkClips')}
        <span className="numeric text-xs text-muted-foreground">{selected.size}</span>
      </Button>

      {open ? (
        <div className="mt-3 rounded-md border border-border/60 bg-background p-3">
          <p className="mb-3 text-xs text-muted-foreground">{t('dash.linkClipsHint')}</p>
          <ul className="scrollbar-thin max-h-56 space-y-1.5 overflow-y-auto">
            {clips.map((clip) => (
              <li key={clip.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1 py-1 text-sm transition-colors hover:bg-accent">
                  <Checkbox
                    checked={selected.has(clip.id)}
                    onCheckedChange={() => toggle(clip.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{clip.titleAr}</span>
                  {clip.identifiableFaces ? (
                    <span className="shrink-0 text-xs font-medium text-warning">{t('catalogue.identifiableFaces')}</span>
                  ) : clip.hasPeople ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{t('catalogue.peopleWith')}</span>
                  ) : null}
                  <span className="shrink-0 truncate text-xs text-muted-foreground">
                    {clip.albumTitleAr}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-start">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setReleaseClips(releaseId, [...selected])
                  if (result.ok) {
                    toast.success(result.message ?? t('dash.saved'))
                    setOpen(false)
                    router.refresh()
                  } else {
                    toast.error(result.message ?? t('state.error'))
                  }
                })
              }
            >
              {pending ? t('state.loading') : t('dash.saveLinks')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
