'use server'

import { AuthError } from 'next-auth'
import { z } from 'zod'
import { signIn, normalisePhone, hashPassword } from '@/lib/auth'
import { issueOtp, phoneSignInEnabled } from '@/lib/otp'
import { db } from '@/lib/db'

/**
 * Sign-in / sign-up server actions.
 *
 * All of them return a plain result object rather than redirecting themselves —
 * the form decides what to show, and a redirect thrown inside a try/catch here
 * would be swallowed as an error.
 *
 * Message keys, not sentences: the caller translates. Never leak whether an
 * email exists — every failure path returns the same `invalidCredentials`.
 */

export type AuthActionResult =
  | { status: 'ok'; redirectTo: string }
  | { status: 'error'; messageKey: string }
  | { status: 'two_factor' }
  | { status: 'code_sent'; phone: string }

/** Same-origin paths only — an open redirect here would be a phishing hole. */
function safeRedirect(callbackUrl: string | null) {
  if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl
  }
  return '/'
}

const emailInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
})

export async function signInWithEmail(formData: FormData): Promise<AuthActionResult> {
  const redirectTo = safeRedirect(formData.get('callbackUrl') as string | null)

  const parsed = emailInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    totp: (formData.get('totp') as string) || undefined,
  })
  if (!parsed.success) return { status: 'error', messageKey: 'auth.invalidCredentials' }

  try {
    await signIn('email', {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      totp: parsed.data.totp,
      redirect: false,
    })
  } catch (error) {
    if (isTwoFactorChallenge(error)) return { status: 'two_factor' }
    if (error instanceof AuthError) {
      return { status: 'error', messageKey: 'auth.invalidCredentials' }
    }
    throw error
  }

  return { status: 'ok', redirectTo }
}

/** Issue a phone OTP. The code goes out by SMS only — never in this response. */
export async function requestPhoneCode(formData: FormData): Promise<AuthActionResult> {
  if (!phoneSignInEnabled()) return { status: 'error', messageKey: 'auth.phoneUnavailable' }

  const raw = String(formData.get('phone') ?? '')
  if (raw.replace(/\D/g, '').length < 6) {
    return { status: 'error', messageKey: 'auth.invalidCredentials' }
  }

  const phone = normalisePhone(raw)
  await issueOtp(phone)
  return { status: 'code_sent', phone }
}

export async function signInWithPhone(formData: FormData): Promise<AuthActionResult> {
  const redirectTo = safeRedirect(formData.get('callbackUrl') as string | null)
  const phone = String(formData.get('phone') ?? '')
  const code = String(formData.get('code') ?? '')

  try {
    await signIn('phone', { phone, code, redirect: false })
  } catch (error) {
    if (error instanceof AuthError) return { status: 'error', messageKey: 'auth.invalidCode' }
    throw error
  }

  return { status: 'ok', redirectTo }
}

const signUpInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function signUpWithEmail(formData: FormData): Promise<AuthActionResult> {
  const parsed = signUpInput.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { status: 'error', messageKey: 'auth.invalidCredentials' }

  const email = parsed.data.email.toLowerCase()
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { status: 'error', messageKey: 'auth.accountExists' }

  await db.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      locale: 'ar',
      role: 'buyer',
    },
  })

  try {
    await signIn('email', { email, password: parsed.data.password, redirect: false })
  } catch (error) {
    if (error instanceof AuthError) {
      // The account exists but the session did not start — send them to sign in.
      return { status: 'error', messageKey: 'auth.somethingWentWrong' }
    }
    throw error
  }

  return { status: 'ok', redirectTo: '/' }
}

/**
 * Auth.js surfaces a `CredentialsSignin` subclass's `code` on the thrown error,
 * but wraps it differently depending on where the throw happened, so both the
 * property and the message are checked.
 */
function isTwoFactorChallenge(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === 'two_factor_required') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.includes('two_factor_required')
}
