'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { actionT } from '@/lib/locale-request'
import type { ActionResult } from '@/components/dashboard/form'
import { headers } from 'next/headers'
import { issueEmailVerification } from '@/lib/mail'
import { issueOtp, consumeOtp } from '@/lib/otp'

/**
 * Edit the account's own details.
 *
 * ── What is editable here, and what deliberately is not ─────────────────────
 * Name and nationality are plain profile data and change freely.
 *
 * Email and mobile are LOGIN CREDENTIALS — both are unique, and both are a
 * sign-in rail (email/password and phone OTP). Changing either therefore does
 * two things beyond writing the column: it clears that channel's verified
 * stamp, so the account cannot claim a verification it has not passed, and it
 * refuses a value already attached to another account rather than surfacing a
 * database uniqueness error.
 *
 * Clearing the stamp is the important half. Without it, someone could point a
 * verified account at an address they do not control and inherit the trust the
 * old address had earned — which is how account recovery gets abused.
 *
 * ── Why the photo is not here ───────────────────────────────────────────────
 * `User.image` is a URL, and this product has no upload pipeline yet — storage
 * is behind a driver with a local stand-in (see lib/storage.ts). A file input
 * that cannot store a file is worse than no file input, so the avatar stays as
 * it is until that exists.
 */

const Profile = z.object({
  name: z.string().trim().min(2).max(80),
  // Kept loose on purpose: E.164 covers the world, and a stricter Saudi-only
  // pattern would reject the agency staff who sign up on a Gulf or UK number.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/)
    .optional()
    .or(z.literal('')),
  email: z.string().trim().email().max(160),
  // ISO 3166-1 alpha-2. Empty means "prefer not to say", which is a real
  // answer and not a validation failure.
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional()
    .or(z.literal('')),
})

/**
 * `(previous, formData)` — the shape `useActionState` passes, which is what
 * `SettingsForm` is built on. The previous state is unused: this form either
 * saves or explains why it did not, and has nothing to carry between attempts.
 *
 * The message comes back RESOLVED rather than as a key, because the component
 * that renders it is a client component and cannot reach the server's
 * translation store — the same rule as everywhere else in this codebase. The
 * locale is seeded from the request header first; a server action is its own
 * render pass and does not inherit the page's.
 */
export async function updateProfile(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const tr = await actionT()

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { ok: false, message: tr('auth.signIn') }

  const parsed = Profile.safeParse({
    name: formData.get('name') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    country: formData.get('country') ?? '',
  })
  if (!parsed.success) return { ok: false, message: tr('account.profileInvalid') }

  const current = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  })
  if (!current) return { ok: false, message: tr('state.error') }

  const email = parsed.data.email.toLowerCase()
  const phone = parsed.data.phone ? parsed.data.phone.replace(/[\s-]/g, '') : null

  // Uniqueness checked here so the reader gets a sentence rather than a 500.
  if (email !== current.email) {
    const taken = await db.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } })
    if (taken) return { ok: false, message: tr('account.profileEmailTaken') }
  }
  if (phone && phone !== current.phone) {
    const taken = await db.user.findFirst({ where: { phone, NOT: { id: userId } }, select: { id: true } })
    if (taken) return { ok: false, message: tr('account.profilePhoneTaken') }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      country: parsed.data.country ? parsed.data.country.toUpperCase() : null,
      email,
      phone,
      // A changed credential loses its verification. See the note above.
      ...(email !== current.email ? { emailVerified: null } : {}),
      ...(phone !== current.phone ? { phoneVerified: null } : {}),
    },
  })

  /*
   * Redirect on success rather than returning a message.
   *
   * `revalidatePath` refreshes the account tree, which remounts this form and
   * resets `useActionState` — so a success message returned here was wiped
   * before it could render, and a save that had genuinely worked looked like
   * nothing had happened.
   *
   * Sending the reader back to the hub is the better answer anyway: the
   * confirmation is their own updated name and nationality on the page, which
   * is stronger evidence than a sentence claiming it was saved. Failures still
   * return a message and keep the form and its values.
   */
  revalidatePath('/account')
  redirect('/account')
}

/* ── Verifying a channel ──────────────────────────────────────────────────
 *
 * Both of these exist because the profile form tells people that changing an
 * email or a mobile clears its verification. That sentence was true and the
 * way to undo it did not exist, which made it a dead end rather than a
 * warning.
 */

/**
 * Send a fresh verification link to the address currently on the account.
 *
 * `devLink` comes back only while no mail provider is configured — see
 * lib/mail.ts. The page surfaces it so the flow can be completed locally
 * rather than pretending an email was sent.
 */
export async function sendEmailVerification(): Promise<ActionResult & { devLink?: string }> {
  const tr = await actionT()

  const session = await auth()
  if (!session?.user?.id) return { ok: false, message: tr('auth.signIn') }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  })
  if (!user?.email) return { ok: false, message: tr('account.verifyNoEmail') }
  if (user.emailVerified) return { ok: true, message: tr('account.verifyAlready') }

  const headerList = await headers()
  // The link has to be absolute, and it has to point at the host the reader is
  // actually on — not a build-time constant that is wrong on every other one.
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const protocol = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')

  const { delivered, devLink } = await issueEmailVerification(
    session.user.id,
    user.email,
    `${protocol}://${host}`,
  )

  return delivered
    ? { ok: true, message: tr('account.verifyEmailSent') }
    : { ok: true, message: tr('account.verifyEmailNotConfigured'), devLink: devLink ?? undefined }
}

/** Send a one-time code to the mobile on the account. */
export async function sendPhoneCode(): Promise<ActionResult & { devCode?: string }> {
  const tr = await actionT()

  const session = await auth()
  if (!session?.user?.id) return { ok: false, message: tr('auth.signIn') }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, phoneVerified: true },
  })
  if (!user?.phone) return { ok: false, message: tr('account.verifyNoPhone') }
  if (user.phoneVerified) return { ok: true, message: tr('account.verifyAlready') }

  const { delivered, devCode } = await issueOtp(user.phone)
  return delivered
    ? { ok: true, message: tr('account.verifyCodeSent') }
    : { ok: true, message: tr('account.verifyCodeNotConfigured'), devCode: devCode ?? undefined }
}

/** Redeem the code and stamp the mobile as verified. */
export async function confirmPhoneCode(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const tr = await actionT()

  const session = await auth()
  if (!session?.user?.id) return { ok: false, message: tr('auth.signIn') }

  const code = String(formData.get('code') ?? '').trim()
  if (!/^\d{4,8}$/.test(code)) return { ok: false, message: tr('account.verifyCodeInvalid') }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  })
  if (!user?.phone) return { ok: false, message: tr('account.verifyNoPhone') }

  const ok = await consumeOtp(user.phone, code)
  if (!ok) return { ok: false, message: tr('account.verifyCodeWrong') }

  await db.user.update({
    where: { id: session.user.id },
    data: { phoneVerified: new Date() },
  })

  revalidatePath('/account')
  redirect('/account')
}
