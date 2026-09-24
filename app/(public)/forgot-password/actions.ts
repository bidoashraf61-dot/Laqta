'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { requestLocale } from '@/lib/locale-request'
import { PASSWORD_MIN, requestPasswordReset, resetPassword } from '@/lib/password-reset'

/**
 * «نسيت كلمة المرور؟» and the reset link it sends.
 *
 * Message keys, not sentences — the form translates with `useT()`. A server
 * action has no render scope, so `t()` here would answer every reader in
 * Arabic (`verify:action-locale`).
 */

export type ForgotResult =
  | { status: 'sent'; email: string; devLink: string | null }
  | { status: 'error'; messageKey: string }

/**
 * Always `sent` for a well-formed address — known, unknown, suspended or
 * rate-limited alike. Only a malformed address is refused, and that says
 * nothing about any account.
 */
export async function requestReset(formData: FormData): Promise<ForgotResult> {
  const locale = await requestLocale()
  const parsed = z.string().trim().email().max(320).safeParse(formData.get('email'))
  if (!parsed.success) return { status: 'error', messageKey: 'auth.invalidEmail' }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null

  const { devLink } = await requestPasswordReset({ email: parsed.data, ip, pageLocale: locale })
  return { status: 'sent', email: parsed.data, devLink }
}

export type ResetActionResult = { status: 'ok' } | { status: 'error'; messageKey: string }

export async function completeReset(formData: FormData): Promise<ResetActionResult> {
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  // Checked here as well as in the browser: the form's own checks are a
  // courtesy, not a rule.
  if (password.length < PASSWORD_MIN) return { status: 'error', messageKey: 'auth.passwordTooShort' }
  if (password !== confirm) return { status: 'error', messageKey: 'auth.passwordMismatch' }

  const result = await resetPassword(token, password)
  if (result.ok) return { status: 'ok' }
  return {
    status: 'error',
    messageKey: result.reason === 'weak_password' ? 'auth.passwordTooShort' : 'auth.resetInvalidTitle',
  }
}
