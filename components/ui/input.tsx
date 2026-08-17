import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `text-start` rather than `text-left`: the caret and placeholder follow the
 * document direction. Set `dir="ltr"` explicitly on fields whose *content* is
 * always Latin — email, phone, IBAN, VAT number — even on an RTL page.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm ring-offset-background transition-colors duration-tap ease-lens',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm ring-offset-background transition-colors duration-tap ease-lens',
      'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
/**
 * Native `<select>`, styled to match Input.
 *
 * Distinct from the Radix Select in `select.tsx`: that one is for rich,
 * client-driven pickers, this one posts a real value inside a form action and
 * inherits the platform's own picker on mobile. Dashboard forms use this so a
 * dropdown looks and behaves the same on every settings panel.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 text-start text-sm ring-offset-background transition-colors duration-tap ease-lens',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'aria-[invalid=true]:border-destructive',
      className,
    )}
    {...props}
  />
))
NativeSelect.displayName = 'NativeSelect'

export { Input, Textarea, NativeSelect }
