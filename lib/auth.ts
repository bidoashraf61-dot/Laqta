import NextAuth, { CredentialsSignin, type DefaultSession, type Session } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { authConfig } from '@/lib/auth.config'
import { db } from '@/lib/db'
import { consumeOtp } from '@/lib/otp'
import { verifyToken } from '@/lib/totp'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      locale: string
      creatorId: string | null
      /** Set only while an admin is impersonating a buyer for support. */
      impersonatedBy?: string
    } & DefaultSession['user']
  }

  interface User {
    role?: Role
    locale?: string
    creatorId?: string | null
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
 * `phone` — OTP. Not optional: phone-first sign-in is the norm in KSA and
 *           Egypt, and a meaningful share of buyers have no email habit.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
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

        // Second factor, mandatory for creator and admin once enrolled. The
        // password is verified first so an unenrolled attacker never learns
        // that a given account carries 2FA.
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
      if (user) {
        token.uid = user.id
        token.role = user.role ?? 'buyer'
        token.locale = user.locale ?? 'ar'
        token.creatorId = user.creatorId ?? null
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
        }
      }

      if (trigger === 'update' && session?.impersonatedBy !== undefined) {
        token.impersonatedBy = session.impersonatedBy
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = token.uid as string
      session.user.role = (token.role as Role) ?? 'buyer'
      session.user.locale = (token.locale as string) ?? 'ar'
      session.user.creatorId = (token.creatorId as string | null) ?? null
      if (token.impersonatedBy) {
        session.user.impersonatedBy = token.impersonatedBy as string
      }
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
  }
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

export async function requireRole(...roles: Role[]) {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new Error('FORBIDDEN')
  return user
}

export const requireAdmin = () => requireRole('admin')
export const requireCreator = () => requireRole('creator', 'admin')

export function canAccess(role: Role | undefined, pathname: string) {
  const path = stripLocale(pathname)
  if (path.startsWith('/admin')) return role === 'admin'
  if (path.startsWith('/studio')) return role === 'creator' || role === 'admin'
  if (path.startsWith('/account')) return Boolean(role)
  return true
}

function stripLocale(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'ar' || segments[0] === 'en') segments.shift()
  return `/${segments.join('/')}`
}
