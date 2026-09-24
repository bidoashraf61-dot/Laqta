'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n-client'
import { formatBytes } from './upload-engine'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

/**
 * A release's scanned document: attach, open, replace, remove.
 *
 * Sent to `/api/studio/releases/<id>/document`, which checks the type from
 * the file's own bytes and stores it privately. Opening goes through the same
 * route — a short-lived signed URL on S3 — never a public path. Once a
 * reviewer verifies the release its document is locked: the page shows it and
 * offers no way to swap it.
 */
export function ReleaseDocument({
  releaseId,
  document,
  locked,
  rejected,
  maxBytes,
}: {
  releaseId: string
  document: { name: string; sizeBytes: number } | null
  locked: boolean
  rejected: boolean
  maxBytes: number
}) {
  const t = useT()
  const router = useRouter()
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const href = `/api/studio/releases/${releaseId}/document`

  const upload = async (file: File) => {
    if (file.size > maxBytes) {
      toast.error(t('dash.releaseDocRefuseSize'))
      return
    }
    setBusy(true)
    try {
      const response = await fetch(href, {
        method: 'PUT',
        headers: { 'x-filename': encodeURIComponent(file.name) },
        body: file,
      })
      if (response.ok) {
        toast.success(t('dash.releaseDocUploaded'))
        router.refresh()
        return
      }
      const code = ((await response.json().catch(() => ({}))) as { error?: string }).error
      toast.error(
        code === 'type'
          ? t('dash.releaseDocRefuseType')
          : code === 'size'
            ? t('dash.releaseDocRefuseSize')
            : code === 'verified'
              ? t('dash.releaseDocLocked')
              : t('state.error'),
      )
    } catch {
      toast.error(t('state.error'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(t('dash.releaseDocRemoveConfirm'))) return
    setBusy(true)
    try {
      const response = await fetch(href, { method: 'DELETE' })
      if (response.ok) {
        toast.success(t('dash.releaseDocRemoved'))
        router.refresh()
      } else {
        toast.error(t('state.error'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-3 rounded-md border border-border/60 bg-background p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-muted-foreground">{t('dash.releaseDocument')}</span>
        {document ? (
          <>
            <a
              href={href}
              target="_blank"
              rel="noopener"
              className="inline-flex min-w-0 items-center gap-1.5 underline-offset-4 hover:underline"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="ltr-island truncate">{document.name}</span>
              <span className="sr-only">{t('dash.releaseDocOpen')}</span>
            </a>
            <span className="numeric text-xs text-muted-foreground">{formatBytes(document.sizeBytes)}</span>
          </>
        ) : null}

        {locked ? null : (
          <span className="ms-auto flex items-center gap-1">
            {busy ? <Spinner className="size-4" /> : null}
            <Button
              type="button"
              size="sm"
              variant={document ? 'ghost' : 'outline'}
              disabled={busy}
              onClick={() => picker.current?.click()}
            >
              {document ? null : <Paperclip className="size-3.5" />}
              {document ? t('dash.releaseDocReplace') : t('dash.releaseDocAttach')}
            </Button>
            {document ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
                {t('dash.releaseDocRemove')}
              </Button>
            ) : null}
            <input
              ref={picker}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label={document ? t('dash.releaseDocReplace') : t('dash.releaseDocAttach')}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void upload(file)
              }}
            />
          </span>
        )}
      </div>

      {!document && !locked ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('dash.releaseDocNone')}{' '}
          <span>
            {t('dash.releaseDocFormats')} <span className="ltr-island">PDF · JPG · PNG</span> ·{' '}
            {t('dash.releaseDocMax')} <span className="numeric">{formatBytes(maxBytes)}</span>
          </span>
        </p>
      ) : null}
      {locked ? <p className="mt-2 text-xs text-muted-foreground">{t('dash.releaseDocLocked')}</p> : null}
      {rejected && !locked ? (
        <p className="mt-2 text-xs text-muted-foreground">{t('dash.releaseDocRejectedHint')}</p>
      ) : null}
    </div>
  )
}
