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
    eyebrow: 'رحلة ليلية',
    title: 'لقطات سعودية، بجودة سينمائية.',
    body: 'أول مكتبة لقطات صُنعت في السعودية — للعرب. تشتري الألبوم مرة واحدة، وتملكه للأبد. بلا اشتراكات.',
    tags: ['4K و 6K', 'بلا اشتراك', 'مرخّصة تجارياً'],
  },
  {
    id: 'pushed-through',
    label: 'العبور',
    still: poster('01-pushed-through-NIGHT'),
    stillMobile: posterMobile('01-pushed-through-NIGHT'),
    accent: '#7f9ec0',
    eyebrow: 'خارج النافذة',
    title: 'الكاميرا تعبر الزجاج.',
    body: 'من مقعدك إلى السماء المفتوحة، دون قطع.',
  },
  {
    id: 'cloud-night',
    label: 'السحاب',
    still: poster('02-cloud-NIGHT'),
    stillMobile: posterMobile('02-cloud-NIGHT'),
    accent: '#6d86ad',
    eyebrow: 'فوق الغيوم',
    title: 'ليلٌ بلا حدود.',
    body: 'مشاهد جوية عالية الارتفاع، مصوّرة بحركة هادئة وواسعة.',
  },
  {
    id: 'riyadh',
    label: 'الرياض',
    still: poster('03-riyadh-NIGHT'),
    stillMobile: posterMobile('03-riyadh-NIGHT'),
    accent: '#c8a24a',
    scroll: 1.5,
    linger: 0.35,
    eyebrow: 'العاصمة',
    title: 'الرياض تتنفّس ضوءاً.',
    body: 'أفقٌ يتغيّر كل شهر — ألبومات محدّثة للمدينة التي لا تتوقف عن البناء.',
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
    eyebrow: 'قلب العالم الإسلامي',
    title: 'مكة المكرمة.',
    body: 'لقطات مصوّرة بتصاريح كاملة واحترام تام لخصوصية المكان.',
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
    eyebrow: 'تبدّل الوقت',
    title: 'الفجر ينكسر داخل الغيمة.',
    body: 'ثماني ساعات تمرّ في لقطة واحدة — دون أن يشعر المشاهد بالقطع.',
  },
  {
    id: 'alula',
    label: 'العُلا',
    still: poster('06-alula'),
    stillMobile: posterMobile('06-alula'),
    accent: '#e9c98a',
    eyebrow: 'تراثٌ يتنفّس',
    title: 'العُلا كما لم ترها.',
    body: 'ألبومات جوية وأرضية للحِجر والتكوينات الصخرية في الساعة الذهبية.',
    tags: ['جوي / درون', 'الساعة الذهبية'],
  },
  {
    id: 'qasr-al-farid',
    label: 'قصر الفريد',
    still: poster('07-qasr-al-farid'),
    stillMobile: posterMobile('07-qasr-al-farid'),
    accent: '#dcb884',
    eyebrow: 'الحِجر',
    title: 'قصر الفريد، وحيداً كما اسمه.',
    body: 'دورانٌ كامل حول المقبرة النبطية، بتصريح الهيئة الملكية للعُلا.',
    tags: ['تراث', 'بتصريح'],
  },
  {
    id: 'empty-quarter',
    label: 'الربع الخالي',
    still: poster('08-empty-quarter'),
    stillMobile: posterMobile('08-empty-quarter'),
    accent: '#f0d9a0',
    eyebrow: 'صمت الرمال',
    title: 'اتساعٌ لا ينتهي.',
    body: 'كثبانٌ ذهبية عند الفجر والغروب، بحركة كاميرا واسعة وهادئة.',
    tags: ['كثبان', 'فجر / غروب'],
  },
  {
    id: 'edge-of-the-world',
    label: 'حافة العالم',
    still: poster('09-edge-of-the-world'),
    stillMobile: posterMobile('09-edge-of-the-world'),
    accent: '#c9a678',
    eyebrow: 'جبل فِهْرَين',
    title: 'حيث ينتهي الجرف.',
    body: 'مشاهد جوية من حافة الهضبة — من أكثر المواقع طلباً في المملكة.',
  },
  {
    id: 'red-sea',
    label: 'البحر الأحمر',
    still: poster('10-red-sea'),
    stillMobile: posterMobile('10-red-sea'),
    accent: '#3fb6c4',
    eyebrow: 'ساحلٌ بلا حدود',
    title: 'البحر الأحمر بعدسةٍ عربية.',
    body: 'مياهٌ فيروزية وشعابٌ ومشاهد ساحلية جوية — جاهزة لأعمالك.',
    tags: ['جوي ساحلي', 'تحت الماء'],
  },
  {
    id: 'jeddah',
    label: 'جدة',
    still: poster('11-jeddah'),
    stillMobile: posterMobile('11-jeddah'),
    accent: '#d8b070',
    eyebrow: 'العروس',
    title: 'جدة، حيث يلتقي القديم بالبحر.',
    body: 'البلد التاريخية والواجهة البحرية، صباحاً.',
    tags: ['تراث', 'ساحل'],
  },
  {
    id: 'diriyah',
    label: 'الدرعية',
    still: poster('12-diriyah'),
    stillMobile: posterMobile('12-diriyah'),
    accent: '#c89b6a',
    eyebrow: 'حيث بدأت الحكاية',
    title: 'الدرعية والطين الذي صنع تاريخاً.',
    body: 'حي الطُّريف ومبانيه الطينية — تفاصيلٌ تراثية بدقة عالية.',
    tags: ['تراث', 'عمارة طينية'],
  },
  {
    id: 'finale',
    label: 'الوصول',
    still: poster('13-window-MORNING'),
    stillMobile: posterMobile('13-window-MORNING'),
    accent: '#c8a24a',
    scroll: 1.9,
    linger: 0.5,
    eyebrow: 'من اللقطة إلى العمل',
    title: 'اشترِ الألبوم. امتلكه للأبد.',
    body: 'كل ألبوم مجموعة لقطات متناسقة، جاهزة للمونتاج. ادفع مرة واحدة وحمّلها متى شئت.',
    tags: ['شراء لمرة واحدة', 'فاتورة ضريبية', 'تحميل فوري'],
  },
]

/**
 * Cloud wipes between scenes. `connectors[i]` joins scene i to scene i+1, and a
 * null simply crossfades — the engine tolerates gaps, so the page stays whole
 * while the renders come in one at a time.
 */
export const CONNECTORS: Array<string | null> = Array(SCENES.length - 1).fill(null)
