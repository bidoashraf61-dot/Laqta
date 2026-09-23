/**
 * The published contact channels — ONE place to fill them in.
 *
 * ── Nothing here is invented ────────────────────────────────────────────────
 * Every value is left empty until the owner supplies the real one. /contact
 * renders a channel ONLY when its value is set, so the page is complete with
 * none, some or all of them: the form is always there, and each direct line
 * appears the day it is filled in. A placeholder number on a live site is a
 * number someone will dial.
 *
 * Each field reads an environment variable first and falls back to the
 * constant beside it, so a value can live in the deployment's env (preferred)
 * or be committed here. Either works; set one, not both.
 *
 * ── The fields ──────────────────────────────────────────────────────────────
 *   NEXT_PUBLIC_CONTACT_WHATSAPP     international format, digits only, no +
 *                                    or spaces — e.g. 20XXXXXXXXXX. Used for
 *                                    the wa.me link and shown formatted.
 *   NEXT_PUBLIC_CONTACT_EMAIL        the published support address.
 *   CONTACT_COMPANY_NAME_AR / _EN    the registered company name.
 *   CONTACT_ADDRESS_AR / _EN         the registered address in Egypt, one
 *                                    line or several separated by "\n".
 *   CONTACT_CR_NUMBER                commercial registration number
 *                                    (السجل التجاري).
 *
 * The English side of the name and address is optional: it falls back to the
 * Arabic, per the localisation contract (fallback is always towards Arabic).
 */

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()

/*
 * Constants, for a value that should be committed rather than configured.
 * Leave '' until the owner supplies the real value.
 */
const WHATSAPP = ''
const EMAIL = ''
const COMPANY_NAME_AR = ''
const COMPANY_NAME_EN = ''
const ADDRESS_AR = ''
const ADDRESS_EN = ''
const CR_NUMBER = ''

export type ContactChannels = {
  /** Digits only, international, no leading + (wa.me's format). */
  whatsapp: string
  email: string
  company: {
    nameAr: string
    nameEn: string
    addressAr: string
    addressEn: string
    crNumber: string
  }
}

/**
 * Read at request time on the server, so a value set in the deployment's env
 * reaches the page without a rebuild. `NEXT_PUBLIC_` on the two public lines
 * only so a client component could read them later; nothing here is secret.
 */
export function contactChannels(): ContactChannels {
  return {
    whatsapp: env('NEXT_PUBLIC_CONTACT_WHATSAPP', WHATSAPP).replace(/\D/g, ''),
    email: env('NEXT_PUBLIC_CONTACT_EMAIL', EMAIL),
    company: {
      nameAr: env('CONTACT_COMPANY_NAME_AR', COMPANY_NAME_AR),
      nameEn: env('CONTACT_COMPANY_NAME_EN', COMPANY_NAME_EN),
      addressAr: env('CONTACT_ADDRESS_AR', ADDRESS_AR).replace(/\\n/g, '\n'),
      addressEn: env('CONTACT_ADDRESS_EN', ADDRESS_EN).replace(/\\n/g, '\n'),
      crNumber: env('CONTACT_CR_NUMBER', CR_NUMBER),
    },
  }
}

/**
 * Display form: a leading + and the digits as given. No grouping — the split
 * between country code and number is not knowable without a table, and a
 * wrongly grouped number reads as a different number.
 */
export const displayWhatsapp = (digits: string) => `+${digits}`

/**
 * The topics the form offers. Keys are stored on `ContactMessage.topic`; the
 * labels live in messages/*.json under `contact.topic.*`.
 */
export const CONTACT_TOPICS = ['buying', 'selling', 'custom', 'rights', 'other'] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]
