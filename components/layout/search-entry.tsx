'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * Header search entry.
 *
 * Deliberately dumb: it hands the query to `/footage` and stops there.
 * Suggestions, filters and the search index belong to the catalogue — this is
 * only the doorway, so the header does not change when search grows.
 *
 * The magnifier sits at inline-start with `ps-9` padding on the field, so it
 * lands on the right-hand side of the box without a second rule.
 */
export function SearchEntry({ className }: { className?: string }) {
  const router = useRouter()
  const [value, setValue] = useState('')

  return (
    <form
      role="search"
      className={cn('relative w-full', className)}
      onSubmit={(event) => {
        event.preventDefault()
        const query = value.trim()
        router.push(`/footage${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      }}
    >
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.submit')}
        className="ps-9"
      />
    </form>
  )
}
