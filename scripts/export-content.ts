/**
 * Export every word on the site for an external editorial pass.
 *
 * ── Why it is shaped like this ──────────────────────────────────────────────
 * Two earlier passes taught two lessons:
 *
 *   1. The writer returned page-level prose ("العنوان الرئيسي: …") instead of
 *      keys, so roughly 750 of 949 strings could not be mapped back. Every
 *      line here therefore carries its key, and the brief demands the same
 *      line shape in return — `- \`key\` :: text` — so an importer can apply
 *      it mechanically and validate it.
 *   2. The writer stopped halfway (502 of 913). One model response cannot hold
 *      the whole site, so the export is split into parts small enough to come
 *      back whole, on section boundaries so each part keeps its context.
 *
 * The English is attached to each line after `⟂` as a HINT — «حذف» alone does
 * not say what is being deleted — and the importer strips everything after
 * that mark, so a writer who leaves it in costs nothing.
 *
 * Output: docs/gemini/00-brief.md plus part-NN.md files.
 *
 *     npx tsx scripts/export-content.ts
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import * as legal from '../content/legal'
import type { DocumentSection } from '../components/layout/document-page'

type Tree = { [k: string]: string | Tree }
const ar = JSON.parse(readFileSync('messages/ar.json', 'utf8')) as Tree
const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Tree

function flatten(tree: Tree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [[prefix + k, v] as [string, string]] : flatten(v, `${prefix}${k}.`),
  )
}
const enMap = new Map(flatten(en))

/** Where each section appears, so the writer knows who is reading it. */
const AREAS: Record<string, string> = {
  brand: 'الهوية ووصف الموقع لمحركات البحث (SEO) — لا تتجاوز الأوصاف ١٦٠ حرفاً',
  nav: 'قوائم التنقل — كلمة أو كلمتان',
  search: 'شريط البحث',
  footer: 'تذييل الموقع',
  landing: 'الصفحة الرئيسية — المفاتيح المنتهية بـ Lead و Bold سطران لعنوان واحد',
  catalogue: 'الكتالوج: الألبومات، اللقطات، الفلاتر، صفحات الألبوم واللقطة وصانع المحتوى',
  commerce: 'مفردات الشراء المشتركة عبر الموقع',
  cart: 'سلة الشراء',
  checkout: 'إتمام الشراء',
  library: 'مكتبة المشتري: ما اشتراه وتحميلاته',
  boards: 'الألواح: قوائم لقطات يجمعها المشتري ويشاركها',
  review: 'تقييمات المشترين للألبومات',
  request: 'طلب لقطة غير موجودة في المكتبة',
  media: 'مشغّل الفيديو والمعاينات',
  account: 'حساب المشتري وبياناته وتوثيق البريد والجوال',
  auth: 'تسجيل الدخول وإنشاء الحساب ورسائل الخطأ',
  security: 'الأمان: كلمة المرور والتحقق بخطوتين',
  state: 'حالات عامة: تحميل، خطأ، فارغ، لا صلاحية',
  actions: 'أزرار وأفعال عامة — قصيرة جداً',
  role: 'أسماء الأدوار',
  palette: 'لوحة الأوامر السريعة',
  email: 'رسائل البريد الإلكتروني — نص عادي بلا تنسيق',
  sell: 'صفحة «بِع لقطاتك» — يقرؤها صانع المحتوى قبل أن يقرر',
  studio: 'استوديو صانع المحتوى — نبرة عملية مختصرة',
  dash: 'عناصر لوحات التحكم المشتركة بين الاستوديو والإدارة — نبرة تشغيلية مختصرة',
  admin: 'لوحة الإدارة — يقرؤها المشغّل وحده، نبرة تشغيلية بلا تسويق',
  legal: 'عبارات مشتركة في الصفحات القانونية',
}

// ── Lines ─────────────────────────────────────────────────────────────────
type Block = { title: string; note: string; lines: string[] }
const blocks: Block[] = []

const bySection = new Map<string, Array<[string, string]>>()
for (const [key, value] of flatten(ar)) {
  const section = key.split('.')[0]
  if (!bySection.has(section)) bySection.set(section, [])
  bySection.get(section)!.push([key, value])
}

const line = (key: string, value: string, hint?: string) => {
  const clean = value.replace(/\n/g, '\\n')
  const h = hint ? `   ⟂ EN: ${hint.replace(/\n/g, ' ')}` : ''
  return `- \`${key}\` :: ${clean}${h}`
}

/*
 * Site order, not JSON order: the public site first, then the buyer's account,
 * the creator's side, the operator's panel, shared fragments, and the long
 * documents last. A writer working in this order meets each voice together.
 */
const ORDER = [
  'brand', 'nav', 'search', 'footer', 'landing', 'catalogue', 'commerce', 'cart',
  'checkout', 'request', 'review', 'boards', 'media',
  'account', 'auth', 'security', 'library',
  'sell', 'studio',
  'dash', 'admin',
  'state', 'actions', 'role', 'palette', 'legal', 'email',
]
const rank = (s: string) => (ORDER.indexOf(s) === -1 ? ORDER.length : ORDER.indexOf(s))
const sections = [...bySection.keys()].sort((a, b) => rank(a) - rank(b))

for (const section of sections) {
  const pairs = bySection.get(section)!
  blocks.push({
    title: section,
    note: AREAS[section] ?? '',
    lines: pairs.map(([k, v]) => line(k, v, enMap.get(k))),
  })
}

// Long-form documents, one line per paragraph so each maps back exactly.
const DOCS: Array<[string, string, DocumentSection[]]> = [
  ['terms', 'الشروط والأحكام — نص قانوني: فصحى دقيقة، بلا عامية', legal.TERMS],
  ['privacy', 'سياسة الخصوصية — نص قانوني', legal.PRIVACY],
  ['licences', 'تفاصيل الترخيص — ترخيص واحد فقط', legal.LICENCES],
  ['contentPolicy', 'سياسة المحتوى', legal.CONTENT_POLICY],
  ['refunds', 'سياسة الاسترجاع', legal.REFUNDS],
  ['about', 'عن لقطة', legal.ABOUT],
  ['contact', 'تواصل معنا', legal.CONTACT],
]
for (const [id, note, sections] of DOCS) {
  const lines: string[] = []
  sections.forEach((sec, i) => {
    const n = i + 1
    lines.push(line(`doc.${id}.${n}.heading`, sec.heading, sec.headingEn))
    sec.body.forEach((para, j) =>
      lines.push(line(`doc.${id}.${n}.body.${j + 1}`, para, sec.bodyEn?.[j])),
    )
  })
  blocks.push({ title: `doc.${id}`, note, lines })
}

// ── Parts ─────────────────────────────────────────────────────────────────
// Budget by what the writer RETURNS: the key and the Arabic, not the English
// hint. The key is returned on every line, so a part of short labels is far
// bigger on the way back than its Arabic alone suggests — measuring Arabic only
// produced a 371-line part, the size at which an earlier return stopped
// halfway. A line cap backs up the character budget for label-heavy sections.
const BUDGET = 11000
const MAX_LINES = 140
const arabicLength = (l: string) => l.split('⟂')[0].length

type Part = Block[]
const parts: Part[] = []
let current: Part = []
let size = 0
for (const block of blocks) {
  // A block larger than the budget is split into its own consecutive parts.
  const chunks: Block[] = []
  let chunk: string[] = []
  let chunkSize = 0
  for (const l of block.lines) {
    if ((chunkSize + arabicLength(l) > BUDGET || chunk.length >= MAX_LINES) && chunk.length) {
      chunks.push({ ...block, lines: chunk })
      chunk = []
      chunkSize = 0
    }
    chunk.push(l)
    chunkSize += arabicLength(l)
  }
  if (chunk.length) chunks.push({ ...block, lines: chunk })

  for (const c of chunks) {
    const cSize = c.lines.reduce((n, l) => n + arabicLength(l), 0)
    const lines = current.reduce((n, b) => n + b.lines.length, 0)
    if ((size + cSize > BUDGET || lines + c.lines.length > MAX_LINES) && current.length) {
      parts.push(current)
      current = []
      size = 0
    }
    current.push(c)
    size += cSize
  }
}
if (current.length) parts.push(current)

// ── Write ─────────────────────────────────────────────────────────────────
const out = 'docs/gemini'
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const total = parts.length
const totalLines = blocks.reduce((n, b) => n + b.lines.length, 0)

parts.forEach((part, i) => {
  const n = String(i + 1).padStart(2, '0')
  const count = part.reduce((c, b) => c + b.lines.length, 0)
  const body = [
    `# لقطة — الجزء ${i + 1} من ${total}`,
    '',
    `هذا الجزء فيه **${count} سطراً**. أعد **كل** الأسطر، بنفس المفاتيح وبنفس الترتيب، حتى ما لم تغيّره.`,
    'كل سطر على الشكل: `- \\`المفتاح\\` :: النص` — احذف ما بعد العلامة ⟂ (الترجمة الإنجليزية للاسترشاد فقط).',
    'طبّق قواعد الموجز كاملة. لا تُضف أسطراً ولا تحذف أسطراً ولا تدمج سطرين.',
    '',
    ...part.flatMap((b) => [
      `## ${b.title}`,
      b.note ? `> ${b.note}` : '',
      '',
      ...b.lines,
      '',
    ]),
  ].join('\n')
  writeFileSync(path.join(out, `part-${n}.md`), body)
})

// The brief is authored by hand in docs/content-brief-gemini.md — it carries
// judgement, not data — and copied in as part zero so the folder is complete.
// `{{PARTS}}` is filled with the real count, in Arabic-Indic digits, so the
// brief never promises a number of parts the export did not produce.
const partsArabic = new Intl.NumberFormat('ar-SA-u-nu-arab').format(total)
const brief = readFileSync('docs/content-brief-gemini.md', 'utf8').replaceAll('{{PARTS}}', partsArabic)
writeFileSync(path.join(out, '00-brief.md'), brief)

writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), parts: total, lines: totalLines }, null, 2),
)
console.log(`${totalLines} lines in ${total} parts → ${out}/`)
