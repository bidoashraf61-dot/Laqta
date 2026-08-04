'use client'

import { Toaster as SonnerToaster, toast } from 'sonner'

/**
 * Toasts.
 *
 * Mounted once in app/layout.tsx. The stack anchors bottom-right — the inline
 * start of an Arabic page — because a toast covering the reading edge is a
 * toast people miss.
 *
 * Usage anywhere in a client component:
 *   import { toast } from '@/components/ui/toast'
 *   toast.success('تم الحفظ')
 */
function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="bottom-right"
      // Sonner labels its live region "Notifications" by default. That string
      // is never drawn, so it survives any visual review — but a screen reader
      // would announce the toast container in English.
      containerAriaLabel="الإشعارات"
      theme="dark"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group border-border bg-card text-card-foreground shadow-lift',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          error: 'border-destructive/40',
          success: 'border-success/40',
        },
      }}
    />
  )
}

export { Toaster, toast }
