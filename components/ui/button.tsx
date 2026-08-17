import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    /*
     * Hover is colour only, per DESIGN.md — a button does not travel.
     *
     * The pressed state is the one addition, and it is deliberate. DESIGN.md
     * specifies hover and focus; it says nothing about `:active`, and on a
     * touch screen there IS no hover — a tap on a phone produced no feedback
     * at all between the press and the server answering. One percent over
     * 120ms sits under the threshold where it reads as movement and above the
     * one where the button feels dead.
     *
     * One `transition-property` for the whole button: naming transform in a
     * second utility would silently replace this list rather than extend it.
     */
    'transition-[color,background-color,border-color,box-shadow,transform] duration-tap ease-lens',
    'active:scale-[0.99]',
  ),
  {
    variants: {
      /*
       * Every filled variant hovers to a NAMED token, never to an alpha.
       *
       * `hover:bg-primary/90` looks like "10% darker" and is not: it is a hole
       * punched in the fill, so the result depends on whatever sits behind the
       * button — paper, an olive band, a photograph — while the label's colour
       * does not move at all. Three of these six variants did that, and the
       * one that already used a token (`gold`) used one its band had never
       * re-pitched, which is how the gold CTA reached 1.37:1 on hover.
       *
       * Each `-hover` step is solved against its own ink in every scope and
       * checked by `npm run verify:pairs`.
       */
      variant: {
        default: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover',
        gold: 'bg-gold text-gold-foreground shadow-glow hover:bg-gold-400',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        // The two unfilled variants share one hover fill, so a ghost and an
        // outline button sitting beside each other light up identically.
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3',
        default: 'h-10 px-4 py-2',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
