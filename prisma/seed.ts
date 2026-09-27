/**
 * Laqta DEMO seed — development only.
 *
 *   npm run db:seed
 *
 * Refuses to run against anything but a local database (or with SEED_DEMO=1):
 * it makes accounts with a shared published password and fake sales. A real
 * database gets `npm run db:seed:production` (prisma/seed-production.ts).
 * The real data both share — taxonomy, licence, price bands — lives in
 * prisma/seed-base.ts.
 *
 * Idempotent — every write is an upsert or is guarded by a count, so it can be
 * re-run against a live development database without duplicating anything.
 *
 * What it puts in:
 *   · Bilingual Saudi taxonomy (locations, categories, themes, tags) with the
 *     transliteration synonyms the search index is built from
 *   · Licence versions and price bands
 *   · Three accounts — admin, creator, buyer — plus a second creator so the
 *     creator directory is not a single card
 *   · One live album with 22 clips, one draft, one in review
 *   · Five sales at different ages, so the 30-day payout hold is visible in the
 *     ledger, with commission frozen per lib/commission.ts
 *
 * Imports are relative, not `@/`: this runs under tsx outside the Next
 * bundler, where the tsconfig path alias is not guaranteed.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { resolveCommission } from '../lib/commission'
import { emptyChecklist } from '../lib/review-checklist'
import { addBusinessDays } from '../lib/utils'
import { demoSeedAllowed, seedLicences, seedPriceBands, seedTaxonomy } from './seed-base'

const db = new PrismaClient()

const DAY = 24 * 60 * 60 * 1000
const HOLD_DAYS = Number(process.env.PAYOUT_HOLD_DAYS ?? 30)
const VAT_RATE = Number(process.env.VAT_RATE ?? 0.15)

function daysAgo(n: number) {
  return new Date(Date.now() - n * DAY)
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Demo posters.
 *
 * Development data points at the real hero stills in public/hero rather than
 * invented `thumbs/demo/*.jpg` keys, so the catalogue renders as a product
 * instead of a grid of grey boxes. In production these are object-storage keys
 * resolved through the media pipeline; here they are plain public paths, which
 * is why they start with a slash.
 */
const POSTERS = {
  alula: ['/hero/06-alula.jpg', '/hero/07-qasr-al-farid.jpg'],
  desert: ['/hero/08-empty-quarter.jpg', '/hero/09-edge-of-the-world.jpg'],
  riyadh: ['/hero/03-riyadh-NIGHT.jpg'],
  diriyah: ['/hero/12-diriyah.jpg'],
  jeddah: ['/hero/11-jeddah.jpg'],
  redsea: ['/hero/10-red-sea.jpg'],
  makkah: ['/hero/04-makkah-NIGHT.jpg'],
  clouds: ['/hero/05-cloud-DAWN.jpg', '/hero/02-cloud-NIGHT.jpg'],
  window: ['/hero/13-window-MORNING.jpg', '/hero/00-window-NIGHT.jpg'],
} as const

/** Hero segments reused as stand-in clip loops. See the note at proxyKey. */
const DEMO_LOOPS = [
  '/hero/vid/05-07_dawn-cloud_alula_qasr-m.mp4',
  '/hero/vid/02-04_night-cloud_riyadh_makkah-m.mp4',
  '/hero/vid/10-12_red-sea_jeddah_diriyah-m.mp4',
  '/hero/vid/12-13_diriyah_to_morning-window-m.mp4',
] as const

const poster = (set: keyof typeof POSTERS, index: number) =>
  POSTERS[set][index % POSTERS[set].length]

/** Frame size for a clip, from its album's orientation. */
function clipFrame(orientation: 'landscape' | 'portrait' | 'mixed', index: number) {
  const portrait = orientation === 'portrait' || (orientation === 'mixed' && index % 3 === 1)
  return portrait
    ? { width: 1080, height: 1920, aspectRatio: '9:16' }
    : { width: 1920, height: 1080, aspectRatio: '16:9' }
}

// ─────────────────────────────────────────────────────────────────────────────

const ALULA_SHOTS: Array<[string, string, string, string]> = [
  ['الحِجر عند الشروق — دوران بطيء', 'Hegra at sunrise — slow orbit', 'Drone', 'Wide'],
  [
    'قصر الفريد — كشف من خلف الصخرة',
    'Qasr al-Farid — reveal from behind the rock',
    'Drone',
    'Wide',
  ],
  ['جبل عكمة — تمرير جانبي', 'Jabal Ikmah — lateral pass', 'Drone', 'Wide'],
  ['وادي العلا — ارتفاع عمودي', 'AlUla valley — vertical climb', 'Drone', 'Aerial'],
  ['المدينة القديمة — من الأعلى', 'Old Town — top-down', 'Drone', 'Aerial'],
  ['واحة النخيل — انزلاق منخفض', 'Palm oasis — low glide', 'Gimbal', 'Medium'],
  ['مرايا — انعكاس الصحراء', 'Maraya — desert reflection', 'Drone', 'Wide'],
  ['جبل الفيل — دوران كامل', 'Elephant Rock — full orbit', 'Drone', 'Wide'],
  ['طريق البخور — تتبع', 'Incense route — tracking', 'Drone', 'Wide'],
  ['الكثبان الحمراء — تمرير منخفض', 'Red dunes — low pass', 'Drone', 'Wide'],
  ['المقابر النبطية — اقتراب', 'Nabataean tombs — push in', 'Gimbal', 'Medium'],
  ['الحرة البركانية — من الأعلى', 'Volcanic harrat — top-down', 'Drone', 'Aerial'],
  ['غروب على الجرف', 'Sunset over the escarpment', 'Static', 'Aerial'],
  ['ظلال الصخور الطويلة', 'Long rock shadows', 'Slider', 'Wide'],
  ['نخيل عند الغسق', 'Palms at dusk', 'Gimbal', 'Medium'],
  ['الطريق الصحراوي — تتبع سيارة', 'Desert road — car tracking', 'Drone', 'Wide'],
  ['تفاصيل النقوش الصخرية', 'Rock inscription detail', 'Slider', 'Close-up'],
  ['بانوراما الوادي', 'Valley panorama', 'Crane', 'Aerial'],
  ['ضوء الفجر الأول', 'First light', 'Static', 'Wide'],
  ['قافلة الجمال', 'Camel caravan', 'Drone', 'Wide'],
  ['الحِجر — ارتفاع وكشف', 'Hegra — rise and reveal', 'Crane', 'Aerial'],
  ['العلا من الأفق', 'AlUla from the horizon', 'Static', 'Aerial'],
]

/** Deliberately inconsistent specs, so the reviewer's technical check has something to fail on. */
const RUB_SHOTS: Array<[string, string, number, number, number, string]> = [
  ['كثبان الفجر — تمرير', 'Dawn dunes — pass', 3840, 2160, 24, 'S-Log3'],
  ['خط الكثيب', 'Dune ridge line', 3840, 2160, 24, 'S-Log3'],
  ['ظلال طويلة على الرمل', 'Long shadows on sand', 3840, 2160, 24, 'S-Log3'],
  ['رمال متحركة — بطيء', 'Moving sand — slow motion', 1920, 1080, 60, 'Rec.709'],
  ['الأفق الفارغ', 'Empty horizon', 3840, 2160, 24, 'S-Log3'],
  ['قمة الكثيب عند الغروب', 'Dune crest at sunset', 3840, 2160, 24, 'S-Log3'],
  ['نمط الرمال من الأعلى', 'Sand pattern top-down', 4096, 2160, 25, 'Rec.709'],
  ['آخر ضوء', 'Last light', 3840, 2160, 24, 'S-Log3'],
  ['نجوم فوق الكثبان', 'Stars over the dunes', 3840, 2160, 24, 'S-Log3'],
]

/**
 * Two-factor for the demo admin and creators. It is mandatory for both roles
 * (lib/two-factor.ts), so an unenrolled demo account could not open /admin or
 * /studio at all. Fixed, published secrets — these are DEV accounts with a
 * published password already; this seed must never run against production.
 *
 * Get the current 6-digit code with `npm run totp:code -- admin@laqta.sa`, or
 * add the secret to an authenticator app. The verify gates read the secret
 * from the database, so an account the owner re-enrolled still passes.
 */
const DEMO_TWO_FACTOR: Record<string, string> = {
  'admin@laqta.sa': 'LAQTADEVADMINTOTPSECRETONLYLOCAL',
  'creator@laqta.sa': 'LAQTADEVCREATORTOTPSECRETLOCAL22',
  'nada@laqta.sa': 'LAQTADEVNADATOTPSECRETONLYLOCAL2',
}

/**
 * Enrol the demo accounts — only where no secret exists yet, so re-seeding
 * never replaces one the owner enrolled with their own authenticator.
 */
async function enrolDemoTwoFactor() {
  for (const [email, secret] of Object.entries(DEMO_TWO_FACTOR)) {
    await db.user.updateMany({
      where: { email, twoFactorSecret: null },
      data: { twoFactorSecret: secret, twoFactorEnabled: true },
    })
    // A secret without the flag (an abandoned enrolment) completes too.
    await db.user.updateMany({
      where: { email, twoFactorSecret: { not: null }, twoFactorEnabled: false },
      data: { twoFactorEnabled: true },
    })
  }
}

async function main() {
  // Demo data — shared password, fake sales and view counts — only ever goes
  // into a local database. A real one is seeded with seed-production.ts.
  if (!demoSeedAllowed(process.env.DATABASE_URL, process.env)) {
    console.error(
      'Refusing: this is the DEMO seed and DATABASE_URL is not a local database.\n' +
        'For a real database run `npm run db:seed:production`. To force demo data anyway, set SEED_DEMO=1.',
    )
    process.exit(1)
  }
  console.log('Seeding Laqta…')

  await seedTaxonomy(db)
  const licences = await seedLicences(db)
  await seedPriceBands(db)

  const passwordHash = await bcrypt.hash('Laqta!2026', 12)

  // ── Accounts ──────────────────────────────────────────────────────────────
  const admin = await db.user.upsert({
    where: { email: 'admin@laqta.sa' },
    update: {},
    create: {
      email: 'admin@laqta.sa',
      phone: '+966500000001',
      emailVerified: new Date(),
      phoneVerified: new Date(),
      passwordHash,
      name: 'مدير المنصة',
      role: 'admin',
      locale: 'ar',
      // 2FA is mandatory for admin and creator — see DEMO_TWO_FACTOR below.
    },
  })

  const buyer = await db.user.upsert({
    where: { email: 'buyer@agency.sa' },
    // Not empty: `country` was added after this account first existed, so an
    // `update: {}` left every already-seeded machine with a blank nationality
    // on the account page — the same trap the albums hit.
    update: { country: 'SA' },
    create: {
      email: 'buyer@agency.sa',
      phone: '+966500000003',
      emailVerified: new Date(),
      phoneVerified: new Date(),
      passwordHash,
      name: 'وكالة أثر للإعلان',
      country: 'SA',
      role: 'buyer',
      locale: 'ar',
      billingEntityType: 'business',
      legalName: 'شركة أثر للدعاية والإعلان',
      crNumber: '1010234567',
      vatNumber: '300012345600003',
      billingAddress: {
        line1: 'طريق الملك فهد',
        cityAr: 'الرياض',
        cityEn: 'Riyadh',
        region: 'منطقة الرياض',
        postalCode: '12211',
        country: 'SA',
      },
    },
  })

  const creatorUser = await db.user.upsert({
    where: { email: 'creator@laqta.sa' },
    update: {},
    create: {
      email: 'creator@laqta.sa',
      phone: '+201000000002',
      emailVerified: new Date(),
      phoneVerified: new Date(),
      passwordHash,
      name: 'يوسف الشامي',
      role: 'creator',
      locale: 'ar',
    },
  })

  const creator = await db.creator.upsert({
    where: { userId: creatorUser.id },
    update: {},
    create: {
      userId: creatorUser.id,
      handle: 'yousef-shami',
      displayNameAr: 'يوسف الشامي',
      displayNameEn: 'Yousef Al-Shami',
      bioAr:
        'مصوّر جوي مقيم في القاهرة، متخصص في المناظر الصحراوية والمواقع التراثية في الجزيرة العربية. أصوّر بكاميرا سينمائية بمعدل ٢٤ إطاراً وملف لوغ.',
      bioEn:
        'Cairo-based aerial cinematographer specialising in desert landscapes and heritage sites across the Arabian Peninsula. Shoots 24p cinema LOG.',
      country: 'EG',
      cityAr: 'القاهرة',
      cityEn: 'Cairo',
      status: 'approved',
      tier: 'silver',
      isExclusive: true,
      // Egyptian creator: no Saudi IBAN, so the Wise rail is the live one.
      payoutMethod: 'wise',
      wiseEmail: 'yousef.shami@example.com',
      beneficiaryName: 'Yousef Al-Shami',
      taxResidency: 'EG',
      withholdingRate: 0,
      taxFormOnFile: true,
      approvedAt: daysAgo(205),
    },
  })

  const creator2User = await db.user.upsert({
    where: { email: 'nada@laqta.sa' },
    update: {},
    create: {
      email: 'nada@laqta.sa',
      phone: '+966500000004',
      emailVerified: new Date(),
      phoneVerified: new Date(),
      passwordHash,
      name: 'ندى العتيبي',
      role: 'creator',
      locale: 'ar',
    },
  })

  const creator2 = await db.creator.upsert({
    where: { userId: creator2User.id },
    update: {},
    create: {
      userId: creator2User.id,
      handle: 'nada-otaibi',
      displayNameAr: 'ندى العتيبي',
      displayNameEn: 'Nada Al-Otaibi',
      bioAr: 'مخرجة ومصوّرة من الرياض. أعمل على قصص المدينة والحياة اليومية.',
      bioEn: 'Director and DP from Riyadh working on city stories and everyday life.',
      country: 'SA',
      cityAr: 'الرياض',
      cityEn: 'Riyadh',
      status: 'approved',
      tier: 'standard',
      payoutMethod: 'iban',
      iban: 'SA0380000000608010167519',
      bankName: 'مصرف الراجحي',
      beneficiaryName: 'Nada Al-Otaibi',
      taxResidency: 'SA',
      approvedAt: daysAgo(90),
    },
  })

  await db.cart.upsert({ where: { userId: buyer.id }, update: {}, create: { userId: buyer.id } })

  await enrolDemoTwoFactor()
  console.log('  users — admin@laqta.sa · creator@laqta.sa · nada@laqta.sa · buyer@agency.sa')
  console.log('  2FA on for admin and creators — code: npm run totp:code -- admin@laqta.sa')
  console.log('  password for all — Laqta!2026')

  // ── Releases and permits ──────────────────────────────────────────────────
  const permit =
    (await db.release.findFirst({ where: { referenceNumber: 'RCU-FLM-2026-0417' } })) ??
    (await db.release.create({
      data: {
        creatorId: creator.id,
        type: 'permit',
        fileKey: 'releases/demo/rcu-permit-2026-0417.pdf',
        authority: 'rcu',
        referenceNumber: 'RCU-FLM-2026-0417',
        validFrom: daysAgo(180),
        validTo: new Date(Date.now() + 185 * DAY),
        verification: 'verified',
        verifiedById: admin.id,
        verifiedAt: daysAgo(170),
        notes: 'تصريح تصوير تجاري جوي — الحِجر ومحيطها',
      },
    }))

  const modelRelease =
    (await db.release.findFirst({ where: { creatorId: creator.id, type: 'model' } })) ??
    (await db.release.create({
      data: {
        creatorId: creator.id,
        type: 'model',
        fileKey: 'releases/demo/model-release-a-hassan.pdf',
        subjectName: 'أحمد حسن',
        verification: 'verified',
        verifiedById: admin.id,
        verifiedAt: daysAgo(120),
      },
    }))

  // An expiring permit and an unverified property release, so the releases
  // screen has both a warning and a to-do on first load.
  if (!(await db.release.findFirst({ where: { referenceNumber: 'DGDA-2025-1188' } }))) {
    await db.release.create({
      data: {
        creatorId: creator.id,
        type: 'permit',
        fileKey: 'releases/demo/diriyah-permit-2025-1188.pdf',
        authority: 'diriyah_gate',
        referenceNumber: 'DGDA-2025-1188',
        validFrom: daysAgo(340),
        validTo: new Date(Date.now() + 12 * DAY),
        verification: 'verified',
        verifiedById: admin.id,
        verifiedAt: daysAgo(330),
      },
    })
    await db.release.create({
      data: {
        creatorId: creator.id,
        type: 'property',
        fileKey: 'releases/demo/property-release-villa.pdf',
        subjectName: 'استراحة خاصة — العلا',
        verification: 'pending',
      },
    })
  }

  // ── Albums ────────────────────────────────────────────────────────────────
  const tax = async (kind: 'location' | 'category' | 'theme', slug: string) =>
    db.taxonomy.findUnique({ where: { kind_slug: { kind, slug } } })

  const [locAlula, locRiyadh, locRub, catAerials, catDesert, catCity, themeTourism] =
    await Promise.all([
      tax('location', 'alula'),
      tax('location', 'riyadh'),
      tax('location', 'rub-al-khali'),
      tax('category', 'aerials'),
      tax('category', 'desert-nature'),
      tax('category', 'cityscapes'),
      tax('theme', 'tourism'),
    ])

  const liveAlbum = await db.album.upsert({
    where: { slug: 'alula-golden-hour-aerials' },
    /*
     * `update` is not empty, deliberately.
     *
     * An `upsert` with `update: {}` never touches an album that already
     * exists, so editing a price or a badge here changed nothing on any
     * machine that had seeded once — the only way to see the change was to
     * drop the database. The commercial fields are the ones that actually get
     * edited, so they refresh; the content fields do not, because a developer
     * may have deliberately renamed an album while testing.
     */
    update: {
      priceStandard: 599,

      offerPrice: 399,
      offerLabelAr: 'عرض الإطلاق',
      offerLabelEn: 'Launch offer',
      origin: 'captured',
      orientation: 'landscape',
      ratingAvg: 4.8,
      ratingCount: 34,
    },
    create: {
      creatorId: creator.id,
      slug: 'alula-golden-hour-aerials',
      titleAr: 'العلا — لقطات جوية في الساعة الذهبية',
      titleEn: 'AlUla — Golden Hour Aerials',
      descriptionAr:
        'اثنتان وعشرون لقطة جوية للعلا مصوّرة خلال أربع رحلات في الساعة الذهبية. كلها بدقة 4K و٢٤ إطاراً وملف لوغ، ومتدرجة لتقطيعها في خط زمني واحد دون إعادة تدرّج.',
      descriptionEn:
        'Twenty-two aerial shots of AlUla captured across four golden-hour flights. All 4K, 24p, LOG, graded to cut together in a single timeline without regrading.',
      status: 'live',
      tier: 'pro',
      priceStandard: 599,

      offerPrice: 399,
      offerLabelAr: 'عرض الإطلاق',
      offerLabelEn: 'Launch offer',
      origin: 'captured',
      orientation: 'landscape',
      clearanceStatus: 'full',
      clearedForCommercial: true,
      isExclusive: true,
      isFeatured: true,
      featureRank: 1,
      licenceVersionId: licences.commercial.id,
      publishedAt: daysAgo(150),
      ratingAvg: 4.8,
      ratingCount: 34,
      viewCount: 3120,
    },
  })

  const draftAlbum = await db.album.upsert({
    where: { slug: 'empty-quarter-dune-fields' },
    /*
     * `update` is not empty, deliberately.
     *
     * An `upsert` with `update: {}` never touches an album that already
     * exists, so editing a price or a badge here changed nothing on any
     * machine that had seeded once — the only way to see the change was to
     * drop the database. The commercial fields are the ones that actually get
     * edited, so they refresh; the content fields do not, because a developer
     * may have deliberately renamed an album while testing.
     */
    update: {
      priceStandard: 119,

      offerPrice: 79,
      offerLabelAr: 'عرض الإطلاق',
      offerLabelEn: 'Launch offer',
      origin: 'captured',
      orientation: 'landscape',
      licenceVersionId: licences.commercial.id,
    },
    create: {
      creatorId: creator.id,
      slug: 'empty-quarter-dune-fields',
      licenceVersionId: licences.commercial.id,
      titleAr: 'الربع الخالي — حقول الكثبان',
      titleEn: 'Empty Quarter — Dune Fields',
      descriptionAr: 'لقطات جوية للكثبان الرملية عند الفجر وبعد الغروب.',
      descriptionEn: 'Aerial dune fields at dawn and after sunset.',
      status: 'draft',
      tier: 'mini',
      priceStandard: 119,

      offerPrice: 79,
      offerLabelAr: 'عرض الإطلاق',
      offerLabelEn: 'Launch offer',
      origin: 'captured',
      orientation: 'landscape',
      clearanceStatus: 'pending',
    },
  })

  const reviewAlbum = await db.album.upsert({
    where: { slug: 'riyadh-night-drive' },
    /*
     * `update` is not empty, deliberately.
     *
     * An `upsert` with `update: {}` never touches an album that already
     * exists, so editing a price or a badge here changed nothing on any
     * machine that had seeded once — the only way to see the change was to
     * drop the database. The commercial fields are the ones that actually get
     * edited, so they refresh; the content fields do not, because a developer
     * may have deliberately renamed an album while testing.
     */
    update: {
      priceStandard: 299,

      offerPrice: 199,
      offerLabelAr: 'عرض الإطلاق',
      offerLabelEn: 'Launch offer',
      origin: 'captured',
      orientation: 'mixed',
      licenceVersionId: licences.commercial.id,
    },
    create: {
      creatorId: creator2.id,
      slug: 'riyadh-night-drive',
      licenceVersionId: licences.commercial.id,
      titleAr: 'الرياض — قيادة ليلية',
      titleEn: 'Riyadh — Night Drive',
      descriptionAr: 'لقطات ليلية من داخل السيارة وحولها في شمال الرياض.',
      descriptionEn: 'Night driving plates in and around north Riyadh.',
      status: 'in_review',
      tier: 'standard',
      priceStandard: 299,

      offerPrice: 199,
      offerLabelAr: 'عرض الإطلاق',
      offerLabelEn: 'Launch offer',
      origin: 'captured',
      orientation: 'mixed',
      clearanceStatus: 'editorial_only',
    },
  })

  for (const [albumId, taxonomyIds] of [
    [liveAlbum.id, [locAlula?.id, catAerials?.id, catDesert?.id, themeTourism?.id]],
    [draftAlbum.id, [locRub?.id, catDesert?.id]],
    [reviewAlbum.id, [locRiyadh?.id, catCity?.id]],
  ] as const) {
    for (const taxonomyId of taxonomyIds.filter(Boolean) as string[]) {
      await db.albumTaxonomy.upsert({
        where: { albumId_taxonomyId: { albumId, taxonomyId } },
        update: {},
        create: { albumId, taxonomyId },
      })
    }
  }

  // ── Clips ─────────────────────────────────────────────────────────────────
  if ((await db.clip.count({ where: { albumId: liveAlbum.id } })) === 0) {
    for (const [i, [titleAr, titleEn, movement, shotSize]] of ALULA_SHOTS.entries()) {
      const clip = await db.clip.create({
        data: {
          albumId: liveAlbum.id,
          orderIndex: i,
          slug: `alula-${String(i + 1).padStart(2, '0')}`,
          titleAr,
          titleEn,
          durationS: 8 + (i % 7) * 2.5,
          width: 3840,
          height: 2160,
          fps: 24,
          codec: 'hevc',
          bitrateKbps: 240_000,
          colourProfile: 'D-Log',
          aspectRatio: '16:9',
          camera: 'DJI Inspire 3',
          lens: 'DL 24mm F2.8',
          hasPeople: i === 19,
          identifiableFaces: false,
          cameraMovement: movement,
          shotSize,
          timeOfDay: i < 12 ? 'golden hour' : 'dusk',
          season: 'winter',
          locationId: locAlula?.id ?? null,
          geoLat: 26.6 + i * 0.001,
          geoLng: 37.9 + i * 0.001,
          masterKey: `masters/demo/alula-${i + 1}.mov`,
          proxyKey: `proxies/demo/alula-${i + 1}.mp4`,
          previewHlsKey: `previews/demo/alula-${i + 1}/index.m3u8`,
          thumbnailKeys: [poster('alula', i)],
          spriteKey: `sprites/demo/alula-${i + 1}.jpg`,
          ingestStatus: 'ready',
          checksum: `demo-checksum-alula-${i}`,
          perceptualHash: (0x8f3a2b1c4d5e6f70n + BigInt(i)).toString(16),
        },
      })

      await db.releaseClip.create({ data: { clipId: clip.id, releaseId: permit.id } })
      if (i === 19) {
        await db.releaseClip.create({ data: { clipId: clip.id, releaseId: modelRelease.id } })
      }
    }

    for (const [i, [titleAr, titleEn, width, height, fps, profile]] of RUB_SHOTS.entries()) {
      await db.clip.create({
        data: {
          albumId: draftAlbum.id,
          orderIndex: i,
          slug: `rub-${String(i + 1).padStart(2, '0')}`,
          titleAr,
          titleEn,
          durationS: 10 + i,
          width,
          height,
          fps,
          codec: 'prores',
          bitrateKbps: 880_000,
          colourProfile: profile,
          aspectRatio: width === 4096 ? '17:9' : '16:9',
          camera: 'Sony FX6',
          cameraMovement: 'Drone',
          shotSize: 'Wide',
          timeOfDay: i > 6 ? 'night' : 'dawn',
          locationId: locRub?.id ?? null,
          masterKey: `masters/demo/rub-${i + 1}.mov`,
          thumbnailKeys: [poster('desert', i)],
          ingestStatus: 'ready',
        },
      })
    }

    for (let i = 0; i < 16; i += 1) {
      await db.clip.create({
        data: {
          albumId: reviewAlbum.id,
          orderIndex: i,
          slug: `riyadh-${String(i + 1).padStart(2, '0')}`,
          titleAr: `الرياض ليلاً — لقطة ${i + 1}`,
          titleEn: `Riyadh at night — shot ${i + 1}`,
          durationS: 12,
          width: 3840,
          height: 2160,
          fps: 25,
          codec: 'h264',
          colourProfile: 'Rec.709',
          aspectRatio: '16:9',
          hasPeople: true,
          identifiableFaces: i % 3 === 0,
          cameraMovement: 'Gimbal',
          shotSize: 'Wide',
          timeOfDay: 'night',
          locationId: locRiyadh?.id ?? null,
          masterKey: `masters/demo/riyadh-${i + 1}.mov`,
          thumbnailKeys: [poster('riyadh', i)],
          ingestStatus: 'ready',
        },
      })
    }
  }

  // Demo posters are refreshed on every run, not just on first create: clip
  // rows are guarded by a count, so without this an existing database keeps
  // whatever keys it was first seeded with and the catalogue stays grey.
  for (const [albumId, set] of [
    [liveAlbum.id, 'alula'],
    [draftAlbum.id, 'desert'],
    [reviewAlbum.id, 'riyadh'],
  ] as const) {
    const existing = await db.clip.findMany({
      where: { albumId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    })
    for (const [index, clip] of existing.entries()) {
      await db.clip.update({
        where: { id: clip.id },
        data: { thumbnailKeys: [poster(set, index)] },
      })
    }
  }

  // Denormalised counters. Cheap to recompute here, expensive to get wrong.
  for (const album of [liveAlbum, draftAlbum, reviewAlbum]) {
    const aggregate = await db.clip.aggregate({
      where: { albumId: album.id },
      _count: true,
      _sum: { durationS: true },
    })
    const cover = await db.clip.findFirst({
      where: { albumId: album.id },
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    })
    await db.album.update({
      where: { id: album.id },
      data: {
        clipCount: aggregate._count,
        totalRuntimeS: Math.round(Number(aggregate._sum.durationS ?? 0)),
        totalSizeBytes: BigInt(aggregate._count) * BigInt(1_600_000_000),
        coverClipId: cover?.id ?? null,
      },
    })
  }
  console.log('  albums — 1 live (22 clips), 1 draft (9), 1 in review (16)')

  // ── Sales ─────────────────────────────────────────────────────────────────
  //
  // Five orders at different ages so the 30-day hold is visible: the oldest
  // four have cleared, the newest is still held. Commission is resolved ONCE
  // here and written to the OrderItem — nothing downstream recomputes it.
  // Guarded on ENTITLEMENTS, not orders. Guarding the whole purchase block on
  // `order.count() === 0` meant that once orders existed the block never ran
  // again — so when the entitlement write was added later it was skipped
  // forever, leaving five paid orders whose buyers owned nothing and could
  // download nothing. An all-or-nothing guard on one entity is how a seed
  // drifts out of sync with its own schema.
  if ((await db.entitlement.count()) === 0) {
    const clips = await db.clip.findMany({
      where: { albumId: liveAlbum.id },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, titleAr: true, titleEn: true, masterKey: true },
    })

    // Five past sales at five ages, so the ledger, the hold window and the
    // payout all have something real to describe.
    const sales = [96, 61, 34, 11, 3]

    /*
     * Clear the demo order graph first, so this file can be run twice.
     *
     * Everything above uses `upsert` and is re-runnable; the sales below use
     * `create` with fixed order numbers, so a second run died on a unique
     * constraint and the only way forward was resetting the whole database.
     * That is a trap: a schema change means reseeding, and reseeding meant
     * losing every account someone had set up by hand.
     *
     * Scoped to the numbers this block owns. `Order` cascades to its items,
     * invoice and certificate; the ledger and entitlements hold plain
     * references and are cleared first, in dependency order.
     */
    const demoOrders = await db.order.findMany({
      where: { orderNumber: { startsWith: 'LQ-2026-' } },
      select: { id: true, items: { select: { id: true } } },
    })
    if (demoOrders.length) {
      const itemIds = demoOrders.flatMap((order) => order.items.map((item) => item.id))
      await db.download.deleteMany({
        where: { entitlement: { orderItemId: { in: itemIds } } },
      })
      await db.creatorLedger.deleteMany({ where: { orderItemId: { in: itemIds } } })
      await db.entitlement.deleteMany({ where: { orderItemId: { in: itemIds } } })
      await db.order.deleteMany({ where: { id: { in: demoOrders.map((o) => o.id) } } })
    }

    let balance = 0
    for (const [index, age] of sales.entries()) {
      const gross = Number(liveAlbum.priceStandard)
      const vatAmount = round2(gross * VAT_RATE)
      const createdAt = daysAgo(age)

      const commission = resolveCommission({
        grossAmount: gross,
        tier: creator.tier,
        isExclusive: liveAlbum.isExclusive,
        override: creator.commissionRateOverride ? Number(creator.commissionRateOverride) : null,
      })

      const order = await db.order.create({
        data: {
          userId: buyer.id,
          orderNumber: `LQ-2026-${1001 + index}`,
          status: 'paid',
          subtotal: gross,
          vatRate: VAT_RATE,
          vatAmount,
          total: gross + vatAmount,
          paymentMethod: 'mada',
          gatewayRef: `demo_${1001 + index}`,
          createdAt,
          paidAt: createdAt,
          billingEntitySnapshot: {
            legalName: buyer.legalName,
            crNumber: buyer.crNumber,
            vatNumber: buyer.vatNumber,
            billingAddress: buyer.billingAddress,
          },
        },
      })

      const item = await db.orderItem.create({
        data: {
          orderId: order.id,
          albumId: liveAlbum.id,
          creatorId: creator.id,
          licenceVersionId: licences.commercial.id,
          grossAmount: gross,
          vatAmount,
          commissionRate: commission.rate,
          commissionAmount: commission.commissionAmount,
          creatorNetAmount: commission.creatorNetAmount,
          commissionBasis: commission.basis,
          // The frozen manifest: titles and keys as they stood at purchase, so
          // a later edit to the album cannot change what this buyer owns.
          clipManifestSnapshot: clips,
          createdAt,
        },
      })

      await db.entitlement.upsert({
        where: { userId_albumId: { userId: buyer.id, albumId: liveAlbum.id } },
        update: {},
        create: {
          userId: buyer.id,
          albumId: liveAlbum.id,
          orderItemId: item.id,
          clipIdsSnapshot: clips.map((clip) => clip.id),
          grantedAt: createdAt,
        },
      })

      await db.invoice.create({
        data: {
          orderId: order.id,
          invoiceNumber: `INV-2026-${1001 + index}`,
          uuid: `00000000-0000-4000-8000-${String(1001 + index).padStart(12, '0')}`,
          zatcaStatus: 'cleared',
          issuedAt: createdAt,
        },
      })

      await db.licenceCertificate.create({
        data: {
          orderItemId: item.id,
          certificateNumber: `LIC-2026-${1001 + index}`,
          issuedAt: createdAt,
        },
      })

      balance = round2(balance + commission.creatorNetAmount)
      await db.creatorLedger.create({
        data: {
          creatorId: creator.id,
          entryType: 'sale',
          amount: commission.creatorNetAmount,
          balanceAfter: balance,
          orderItemId: item.id,
          memo: liveAlbum.titleAr,
          availableAt: new Date(createdAt.getTime() + HOLD_DAYS * DAY),
          createdAt,
        },
      })
    }

    // One settled payout against funds that have already cleared the hold.
    const payoutAmount = round2(balance * 0.5)
    const payout = await db.payout.create({
      data: {
        creatorId: creator.id,
        amount: payoutAmount,
        netAmount: payoutAmount,
        status: 'paid',
        method: 'wise',
        destinationSnapshot: {
          method: 'wise',
          wiseEmail: 'yousef.shami@example.com',
          beneficiaryName: 'Yousef Al-Shami',
        },
        reference: 'WISE-2026-000441',
        invoiceKey: 'self-billing/demo/SB-2026-0001.pdf',
        periodStart: daysAgo(120),
        periodEnd: daysAgo(60),
        approvedById: admin.id,
        approvedAt: daysAgo(50),
        paidAt: daysAgo(48),
        createdAt: daysAgo(52),
      },
    })

    balance = round2(balance - payoutAmount)
    await db.creatorLedger.create({
      data: {
        creatorId: creator.id,
        entryType: 'payout',
        amount: -payoutAmount,
        balanceAfter: balance,
        payoutId: payout.id,
        memo: 'تحويل عبر Wise — SB-2026-0001',
        createdAt: daysAgo(48),
      },
    })

    const gmv = await db.orderItem.aggregate({
      where: { creatorId: creator.id },
      _sum: { grossAmount: true, creatorNetAmount: true },
    })
    const held = await db.creatorLedger.aggregate({
      where: { creatorId: creator.id, entryType: 'sale', availableAt: { gt: new Date() } },
      _sum: { amount: true },
    })

    await db.creator.update({
      where: { id: creator.id },
      data: {
        lifetimeGmv: Number(gmv._sum.grossAmount ?? 0),
        balanceHeld: Number(held._sum.amount ?? 0),
        balanceAvail: round2(balance - Number(held._sum.amount ?? 0)),
      },
    })
    await db.album.update({
      where: { id: liveAlbum.id },
      data: { salesCount: sales.length },
    })
    console.log(`  sales — ${sales.length} orders, 1 payout, ledger balance ${balance} SAR`)
  }

  // ── Review queue ──────────────────────────────────────────────────────────
  if ((await db.reviewTask.count()) === 0) {
    const submittedAt = daysAgo(2)
    await db.reviewTask.create({
      data: {
        albumId: reviewAlbum.id,
        status: 'unassigned',
        checklist: emptyChecklist(),
        submittedAt,
        slaDueAt: addBusinessDays(submittedAt, 3),
      },
    })
    console.log('  review queue — 1 unassigned task')
  }

  // ── Merchandising ─────────────────────────────────────────────────────────
  await db.collection.upsert({
    where: { slug: 'saudi-heritage' },
    update: {},
    create: {
      slug: 'saudi-heritage',
      titleAr: 'التراث السعودي',
      titleEn: 'Saudi Heritage',
      descriptionAr: 'مواقع تراثية ومعالم تاريخية عبر المملكة.',
      descriptionEn: 'Heritage sites and historic landmarks across the Kingdom.',
      isFeatured: true,
      isPublished: true,
    },
  })
  const heritage = await db.collection.findUnique({ where: { slug: 'saudi-heritage' } })
  if (heritage) {
    await db.collectionAlbum.upsert({
      where: { collectionId_albumId: { collectionId: heritage.id, albumId: liveAlbum.id } },
      update: {},
      create: { collectionId: heritage.id, albumId: liveAlbum.id },
    })
  }

  // ── Search telemetry ──────────────────────────────────────────────────────
  //
  // Zero-result queries are the highest-value content-acquisition signal the
  // business has: they say exactly what buyers wanted and nobody has shot.
  if ((await db.searchQueryLog.count()) === 0) {
    const queries: Array<[string, string | null, number]> = [
      ['العلا ليلاً نجوم', 'alula', 0],
      ['AlUla night sky timelapse', 'alula', 0],
      ['العلا شتاء طنطورة', 'alula', 0],
      ['الربع الخالي قافلة', 'rub-al-khali', 0],
      ['Empty Quarter camel caravan', 'rub-al-khali', 0],
      ['حافة العالم درون', 'edge-of-the-world', 0],
      ['العلا مطار', 'alula', 0],
      ['العلا جوي', 'alula', 22],
      ['AlUla aerial', 'alula', 22],
      ['الرياض ليلاً', 'riyadh', 16],
    ]

    for (const [query, locationSlug, resultCount] of queries) {
      const repeats = resultCount === 0 ? 14 : 6
      for (let n = 0; n < repeats; n += 1) {
        await db.searchQueryLog.create({
          data: {
            query,
            normalized: query.trim().toLowerCase(),
            locale: /[؀-ۿ]/.test(query) ? 'ar' : 'en',
            resultCount,
            filtersJson: locationSlug ? { location: locationSlug } : undefined,
            createdAt: daysAgo((n * 3) % 60),
          },
        })
      }
    }
    console.log('  search telemetry — 10 queries, 7 of them zero-result')
  }

  // ── Analytics history ───────────────────────────────────────────────────────
  //
  // Ninety days of daily AlbumStat rows so the dashboards render live trend
  // charts on a fresh database. Shaped, not random: a gentle upward drift with
  // a weekly rhythm (Gulf weekend dip on Fri/Sat) and occasional spikes, and a
  // realistic funnel — a fraction of views reach the cart, a fraction of those
  // convert. Deterministic (seeded PRNG) so a re-seed reproduces the same
  // history rather than churning the charts.
  if ((await db.albumStat.count()) === 0) {
    const liveAlbums = await db.album.findMany({
      where: { status: 'live' },
      select: { id: true, creatorId: true, priceStandard: true, salesCount: true },
    })

    // Small deterministic PRNG (mulberry32) so seeds are reproducible without
    // Math.random, which the harness also discourages in scripts.
    let prngState = 0x9e3779b9
    const rand = () => {
      prngState |= 0
      prngState = (prngState + 0x6d2b79f5) | 0
      let x = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState)
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296
    }

    let rows = 0
    for (const album of liveAlbums) {
      const price = Number(album.priceStandard)
      // A per-album popularity weight so albums differ in the "top albums" table.
      const weight = 0.5 + rand() * 1.5
      for (let d = 89; d >= 0; d -= 1) {
        const date = daysAgo(d)
        const dow = date.getDay() // 5 Fri, 6 Sat
        const weekend = dow === 5 || dow === 6 ? 0.55 : 1
        const drift = 1 + (89 - d) / 160 // slow growth toward today
        const spike = rand() < 0.04 ? 2.4 : 1 // occasional viral day
        const base = 22 * weight * weekend * drift * spike

        const views = Math.max(1, Math.round(base + (rand() - 0.5) * 8))
        const cartAdds = Math.round(views * (0.06 + rand() * 0.05))
        const purchases = Math.round(cartAdds * (0.28 + rand() * 0.18))
        const boardAdds = Math.round(views * (0.09 + rand() * 0.06))
        const revenue = Math.round(purchases * price * 100) / 100

        await db.albumStat.create({
          data: {
            albumId: album.id,
            creatorId: album.creatorId,
            day: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
            views,
            boardAdds,
            cartAdds,
            purchases,
            revenue,
          },
        })
        rows += 1
      }
    }
    console.log(`  analytics — ${rows} daily rows across ${liveAlbums.length} albums (90 days)`)
  }

  // ── Catalogue depth ───────────────────────────────────────────────────────
  //
  // A launch catalogue of one live album makes every album surface — the
  // landing shelf, the offers rail, a creator profile — render as an empty
  // state, which is indistinguishable from a broken page during review. These
  // are placeholders with real posters, real clip rows and real taxonomy
  // links, so the grids, filters and offer pricing can all be exercised.
  //
  // Every album carries a launch offer, and every `compareAt` below is a
  // real regular price rather than a number invented to make a strike-through
  // appear. That is the whole reason it is stored per album instead of derived
  // from a percentage: the struck number a buyer sees is the number the album
  // actually reverts to.
  //
  // The earlier catalogue deliberately left most albums off-offer, on the
  // grounds that a rail which is 100% offers teaches the eye that the
  // strike-through means nothing. That reasoning still holds for a permanent
  // sale — it does not hold for a launch, where the whole catalogue genuinely
  // is introductory. When the launch ends, these come off, and the argument
  // applies again.
  const EXTRA_ALBUMS: Array<{
    slug: string
    titleAr: string
    titleEn: string
    descAr: string
    posters: keyof typeof POSTERS
    /** A `theme` slug — what occasion this album is merchandised for. */
    theme?: string
    origin: 'captured' | 'generated'
    orientation: 'landscape' | 'portrait' | 'mixed'
    clips: number
    price: number
    compareAt?: number
    offerAr?: string
    offerEn?: string
    loc?: string
    cat?: string
    featured?: boolean
  }> = [
    {
      slug: 'diriyah-najdi-architecture',
      titleAr: 'الدرعية — عمارة نجدية',
      titleEn: 'Diriyah — Najdi Architecture',
      descAr: 'أربع وعشرون لقطة للطين النجدي عند الغروب وبعد المغرب، بتدرّج واحد.',
      posters: 'diriyah',
      clips: 24,
      price: 399,
      compareAt: 599,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'founding-day',
      origin: 'captured' as const,
      orientation: 'landscape' as const,
      loc: 'diriyah',
      cat: 'heritage',
      featured: true,
    },
    {
      slug: 'riyadh-skyline-night',
      titleAr: 'الرياض — أفق الليل',
      titleEn: 'Riyadh — Night Skyline',
      descAr: 'ستّ عشرة لقطة لأبراج الرياض من الغروب حتى منتصف الليل.',
      posters: 'riyadh',
      clips: 16,
      price: 199,
      compareAt: 299,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'riyadh-season',
      origin: 'captured' as const,
      orientation: 'landscape' as const,
      loc: 'riyadh',
      cat: 'cityscapes',
    },
    {
      slug: 'jeddah-waterfront',
      titleAr: 'جدة — الواجهة البحرية',
      titleEn: 'Jeddah — Waterfront',
      descAr: 'أربع عشرة لقطة للكورنيش والبحر الأحمر في الساعة الزرقاء.',
      posters: 'jeddah',
      clips: 14,
      price: 199,
      compareAt: 299,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'tourism',
      origin: 'captured' as const,
      orientation: 'landscape' as const,
      loc: 'jeddah',
      cat: 'cityscapes',
    },
    {
      slug: 'red-sea-reefs',
      titleAr: 'البحر الأحمر — شعاب وسواحل',
      titleEn: 'Red Sea — Reefs & Coast',
      descAr: 'عشرون لقطة جوية للشعاب والمياه الضحلة عند الظهيرة.',
      posters: 'redsea',
      clips: 20,
      price: 399,
      compareAt: 599,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'tourism',
      origin: 'captured' as const,
      orientation: 'landscape' as const,
      loc: 'red-sea',
      cat: 'coast-marine',
      featured: true,
    },
    {
      slug: 'edge-of-the-world-cliffs',
      titleAr: 'حافة العالم — منحدرات طويق',
      titleEn: 'Edge of the World — Tuwaiq Cliffs',
      descAr: 'ثماني عشرة لقطة للجرف عند الفجر وفي الغبار الخفيف.',
      posters: 'desert',
      clips: 18,
      price: 399,
      compareAt: 599,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'national-day',
      origin: 'captured' as const,
      orientation: 'landscape' as const,
      loc: 'edge-of-the-world',
      cat: 'desert-nature',
    },
    {
      slug: 'empty-quarter-dawn',
      titleAr: 'الربع الخالي — فجر الكثبان',
      titleEn: 'Empty Quarter — Dune Dawn',
      descAr: 'اثنتا عشرة لقطة للكثبان قبل الشروق مباشرة.',
      posters: 'desert',
      clips: 12,
      price: 199,
      compareAt: 279,
      offerAr: 'عرض محدود',
      offerEn: 'Limited offer',
      theme: 'national-day',
      origin: 'generated' as const,
      orientation: 'landscape' as const,
      loc: 'rub-al-khali',
      cat: 'desert-nature',
    },
    {
      slug: 'aerial-clouds-above',
      titleAr: 'فوق الغيوم — لقطات ارتفاع',
      titleEn: 'Above the Clouds — Altitude',
      descAr: 'خمس عشرة لقطة فوق طبقة الغيوم عند الفجر وبعد الغروب.',
      posters: 'clouds',
      clips: 15,
      price: 199,
      compareAt: 299,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'national-day',
      origin: 'generated' as const,
      orientation: 'landscape' as const,
      cat: 'aerials',
    },
    {
      slug: 'cabin-window-series',
      titleAr: 'من النافذة — سلسلة الطيران',
      titleEn: 'From the Window — Flight Series',
      descAr: 'عشر لقطات من نافذة الطائرة، صباحاً وليلاً.',
      posters: 'window',
      clips: 10,
      price: 79,
      compareAt: 119,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'tourism',
      origin: 'captured' as const,
      orientation: 'portrait' as const,
      cat: 'transport',
    },
    {
      slug: 'alula-hegra-detail',
      titleAr: 'العلا — تفاصيل الحِجر',
      titleEn: 'AlUla — Hegra Details',
      descAr: 'اثنتا عشرة لقطة قريبة للواجهات المنحوتة.',
      posters: 'alula',
      clips: 12,
      price: 199,
      compareAt: 299,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'winter-tantora',
      origin: 'captured' as const,
      orientation: 'landscape' as const,
      loc: 'alula',
      cat: 'heritage',
    },
    {
      slug: 'riyadh-streets-day',
      titleAr: 'الرياض — شوارع النهار',
      titleEn: 'Riyadh — Daytime Streets',
      descAr: 'إحدى وعشرون لقطة للحركة والمشاة في وسط المدينة.',
      posters: 'riyadh',
      clips: 21,
      price: 399,
      compareAt: 549,
      offerAr: 'عرض الإطلاق',
      offerEn: 'Launch offer',
      theme: 'riyadh-season',
      origin: 'captured' as const,
      orientation: 'mixed' as const,
      loc: 'riyadh',
      cat: 'people-lifestyle',
    },
  ]

  let made = 0
  for (const [n, a] of EXTRA_ALBUMS.entries()) {
    const existing = await db.album.findUnique({ where: { slug: a.slug } })
    if (existing) {
      // Same reasoning as the three albums above: refresh what gets edited,
      // leave the content alone.
      await db.album.update({
        where: { id: existing.id },
        data: {
          // Regular price, and the offer price when the album is on offer
          // (DEV-60: priceStandard is always the REGULAR price).
          priceStandard: a.compareAt ?? a.price,
          offerPrice: a.compareAt ? a.price : null,
          offerLabelAr: a.offerAr ?? null,
          offerLabelEn: a.offerEn ?? null,
          origin: a.origin,
          orientation: a.orientation,
          ratingAvg: 4.3 + (n % 6) * 0.1,
          ratingCount: 6 + ((n * 5) % 23),
        },
      })
      // Frame sizes follow the album's orientation, so they have to be
      // refreshed with it — otherwise a portrait album keeps 16:9 clips and
      // the contact sheet has nothing to show.
      const existingClips = await db.clip.findMany({
        where: { albumId: existing.id },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, orderIndex: true },
      })
      for (const clip of existingClips) {
        await db.clip.update({
          where: { id: clip.id },
          data: clipFrame(a.orientation, clip.orderIndex),
        })
      }
      // The occasion link is new, so albums seeded before it exists have none —
      // and the seasonal shelf would be empty on every machine but a fresh one.
      if (a.theme) {
        const tx = await db.taxonomy.findUnique({
          where: { kind_slug: { kind: 'theme', slug: a.theme } },
        })
        if (tx) {
          await db.albumTaxonomy.upsert({
            where: { albumId_taxonomyId: { albumId: existing.id, taxonomyId: tx.id } },
            update: {},
            create: { albumId: existing.id, taxonomyId: tx.id },
          })
        }
      }
      continue
    }
    const album = await db.album.create({
      data: {
        creatorId: n % 3 === 0 ? creator2.id : creator.id,
        slug: a.slug,
        titleAr: a.titleAr,
        titleEn: a.titleEn,
        descriptionAr: a.descAr,
        descriptionEn: a.titleEn,
        status: 'live',
        tier: 'pro',
        priceStandard: a.compareAt ?? a.price,
        offerPrice: a.compareAt ? a.price : null,
        origin: a.origin,
        orientation: a.orientation,
        // No trailer. A hero segment standing in as "the album's trailer" is
        // the site pretending: the page leads with the album's own cover
        // still until a real cut is set from /admin/catalogue or uploaded by
        // `npm run media:upload`.
        trailerKey: null,
        offerLabelAr: a.offerAr ?? null,
        offerLabelEn: a.offerEn ?? null,
        clearanceStatus: 'full',
        clearedForCommercial: true,
        isFeatured: a.featured ?? false,
        featureRank: a.featured ? n + 2 : null,
        licenceVersionId: licences.commercial.id,
        publishedAt: daysAgo(120 - n * 7),
        ratingAvg: 4.3 + (n % 6) * 0.1,
        // Denormalised alongside the average, and the two must agree: an
        // average with a zero count renders as "no ratings", which is how the
        // whole catalogue showed as unrated while carrying scores.
        ratingCount: 6 + ((n * 5) % 23),
        viewCount: 400 + n * 137,
      },
    })

    for (let i = 0; i < a.clips; i++) {
      await db.clip.create({
        data: {
          albumId: album.id,
          orderIndex: i,
          slug: `${a.slug}-${String(i + 1).padStart(2, '0')}`,
          titleAr: `${a.titleAr} — لقطة ${i + 1}`,
          titleEn: `${a.titleEn} — Shot ${i + 1}`,
          durationS: 6 + (i % 6) * 2,
          /*
           * The clip's real frame size, following the album's orientation.
           *
           * Every clip used to be 1920×1080 regardless, so a "portrait" album
           * was portrait in name only and the contact sheet had nothing to
           * demonstrate. A `mixed` album genuinely mixes, alternating so both
           * shapes appear in the same sheet.
           */
          ...clipFrame(a.orientation, i),
          fps: 24,
          codec: 'h264',
          bitrateKbps: 40_000,
          colourProfile: 'Rec.709',
          hasPeople: a.cat === 'people-lifestyle',
          identifiableFaces: false,
          cameraMovement: (['static', 'pan', 'orbit', 'push in'] as const)[i % 4],
          shotSize: (['wide', 'medium', 'close'] as const)[i % 3],
          timeOfDay: i % 2 === 0 ? 'golden hour' : 'blue hour',
          thumbnailKeys: [poster(a.posters, i)],
          // Dev only: the hero segments stand in for per-clip proxies so the
          // hover-to-play interaction can be built and tested before the
          // transcode pipeline exists. They live in public/hero/vid, which is
          // gitignored — a fresh checkout has no video and the tile correctly
          // falls back to its poster. `previewKey` is what public pages play;
          // `proxyKey` is the buyer's clean editing copy (library download).
          // `npm run media:previews` replaces the stand-in with the clip's own.
          proxyKey: DEMO_LOOPS[i % DEMO_LOOPS.length],
          previewKey: DEMO_LOOPS[i % DEMO_LOOPS.length],
          ingestStatus: 'ready',
          checksum: `demo-${a.slug}-${i}`,
        },
      })
    }

    const cover = await db.clip.findFirst({
      where: { albumId: album.id },
      orderBy: { orderIndex: 'asc' },
    })
    await db.album.update({
      where: { id: album.id },
      data: { clipCount: a.clips, coverClipId: cover?.id ?? null, totalRuntimeS: a.clips * 10 },
    })

    for (const [kind, slug] of [
      ['location', a.loc],
      ['category', a.cat],
      // The occasion, which is what the seasonal shelf on the landing page
      // selects on. Without it that shelf has nothing to show all year.
      ['theme', a.theme],
    ] as const) {
      if (!slug) continue
      const tx = await db.taxonomy.findUnique({ where: { kind_slug: { kind, slug } } })
      if (tx) await db.albumTaxonomy.create({ data: { albumId: album.id, taxonomyId: tx.id } })
    }
    made += 1
  }
  console.log(
    `  catalogue — ${made} extra live albums (${EXTRA_ALBUMS.filter((a) => a.compareAt).length} on offer)`,
  )

  // ── Collections, populated ────────────────────────────────────────────────
  //
  // These are seeded LAST, after the catalogue exists.
  //
  // The merchandising block further up runs before the extra albums are
  // created, so the only album it could ever link was the one live album — and
  // a collections page whose every shelf holds a single album demonstrates
  // nothing about collections. A shelf is only a shelf once there is more than
  // one thing on it.
  const SHELVES: Array<{
    slug: string
    titleAr: string
    titleEn: string
    descAr: string
    descEn: string
    albums: string[]
  }> = [
    {
      slug: 'saudi-heritage',
      titleAr: 'التراث السعودي',
      titleEn: 'Saudi Heritage',
      descAr: 'مواقع تراثية ومعالم تاريخية عبر المملكة.',
      descEn: 'Heritage sites and historic landmarks across the Kingdom.',
      albums: ['alula-golden-hour-aerials', 'diriyah-najdi-architecture', 'alula-hegra-detail'],
    },
    {
      slug: 'aerials',
      titleAr: 'لقطات جوية',
      titleEn: 'From the Air',
      descAr: 'الصحراء والساحل والمدينة من الأعلى، بالدرون وبالطائرة.',
      descEn: 'Desert, coast and city from above, by drone and from the air.',
      albums: [
        'red-sea-reefs',
        'edge-of-the-world-cliffs',
        'empty-quarter-dawn',
        'aerial-clouds-above',
        'cabin-window-series',
      ],
    },
    {
      slug: 'cities',
      titleAr: 'المدن السعودية',
      titleEn: 'Saudi Cities',
      descAr: 'الرياض وجدة، نهاراً وليلاً، من الشارع ومن الأفق.',
      descEn: 'Riyadh and Jeddah, day and night, from street level and from the skyline.',
      albums: ['riyadh-skyline-night', 'riyadh-streets-day', 'jeddah-waterfront'],
    },
  ]

  for (const [order, shelf] of SHELVES.entries()) {
    const collection = await db.collection.upsert({
      where: { slug: shelf.slug },
      update: {
        titleAr: shelf.titleAr,
        titleEn: shelf.titleEn,
        descriptionAr: shelf.descAr,
        descriptionEn: shelf.descEn,
        isFeatured: order === 0,
        isPublished: true,
      },
      create: {
        slug: shelf.slug,
        titleAr: shelf.titleAr,
        titleEn: shelf.titleEn,
        descriptionAr: shelf.descAr,
        descriptionEn: shelf.descEn,
        isFeatured: order === 0,
        isPublished: true,
        sortOrder: order,
      },
    })

    for (const [position, slug] of shelf.albums.entries()) {
      const album = await db.album.findUnique({ where: { slug }, select: { id: true } })
      if (!album) continue
      await db.collectionAlbum.upsert({
        where: { collectionId_albumId: { collectionId: collection.id, albumId: album.id } },
        update: { sortOrder: position },
        create: { collectionId: collection.id, albumId: album.id, sortOrder: position },
      })
    }
  }
  console.log(`  collections — ${SHELVES.length} shelves populated`)

  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
