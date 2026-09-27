/**
 * The real data every Laqta database needs — shared by the development seed
 * (`prisma/seed.ts`) and the production seed (`prisma/seed-production.ts`,
 * DEV-47). Nothing here is demo: the Saudi taxonomy with its search synonyms,
 * the one current licence, and the suggested-price bands.
 *
 * Every write is an upsert keyed on a stable slug, so it can run against a
 * live database any number of times without duplicating or deleting.
 *
 * Imports are relative, not `@/`: this runs under tsx outside the Next
 * bundler, where the tsconfig path alias is not guaranteed.
 */
import { PrismaClient } from '@prisma/client'

type Db = PrismaClient

/** Location hubs that have a matching hero still. The rest fall back to type. */
const LOCATION_HERO: Record<string, string> = {
  riyadh: '/hero/03-riyadh-NIGHT.jpg',
  makkah: '/hero/04-makkah-NIGHT.jpg',
  alula: '/hero/06-alula.jpg',
  'rub-al-khali': '/hero/08-empty-quarter.jpg',
  'edge-of-the-world': '/hero/09-edge-of-the-world.jpg',
  'red-sea': '/hero/10-red-sea.jpg',
  jeddah: '/hero/11-jeddah.jpg',
  diriyah: '/hero/12-diriyah.jpg',
}

// ─────────────────────────────────────────────────────────────────────────────
// Taxonomy
//
// Synonyms carry the two things Arabic search gets wrong by default: spelling
// variants on the Arabic side (العلا / العلى, جدة / جده) and transliterations
// on the English side (AlUla / Al-Ula / Al Ula). Both feed the Meilisearch
// synonym map — see lib/i18n.ts `normaliseArabic` for the matching folding.
// ─────────────────────────────────────────────────────────────────────────────

const LOCATIONS: Array<[string, string, string, string[], string[]]> = [
  ['riyadh', 'الرياض', 'Riyadh', ['الریاض'], ['Riyad', 'Ar Riyadh']],
  ['jeddah', 'جدة', 'Jeddah', ['جده'], ['Jiddah', 'Jedda']],
  ['makkah', 'مكة المكرمة', 'Makkah', ['مكه'], ['Mecca', 'Makkah al-Mukarramah']],
  ['madinah', 'المدينة المنورة', 'Madinah', ['المدينه'], ['Medina', 'Al Madinah']],
  ['dammam', 'الدمام والخبر والظهران', 'Dammam, Khobar & Dhahran', [], ['Khobar', 'Dhahran']],
  ['alula', 'العلا', 'AlUla', ['العلى'], ['Al-Ula', 'Al Ula', 'Hegra', 'Madain Saleh']],
  ['abha-asir', 'أبها وعسير', 'Abha & Asir', [], ['Aseer', 'Abha']],
  ['taif', 'الطائف', 'Taif', [], ['At Taif']],
  ['tabuk', 'تبوك', 'Tabuk', [], []],
  ['neom', 'نيوم', 'NEOM', [], ['Neom', 'The Line']],
  ['red-sea', 'البحر الأحمر', 'The Red Sea', [], ['Red Sea Global', 'Amaala']],
  ['diriyah', 'الدرعية', 'Diriyah', [], ['Ad Diriyah', 'At-Turaif']],
  ['al-ahsa', 'الأحساء', 'Al-Ahsa', ['الاحساء'], ['Hofuf', 'Al Hasa']],
  ['jazan', 'جازان', 'Jazan', [], ['Jizan']],
  ['hail', 'حائل', 'Hail', [], ["Ha'il"]],
  ['najran', 'نجران', 'Najran', [], []],
  ['farasan', 'جزر فرسان', 'Farasan Islands', [], ['Farasan']],
  ['rub-al-khali', 'الربع الخالي', "Rub' al Khali", [], ['Empty Quarter']],
  ['edge-of-the-world', 'حافة العالم', 'Edge of the World', [], ['Jebel Fihrayn']],
]

const CATEGORIES: Array<[string, string, string, string[]]> = [
  ['aerials', 'تصوير جوي / درون', 'Aerials & Drone', ['Drone', 'Aerial', 'FPV']],
  ['cityscapes', 'مدن وأفق', 'Cityscapes & Skylines', ['Skyline', 'Urban']],
  ['heritage', 'تراث وعمارة', 'Heritage & Architecture', ['Heritage', 'Architecture']],
  ['desert-nature', 'صحراء وطبيعة', 'Desert & Nature', ['Desert', 'Dunes', 'Nature']],
  ['coast-marine', 'سواحل وبحار', 'Coast & Marine', ['Diving', 'Coral', 'Sea']],
  ['people-lifestyle', 'أشخاص ونمط حياة', 'People & Lifestyle', ['Lifestyle', 'People']],
  ['business', 'أعمال وشركات', 'Business & Corporate', ['Corporate', 'Office']],
  ['industry-energy', 'صناعة وطاقة', 'Industry & Energy', ['Oil', 'Energy', 'Solar']],
  ['megaprojects', 'إنشاءات ومشاريع كبرى', 'Construction & Megaprojects', ['Giga-project']],
  ['food-coffee', 'طعام وقهوة', 'Food & Coffee', ['Coffee', 'Qahwa', 'Food']],
  ['sports', 'رياضة وسباقات', 'Sports & Motorsport', ['Formula 1', 'Dakar', 'Football']],
  ['events', 'فعاليات ومهرجانات', 'Events & Festivals', ['Festival', 'Concert']],
  ['traditional', 'ثقافة تقليدية', 'Traditional Culture', ['Ardah', 'Falconry', 'Camels', 'Souq']],
  ['religious', 'ديني وروحاني', 'Religious & Spiritual', ['Hajj', 'Umrah', 'Mosque']],
  ['education-health', 'تعليم وصحة', 'Education & Healthcare', ['School', 'Hospital']],
  ['technology', 'تقنية', 'Technology', ['Tech', 'AI', 'Data centre']],
  ['transport', 'نقل وبنية تحتية', 'Transport & Infrastructure', ['Metro', 'Rail', 'Airport']],
]

const THEMES: Array<[string, string, string]> = [
  ['ramadan', 'رمضان', 'Ramadan'],
  ['eid', 'العيد', 'Eid'],
  ['national-day', 'اليوم الوطني', 'National Day'],
  ['founding-day', 'يوم التأسيس', 'Founding Day'],
  ['riyadh-season', 'موسم الرياض', 'Riyadh Season'],
  ['hajj-umrah', 'الحج والعمرة', 'Hajj & Umrah'],
  ['winter-tantora', 'شتاء طنطورة', 'Winter at Tantora'],
  ['formula-1', 'فورمولا 1', 'Formula 1'],
  ['soudah', 'موسم السودة', 'Soudah Season'],
  ['giga-projects', 'المشاريع الكبرى', 'Giga-projects'],
  ['quality-of-life', 'جودة الحياة', 'Quality of Life'],
  ['tourism', 'السياحة', 'Tourism'],
  ['green-initiative', 'المبادرة الخضراء', 'Green Initiative'],
  ['women-workforce', 'المرأة في سوق العمل', 'Women in the Workforce'],
  ['youth', 'الشباب', 'Youth'],
]

const TAGS: Array<[string, string, string]> = [
  ['golden-hour', 'الساعة الذهبية', 'Golden hour'],
  ['blue-hour', 'الساعة الزرقاء', 'Blue hour'],
  ['sunrise', 'شروق', 'Sunrise'],
  ['sunset', 'غروب', 'Sunset'],
  ['night', 'ليل', 'Night'],
  ['slow-motion', 'حركة بطيئة', 'Slow motion'],
  ['timelapse', 'فاصل زمني', 'Timelapse'],
  ['hyperlapse', 'هايبرلابس', 'Hyperlapse'],
  ['orbit', 'دوران حول الهدف', 'Orbit'],
  ['reveal', 'كشف', 'Reveal'],
  ['top-down', 'من الأعلى', 'Top-down'],
  ['handheld', 'كاميرا محمولة', 'Handheld'],
  ['gimbal', 'جيمبل', 'Gimbal'],
  ['wide', 'لقطة واسعة', 'Wide'],
  ['close-up', 'لقطة قريبة', 'Close-up'],
  ['log', 'ملف لوغ', 'LOG'],
  ['rec709', 'ريك 709', 'Rec.709'],
  ['no-people', 'بدون أشخاص', 'No people'],
]

export async function seedTaxonomy(db: Db) {
  for (const [index, [slug, nameAr, nameEn, synonymsAr, synonymsEn]] of LOCATIONS.entries()) {
    const heroImage = LOCATION_HERO[slug] ?? null
    await db.taxonomy.upsert({
      where: { kind_slug: { kind: 'location', slug } },
      update: { nameAr, nameEn, synonymsAr, synonymsEn, heroImage },
      create: {
        kind: 'location',
        slug,
        nameAr,
        nameEn,
        synonymsAr,
        synonymsEn,
        heroImage,
        sortOrder: index,
      },
    })
  }
  for (const [index, [slug, nameAr, nameEn, synonymsEn]] of CATEGORIES.entries()) {
    await db.taxonomy.upsert({
      where: { kind_slug: { kind: 'category', slug } },
      update: { nameAr, nameEn, synonymsEn },
      create: { kind: 'category', slug, nameAr, nameEn, synonymsEn, sortOrder: index },
    })
  }
  for (const [index, [slug, nameAr, nameEn]] of THEMES.entries()) {
    await db.taxonomy.upsert({
      where: { kind_slug: { kind: 'theme', slug } },
      update: { nameAr, nameEn },
      create: { kind: 'theme', slug, nameAr, nameEn, sortOrder: index },
    })
  }
  for (const [index, [slug, nameAr, nameEn]] of TAGS.entries()) {
    await db.taxonomy.upsert({
      where: { kind_slug: { kind: 'tag', slug } },
      update: { nameAr, nameEn },
      create: { kind: 'tag', slug, nameAr, nameEn, sortOrder: index },
    })
  }
  console.log(
    `  taxonomy — ${LOCATIONS.length} locations, ${CATEGORIES.length} categories, ${THEMES.length} themes, ${TAGS.length} tags`,
  )
}

/**
 * The blog's categories (DEV-43) — structure, not content, so the production
 * seed carries them too. A category shows on /blog only once it holds a post.
 */
export const BLOG_CATEGORIES: Array<[string, string, string]> = [
  ['editing', 'دليل المونتاج', 'Editing guide'],
  ['campaigns', 'مواسم وحملات', 'Seasons and campaigns'],
  ['licensing', 'الترخيص', 'Licensing'],
]

export async function seedBlogCategories(db: Db) {
  for (const [index, [slug, nameAr, nameEn]] of BLOG_CATEGORIES.entries()) {
    await db.blogCategory.upsert({ where: { slug }, update: { nameAr, nameEn }, create: { slug, nameAr, nameEn, sortOrder: index } })
  }
  console.log(`  blog — ${BLOG_CATEGORIES.length} categories`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Licences and pricing
// ─────────────────────────────────────────────────────────────────────────────

export async function seedLicences(db: Db) {
  /*
   * One licence. Full commercial, and genuinely uncapped.
   *
   * There were two — Standard at 500,000 views per outlet, Extended at 3× the
   * price for unlimited — and the tier was the single most common thing a
   * buyer got wrong. Guess low and they are out of licence, which is a legal
   * problem; guess high and they overpay, which is a refund. Collapsing them
   * removes the question rather than explaining it better.
   *
   * The exclusion that remains is the one every stock library keeps: you may
   * use the footage in anything you make, but you may not resell the footage
   * itself. Without it, one purchase makes a competitor.
   */
  const commercial = await db.licenceVersion.upsert({
    where: { version: 'commercial-v1' },
    update: {},
    create: {
      version: 'commercial-v1',
      isCurrent: true,
      titleAr: 'الترخيص التجاري الكامل',
      titleEn: 'Full Commercial Licence',
      bodyAr:
        'ترخيص تجاري كامل: غير حصري، عالمي، دائم، بلا حد لعدد المشاهدات. يشمل الحملات المدفوعة والعرض خارج المنزل والمنتجات المعدّة لإعادة البيع. لا يشمل إعادة بيع اللقطة نفسها أو توزيعها كمادة أرشيفية.',
      bodyEn:
        'Full commercial licence: non-exclusive, worldwide, perpetual, with no view cap. Covers paid campaigns, out-of-home, and products made for resale. Excludes reselling the footage itself or redistributing it as stock.',
    },
  })

  return { commercial }
}

/**
 * Price bands — the SUGGESTED price for an album of that size, pre-filled on
 * the review page; the operator sets the real price at approval (DEV-09).
 * Cut to the 30–70 clip album, inside the $49–$249 range (decision D4).
 * Upserted in full so an older database is re-cut too.
 */
export async function seedPriceBands(db: Db) {
  const bands = [
    ['mini', 'ألبوم ٣٠–٣٩ لقطة', 'Album of 30–39 clips', 30, 39, 79],
    ['standard', 'ألبوم ٤٠–٤٩ لقطة', 'Album of 40–49 clips', 40, 49, 119],
    ['pro', 'ألبوم ٥٠–٥٩ لقطة', 'Album of 50–59 clips', 50, 59, 159],
    ['signature', 'ألبوم ٦٠–٧٠ لقطة', 'Album of 60–70 clips', 60, 70, 199],
  ] as const

  for (const [tier, labelAr, labelEn, minClips, maxClips, priceStandard] of bands) {
    await db.priceBand.upsert({
      where: { tier },
      update: { labelAr, labelEn, minClips, maxClips, priceStandard },
      create: { tier, labelAr, labelEn, minClips, maxClips, priceStandard },
    })
  }
  console.log('  price bands — mini, standard, pro, signature')
}


// ─────────────────────────────────────────────────────────────────────────────
// Safety
// ─────────────────────────────────────────────────────────────────────────────

/** The demo seed's accounts — their presence means a database holds demo data. */
export const DEMO_EMAILS = ['admin@laqta.sa', 'creator@laqta.sa', 'nada@laqta.sa', 'buyer@agency.sa']

/**
 * May the DEMO seed write to this database? Only a local one (the embedded
 * dev Postgres, a laptop), unless `SEED_DEMO=1` says so explicitly — the demo
 * seed creates accounts with a shared, published password, fake sales and
 * fake view counts, and must never reach a real database by accident (DEV-47).
 */
export function demoSeedAllowed(databaseUrl: string | undefined, env: Record<string, string | undefined>) {
  if (env.SEED_DEMO === '1') return true
  if (!databaseUrl) return false
  try {
    const host = new URL(databaseUrl).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}
