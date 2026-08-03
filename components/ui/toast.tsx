'use client'

import { Toaster as SonnerToaster, toast } from 'sonner'
import type { Locale } from '@/lib/i18n'

/**
 * Toasts.
 *
 * Mounted once in app/[locale]/layout.tsx. The stack anchors to the bottom
 * inline-start corner — bottom-right in Arabic, bottom-left in English —
 * because a toast that covers the reading edge is a toast people miss.
 *
 * Usage anywhere in a client component:
 *   import { toast } from '@/components/ui/toast'
 *   toast.success('تم الحفظ')
 */
function Toaster({ locale }: { locale: Locale }) {
  return (
    <SonnerToaster
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      position={locale === 'ar' ? 'bottom-right' : 'bottom-left'}
      // Sonner labels its live region "Notifications" by default. That string
      // is never drawn, so it survives any visual review — but a screen reader
      // on an Arabic page announces the toast container in English.
      containerAriaLabel={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
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
