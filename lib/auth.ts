import NextAuth, { CredentialsSignin, type DefaultSession, type Session } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import {
  applyImpersonationToSession,
  authConfig,
  twoFactorClaim,
  type SessionImpersonation,
} from '@/lib/auth.config'
import { expireIfDue } from '@/lib/impersonation-shared'
import { db } from '@/lib/db'
import { consumeOtp, phoneSignInEnabled } from '@/lib/otp'
import { verifyToken } from '@/lib/totp'
import { twoFactorOwed } from '@/lib/two-factor'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      locale: string
      creatorId: string | null
      /**
       * Enrolled in TOTP. Fresh from the database in every server render; in
       * middleware it is the cookie's copy, undefined on a pre-claim cookie.
       */
      twoFactorEnabled?: boolean
      /** Set only while an admin is viewing the site as this user — the admin's id. */
      impersonatedBy?: string
      /** The active view-as-user session, for the banner. */
      impersonation?: SessionImpersonation
    } & DefaultSession['user']
  }

  interface User {
    role?: Role
    locale?: string
    creatorId?: string | null
    twoFactorEnabled?: boolean
  }
}

const emailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  /** Second factor. Only consulted when the account has 2FA enrolled. */
  totp: z.string().optional(),
})

const phoneSchema = z.object({
  phone: z.string().min(6),
  code: z.string().length(6),
})

/**
 * Raised when the password checks out but the account still owes a TOTP code.
 * Auth.js surfaces `code` to the caller, which is how the sign-in form knows
 * to show the authenticator step rather than "wrong password".
 */
export class TwoFactorRequiredError extends CredentialsSignin {
  code = 'two_factor_required'
}

/**
 * Two credential providers.
 *
 * `email` — classic email + password.
 * `phone` — OTP. Phone-first sign-in is the norm in KSA and Egypt, but the
 *           rail stays shut until an SMS provider delivers the code — see
 *           `phoneSignInEnabled()` in `lib/otp.ts`.
 */
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'email',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totp: { label: 'Authenticator code', type: 'text' },
      },
      async authorize(raw) {
        const parsed = emailSchema.safeParse(raw)
        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { creator: { select: { id: true } } },
        })
        if (!user?.passwordHash || user.status === 'suspended') return null

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!ok) return null

        // Second factor, asked for whenever the account has enrolled. The
        // password is verified first so an unenrolled attacker never learns
        // that a given account carries 2FA. A creator or admin who has NOT
        // enrolled still signs in — and is held on /account/security until
        // they do (lib/two-factor.ts); refusing them here would leave no way
        // to reach the enrolment page at all.
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!parsed.data.totp) throw new TwoFactorRequiredError()
          if (!verifyToken(user.twoFactorSecret, parsed.data.totp)) return null
        }

        return toSessionUser(user)
      },
    }),

    Credentials({
      id: 'phone',
      name: 'Phone OTP',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(raw) {
        // Refused outright while no SMS provider exists, whatever code is sent.
        if (!phoneSignInEnabled()) return null

        const parsed = phoneSchema.safeParse(raw)
        if (!parsed.success) return null

        const phone = normalisePhone(parsed.data.phone)
        const verified = await consumeOtp(phone, parsed.data.code)
        if (!verified) return null

        // OTP sign-in doubles as sign-up: a verified number is an identity.
        const user = await db.user.upsert({
          where: { phone },
          update: { phoneVerified: new Date() },
          create: { phone, phoneVerified: new Date(), locale: 'ar' },
          include: { creator: { select: { id: true } } },
        })
        if (user.status === 'suspended') return null

        return toSessionUser(user)
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, trigger, session }) {
      // A view whose clock ran out is over, whatever else this call is for.
      if (token.imp && Date.now() >= (token.imp as { expiresAt: number }).expiresAt) {
        const { closeImpersonation } = await import('@/lib/impersonation')
        await closeImpersonation((token.imp as { id: string }).id, 'expired').catch(() => {})
        expireIfDue(token)
      }

      // View-as-user start / end. Only these two shapes are honoured, and the
      // start is re-verified against the database (lib/impersonation.ts), so a
      // browser calling `update()` itself cannot become anyone.
      if (trigger === 'update' && session && typeof session === 'object') {
        const request = (session as { impersonation?: { start?: string; end?: boolean } })
          .impersonation
        if (request) {
          const { applyImpersonationEnd, applyImpersonationStart } = await import(
            '@/lib/impersonation'
          )
          if (request.end) return applyImpersonationEnd(token)
          if (typeof request.start === 'string') {
            return applyImpersonationStart(token, request.start)
          }
          return token
        }
      }

      if (user) {
        token.uid = user.id
        token.role = user.role ?? 'buyer'
        token.locale = user.locale ?? 'ar'
        token.creatorId = user.creatorId ?? null
        token.tfa = user.twoFactorEnabled === true
        // When this session began — compared with `passwordChangedAt` below.
        token.signedInAt = Date.now()
      } else if (token.uid) {
        /*
         * A password reset signs out every existing session. Sessions are
         * JWTs, so there is no row to delete: instead a token minted before
         * the account's `passwordChangedAt` is refused here, and Auth.js
         * treats `null` as signed out. One indexed read per `auth()` call.
         *
         * Middleware runs the edge half of the config and cannot make this
         * read, so a stale cookie still passes the gate — and then meets the
         * route-group layout's `auth()`, which is the lock.
         */
        const account = await db.user.findUnique({
          where: { id: token.uid as string },
          select: {
            passwordChangedAt: true,
            status: true,
            role: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            creator: { select: { id: true } },
          },
        })
        if (!account) return null
        const issued = typeof token.signedInAt === 'number' ? token.signedInAt : ((token.iat as number) ?? 0) * 1000
        if (account.passwordChangedAt && account.passwordChangedAt.getTime() > issued) return null

        // Same read, so free: role and creator profile follow the database in
        // every server render. An admin who makes THEMSELVES a creator on
        // /admin/users/[id] gets `creatorId` at once (the role already passes
        // middleware); without this /studio bounced to /sell until a re-login.
        // A demotion reaches layouts and actions just as fast. Middleware still
        // reads the cookie's role, so a buyer promoted mid-session must sign in
        // again to pass the /studio gate.
        token.role = account.role
        token.creatorId = account.creator?.id ?? null
        // Same read again: the 2FA lock in the layouts and in requireRole()
        // judges the database, never a cookie that predates an enrolment.
        token.tfa = enrolled(account)
      }

      // Role or creator status can change mid-session (a creator gets
      // approved); refresh from the database on an explicit update.
      if (trigger === 'update' && token.uid) {
        const fresh = await db.user.findUnique({
          where: { id: token.uid as string },
          include: { creator: { select: { id: true } } },
        })
        if (fresh) {
          token.role = fresh.role
          token.locale = fresh.locale
          token.creatorId = fresh.creator?.id ?? null
          token.tfa = enrolled(fresh)
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = token.uid as string
      session.user.role = (token.role as Role) ?? 'buyer'
      session.user.locale = (token.locale as string) ?? 'ar'
      session.user.creatorId = (token.creatorId as string | null) ?? null
      session.user.twoFactorEnabled = twoFactorClaim(token)
      applyImpersonationToSession(session.user, token)
      return session
    },
  },
})

function toSessionUser(user: {
  id: string
  email: string | null
  name: string | null
  image: string | null
  role: Role
  locale: string
  twoFactorEnabled: boolean
  twoFactorSecret: string | null
  creator: { id: string } | null
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    locale: user.locale,
    creatorId: user.creator?.id ?? null,
    twoFactorEnabled: enrolled(user),
  }
}

/**
 * Enrolled means sign-in actually asks for a code: the flag AND a secret. A
 * flag without a secret (a hand-edited row) is skipped by `authorize`, so it
 * must not count as enrolled either.
 */
function enrolled(user: { twoFactorEnabled: boolean; twoFactorSecret?: string | null }) {
  return user.twoFactorEnabled && Boolean(user.twoFactorSecret)
}

/** E.164-ish. KSA and Egypt both drop a leading 0 behind the country code. */
export function normalisePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith('05')) return `+966${digits.slice(1)}` // KSA mobile
  if (digits.startsWith('01')) return `+20${digits.slice(1)}` // Egypt mobile
  return `+${digits}`
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12)
}

// ── Server-side guards ──────────────────────────────────────────────────────

/**
 * Derived from `Session` rather than `ReturnType<typeof auth>`: `auth` is
 * overloaded (it doubles as the middleware wrapper), so inferring from it
 * resolves to `NextMiddleware` instead of a session.
 */
export type SessionUser = Session['user']

export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

/** Throws if unauthenticated — pair with the route-group layout's redirect. */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

/**
 * Also the 2FA lock for every admin and studio server action: a creator or
 * admin who has not enrolled is held on /account/security by middleware and
 * the layouts, and a POST forged past the page stops here.
 */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new Error('FORBIDDEN')
  if (twoFactorOwed(user)) throw new Error('TWO_FACTOR_REQUIRED')
  return user
}

export const requireAdmin = () => requireRole('admin')
export const requireCreator = () => requireRole('creator', 'admin')

/**
 * Mirrors the middleware matcher, for use inside a page or action that wants
 * to test access without throwing. Paths carry no locale prefix — the site is
 * Arabic-only and `/ar/*` is redirected away before anything sees it.
 */
export function canAccess(role: Role | undefined, pathname: string) {
  if (pathname.startsWith('/admin')) return role === 'admin'
  if (pathname.startsWith('/studio')) return role === 'creator' || role === 'admin'
  if (pathname.startsWith('/account')) return Boolean(role)
  return true
}
