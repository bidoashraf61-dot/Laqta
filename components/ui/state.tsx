import * as React from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading / empty / error states.
 *
 * Every list surface in the app hits all three, and a page that renders a bare
 * white gap on the empty path reads as broken. Use these rather than inventing
 * a local variant so the copy and the spacing stay consistent site-wide.
 */

function Spinner({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <Loader2
      className={cn('size-5 animate-spin text-muted-foreground', className)}
      aria-hidden
      {...props}
    />
  )
}

function LoadingState({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('flex min-h-40 flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  )
}

/** Card-shaped placeholder for album/clip grids while data streams in. */
function CardGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        className,
      )}
    >
      <div className="text-muted-foreground [&_svg]:size-8">{icon ?? <Inbox />}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  )
}

function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: {
  title: string
  description?: string
  retryLabel?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="size-8 text-destructive" />
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry && retryLabel ? (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}

const alertVariants = cva('rounded-lg border p-4 text-sm [&>svg]:size-4', {
  variants: {
    variant: {
      default: 'bg-card text-card-foreground',
      info: 'border-primary/30 bg-primary/10 text-foreground',
      success: 'border-success/30 bg-success/10 text-foreground',
      warning: 'border-warning/40 bg-warning/10 text-foreground',
      destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-semibold leading-none', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export {
  Spinner,
  LoadingState,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  Alert,
  AlertTitle,
  AlertDescription,
  alertVariants,
}
