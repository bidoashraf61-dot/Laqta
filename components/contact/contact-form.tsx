'use client'

import * as React from 'react'
import { sendContactMessage, type ContactField, type ContactResult } from '@/app/(public)/actions'
import { CONTACT_TOPICS } from '@/content/contact'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/state'
import { Headline } from '@/components/ui/typography'
import { useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'

/**
 * The /contact form.
 *
 * ── Why onSubmit and not `<form action>` ────────────────────────────────────
 * React resets an uncontrolled form after its action resolves. That is right
 * after a success and exactly wrong after a validation error or a server
 * failure: the visitor would lose a message they may have spent ten minutes
 * writing. Submitting by hand keeps every field as typed until the server says
 * it is stored.
 *
 * ── Why `noValidate` ────────────────────────────────────────────────────────
 * The browser's own bubbles speak the browser's language, not the page's, and
 * disappear on the next keystroke. Errors come back from the server action
 * (zod) as message keys, render under their field, are wired with
 * `aria-describedby`, and focus moves to the first one.
 */

type Values = { name: string; email: string; topic: string; message: string }
const EMPTY: Values = { name: '', email: '', topic: '', message: '' }

const MESSAGE_MAX = 5000

export function ContactForm({ initialTopic = '' }: { initialTopic?: string }) {
  const t = useT()
  // `/sell`'s «قدّم كصانع محتوى» arrives as `?topic=selling` (DEV-05).
  const [values, setValues] = React.useState<Values>({ ...EMPTY, topic: initialTopic })
  const [result, setResult] = React.useState<ContactResult | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  // Submit waits for hydration: before it, a click would post the page back
  // to itself and the message would be lost without a word.
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])

  const formRef = React.useRef<HTMLFormElement>(null)
  const doneRef = React.useRef<HTMLHeadingElement>(null)
  const alertRef = React.useRef<HTMLDivElement>(null)

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {}
  const formError = result && !result.ok && !result.fieldErrors ? result.messageKey : null

  function set(field: keyof Values) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value
      setValues((v) => ({ ...v, [field]: value }))
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      let next: ContactResult
      try {
        next = await sendContactMessage(data)
      } catch {
        // The action itself never throws; a network drop between here and it
        // does. Same answer as a storage failure — try again, nothing lost.
        next = { ok: false, messageKey: 'contact.errServer' }
      }
      setResult(next)
      if (next.ok) {
        setSentTo(values.email.trim())
        setValues(EMPTY)
      }
    })
  }

  // Move focus to whatever the visitor now needs to read.
  React.useEffect(() => {
    if (!result) return
    if (result.ok) {
      doneRef.current?.focus()
      return
    }
    if (result.fieldErrors) {
      const first = (['name', 'email', 'topic', 'message'] as ContactField[]).find(
        (f) => result.fieldErrors?.[f],
      )
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
    } else {
      alertRef.current?.focus()
    }
  }, [result])

  if (result?.ok) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-soft sm:p-10">
        <h2
          ref={doneRef}
          tabIndex={-1}
          className="font-display text-2xl font-bold leading-[1.34] outline-none"
        >
          {t('contact.sentTitle')}
        </h2>
        <p className="mt-4 max-w-prose font-serif text-[1.2rem] leading-[1.85] text-foreground/75">
          {t('contact.sentBody')}
        </p>
        {sentTo ? (
          <p className="mt-2 font-sans text-lg">
            <span className="ltr-island" dir="ltr">
              {sentTo}
            </span>
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-8"
          onClick={() => {
            setResult(null)
            setSentTo(null)
          }}
        >
          {t('contact.sendAnother')}
        </Button>
      </div>
    )
  }

  const describedBy = (field: ContactField, hint?: boolean) =>
    [fieldErrors[field] ? `contact-${field}-error` : null, hint ? `contact-${field}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined

  const error = (field: ContactField) =>
    fieldErrors[field] ? (
      <p id={`contact-${field}-error`} className="text-sm text-destructive">
        {t(fieldErrors[field])}
      </p>
    ) : null

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      // Only matters before hydration (or with JS failing): a form with no
      // method submits as GET and would put the visitor's name, email and
      // message in the URL — into history, logs and referrers. POST keeps a
      // premature submit harmless; after hydration onSubmit takes over.
      method="post"
      noValidate
      aria-labelledby="contact-form-title"
      aria-busy={pending || undefined}
      className="relative rounded-lg border bg-card p-6 shadow-soft sm:p-10"
    >
      <Headline as="h2" size="lg">
        <span id="contact-form-title">{t('contact.formTitle')}</span>
      </Headline>

      {formError ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 rounded-md border border-destructive/40 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive outline-none"
        >
          {t(formError)}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <label htmlFor="contact-name" className="text-sm font-medium">
            {t('contact.name')}
          </label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            maxLength={120}
            value={values.name}
            onChange={set('name')}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy('name')}
            className="h-11"
          />
          {error('name')}
        </div>

        <div className="grid content-start gap-2">
          <label htmlFor="contact-email" className="text-sm font-medium">
            {t('contact.email')}
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={values.email}
            onChange={set('email')}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={describedBy('email', !fieldErrors.email)}
            className="h-11"
          />
          {error('email') ?? (
            <p id="contact-email-hint" className="text-sm text-muted-foreground">
              {t('contact.emailHint')}
            </p>
          )}
        </div>

        <div className="grid content-start gap-2 sm:col-span-2">
          <label htmlFor="contact-topic" className="text-sm font-medium">
            {t('contact.topicLabel')}{' '}
            <span className="font-normal text-muted-foreground">({t('contact.optional')})</span>
          </label>
          <NativeSelect
            id="contact-topic"
            name="topic"
            value={values.topic}
            onChange={set('topic')}
            aria-invalid={fieldErrors.topic ? true : undefined}
            aria-describedby={describedBy('topic')}
            className="h-11"
          >
            <option value="">{t('contact.topicNone')}</option>
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {t(`contact.topic.${topic}`)}
              </option>
            ))}
          </NativeSelect>
          {error('topic')}
        </div>

        <div className="grid content-start gap-2 sm:col-span-2">
          <label htmlFor="contact-message" className="text-sm font-medium">
            {t('contact.message')}
          </label>
          <Textarea
            id="contact-message"
            name="message"
            rows={7}
            maxLength={MESSAGE_MAX}
            value={values.message}
            onChange={set('message')}
            aria-invalid={fieldErrors.message ? true : undefined}
            aria-describedby={describedBy('message', true)}
            className={cn(
              'min-h-40 resize-y text-base leading-relaxed',
              fieldErrors.message && 'border-destructive',
            )}
          />
          {error('message')}
          <p id="contact-message-hint" className="text-sm text-muted-foreground">
            {t('contact.messageHint')}
          </p>
        </div>
      </div>

      {/*
        Honeypot. Off-screen rather than display:none (some bots skip hidden
        inputs), out of the tab order, and hidden from assistive tech so no
        person ever reaches it.
      */}
      <div aria-hidden="true" lang="en" className="absolute -start-[10000px] top-auto size-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" variant="gold" size="lg" disabled={pending || !ready}>
          {pending ? <Spinner className="size-4 text-current" /> : null}
          {pending ? t('contact.sending') : t('contact.submit')}
        </Button>
        {result && !result.ok && result.fieldErrors ? (
          <p role="alert" className="text-sm text-destructive">
            {t(result.messageKey)}
          </p>
        ) : null}
      </div>
    </form>
  )
}
