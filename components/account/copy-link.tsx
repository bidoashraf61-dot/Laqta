'use client'

import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n-client'

/** Copy an absolute share link built from the page's own origin. */
export function CopyLink({ path }: { path: string }) {
  const t = useT()
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        const url = `${window.location.origin}${path}`
        try {
          await navigator.clipboard.writeText(url)
          toast.success(t('boards.copied'))
        } catch {
          window.prompt(t('boards.share'), url)
        }
      }}
    >
      <Link2 className="size-4" />
      {t('boards.share')}
    </Button>
  )
}
