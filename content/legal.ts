import type { DocumentSection } from '@/components/layout/document-page'

/**
 * Policy documents.
 *
 * Kept as structured content in one module rather than scattered through the
 * dictionary: these are long-form legal prose, they are reviewed as whole
 * documents, and whoever reviews them next is a lawyer rather than a developer.
 *
 * Each section carries both languages. The Arabic is the original and the
 * operative text; the English is a convenience translation for buyers who do
 * not read Arabic. Where the two ever diverge, the Arabic governs — which is
 * also what the governing-law section says, and why the English must never be
 * edited on its own.
 *
 * ⚠️ NEITHER LANGUAGE HAS BEEN REVIEWED BY COUNSEL. These are drafted to
 * describe how the product ACTUALLY behaves — the
 * 30-day payout hold, the frozen commission, entitlement served from the order
 * snapshot, the review checklist — so they are accurate rather than generic.
 * They still need review by Saudi counsel before launch; nothing here is legal
 * advice and the ZATCA/PDPL references in particular should be confirmed
 * against current regulation.
 */

export const EFFECTIVE_FROM = new Date('2026-08-01T00:00:00Z')

export const TERMS: DocumentSection[] = [
  {
    heading: 'من نحن وما الذي تشتريه',
    headingEn: 'Who we are and what you are buying',
    bodyEn: [
      'Laqta is a digital marketplace for footage of the Kingdom of Saudi Arabia. The platform connects creators with buyers and claims no ownership of the material listed: the rights to every clip remain with its creator, and what you buy is a licence of defined scope, not ownership of the material itself.',
      'The unit of sale is the album, not the individual clip. When a purchase completes, the list of clips included in your order is fixed exactly as it stood at the moment of payment, and stays yours to download with no time limit \u2014 even if the creator later edits the album or removes it from the catalogue.',
    ],
    body: [
      'لقطة سوق رقمي للقطات من داخل المملكة العربية السعودية. المنصّة تصل بين صنّاع المحتوى وبين المشترين، ولا تدّعي ملكية المواد المعروضة: تظل حقوق كل لقطة لصانعها، وما تشتريه أنت هو ترخيص استخدام محدّد النطاق، لا ملكية المادة نفسها.',
      'الوحدة المعروضة للبيع هي الألبوم، لا اللقطة المفردة. عند إتمام الشراء تُثبَّت قائمة اللقطات المشمولة في طلبك كما هي لحظة الدفع، وتبقى ملكك للتحميل بلا حد زمني حتى لو عدّل الصانع الألبوم أو أزاله من الكتالوج لاحقاً.',
    ],
  },
  {
    heading: 'الحساب',
    headingEn: 'Your account',
    bodyEn: [
      'You are responsible for the accuracy of your account details and for keeping your means of access to it confidential. Creator and administrator accounts are required to have two-factor authentication enabled.',
      'We may suspend an account that breaches these terms or uses the platform for an unlawful purpose, and will tell you why. Suspending an account does not cancel licences you have already bought and paid for.',
    ],
    body: [
      'أنت مسؤول عن صحة بيانات حسابك وعن سرّية وسائل الدخول إليه. حسابات صنّاع المحتوى وحسابات الإدارة ملزمة بتفعيل التحقق بخطوتين.',
      'يجوز لنا إيقاف حساب يخالف هذه الشروط أو يستخدم المنصّة لغرض غير مشروع، مع إشعارك بالسبب. إيقاف الحساب لا يلغي التراخيص التي اشتريتها ودفعت قيمتها.',
    ],
  },
  {
    heading: 'الأسعار والدفع والفاتورة',
    headingEn: 'Prices, payment and invoicing',
    bodyEn: [
      'Prices are shown in US dollars per album. An electronic invoice is issued for every purchase, and VAT is added for buyers inside the Kingdom as the regulations require.',
      "The platform's share of each sale is calculated at the rate in force at the moment of purchase, and that rate is frozen against the order. Any later change to the creator's tier or to the commission policy does not apply retroactively to an earlier order.",
    ],
    body: [
      'الأسعار معروضة بالدولار الأمريكي لكل ألبوم. تصدر لك فاتورة إلكترونية عن كل عملية شراء، وتُضاف ضريبة القيمة المضافة للمشترين داخل المملكة وفق النظام.',
      'يُحتسب نصيب المنصّة من كل عملية بيع بالنسبة السارية لحظة الشراء، وتُجمَّد تلك النسبة على الطلب. أي تغيير لاحق في شريحة الصانع أو في سياسة العمولة لا يسري بأثر رجعي على طلب سابق.',
    ],
  },
  {
    heading: 'ما لا يشمله الترخيص',
    headingEn: 'What the licence does not cover',
    bodyEn: [
      'The licence gives you no right to resell the clip as it is, to make it available in another footage library, or to use it in a way that reflects badly on a person appearing in it, or on a place or a religious or national symbol.',
      'See the licences page for a breakdown of what the standard licence covers and what requires an extended one.',
    ],
    body: [
      'لا يمنحك الترخيص حقاً في إعادة بيع اللقطة كما هي، أو إتاحتها في مكتبة لقطات أخرى، أو استخدامها بما يسيء إلى شخص ظاهر فيها أو إلى مكان أو رمز ديني أو وطني.',
      'راجع صفحة التراخيص لتفصيل ما يشمله الترخيص القياسي وما يتطلب ترخيصاً موسّعاً.',
    ],
  },
  {
    heading: 'مسؤولية صانع المحتوى',
    headingEn: "The creator's responsibility",
    bodyEn: [
      'The creator confirms that they own the material uploaded, or hold the full right to license it, and that they have obtained the necessary clearances: a model release for every person whose face is clearly identifiable, and a location or filming permit wherever the owning authority requires one.',
      'Clips showing identifiable faces without a model release cannot be submitted for review at all \u2014 the platform blocks it at submission \u2014 but a technical block does not move the responsibility off the creator.',
    ],
    body: [
      'يقرّ الصانع بأنه يملك المادة المرفوعة أو يملك الحق الكامل في ترخيصها، وأنه حصل على التصاريح اللازمة: تصريح نموذج لكل شخص يظهر وجهه بوضوح، وتصريح موقع أو تصريح تصوير حيثما تطلبت الجهة المالكة ذلك.',
      'اللقطات التي تظهر فيها وجوه واضحة بلا تصريح نموذج لا يمكن إرسالها للمراجعة أصلاً — المنصّة تمنع ذلك عند الإرسال، لكن المنع التقني لا ينقل المسؤولية عن الصانع.',
    ],
  },
  {
    heading: 'حدود مسؤولية المنصّة',
    headingEn: "Limits of the platform's liability",
    bodyEn: [
      'We take reasonable care in reviewing every album before it is published, but that review is no substitute for your own judgement about whether a clip suits your particular use. Our liability in every case is limited to the amount actually paid for the order in dispute.',
      'We do not guarantee that any given clip stays available in the catalogue, because a creator may withdraw their album. That does not affect anything you bought before the withdrawal.',
    ],
    body: [
      'نبذل عناية معقولة في مراجعة كل ألبوم قبل نشره، لكن المراجعة لا تُغني عن تقديرك لملاءمة اللقطة لاستخدامك المحدّد. مسؤوليتنا في كل الأحوال لا تتجاوز المبلغ المدفوع فعلياً عن الطلب محل النزاع.',
      'لا نضمن استمرار توفّر لقطة بعينها في الكتالوج، لأن الصانع قد يوقف ألبومه. هذا لا يمسّ ما اشتريته قبل الإيقاف.',
    ],
  },
  {
    heading: 'النظام الواجب التطبيق',
    headingEn: 'Governing law',
    bodyEn: [
      'These terms are governed by the laws of the Kingdom of Saudi Arabia, and the Saudi courts have jurisdiction over any dispute arising from them.',
    ],
    body: [
      'تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص الجهات القضائية السعودية بالنظر في أي نزاع ينشأ عنها.',
    ],
  },
]

export const PRIVACY: DocumentSection[] = [
  {
    heading: 'ما الذي نجمعه',
    headingEn: 'What we collect',
    bodyEn: ['We collect what the service genuinely needs, and no more:'],
    listEn: [
      'Account details: your name, email address, and mobile number if you choose to sign in with it.',
      'Billing details: legal name, VAT number and address \u2014 the details a tax invoice requires.',
      'Your order and download history, because it is what proves your right to the material you bought.',
      'Searches made on the site. These improve results, and show us what buyers are looking for that we do not have.',
      'Basic technical session data, for security and to prevent abuse.',
    ],
    body: ['نجمع الحد الذي تحتاجه الخدمة فعلاً، لا أكثر:'],
    list: [
      'بيانات الحساب: الاسم، البريد الإلكتروني، رقم الجوال إن اخترت الدخول به.',
      'بيانات الفوترة: الاسم النظامي والرقم الضريبي والعنوان، وهي بيانات تفرضها الفاتورة الضريبية.',
      'سجل الطلبات والتحميلات، لأنه ما يثبت حقك في المادة التي اشتريتها.',
      'عمليات البحث داخل الموقع. تُستخدم لتحسين النتائج، ولمعرفة ما يبحث عنه المشترون ولا نملكه.',
      'بيانات تقنية أساسية عن الجلسة لأغراض الأمان ومنع إساءة الاستخدام.',
    ],
  },
  {
    heading: 'ما الذي لا نجمعه',
    headingEn: 'What we do not collect',
    bodyEn: [
      'We do not store your card details. Payment goes through the payment provider, and all that reaches us is a transaction reference.',
      'We do not sell your personal data to anyone, and we do not use it for advertising off the platform.',
    ],
    body: [
      'لا نخزّن بيانات بطاقتك. تمرّ عملية الدفع عبر مزوّد خدمة الدفع ولا يصلنا منها سوى مرجع العملية.',
      'لا نبيع بياناتك الشخصية لأي طرف، ولا نستخدمها في إعلانات خارج المنصّة.',
    ],
  },
  {
    heading: 'من يطّلع على بياناتك',
    headingEn: 'Who sees your data',
    bodyEn: [
      'Our support team sees your data only when they need it to help you. Any administrative access to a user account is logged with its reason, and can be reviewed afterwards.',
      'A creator sees their own sales figures. They do not see your identity as a buyer.',
    ],
    body: [
      'يطّلع فريق الدعم على بياناتك عند الحاجة لخدمتك فقط. أي دخول إداري إلى حساب مستخدم يُسجَّل مع سببه، ويمكن مراجعته لاحقاً.',
      'يرى صانع المحتوى أرقام مبيعاته، ولا يرى هويتك كمشترٍ.',
    ],
  },
  {
    heading: 'مدة الحفظ',
    headingEn: 'How long we keep it',
    bodyEn: [
      'We keep billing data for the period the tax regulations require. We keep your order history for as long as your account exists, because it is the basis of your permanent right to download.',
    ],
    body: [
      'نحتفظ ببيانات الفوترة للمدة التي تفرضها الأنظمة الضريبية. نحتفظ بسجل الطلبات ما دام حسابك قائماً، لأنه أساس حقك الدائم في التحميل.',
    ],
  },
  {
    heading: 'حقوقك',
    headingEn: 'Your rights',
    bodyEn: [
      'You have the right to see your data, correct it, and ask for it to be deleted, within what the Saudi personal data protection regulations allow. Deletion does not extend to what we are legally required to keep, such as invoices.',
      'To make any of these requests, get in touch through the contact page.',
    ],
    body: [
      'لك حق الاطلاع على بياناتك وتصحيحها وطلب حذفها، ضمن ما تسمح به الأنظمة السعودية لحماية البيانات الشخصية. الحذف لا يشمل ما يلزمنا الاحتفاظ به نظاماً كالفواتير.',
      'للتقدّم بأي من هذه الطلبات تواصل معنا عبر صفحة التواصل.',
    ],
  },
]

export const LICENCES: DocumentSection[] = [
  {
    heading: 'ترخيص واحد يُشترى مرة واحدة',
    headingEn: 'One licence, bought once',
    bodyEn: [
      'There is no subscription and no monthly allowance that expires. You buy the album once, keep the right to use its clips with no time limit, and it stays downloadable from your library.',
    ],
    body: [
      'لا يوجد اشتراك ولا رصيد شهري ينتهي. تشتري الألبوم مرة واحدة، وتحتفظ بحق استخدام لقطاته بلا حد زمني، وتبقى قابلة للتحميل من مكتبتك.',
    ],
  },
  {
    heading: 'الترخيص القياسي',
    headingEn: 'The standard licence',
    bodyEn: ['Covers ordinary commercial use:'],
    listEn: [
      'Digital advertising, social platforms, websites and internal presentations.',
      'Television, cinema and paid content, up to five hundred thousand views per channel.',
      'Use within a single client project; the licence is attributed to the party that paid for it.',
    ],
    body: ['يغطي الاستخدام التجاري المعتاد:'],
    list: [
      'الإعلانات الرقمية، ومنصّات التواصل، ومواقع الويب، والعروض الداخلية.',
      'الأعمال التلفزيونية والسينمائية والمحتوى المدفوع، بحد أقصى خمسمئة ألف مشاهدة لكل منفذ عرض.',
      'الاستخدام داخل مشروع عميل واحد، ويُنسب الترخيص للجهة التي دفعت قيمته.',
    ],
  },
  {
    heading: 'الترخيص الموسّع',
    headingEn: 'The extended licence',
    bodyEn: ['Costs three times the standard price, and lifts the limits:'],
    listEn: [
      'Unlimited views across every channel.',
      'Products made for resale: templates, digital product backgrounds and commercial displays.',
      'Use across more than one client project.',
    ],
    body: ['يُشترى بثلاثة أضعاف السعر القياسي، ويرفع القيود:'],
    list: [
      'مشاهدات غير محدودة على كل المنافذ.',
      'المنتجات المعدّة لإعادة البيع: القوالب، وخلفيات المنتجات الرقمية، والشاشات التجارية.',
      'الاستخدام في أكثر من مشروع عميل.',
    ],
  },
  {
    heading: 'ما يمنعه الترخيصان معاً',
    headingEn: 'What both licences prohibit',
    bodyEn: [],
    listEn: [
      'Reselling the clip as it is, or listing it in another footage library.',
      'Any use that reflects badly on a person appearing in the clip, or implies their endorsement of a product or opinion.',
      'Any use that touches religious or national symbols, or holy places.',
      'Using a clip marked \u201ceditorial use only\u201d in a commercial context.',
    ],
    body: [],
    list: [
      'إعادة بيع اللقطة كما هي أو إدراجها في مكتبة لقطات أخرى.',
      'الاستخدام الذي يسيء إلى شخص ظاهر في اللقطة أو يوحي بتأييده لمنتج أو رأي.',
      'الاستخدام الذي يمسّ الرموز الدينية أو الوطنية أو الأماكن المقدّسة.',
      'استخدام لقطة موسومة "للاستخدام التحريري فقط" في سياق تجاري.',
    ],
  },
  {
    heading: 'التحريري مقابل التجاري',
    headingEn: 'Editorial versus commercial',
    bodyEn: [
      'An album marked \u201ccleared for commercial use\u201d has complete clearance: model, location and filming permits are all documented. \u201cEditorial use only\u201d means some clearance is missing, and use is limited to news and documentary contexts, without promoting a product or service.',
    ],
    body: [
      'الألبوم الموسوم "مرخّص للاستخدام التجاري" اكتملت تصاريحه: تصاريح النماذج والمواقع والتصوير كلها موثّقة. أما "للاستخدام التحريري فقط" فيعني أن تصريحاً ما ناقص، ويقتصر استخدامه على السياق الإخباري والتوثيقي دون الترويج لمنتج أو خدمة.',
    ],
  },
  {
    heading: 'شهادة الترخيص',
    headingEn: 'The licence certificate',
    bodyEn: [
      'Every purchase issues a licence certificate carrying a number, the list of clips covered, and the text of the licence as it stood at the moment of purchase. Changing the licence text later does not change what you bought: the certificate preserves the text as it was.',
    ],
    body: [
      'تصدر مع كل عملية شراء شهادة ترخيص تحمل رقماً وقائمة اللقطات المشمولة ونص الترخيص الساري لحظة الشراء. تعديل نص الترخيص لاحقاً لا يغيّر ما اشتريته: الشهادة تحفظ النص كما كان.',
    ],
  },
]

export const CONTENT_POLICY: DocumentSection[] = [
  {
    heading: 'ما الذي نقبله',
    headingEn: 'What we accept',
    bodyEn: [
      'Footage from inside the Kingdom, at 1080p or 4K, in coherent albums of no fewer than eight clips. Coherence is a requirement, not a preference: mixing frame rates or colour profiles within one album is the single largest cause of refund requests, because the editor ends up with material that will not cut together on one timeline.',
    ],
    body: [
      'لقطات من داخل المملكة، بدقة 1080p أو 4K، ضمن ألبومات متناسقة لا تقل عن ثماني لقطات. التناسق شرط لا شكل: خلط معدلات الإطارات أو ملفات الألوان داخل ألبوم واحد هو السبب الأول لطلبات الاسترجاع، لأن المونتير يجد نفسه أمام مواد لا تُركّب على تايم لاين واحد.',
    ],
  },
  {
    heading: 'التصاريح شرط للنشر',
    headingEn: 'Clearance is a condition of publication',
    bodyEn: [
      'No album is published with an identifiable face in it and no model release. Nor is a clip published that was filmed at a location requiring a filming permit \u2014 AlUla, Diriyah, NEOM, the Red Sea and the like \u2014 without the permit and its reference number attached.',
      "The permit is checked by the platform team before publication; the creator's own declaration is not enough on its own.",
    ],
    body: [
      'لا يُنشر ألبوم فيه وجه واضح بلا تصريح نموذج. ولا تُنشر لقطة صُوّرت في موقع يشترط تصريح تصوير — العلا، والدرعية، ونيوم، والبحر الأحمر، وما يماثلها — دون إرفاق التصريح ورقمه المرجعي.',
      'التصريح يُراجَع من فريق المنصّة قبل النشر، ولا يكفي إقرار الصانع وحده.',
    ],
  },
  {
    heading: 'الملاءمة الثقافية',
    headingEn: 'Cultural fit',
    bodyEn: [
      "We review every album for how well it fits the Saudi context: respect for holy places, no use of religious or national symbols in an unbecoming commercial context, and respect for people's privacy in public places.",
      'This check is mandatory and cannot be skipped in review, because it is a direct source of liability for the platform and the buyer alike.',
    ],
    body: [
      'نراجع كل ألبوم من زاوية ملاءمته للسياق السعودي: احترام الأماكن المقدّسة، وعدم استخدام الرموز الدينية أو الوطنية في سياق تجاري غير لائق، واحترام خصوصية الأشخاص في الأماكن العامة.',
      'هذا فحص إلزامي لا يجوز تجاوزه في المراجعة، لأنه مصدر مسؤولية مباشرة على المنصّة وعلى المشتري معاً.',
    ],
  },
  {
    heading: 'التكرار والمحتوى المنقول',
    headingEn: 'Duplication and lifted material',
    bodyEn: [
      'We compare the visual fingerprint of every new clip against the existing catalogue. A match is not an automatic rejection \u2014 a creator may be relisting their own material in a new album \u2014 but it goes to a human reviewer before any decision.',
    ],
    body: [
      'نقارن البصمة البصرية لكل لقطة جديدة بالكتالوج القائم. التطابق لا يعني الرفض تلقائياً — قد يعيد الصانع إدراج مادته الخاصة في ألبوم جديد — لكنه يُعرض على مراجع بشري قبل أي قرار.',
    ],
  },
  {
    heading: 'ما لا نقبله',
    headingEn: 'What we do not accept',
    bodyEn: [],
    listEn: [
      'Material whose uploader does not hold the full rights to it.',
      'AI-generated footage presented as if it were filmed.',
      'Content that breaches the laws of the Kingdom or reflects badly on individuals or bodies.',
      "Footage taken from someone else's commercial production without their permission.",
    ],
    body: [],
    list: [
      'مادة لا يملك رافعها حقوقها كاملة.',
      'لقطات مولّدة بالذكاء الاصطناعي معروضة على أنها تصوير حقيقي.',
      'محتوى يخالف أنظمة المملكة أو يسيء لأفراد أو جهات.',
      'لقطات مأخوذة من إنتاج تجاري لجهة أخرى دون إذنها.',
    ],
  },
  {
    heading: 'العلامة المائية والمعاينة',
    headingEn: 'Watermarking and previews',
    bodyEn: [
      'Every clip uploaded to Laqta is shown publicly with an automatic watermark \u2014 on every thumbnail, every preview and every player, without exception and without any extra step from the creator. A preview establishes what the clip is without handing over a usable copy.',
      "The original file, at full resolution and without a watermark, is delivered only to the buyer once payment completes. This protects the creator's rights and makes previews safe to show anywhere.",
    ],
    body: [
      'كل لقطة تُرفع إلى لقطة تُعرض للجمهور بعلامة مائية تلقائياً — تظهر على كل مصغّرة وكل معاينة وكل مشغّل، دون استثناء ودون خطوة إضافية من الصانع. المعاينة تثبت اللقطة دون أن تسلّم نسخة صالحة للاستخدام.',
      'الملف الأصلي بالدقة الكاملة وبلا علامة مائية لا يُسلَّم إلا للمشتري بعد إتمام الدفع. هذا يحمي حق الصانع ويجعل المعاينة آمنة للعرض في كل مكان.',
    ],
  },
  {
    heading: 'البلاغات والإزالة',
    headingEn: 'Reports and takedowns',
    bodyEn: [
      'Any rights holder may file a report. We disable the reported content as soon as we have made a serious initial assessment, then give the creator a chance to respond. Disabling is reversible by nature, which is why we do it quickly rather than waiting.',
    ],
    body: [
      'لأي صاحب حق أن يتقدّم ببلاغ. نعطّل المحتوى محل البلاغ فور تقييمه تقييماً أولياً جادّاً، ثم نمنح الصانع فرصة الرد. التعطيل إجراء قابل للتراجع بطبيعته، ولهذا نلجأ إليه سريعاً بدل الانتظار.',
    ],
  },
]

export const REFUNDS: DocumentSection[] = [
  {
    heading: 'المبدأ',
    headingEn: 'The principle',
    bodyEn: [
      'The product is digital and delivered the moment you pay, so there is no refund for a simple change of mind. A refund is due when you did not get what you paid for.',
    ],
    body: [
      'المنتج رقمي ويُسلَّم فور الدفع، لذا لا يوجد استرجاع لمجرّد تغيير الرأي. الاسترجاع مستحق حين لا تحصل على ما دفعت مقابله.',
    ],
  },
  {
    heading: 'متى نسترجع',
    headingEn: 'When we refund',
    bodyEn: [],
    listEn: [
      'A technical fault in the file: corruption, or specifications differing from what the album page stated.',
      'A licence mismatch: the album turns out not to cover the use stated on its page.',
      'A duplicate purchase of the same album on the same licence within fourteen days.',
      'Content disabled after purchase as the result of an upheld rights report.',
    ],
    body: [],
    list: [
      'خلل تقني في الملف: تلف، أو اختلاف المواصفات عمّا هو معلن في صفحة الألبوم.',
      'عدم مطابقة الترخيص: تبيّن أن الألبوم لا يغطي الاستخدام المعلن في صفحته.',
      'شراء مكرّر لنفس الألبوم بنفس الترخيص خلال أربع عشرة يوماً.',
      'تعطيل المحتوى بعد الشراء نتيجة بلاغ حقوق ثبتت صحته.',
    ],
  },
  {
    heading: 'المدة',
    headingEn: 'The window',
    bodyEn: [
      'A request is made within fourteen days of the purchase date. Requests based on a rights report are not subject to that window, because their cause arises late by nature.',
    ],
    body: [
      'يُقدَّم الطلب خلال أربعة عشر يوماً من تاريخ الشراء. الطلبات المبنية على بلاغ حقوق لا تخضع لهذه المدة، لأن سببها ينشأ متأخراً بطبيعته.',
    ],
  },
  {
    heading: 'كيف يعمل الاسترجاع',
    headingEn: 'How a refund works',
    bodyEn: [
      'The amount is returned to the same payment method within the period the provider sets. Your right to download the refunded material ends the moment a full refund is processed.',
      "The creator's share is reversed at the rate frozen against the order at the moment of purchase, not at their current rate. This is what guarantees a creator's statement returns to exactly zero on a full refund.",
    ],
    body: [
      'يُعاد المبلغ إلى وسيلة الدفع نفسها خلال المدة التي يحدّدها مزوّد الخدمة. يُلغى حقك في تحميل المادة المسترجعة فور تنفيذ الاسترجاع الكامل.',
      'تُعكس حصّة الصانع بالنسبة المجمّدة على الطلب لحظة الشراء، لا بنسبته الحالية. هذا يضمن أن كشف حساب الصانع يعود إلى الصفر تماماً عند الاسترجاع الكامل.',
    ],
  },
  {
    heading: 'الاسترجاع الجزئي',
    headingEn: 'Partial refunds',
    bodyEn: [
      'Where the fault affects only part of an album, a partial refund in proportion to the affected part is possible, and the rest of the licence stays valid and downloadable.',
    ],
    body: [
      'إن كان الخلل في جزء من الألبوم فقط، يجوز الاسترجاع الجزئي بنسبة المتأثر، ويبقى باقي الترخيص سارياً وقابلاً للتحميل.',
    ],
  },
]

export const ABOUT: DocumentSection[] = [
  {
    heading: 'لماذا وُجدت لقطة',
    headingEn: 'Why Laqta exists',
    bodyEn: [
      'Search for \u201cRiyadh\u201d in any global footage library and you will find the same skyline from a plane, and scenes that cannot tell one district from another. The problem is not the price \u2014 it is that whoever assembled that library did not know the place.',
      'Laqta is a Saudi footage library: made inside the Kingdom, with complete clearances, and indexed under place names as the people who live there say them \u2014 not as a machine translates them.',
    ],
    body: [
      'ابحث عن "الرياض" في أي مكتبة لقطات عالمية وستجد الأفق نفسه من الطائرة، ومشاهد لا تعرف الفرق بين حيّ وحيّ. المشكلة ليست السعر، بل أن من جمع تلك اللقطات لم يكن يعرف المكان.',
      'لقطة مكتبة لقطات سعودية: مادتها من داخل المملكة، تُراجَع قبل النشر، ومفهرسة بأسماء الأماكن كما ينطقها أهلها — لا كما تُترجم آلياً.',
    ],
  },
  {
    heading: 'ما الذي يميّز الفهرسة',
    headingEn: 'What makes the indexing different',
    bodyEn: [
      'Arabic search here is not a translation of English search. \u201c\u0627\u0644\u0639\u0644\u0627\u201d, \u201cAlUla\u201d and \u201c\u0627\u0644\u0639\u064f\u0644\u0627\u201d all reach the same material, and so do variations of hamza, alef maqsura and teh marbuta. The index is built on a synonym layer the platform team edits, not on text matching.',
    ],
    body: [
      'البحث العربي هنا ليس ترجمة للبحث الإنجليزي. "العلا" و"AlUla" و"العُلا" كلها تصل إلى المادة نفسها، وكذلك اختلافات الهمزة والألف المقصورة والتاء المربوطة. الفهرس مبني على طبقة مرادفات يحرّرها فريق المنصّة، لا على مطابقة نصية.',
    ],
  },
  {
    heading: 'نموذج العمل',
    headingEn: 'The business model',
    bodyEn: [
      'You buy the album once and own its licence forever. No subscription, no allowance expiring at the end of the month, no surprises at renewal. A tax invoice comes with every purchase.',
      'The creator keeps the rights to their material and takes a share of every sale that rises with their total sales. Earnings from each sale are held for thirty days before becoming withdrawable, because the refund window has to close before the money leaves.',
    ],
    body: [
      'تشتري الألبوم مرة واحدة وتملك ترخيصه للأبد. لا اشتراك، ولا رصيد ينتهي آخر الشهر، ولا مفاجآت عند التجديد. تصلك فاتورة ضريبية عن كل عملية.',
      'يحتفظ صانع المحتوى بحقوق مادته، ويأخذ حصّة من كل عملية بيع ترتفع مع إجمالي مبيعاته. تُحجز أرباح كل عملية ثلاثين يوماً قبل أن تصبح قابلة للسحب، لأن نافذة الاسترجاع يجب أن تُغلق قبل أن يخرج المال.',
    ],
  },
  {
    heading: 'المراجعة',
    headingEn: 'Review',
    bodyEn: [
      'Every album goes to a human reviewer before publication: matching specifications, complete clearances, cultural fit, and duplication against the existing catalogue. Our stated turnaround is three business days.',
    ],
    body: [
      'كل ألبوم يمرّ على مراجع بشري قبل النشر: تناسق المواصفات، واكتمال التصاريح، والملاءمة الثقافية، والتكرار مع الكتالوج القائم. مهلتنا المعلنة ثلاثة أيام عمل.',
    ],
  },
]

export const CONTACT: DocumentSection[] = [
  {
    heading: 'الدعم',
    headingEn: 'Support',
    bodyEn: [
      'For any question about an order, a licence, or a file that is not behaving as it should, write to us and we will reply within one business day. Quote the order number if your question is about a purchase \u2014 it saves the entire back-and-forth.',
    ],
    body: [
      'لأي سؤال عن طلب، أو ترخيص، أو ملف لا يعمل كما ينبغي، راسلنا وسنرد خلال يوم عمل واحد. اذكر رقم الطلب إن كان سؤالك متعلقاً بعملية شراء — يختصر ذلك المراسلة كلها.',
    ],
  },
  {
    heading: 'صنّاع المحتوى',
    headingEn: 'Creators',
    bodyEn: [
      'If you make Saudi material and want to list it, start from the \u201cSell your footage\u201d page. Partnership and exclusivity questions go to the same channel.',
    ],
    body: [
      'إن كنت صانع محتوى وتريد عرض مادتك، ابدأ من صفحة "بِع لقطاتك". أسئلة الشراكات والحصريات تُرسل على القناة نفسها.',
    ],
  },
  {
    heading: 'بلاغات الحقوق',
    headingEn: 'Rights reports',
    bodyEn: [
      'Any rights holder may file a takedown report. Attach proof of your standing, a link to the material in question, and a specific description of the clips concerned. We act on serious reports as soon as we have assessed them.',
    ],
    body: [
      'لأي صاحب حق أن يتقدّم ببلاغ إزالة. أرفق ما يثبت صفتك، ورابط المادة محل البلاغ، ووصفاً محدّداً للقطات المعنية. نعالج البلاغات الجادة فور تقييمها.',
    ],
  },
  {
    heading: 'الشركات والجهات الحكومية',
    headingEn: 'Companies and government bodies',
    bodyEn: [
      'For organisational accounts, invoicing against a purchase order, and organisation-wide extended licences, get in touch and we will put together a proposal.',
    ],
    body: [
      'للحسابات المؤسسية، والفوترة بأمر شراء، والتراخيص الموسّعة على مستوى المنظمة، تواصل معنا وسنجهّز لك عرضاً.',
    ],
  },
]
