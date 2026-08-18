import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `interactive` is opt-in, and most cards should not take it.
 *
 * DESIGN.md defines a card hover — the border lifts to `foreground/25`, any
 * image inside scales, and the title never changes colour — but the base
 * component never implemented it, so every clickable card in the portal either
 * hand-rolled its own or had none. Naming it here makes the system's answer the
 * easy one.
 *
 * It stays opt-in because a dashboard panel is not a target. A card that
 * responds to the pointer is promising that clicking it does something, and a
 * card that lights up and then does nothing is a worse lie than a flat one.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-soft',
      interactive && [
        'transition-[border-color,box-shadow] duration-hover ease-lens',
        'hover:border-foreground/25 hover:shadow-lift',
        // The border is the hover signal, and a keyboard user reaching the card
        // through its link deserves the same signal a pointer gets.
        'focus-within:border-foreground/25',
        // Scales the image the card contains, which is the other half of the
        // rule. Longer than the border change: it is the whole frame moving.
        '[&_img]:transition-transform [&_img]:duration-frame [&_img]:ease-lens hover:[&_img]:scale-105',
      ],
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

/**
 * `as` exists for the page whose card IS the page.
 *
 * An <h2> is right for a card in a grid of cards. On sign-in and sign-up the
 * card is the entire page, so its title is the page title — and leaving it an
 * <h2> left those routes with no <h1> at all. Every guarded route redirects to
 * sign-in when signed out, so that single omission reported as 46 findings.
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' }
>(({ className, as: Tag = 'h2', ...props }, ref) => (
  <Tag ref={ref} className={cn('text-lg font-bold leading-[1.4]', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
