import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-tap ease-lens',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        gold: 'border-gold/40 bg-gold/15 text-gold',
        neutral: 'border-transparent bg-muted text-muted-foreground',
        /*
         * The chip that survives a coloured ground — by not repainting it.
         *
         * Every filled variant fails somewhere on olive: `gold` reaches 2.82:1,
         * `neutral` 3.47:1, and even the secondary pair only 4.19:1, because
         * each one lifts a tint out from under its own text and the pair was
         * never solved against THAT composite. Painting a surface without
         * re-solving its ink is the same mistake that made four sections
         * invisible in dark mode.
         *
         * So this one paints nothing. It borrows the ground it is standing on
         * and borrows `--foreground` with it, which every scope already solves
         * together — 5.64:1 on olive, higher everywhere else. It cannot come
         * apart, because there is nothing to come apart.
         */
        sand: 'border-current/35 bg-transparent text-foreground',
        /*
         * Worn on footage — a duration, a resolution, a ratio.
         *
         * These sat on `neutral` with the ground repainted to `bg-ink/80` at
         * the call site, which left `--muted-foreground` on top of it: fine in
         * dark, 1.82:1 in light, because that token follows the CHROME and the
         * scrim does not. Film is theme-independent (dark is a property of the
         * footage, not of the page), so the pair is pinned here and cannot be
         * half-overridden by a className again.
         */
        film: 'border-transparent bg-ink/80 text-off-white backdrop-blur',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/15 text-warning',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
