import { cn } from '@/lib/utils'

/**
 * The `skeleton` class carries the shimmer sweep, which is authored with
 * `inset-inline-start` in globals.css so it travels the right way in RTL.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} {...props} />
}

export { Skeleton }
