/**
 * Sample payload for every template — used by `verify:mail` and by the
 * admin email preview (`/admin/content/copy/email/preview`, DEV-64b).
 *
 * Every value a template could ask for, so nothing renders as an empty gap.
 *
 * Latin values on purpose. verify:mail's English check is that the
 * TEMPLATE's own words are English — but an album's Arabic title legitimately
 * appears inside an English message, so real data would make the check
 * meaningless. Payload values are deliberately not the thing under test.
 *
 * `message` carries markup: the contact form is untrusted input, and it must
 * arrive in the operator's inbox as text, never as HTML.
 */
export const SAMPLE_PAYLOAD = {
  name: 'Athar Agency',
  email: 'visitor@example.test',
  subject: 'Licensing question',
  message: 'Hello <script>alert(1)</script> & welcome',
  senderLocale: 'en',
  orderNumber: 'LQ-2026-1006',
  albumTitles: ['AlUla Aerials', 'Riyadh Nights'],
  subtotal: 399,
  vatAmount: 59.85,
  total: 458.85,
  currency: 'USD',
  reference: 'BT-LQ-2026-1006',
  bankName: 'Saudi National Bank',
  bankAccountName: 'Laqta LLC',
  bankIban: 'SA0380000000608010167519',
  bankSwift: 'NCBKSAJE',
  album: 'AlUla Aerials',
  creator: 'Yousef Shami',
  price: '399 US$',
  notes: 'Please regrade shot 4.',
  taskId: 'task_1',
  libraryUrl: 'https://laqta.sa/account/library',
  orderUrl: 'https://laqta.sa/account/purchases',
  albumUrl: 'https://laqta.sa/albums/x/y',
  reviewUrl: 'https://laqta.sa/admin/review',
  resetUrl: 'https://laqta.sa/reset-password?token=fixture',
  minutes: 30,
  expiresAt: '2099-01-01T00:00:00.000Z',
  certificateAttached: true,
}
