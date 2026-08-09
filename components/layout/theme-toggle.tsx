'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_KEY } from '@/lib/theme'
import { useT } from '@/lib/i18n-client'

/**
 * Light / dark toggle.
 *
 * ── Why this is hand-rolled ─────────────────────────────────────────────────
 * The whole job is three lines of state and one class on `<html>`. A theme
 * library would add a dependency and a provider to do that, and would still
 * need the same inline pre-paint script (see `THEME_SCRIPT`) to stop the flash
 * — because nothing React renders can run before the first paint.
 *
 * ── The three states ────────────────────────────────────────────────────────
 * `system` is the default and is NOT the same as "light". A visitor whose OS is
 * dark should land on dark without touching anything; a visitor who has picked
 * a side keeps it across sessions. Only an explicit pick is written to storage,
 * so "follow my system" survives as an absence rather than a guess.
 */

export type Theme = 'light' | 'dark' | 'system'

const KEY = THEME_KEY

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useT()

  const [theme, setTheme] = React.useState<Theme>('system')

  // Read once on mount. The class is already correct by now — THEME_SCRIPT set
  // it — so this only syncs the button's own label.
  React.useEffect(() => {
    const stored = localStorage.getItem(KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') setTheme(stored)
  }, [])

  // While the visitor is on `system`, follow the OS if it changes mid-session.
  React.useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  function pick(next: Theme) {
    setTheme(next)
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
    apply(next)
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <button
      type="button"
      onClick={() => pick(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      title={isDark ? t('theme.toLight') : t('theme.toDark')}
      className={cn(
        'grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {/* Both icons render; CSS picks. Swapping them in JS would flash the
          wrong one for a frame on every navigation. */}
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  )
}
