import type { Locale } from '@/lib/locale'

/**
 * The creator guide (`/studio/guide`, DEV-13) — the in-studio version of the
 * creator brief (docs/creators/creator-brief-ar.md, ALB-20).
 *
 * Every number that the code enforces is passed in, not written here: the clip
 * limits, the upload cap, the payout minimum and hold. A guide that says 20 GB
 * while the upload route refuses at 15 is worse than no guide.
 *
 * Text between backticks is a Latin run (720p, ProRes, a file name) and is
 * rendered isolated (`.ltr-island`), so it keeps its own direction inside
 * Arabic. Arabic is the source; English is for /en/studio.
 *
 * ⚠️ Mirrors the DRAFT brief — the owner has not approved ALB-20 yet. When the
 * brief changes, this changes with it.
 */

export type GuideVars = {
  minClips: number
  maxClips: number
  maxGb: number
  minPayout: number
  holdDays: number
  reviewDays: number
}

export type GuideSection = {
  id: string
  title: string
  intro?: string
  /** A pre-start checklist: each item is something to confirm. */
  checklist?: string[]
  /** Two-column spec rows. */
  rows?: Array<[string, string]>
  list?: string[]
  /** Numbered process steps. */
  steps?: string[]
  /** A monospace block (file naming). */
  code?: string
  note?: string
}

const n = (value: number, locale: Locale) => value.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB')

export function creatorGuide(locale: Locale, v: GuideVars): GuideSection[] {
  const min = n(v.minClips, locale)
  const max = n(v.maxClips, locale)
  if (locale === 'en') {
    return [
      {
        id: 'before-you-start',
        title: 'Before you start',
        intro: 'Confirm each of these before you upload the first clip. They are the reasons albums come back from review.',
        checklist: [
          'Your album subject is agreed with Laqta, so it does not repeat an album already in the catalogue.',
          `The album has ${min} to ${max} clips, all from one source (all AI-generated or all filmed) and all in one orientation.`,
          'Every clip shares one resolution, one frame rate and one colour look.',
          'Clips are 5 to 20 seconds long, with no audio.',
          'AI albums: your tool’s plan allows selling the output commercially as stock footage, and you keep a dated copy of its terms.',
          'Filmed albums: a model release for every clear face, and a property or filming permit wherever one is required.',
          'Files are named to the pattern below, and the quality log has one row per clip.',
          'Your payout method is set in Settings.',
        ],
      },
      {
        id: 'album',
        title: 'What an album is',
        list: [
          'One subject — one idea, place or activity, such as “Al-Balad in Jeddah at night” or “Coffee culture”.',
          `${min} to ${max} clips. The studio will not submit fewer or more.`,
          'One source: entirely AI-generated or entirely filmed. Never mix them, and never present generated clips as filmed.',
          'One orientation: all landscape `16:9`, or — in a dedicated vertical album — all vertical `9:16`.',
          'No filler: no near-identical clips to reach the count.',
        ],
      },
      {
        id: 'specs',
        title: 'Technical specifications',
        intro: 'Every clip must match the rest of its album. Mixed frame rates or colour are the most common reason an album is returned.',
        rows: [
          ['Resolution', '`720p`, `1080p` or `4K` — one per album, as produced. No artificial upscaling.'],
          ['Frame rate', 'One per album: `24`, `25` or `30` fps.'],
          ['Colour', 'One look per album. `Rec.709` for generated clips; filmed clips are `LOG` or `Rec.709`, not both. Keep the grade neutral.'],
          ['Length', '5 to 20 seconds per clip.'],
          ['Audio', 'None — mute or remove the track.'],
          ['File type', '`.mov` or `.mp4`'],
          ['Codec', '`H.264`, `H.265 (HEVC)` or `ProRes`'],
          ['File size', `Up to ${n(v.maxGb, locale)} GB per file.`],
          ['Quality', 'Sharp, stable and well exposed. No dropped frames, compression artefacts or flicker.'],
        ],
      },
      {
        id: 'accuracy',
        title: 'Saudi accuracy — what the reviewer checks',
        list: [
          'Dress: thobe, ghutra or shemagh and agal worn correctly; abaya and hijab in a Saudi style. Modest dress in every clip.',
          'Places: architecture, landscape and plants match the region named — Najdi mud brick is not Hijazi coral stone.',
          'Streets: traffic on the right, Saudi-format plates, road signs in Arabic and English.',
          'Text: any Arabic in the frame — signs, shopfronts, packaging — is correct and legible, or absent.',
        ],
      },
      {
        id: 'ai',
        title: 'Extra checks for AI-generated clips',
        list: [
          'People are fictional — no likeness of a real, famous or public person.',
          'Check every clip for AI errors: extra or fused fingers, melting faces, objects that morph, impossible motion, flickering backgrounds.',
          'Record the tool used for each clip in the quality log.',
        ],
      },
      {
        id: 'filmed',
        title: 'Extra requirements for filmed clips',
        list: [
          'A model release for every clear face, uploaded in Releases.',
          'A property release for private or commercial premises.',
          'A filming permit where the site requires one — AlUla, Diriyah, NEOM, the Red Sea, airports — covering your dates and location, naming the issuing authority.',
        ],
      },
      {
        id: 'not-accepted',
        title: 'What we do not accept',
        list: [
          'The Two Holy Mosques (Makkah and Madinah), filmed or generated.',
          'Military, government, border or security sites.',
          'Alcohol, gambling and anything prohibited in the Kingdom.',
          'Religious places or rites shown inappropriately; religious or national symbols in a demeaning commercial context.',
          'Anything that could read as political or security-related.',
          'Prominent brand logos, or a known product as the subject. A small, unclear background logo is fine.',
          'Protected artworks that need permission; material you do not fully own, or taken from someone else’s production.',
          'A clip already on Laqta, or a rejected album uploaded again.',
        ],
      },
      {
        id: 'naming',
        title: 'File naming',
        code: '<album-short-name>_<number>_<what-it-shows>.mov\njeddah-balad-night_001_lantern-alley-wide.mov\njeddah-balad-night_002_coffee-pour-closeup.mov',
        note: 'Lowercase English letters, hyphens instead of spaces, a three-digit number.',
      },
      {
        id: 'qa-log',
        title: 'The quality log',
        intro: 'Fill one row per clip and send it with your album. It lets the reviewer check the album once instead of coming back with questions.',
        rows: [
          ['`file_name`', 'The file name exactly as uploaded.'],
          ['`origin`', '`ai` or `filmed`.'],
          ['`tool_or_camera`', 'For example `Seedance 2.0`, `Kling` or `Sony FX3`.'],
          ['`location_shown`', 'The city or site the clip shows.'],
          ['`resolution`, `fps`, `codec`', 'For example `3840x2160`, `25`, `ProRes 422 HQ`.'],
          ['`duration_s`', 'Clip length in seconds.'],
          ['`people`', '`none`, `fictional (ai)`, `unidentifiable` or `identifiable`.'],
          ['`release_or_permit`', 'The release or permit number, or `not needed`.'],
          ['`on_screen_text`', '`none`, or what it says.'],
          ['`self_check`', '`pass`, or the fault you found.'],
        ],
      },
      {
        id: 'process',
        title: 'How it works',
        steps: [
          'Agree your subject with Laqta.',
          `Create the album in the studio and upload ${min} to ${max} clips with their releases.`,
          'Fill in the album details; the price calculator suggests a price from the clip count, resolution, type and quality.',
          `Submit for review. The reviewer answers within ${n(v.reviewDays, locale)} business days: approved, or back to you with reasons.`,
          'Laqta approves your price or proposes another; your album is never published at a price you have not accepted.',
          `Once live, you earn your share of every sale (shown in Settings). Each sale becomes available after ${n(v.holdDays, locale)} days; withdraw from ${n(v.minPayout, locale)} USD.`,
        ],
      },
    ]
  }

  return [
    {
      id: 'before-you-start',
      title: 'قبل أن تبدأ',
      intro: 'تأكّد من كل بند هنا قبل رفع أول لقطة، فهذه هي الأسباب التي تُعاد بها الألبومات من المراجعة.',
      checklist: [
        'اتفقت مع لقطة على موضوع الألبوم، حتى لا يكرّر ألبوماً موجوداً في الكتالوج.',
        `في الألبوم من ${min} إلى ${max} لقطة، كلها من مصدر واحد (كلها مولّدة بالذكاء الاصطناعي أو كلها مصوّرة) وباتجاه واحد.`,
        'اللقطات كلها بدقة واحدة ومعدل إطارات واحد ومظهر لوني واحد.',
        'طول كل لقطة من ٥ إلى ٢٠ ثانية، وبلا صوت.',
        'في الألبوم المولّد: خطة أداتك تسمح ببيع مخرجاتها تجارياً كلقطات مخزون، وتحتفظ بنسخة مؤرّخة من شروطها.',
        'في الألبوم المصوّر: تصريح نموذج لكل وجه واضح، وتصريح ملكية أو تصوير حيث يلزم.',
        'أسماء الملفات على النمط الموضّح أدناه، وسجل الجودة فيه سطر لكل لقطة.',
        'طريقة استلام الأرباح محدّدة في الإعدادات.',
      ],
    },
    {
      id: 'album',
      title: 'ما هو الألبوم',
      list: [
        'موضوع واحد: فكرة أو مكان أو نشاط واحد، مثل «البلد في جدة ليلاً» أو «ثقافة القهوة».',
        `من ${min} إلى ${max} لقطة، ولا يقبل الاستوديو الإرسال بأقل أو أكثر.`,
        'مصدر واحد: الألبوم كله مولّد بالذكاء الاصطناعي أو كله مصوّر. لا تخلط بينهما، ولا تعرض لقطات مولّدة على أنها مصوّرة.',
        'اتجاه واحد: كله أفقي `16:9`، أو كله عمودي `9:16` في ألبوم عمودي مخصّص.',
        'بلا حشو: لا لقطات شبه متطابقة لإكمال العدد.',
      ],
    },
    {
      id: 'specs',
      title: 'المواصفات التقنية',
      intro: 'كل لقطة يجب أن تطابق بقية لقطات ألبومها. اختلاف معدل الإطارات أو اللون هو أكثر سبب تُعاد به الألبومات.',
      rows: [
        ['الدقة', '`720p` أو `1080p` أو `4K`، دقة واحدة لكل ألبوم كما أُنتجت فعلاً. لا تكبير صناعي.'],
        ['معدل الإطارات', 'معدل واحد لكل ألبوم: `24` أو `25` أو `30` إطاراً في الثانية.'],
        ['اللون', 'مظهر لوني واحد لكل ألبوم. `Rec.709` للقطات المولّدة، واللقطات المصوّرة `LOG` أو `Rec.709` لا الاثنان معاً. اجعل التلوين محايداً.'],
        ['الطول', 'من ٥ إلى ٢٠ ثانية للقطة.'],
        ['الصوت', 'بلا صوت: اكتم المسار أو احذفه.'],
        ['نوع الملف', '`.mov` أو `.mp4`'],
        ['الترميز', '`H.264` أو `H.265 (HEVC)` أو `ProRes`'],
        ['حجم الملف', `حتى ${n(v.maxGb, locale)} جيجابايت للملف.`],
        ['الجودة', 'واضحة وثابتة وإضاءتها سليمة، بلا إطارات ساقطة ولا تشوّه ضغط ولا وميض.'],
      ],
    },
    {
      id: 'accuracy',
      title: 'الدقة السعودية: ما يراجعه المراجِع',
      list: [
        'اللباس: الثوب والغترة أو الشماغ والعقال بلبسة صحيحة، والعباءة والحجاب بأسلوب سعودي، ولباس محتشم في كل اللقطات.',
        'الأماكن: العمارة والطبيعة والنباتات تطابق المنطقة المذكورة؛ الطين النجدي غير الحجر المنقبي الحجازي.',
        'الشوارع: السير على اليمين، ولوحات سيارات بالشكل السعودي، ولوحات طرق بالعربية والإنجليزية.',
        'النصوص: أي كتابة عربية في اللقطة، من لوحات أو واجهات أو تغليف، صحيحة ومقروءة أو غير موجودة أصلاً.',
      ],
    },
    {
      id: 'ai',
      title: 'فحوص إضافية للقطات المولّدة',
      list: [
        'الأشخاص خياليون: لا شبه لشخص حقيقي أو مشهور أو شخصية عامة.',
        'افحص كل لقطة من أخطاء الذكاء الاصطناعي: أصابع زائدة أو ملتصقة، ووجوه تذوب، وأشياء تتحوّل، وحركة مستحيلة، وخلفيات ترمش.',
        'سجّل الأداة المستخدمة لكل لقطة في سجل الجودة.',
      ],
    },
    {
      id: 'filmed',
      title: 'متطلبات إضافية للقطات المصوّرة',
      list: [
        'تصريح نموذج لكل وجه واضح، ترفعه من صفحة التصاريح.',
        'تصريح ملكية للأماكن الخاصة أو التجارية.',
        'تصريح تصوير حيث يشترطه الموقع (العلا، والدرعية، ونيوم، والبحر الأحمر، والمطارات)، يغطي تواريخ التصوير والموقع ويذكر الجهة المصدِرة.',
      ],
    },
    {
      id: 'not-accepted',
      title: 'ما لا نقبله',
      list: [
        'الحرمان الشريفان في مكة والمدينة، تصويراً أو توليداً.',
        'المنشآت العسكرية أو الحكومية أو الحدودية أو الأمنية.',
        'الكحول والقمار وكل ما يمنعه نظام المملكة.',
        'الأماكن والشعائر الدينية بشكل غير لائق، والرموز الدينية أو الوطنية في سياق تجاري يسيء إليها.',
        'كل ما قد يُفهم سياسياً أو أمنياً.',
        'الشعارات التجارية البارزة، أو منتج معروف موضوعاً للقطة. الشعار الصغير غير الواضح في الخلفية مقبول.',
        'الأعمال الفنية المحمية التي تحتاج إذناً، والمواد التي لا تملك حقوقها كاملة أو المأخوذة من إنتاج غيرك.',
        'لقطة موجودة أصلاً في لقطة، أو إعادة رفع لألبوم مرفوض.',
      ],
    },
    {
      id: 'naming',
      title: 'تسمية الملفات',
      code: '<album-short-name>_<number>_<what-it-shows>.mov\njeddah-balad-night_001_lantern-alley-wide.mov\njeddah-balad-night_002_coffee-pour-closeup.mov',
      note: 'حروف إنجليزية صغيرة، وشرطة بدل المسافة، ورقم من ثلاث خانات.',
    },
    {
      id: 'qa-log',
      title: 'سجل الجودة',
      intro: 'املأ سطراً لكل لقطة وأرسله مع ألبومك، ليراجع المراجِع الألبوم مرة واحدة بدل أن يعود إليك بأسئلة.',
      rows: [
        ['`file_name`', 'اسم الملف كما رفعته بالضبط.'],
        ['`origin`', '`ai` للمولّد أو `filmed` للمصوّر.'],
        ['`tool_or_camera`', 'مثل `Seedance 2.0` أو `Kling` أو `Sony FX3`.'],
        ['`location_shown`', 'المدينة أو الموقع الذي تعرضه اللقطة.'],
        ['`resolution` · `fps` · `codec`', 'مثل `3840x2160` و`25` و`ProRes 422 HQ`.'],
        ['`duration_s`', 'طول اللقطة بالثواني.'],
        ['`people`', '`none` أو `fictional (ai)` أو `unidentifiable` أو `identifiable`.'],
        ['`release_or_permit`', 'رقم التصريح، أو `not needed`.'],
        ['`on_screen_text`', '`none`، أو النص المكتوب.'],
        ['`self_check`', '`pass`، أو الخطأ الذي وجدته.'],
      ],
    },
    {
      id: 'process',
      title: 'كيف تسير الأمور',
      steps: [
        'اتفق مع لقطة على موضوع ألبومك.',
        `أنشئ الألبوم في الاستوديو وارفع من ${min} إلى ${max} لقطة مع تصاريحها.`,
        'املأ تفاصيل الألبوم، وتقترح الحاسبة سعراً من عدد اللقطات والدقة والنوع والجودة.',
        `أرسل الألبوم للمراجعة. يردّ المراجِع خلال ${n(v.reviewDays, locale)} أيام عمل: اعتماد، أو إعادة إليك مع الأسباب.`,
        'تعتمد لقطة سعرك أو تقترح سعراً آخر، ولا يُنشر ألبومك بسعر لم توافق عليه.',
        `بعد النشر تأخذ حصّتك من كل عملية بيع (تظهر في الإعدادات). تصبح أرباح كل عملية متاحة بعد ${n(v.holdDays, locale)} يوماً، ويمكنك السحب من ${n(v.minPayout, locale)} دولار.`,
      ],
    },
  ]
}
