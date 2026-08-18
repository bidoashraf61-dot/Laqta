import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Cells default to `text-start`. Numeric columns (money, counts, dates) should
 * carry `className="numeric"` on the cell — that isolates them LTR with
 * tabular figures so an SAR column stays legible on an RTL page.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
))
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        // The row highlight tracks the pointer down a long table, so it takes
        // the shortest step on the scale — anything slower smears behind the
        // cursor and reads as lag rather than as feedback.
        'border-b transition-colors duration-tap ease-lens hover:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-4 text-start align-middle text-xs font-bold uppercase tracking-wide text-muted-foreground',
      className,
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-4 py-3 text-start align-middle',
      /*
       * A link in a cell gets the cell's full height as its hit area.
       *
       * These were the last targets under 24px anywhere in the portal: an album
       * title in a dashboard table is a 21px line of text, and it is the primary
       * way an operator opens the thing they are working on. The negative margin
       * cancels the padding visually, so rows keep their height and only the
       * target grows.
       *
       * WCAG 2.2 SC 2.5.8's exemption is for links inside a sentence. A table
       * cell is not a sentence.
       */
      '[&>a]:-my-3 [&>a]:block [&>a]:py-3',
      className,
    )}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
))
TableCaption.displayName = 'TableCaption'

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption }
