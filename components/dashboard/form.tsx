'use client'

import { useActionState, useTransition, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { Spinner } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * The two ways a dashboard mutates something.
 *
 * `SettingsForm` for a panel of fields the operator edits then saves;
 * `ActionButton` for a single verb on a row (approve, pause, disable). Both
 * carry the full state set Operate mode requires — pending, error, success —
 * so no page has to hand-roll a spinner or forget one.
 */

export type ActionResult = { ok: boolean; message?: string }

/** Submit button that reads the enclosing form's pending state. */
export function SubmitButton({
  children,
  className,
  ...props
}: ButtonProps & { children?: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className={cn(className)} {...props}>
      {pending ? <Spinner className="size-4 text-current" /> : null}
      {children ?? t('actions.save')}
    </Button>
  )
}

/**
 * A settings panel bound to a server action.
 *
 * The action returns `{ ok, message }`; a failure renders inline above the
 * fields rather than as a toast that scrolls away, because a validation error
 * belongs next to the thing that failed validation.
 */
export function SettingsForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>
  children: ReactNode
  submitLabel?: string
  className?: string
}) {
  const [state, formAction] = useActionState(action, null)

  return (
    <form action={formAction} className={cn('space-y-5', className)}>
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message ?? t('state.error')}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert variant="success">
          <AlertDescription>{state.message ?? t('dash.saved')}</AlertDescription>
        </Alert>
      ) : null}

      {children}

      <div className="flex justify-start pt-1">
        <SubmitButton>{submitLabel ?? t('actions.save')}</SubmitButton>
      </div>
    </form>
  )
}

/**
 * A single-verb action on a row.
 *
 * `confirm` gates the irreversible ones (delist, disable content) behind a
 * native confirm rather than a modal — Operate mode's "modal as first thought"
 * constraint: interrupting the whole page to ask one yes/no question about one
 * row is disproportionate.
 */
export function ActionButton({
  action,
  label,
  confirm,
  successMessage,
  variant = 'outline',
  size = 'sm',
  icon,
  className,
}: {
  action: () => Promise<ActionResult>
  label: string
  confirm?: string
  successMessage?: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  icon?: ReactNode
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return
        startTransition(async () => {
          const result = await action()
          if (result.ok) {
            toast.success(successMessage ?? result.message ?? t('actions.confirm'))
            router.refresh()
          } else {
            toast.error(result.message ?? t('state.error'))
          }
        })
      }}
    >
      {pending ? <Spinner className="size-4 text-current" /> : icon}
      {label}
    </Button>
  )
}
