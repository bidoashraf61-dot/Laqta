/**
 * The hero film — an overnight arrival into Saudi Arabia.
 *
 * Running order per 02_FINAL_STORYBOARD.pdf. Every scene is joined by a cloud
 * wipe: the camera flies into vapour until it fills the frame, so there is
 * never a visible cut — and the night→dawn time shift is hidden inside the
 * cloud at scene 05, which is why that transition can cover eight hours
 * without the viewer registering a jump.
 *
 * ── Posters and video are deliberately decoupled ────────────────────────────
 * `still` is required and ships today, generated from final_stills_4K.
 * `clip` is optional. The engine treats the still as a live poster and only
 * swaps in video once a clip actually paints, so the page is complete right
 * now with stills alone and upgrades scene-by-scene as renders land — no code
 * change, just a `clip` path added below.
 *
 * To add a clip: drop the mp4 in public/hero/vid/ and set `clip` (and
 * `clipMobile` for a ~720p, tight-GOP phone encode). Nothing else moves.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type Scene = {
  id: string
  /** Short label for the route rail down the side. */
  label: string
  still: string
  stillMobile?: string
  clip?: string
  clipMobile?: string
  accent: string
  /** Viewport-heights of scroll for this scene. Higher = slower dwell. */
  scroll?: number
  /** 0–1. Settles the camera mid-scene, where the copy peaks. Keep ≤ 0.6. */
  linger?: number
  eyebrow?: string
  title?: string
  body?: string
  tags?: string[]
}

const poster = (name: string) => `/hero/${name}.jpg`
const posterMobile = (name: string) => `/hero/${name}-m.jpg`

export const SCENES: Scene[] = [
  {
    id: 'window-night',
    label: 'الإقلاع',
    still: poster('00-window-NIGHT'),
    stillMobile: posterMobile('00-window-NIGHT'),
    accent: '#8fa8c8',
    scroll: 1.7,
    linger: 0.45,
    eyebrow: 'مكتبة اللقطات السعودية',
    title: 'السعودية، كما هي فعلاً.',
    body:
      'لقطات مصوّرة داخل المملكة، بتصاريح مكتملة — لمن يعمل على علامة سعودية أو جهة حكومية أو حملة تخص المملكة.',
    tags: ['4K و 6K', 'بلا اشتراك', 'تصاريح مكتملة'],
  },
  {
    id: 'pushed-through',
    label: 'العبور',
    still: poster('01-pushed-through-NIGHT'),
    stillMobile: posterMobile('01-pushed-through-NIGHT'),
    accent: '#7f9ec0',
    eyebrow: 'المشكلة',
    title: 'أغلب «اللقطات السعودية» ليست سعودية.',
    body:
      'المكتبات العالمية تبيعك دبي على أنها الرياض، وأفقاً قديماً بخمس سنوات. جمهورك يلاحظ ذلك قبل عميلك.',
  },
  {
    id: 'cloud-night',
    label: 'السحاب',
    still: poster('02-cloud-NIGHT'),
    stillMobile: posterMobile('02-cloud-NIGHT'),
    accent: '#6d86ad',
    eyebrow: 'فوق الغيوم',
    title: 'ثلاث عشرة منطقة.',
    body:
      'من الربع الخالي إلى فرسان، ومن نيوم إلى الأحساء — لا مدينتين فقط.',
  },
  {
    id: 'riyadh',
    label: 'الرياض',
    still: poster('03-riyadh-NIGHT'),
    stillMobile: posterMobile('03-riyadh-NIGHT'),
    accent: '#c8a24a',
    scroll: 1.5,
    linger: 0.35,
    eyebrow: 'الرياض',
    title: 'مدينة تتغيّر كل شهر.',
    body:
      'أفق الرياض لا يشبه نفسه قبل سنة. نحدّث الألبومات مع المدينة، لا مع دورة أرشيف عالمية.',
    tags: ['مدن وأفق', 'ليل'],
  },
  {
    id: 'makkah',
    label: 'مكة',
    still: poster('04-makkah-NIGHT'),
    stillMobile: posterMobile('04-makkah-NIGHT'),
    accent: '#d9c08a',
    scroll: 1.6,
    linger: 0.5,
    eyebrow: 'مكة المكرمة',
    title: 'مواقع لا تُصوَّر بلا تصريح.',
    body:
      'مكة والمدينة والعُلا والدرعية ونيوم — لكلٍّ منها جهة تصاريح خاصة، والتصوير التجاري فيها بلا تصريح مخالفة.',
    tags: ['بتصريح رسمي'],
  },
  {
    id: 'cloud-dawn',
    label: 'الفجر',
    still: poster('05-cloud-DAWN'),
    stillMobile: posterMobile('05-cloud-DAWN'),
    accent: '#e6a76b',
    scroll: 1.8,
    linger: 0.55,
    eyebrow: 'الساعة الذهبية',
    title: 'الضوء الذي لا يُشترى مرتين.',
    body:
      'كل ألبوم مصوّر في نافذته الصحيحة ومتدرّج ليقطّع في خط زمني واحد دون إعادة تدرّج.',
  },
  {
    id: 'alula',
    label: 'العُلا',
    still: poster('06-alula'),
    stillMobile: posterMobile('06-alula'),
    accent: '#e9c98a',
    eyebrow: 'العُلا',
    title: 'تراثٌ موثّق، لا صورة عامة.',
    body:
      'الحِجر وجبل عكمة ووادي العُلا — بتصاريح الهيئة الملكية، ظاهرة على صفحة كل ألبوم.',
    tags: ['تراث', 'الهيئة الملكية للعُلا'],
  },
  {
    id: 'qasr-al-farid',
    label: 'قصر الفريد',
    still: poster('07-qasr-al-farid'),
    stillMobile: posterMobile('07-qasr-al-farid'),
    accent: '#dcb884',
    eyebrow: 'الحِجر',
    title: 'قصر الفريد.',
    body:
      'دورانٌ كامل حول المقبرة النبطية — لقطة لا تجدها في أي مكتبة عالمية بترخيص تجاري سليم.',
    tags: ['تراث', 'بتصريح'],
  },
  {
    id: 'empty-quarter',
    label: 'الربع الخالي',
    still: poster('08-empty-quarter'),
    stillMobile: posterMobile('08-empty-quarter'),
    accent: '#f0d9a0',
    eyebrow: 'الربع الخالي',
    title: 'صحراء المملكة، لا صحراء أخرى.',
    body:
      'كثبان نجد والربع الخالي — لا المغرب ولا الإمارات تُباع باسم السعودية.',
    tags: ['كثبان', 'فجر / غروب'],
  },
  {
    id: 'edge-of-the-world',
    label: 'حافة العالم',
    still: poster('09-edge-of-the-world'),
    stillMobile: posterMobile('09-edge-of-the-world'),
    accent: '#c9a678',
    eyebrow: 'حافة العالم',
    title: 'مواقع يعرفها من صوّرها.',
    body:
      'مصوّرون يعرفون الطريق والموسم والساعة — لا أرشيف عام اشتُري بالجملة.',
  },
  {
    id: 'red-sea',
    label: 'البحر الأحمر',
    still: poster('10-red-sea'),
    stillMobile: posterMobile('10-red-sea'),
    accent: '#3fb6c4',
    eyebrow: 'البحر الأحمر',
    title: 'ساحلٌ بطول ١٨٠٠ كيلومتر.',
    body:
      'شعاب ومياه فيروزية ومشاريع الساحل — جاهزة لحملات السياحة والعقار والضيافة.',
    tags: ['جوي ساحلي', 'تحت الماء'],
  },
  {
    id: 'jeddah',
    label: 'جدة',
    still: poster('11-jeddah'),
    stillMobile: posterMobile('11-jeddah'),
    accent: '#d8b070',
    eyebrow: 'جدة',
    title: 'البلد، والواجهة، والبحر.',
    body:
      'جدة التاريخية والكورنيش — تراثٌ حيّ لا ديكور.',
    tags: ['تراث', 'ساحل'],
  },
  {
    id: 'diriyah',
    label: 'الدرعية',
    still: poster('12-diriyah'),
    stillMobile: posterMobile('12-diriyah'),
    accent: '#c89b6a',
    eyebrow: 'الدرعية',
    title: 'حيث بدأت الحكاية.',
    body:
      'حي الطُّريف بعمارته الطينية، بتصريح هيئة تطوير بوابة الدرعية.',
    tags: ['تراث', 'بتصريح'],
  },
  {
    id: 'finale',
    label: 'الوصول',
    still: poster('13-window-MORNING'),
    stillMobile: posterMobile('13-window-MORNING'),
    accent: '#c8a24a',
    scroll: 1.9,
    linger: 0.5,
    eyebrow: 'كيف تعمل',
    title: 'اشترِ الألبوم. امتلكه للأبد.',
    body:
      'دفعة واحدة، ترخيص دائم، فاتورة ضريبية، وتحميل غير محدود. بلا اشتراك شهري تدفعه على لقطات لم تستخدمها.',
    tags: ['شراء لمرة واحدة', 'فاتورة ضريبية', 'تحميل فوري'],
  },
]

/**
 * Cloud wipes between scenes. `connectors[i]` joins scene i to scene i+1, and a
 * null simply crossfades — the engine tolerates gaps, so the page stays whole
 * while the renders come in one at a time.
 */
/**
 * The connectors — the film itself.
 *
 * `CONNECTORS[i]` is the flight from scene `i` into scene `i+1`, scrubbed by
 * scroll. They are cut from the single continuous 59s film: every transition
 * is a cloud wipe, so the joins are inside vapour and there is never a visible
 * cut between a connector and the scene it lands on.
 *
 * Encoded at a tight GOP (`-g 8`) because the engine scrubs `currentTime` — a
 * long GOP makes every seek decode a whole group, which is exactly what turns
 * a scrub into a stutter. `-m` variants are 720p for phones.
 *
 * Index 07 is deliberately null. There is no qasr-al-farid → empty-quarter
 * flight in the delivered film; the engine crossfades the two stills instead,
 * which is its documented behaviour for a missing connector and is why the
 * page never depended on the video landing in the first place.
 */
const conn = (index: string) => `/hero/vid/conn/conn-${index}.mp4`
const connMobile = (index: string) => `/hero/vid/conn/conn-${index}-m.mp4`

export const CONNECTORS: Array<string | null> = [
  conn('00'), // window-night     → pushed-through
  conn('01'), // pushed-through   → cloud-night
  conn('02'), // cloud-night      → riyadh
  conn('03'), // riyadh           → makkah
  conn('04'), // makkah           → cloud-dawn  (the 8-hour night→dawn shift)
  conn('05'), // cloud-dawn       → alula
  conn('06'), // alula            → qasr-al-farid
  null, //       qasr-al-farid    → empty-quarter  (no flight delivered)
  conn('08'), // empty-quarter    → edge-of-the-world
  conn('09'), // edge-of-the-world→ red-sea
  conn('10'), // red-sea          → jeddah
  conn('11'), // jeddah           → diriyah
  conn('12'), // diriyah          → finale
]

export const CONNECTORS_MOBILE: Array<string | null> = [
  connMobile('00'),
  connMobile('01'),
  connMobile('02'),
  connMobile('03'),
  connMobile('04'),
  connMobile('05'),
  connMobile('06'),
  null,
  connMobile('08'),
  connMobile('09'),
  connMobile('10'),
  connMobile('11'),
  connMobile('12'),
]
