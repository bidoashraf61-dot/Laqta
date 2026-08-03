'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n'

/**
 * Header search entry.
 *
 * Deliberately dumb: it hands the query to `/footage` and stops there.
 * Suggestions, filters and the Meilisearch wiring belong to Brief 05 — this is
 * only the doorway, so the header does not have to change when search lands.
 *
 * The magnifier sits at inline-start with `ps-9` padding on the field, so it
 * moves to the right-hand side of the box in Arabic without a second rule.
 */
export function SearchEntry({
  locale,
  placeholder,
  label,
  className,
}: {
  locale: Locale
  placeholder: string
  label: string
  className?: string
}) {
  const router = useRouter()
  const [value, setValue] = useState('')

  return (
    <form
      role="search"
      className={cn('relative w-full', className)}
      onSubmit={(event) => {
        event.preventDefault()
        const query = value.trim()
        router.push(`/${locale}/footage${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      }}
    >
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="ps-9"
      />
    </form>
  )
}
