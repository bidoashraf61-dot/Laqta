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
      'Laqta is a digital marketplace for Saudi video footage. The platform connects creators with buyers and claims no ownership of the material listed: the rights to every clip remain with its creator, and what you buy is a licence of defined scope, not ownership of the material itself.',
      'The unit of sale is the album, not the individual clip. When a purchase completes, the list of clips included in your order is fixed exactly as it stood at the moment of payment, and stays yours to download with no time limit \u2014 even if the creator later edits the album or removes it from the catalogue.',
    ],
    body: [
      'لقطة سوق رقمي للقطات فيديو سعودية. تصل المنصّة صنّاع المحتوى بالمشترين، ولا تدّعي ملكية المواد المعروضة: تظل حقوق كل لقطة لصانعها، وما تشتريه أنت ترخيص استخدام محدّد النطاق، لا ملكية المادة نفسها.',
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
    // DEV-26 (decision D1: AI-generated AND filmed albums). ⚠️ FOR COUNSEL
    // (BIZ-02): copyright in AI-generated material, and the AI-tool-terms
    // warranty, are open questions on the lawyer's list.
    heading: 'اللقطات المصوّرة والمولّدة بالذكاء الاصطناعي',
    headingEn: 'Filmed and AI-generated footage',
    bodyEn: [
      'The catalogue holds two kinds of album: footage filmed with a camera, and footage made with generative AI tools. Every album states which it is on its page and on your licence certificate, before and after you buy.',
      'For an AI-generated album, the creator confirms that the tools they used allow the output to be licensed for commercial use, and the album is reviewed for accuracy — architecture, Arabic lettering and dress — before it is published. The licence you buy is the same for both kinds.',
      'Some jurisdictions give AI-generated material limited or no copyright protection. That does not change your right to use what you licensed, but it may mean others can use similar material too; do not rely on an AI-generated clip being exclusive to you.',
    ],
    body: [
      'يضم الكتالوج نوعين من الألبومات: لقطات مصوّرة بالكاميرا، ولقطات مولّدة بأدوات الذكاء الاصطناعي. يُذكر نوع كل ألبوم على صفحته وفي شهادة ترخيصك، قبل الشراء وبعده.',
      'في الألبوم المولّد بالذكاء الاصطناعي، يُقرّ الصانع بأن الأدوات التي استخدمها تسمح بترخيص مخرجاتها للاستخدام التجاري، ويُراجَع الألبوم قبل نشره من حيث الدقة: العمارة والخط العربي واللباس. والترخيص الذي تشتريه واحد في النوعين.',
      'بعض الأنظمة القانونية تمنح المواد المولّدة بالذكاء الاصطناعي حماية محدودة لحق المؤلف أو لا تمنحها. هذا لا يغيّر حقك في استخدام ما رُخّص لك، لكنه قد يعني أن غيرك يستطيع استخدام مواد مشابهة؛ فلا تفترض أن اللقطة المولّدة حصرية لك.',
    ],
  },
  {
    heading: 'الأسعار والدفع والفاتورة',
    headingEn: 'Prices, payment and invoicing',
    bodyEn: [
      // DEV-26/28: must match lib/orders.ts — VAT_RATE (15%, decision D7) is
      // added to EVERY order, whoever buys. ⚠️ FOR THE ACCOUNTANT (BIZ-03).
      'Prices are shown in US dollars per album, before VAT. Value added tax at 15% is added to every order at checkout and shown separately before you pay. An invoice is issued for every purchase and can be downloaded from your orders.',
      "The platform's share of each sale is calculated at the rate in force at the moment of purchase, and that rate is frozen against the order. Any later change to the creator's tier or to the commission policy does not apply retroactively to an earlier order.",
    ],
    body: [
      'الأسعار معروضة بالدولار الأمريكي لكل ألبوم، قبل الضريبة. تُضاف ضريبة القيمة المضافة بنسبة ١٥٪ إلى كل طلب عند إتمام الشراء، وتظهر منفصلةً قبل الدفع. تصدر فاتورة عن كل عملية شراء، ويمكن تنزيلها من صفحة الطلبات.',
      'يُحتسب نصيب المنصّة من كل عملية بيع بالنسبة السارية لحظة الشراء، وتُجمَّد تلك النسبة على الطلب. أي تغيير لاحق في شريحة الصانع أو في سياسة العمولة لا يسري بأثر رجعي على طلب سابق.',
    ],
  },
  {
    heading: 'ما لا يشمله الترخيص',
    headingEn: 'What the licence does not cover',
    bodyEn: [
      'The licence gives you no right to resell the clip as it is, to make it available in another footage library, or to use it in a way that reflects badly on a person appearing in it, or on a place or a religious or national symbol.',
      'See the licence page for a breakdown of what the licence covers and the few things it does not.',
    ],
    body: [
      'لا يمنحك الترخيص حقاً في إعادة بيع اللقطة كما هي، أو إتاحتها في مكتبة لقطات أخرى، أو استخدامها بما يسيء إلى شخص ظاهر فيها أو إلى مكان أو رمز ديني أو وطني.',
      'راجع صفحة الترخيص لتفصيل ما يشمله وما لا يشمله.',
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
      // The operating company is registered in EGYPT, not Saudi Arabia. The
      // footage is Saudi; the entity selling it is not. Naming the wrong
      // jurisdiction in a governing-law clause is the kind of error that only
      // surfaces in a dispute, when it is far too late to correct.
      'These terms are governed by the laws of the Arab Republic of Egypt, where the operating company is registered, and the competent Egyptian courts have jurisdiction over any dispute arising from them.',
    ],
    body: [
      'تخضع هذه الشروط لقوانين جمهورية مصر العربية، حيث تُسجَّل الشركة المشغّلة، وتختص المحاكم المصرية المختصة بالنظر في أي نزاع ينشأ عنها.',
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
      'Billing details: legal name, VAT number and address \u2014 the details an invoice requires.',
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
      // ⚠️ FOR COUNSEL (added 2026-09-24): error monitoring (Sentry, see
      // docs/tech/sentry.md). Names no vendor and no transfer country on purpose —
      // counsel to confirm whether PDPL / Egypt's Law 151 need the processor
      // or the cross-border transfer named here. Keep AR and EN in step.
      'When something on the site breaks, a technical report of the error (the page, the browser and the error message, without your email, your IP address or your cookies) may be sent to an error-monitoring service that processes it on our behalf, only to find and fix the fault.',
    ],
    body: [
      'يطّلع فريق الدعم على بياناتك عند الحاجة لخدمتك فقط. أي دخول إداري إلى حساب مستخدم يُسجَّل مع سببه، ويمكن مراجعته لاحقاً.',
      'يرى صانع المحتوى أرقام مبيعاته، ولا يرى هويتك كمشترٍ.',
      'عند حدوث خطأ تقني في الموقع، قد يُرسَل تقرير عنه (الصفحة والمتصفح ونص الخطأ، دون بريدك أو عنوان الإنترنت الخاص بجهازك أو ملفات تعريف الارتباط) إلى مزوّد خدمة لرصد الأخطاء يعالجه نيابةً عنّا، لغرض واحد: إيجاد الخلل وإصلاحه.',
    ],
  },
  {
    // DEV-46 (decision D10): Google Analytics, only with consent. ⚠️ FOR
    // COUNSEL with the rest of this policy (BIZ-02): Google processes the data
    // outside Saudi Arabia and Egypt; counsel to confirm the transfer wording.
    id: 'cookies',
    heading: 'ملفات تعريف الارتباط والتحليلات',
    headingEn: 'Cookies and analytics',
    bodyEn: [
      'The site uses a small number of cookies it cannot work without: one keeps you signed in, one keeps your cart and your language, and one remembers your answer about analytics. These need no consent.',
      'With your consent only, we use Google Analytics to understand how the site is used — which pages are visited, where visitors come from (including campaign links), and on which device. It sets its own cookies, and Google processes this data on our behalf. We never send it your name, email or purchases.',
      'Until you choose, and if you decline, Google Analytics does not load at all. You can change your answer at any time from “Tracking settings” at the bottom of every page; withdrawing deletes its cookies.',
    ],
    body: [
      'يستخدم الموقع عددًا محدودًا من ملفات تعريف الارتباط لا يعمل بدونها: واحد يُبقيك مسجّل الدخول، وآخر يحفظ سلتك ولغتك، وثالث يتذكّر جوابك عن التحليلات. هذه لا تحتاج موافقة.',
      'وبموافقتك فقط نستخدم خدمة تحليلات جوجل لنفهم كيف يُستخدم الموقع: أي الصفحات تُزار، ومن أين يأتي الزوّار (ومنها روابط الحملات)، ومن أي جهاز. تضع الخدمة ملفات تعريف ارتباط خاصة بها، وتعالج جوجل هذه البيانات نيابةً عنّا. لا نرسل إليها اسمك ولا بريدك ولا مشترياتك.',
      'قبل أن تختار، وإذا رفضت، لا تُحمَّل خدمة التحليلات أصلًا. تقدر تغيّر جوابك في أي وقت من «إعدادات التتبّع» أسفل كل صفحة، وسحب الموافقة يحذف ملفاتها.',
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
      'You have the right to see your data, correct it, and ask for it to be deleted, within what the applicable personal data protection laws allow. Deletion does not extend to what we are legally required to keep, such as invoices.',
      'You can do both yourself from your account, under “Edit your details”: download a copy of everything we hold about you as one file, or delete your account. Deleting it clears your personal details and signs you out everywhere; orders, invoices and licence numbers are kept as tax records, and a licence you bought stays valid.',
      'For anything else, get in touch through the contact page.',
    ],
    body: [
      'لك حق الاطلاع على بياناتك وتصحيحها وطلب حذفها، ضمن ما تسمح به قوانين حماية البيانات الشخصية الواجبة التطبيق. الحذف لا يشمل ما يلزمنا الاحتفاظ به نظاماً كالفواتير.',
      'وتقدر تنفّذ الأمرين بنفسك من حسابك، في «تعديل بياناتك»: تنزيل نسخة من كل ما نحفظه عنك في ملف واحد، أو حذف حسابك. الحذف يمسح بياناتك الشخصية ويُخرجك من كل أجهزتك، ونحتفظ بالطلبات والفواتير وأرقام التراخيص سجلاتٍ ضريبية، ويبقى ترخيص ما اشتريته ساريًا.',
      'ولأي طلب آخر تواصل معنا عبر صفحة التواصل.',
    ],
  },
]

export const LICENCES: DocumentSection[] = [
  {
    heading: 'ترخيص واحد يُشترى مرة واحدة',
    headingEn: 'One licence, bought once',
    bodyEn: [
      'There is no subscription and no monthly allowance that expires. You buy the album once, keep the right to use its clips with no time limit, and the album stays downloadable from your library.',
    ],
    body: [
      'لا يوجد اشتراك ولا رصيد شهري ينتهي. تشتري الألبوم مرة واحدة، وتحتفظ بحق استخدام لقطاته بلا حد زمني، ويبقى الألبوم قابلاً للتحميل من مكتبتك.',
    ],
  },
  {
    heading: 'ما يغطّيه الترخيص',
    headingEn: 'What the licence covers',
    bodyEn: ['One licence, and it covers commercial use in full:'],
    listEn: [
      'Digital advertising, social platforms, websites and internal presentations.',
      'Television, cinema and paid content, with no cap on views.',
      'Out-of-home and commercial displays.',
      'Products made for resale: templates, digital product backgrounds and packaging.',
      'Use across more than one client project.',
    ],
    body: ['ترخيص واحد، ويغطي الاستخدام التجاري كاملاً:'],
    list: [
      'الإعلانات الرقمية، ومنصّات التواصل، ومواقع الويب، والعروض الداخلية.',
      'الأعمال التلفزيونية والسينمائية والمحتوى المدفوع، بلا حد لعدد المشاهدات.',
      'العرض خارج المنزل والشاشات التجارية.',
      'المنتجات المعدّة لإعادة البيع: القوالب، وخلفيات المنتجات الرقمية، والتغليف.',
      'الاستخدام في أكثر من مشروع عميل.',
    ],
  },
  {
    heading: 'ما يمنعه الترخيص',
    headingEn: 'What the licence prohibits',
    bodyEn: [],
    listEn: [
      'Reselling the clip as it is, or listing it in another footage library.',
      'Any use that reflects badly on a person appearing in the clip, or implies their endorsement of a product or opinion.',
      'Any use that touches religious or national symbols, or holy places.',
      'Using a clip marked \u201ceditorial use only\u201d in a commercial context.',
      'Publishing a watermarked preview. A preview you download is for testing a clip in your own edit before you buy; the licence covers only the files delivered after purchase.',
    ],
    body: [],
    list: [
      'إعادة بيع اللقطة كما هي أو إدراجها في مكتبة لقطات أخرى.',
      'الاستخدام الذي يسيء إلى شخص ظاهر في اللقطة أو يوحي بتأييده لمنتج أو رأي.',
      'الاستخدام الذي يمسّ الرموز الدينية أو الوطنية أو الأماكن المقدّسة.',
      'استخدام لقطة موسومة «للاستخدام التحريري فقط» في سياق تجاري.',
      'نشر معاينة عليها علامة مائية. المعاينة التي تحمّلها لتجربة اللقطة في مونتاجك قبل الشراء، والترخيص يشمل فقط الملفات التي تصلك بعد الشراء.',
    ],
  },
  {
    heading: 'التحريري مقابل التجاري',
    headingEn: 'Editorial versus commercial',
    bodyEn: [
      'An album marked \u201ccleared for commercial use\u201d has complete clearance: model, location and filming permits are all documented. \u201cEditorial use only\u201d means some clearance is missing, and use is limited to news and documentary contexts, without promoting a product or service.',
    ],
    body: [
      'الألبوم الموسوم «مرخّص للاستخدام التجاري» اكتملت تصاريحه: تصاريح النماذج والمواقع والتصوير كلها موثّقة. أما «للاستخدام التحريري فقط» فيعني أن تصريحاً ما ناقص، ويقتصر استخدامه على السياق الإخباري والتوثيقي دون الترويج لمنتج أو خدمة.',
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
  {
    // DEV-26. ⚠️ FOR COUNSEL (BIZ-02) with the rest of this page.
    heading: 'اللقطات المولّدة بالذكاء الاصطناعي',
    headingEn: 'AI-generated footage',
    bodyEn: [
      'An AI-generated album is licensed on exactly the same terms. It shows no real person and was not filmed at a real site, so model and filming permits do not apply to it; the review checks it for accuracy instead.',
      'One extra limit applies: do not present an AI-generated clip as real footage of an actual event, person or place — in news, in documentary, or in any context where a viewer would take it as a record of what happened.',
    ],
    body: [
      'يُرخَّص الألبوم المولّد بالذكاء الاصطناعي بالشروط نفسها تماماً. لا يظهر فيه شخص حقيقي ولم يُصوَّر في موقع حقيقي، فلا تنطبق عليه تصاريح النماذج والتصوير، وتحلّ محلها مراجعة الدقة.',
      'ويُضاف قيد واحد: لا تعرض لقطة مولّدة بالذكاء الاصطناعي على أنها تصوير حقيقي لحدث أو شخص أو مكان فعلي، في الأخبار أو الأعمال الوثائقية أو أي سياق يفهم منه المشاهد أنها توثيق لما حدث.',
    ],
  },
]

export const CONTENT_POLICY: DocumentSection[] = [
  {
    heading: 'ما الذي نقبله',
    headingEn: 'What we accept',
    bodyEn: [
      'Saudi footage at 720p, 1080p or 4K — the resolution is stated on each album and reflected in its price — in coherent albums of 30 to 70 clips around one subject. Coherence is a requirement, not a preference: mixing frame rates or colour profiles within one album leaves the editor with material that will not cut together on one timeline, and it is the first thing that spoils an album for the person who bought it.',
      'Albums are either filmed with a camera or made with generative AI tools, and each is labelled as one or the other. An AI-generated album must be made with tools whose terms allow commercial licensing, and is reviewed for accuracy: warped architecture, garbled Arabic lettering, and dress or landmarks that are wrong for the place.',
    ],
    body: [
      'لقطات سعودية بدقة 720p أو 1080p أو 4K، تُذكر دقة كل ألبوم عليه وتنعكس على سعره، ضمن ألبومات متناسقة من ٣٠ إلى ٧٠ لقطة حول موضوع واحد. التناسق شرط لا شكل: خلط معدلات الإطارات أو الملفات اللونية داخل ألبوم واحد يترك المونتير أمام مواد لا تُركّب على خط زمني واحد، وهو أول ما يُفسد الألبوم على من اشتراه.',
      'الألبوم إما مصوّر بالكاميرا أو مولّد بأدوات الذكاء الاصطناعي، ويُوسم بأحدهما. ويُشترط في الألبوم المولّد أن تسمح شروط أدواته بالترخيص التجاري، ويُراجَع من حيث الدقة: العمارة المشوّهة، والخط العربي المختلّ، واللباس أو المعالم التي لا تناسب المكان.',
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
      'Every clip uploaded to Laqta is shown publicly with an automatic watermark — on every thumbnail, every preview and every player, without exception and without any extra step from the creator. A preview shows what the clip is without handing over a usable copy.',
      "The original file, at full resolution and without a watermark, is delivered only to the buyer once payment completes. This protects the creator's rights and makes previews safe to show anywhere.",
      'A signed-in visitor may download a watermarked 720p preview, of one clip or of a whole album, to test it in their own edit. The watermark stays burnt into that file, and it is not licensed for published work.',
    ],
    body: [
      'كل لقطة تُرفع إلى المنصّة تُعرض للجمهور بعلامة مائية تلقائياً — على كل مصغّرة وكل معاينة وكل مشغّل، دون استثناء ودون خطوة إضافية من الصانع. المعاينة تُعرّف باللقطة دون أن تسلّم نسخة صالحة للاستخدام.',
      'الملف الأصلي بالدقة الكاملة وبلا علامة مائية لا يُسلَّم إلا للمشتري بعد إتمام الدفع. هذا يحمي حق الصانع ويجعل المعاينة آمنة للعرض في كل مكان.',
      'يقدر المستخدم المسجّل أن يحمّل معاينة بدقة 720p عليها علامة مائية، للقطة واحدة أو لألبوم كامل، ليجرّبها في مونتاجه. العلامة المائية ثابتة في الملف، والمعاينة غير مرخّصة للنشر.',
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

export const ABOUT: DocumentSection[] = [
  {
    heading: 'لماذا وُجدت لقطة',
    headingEn: 'Why Laqta exists',
    bodyEn: [
      'Search for \u201cRiyadh\u201d in any global footage library and you will find the same skyline from a plane, and scenes that cannot tell one district from another. The problem is not the price \u2014 it is that whoever assembled that library did not know the place.',
      'Laqta is a Saudi footage library: reviewed before publication, and indexed under place names as the people who live there say them \u2014 not as a machine translates them.',
    ],
    body: [
      'ابحث عن «الرياض» في أي مكتبة لقطات عالمية وستجد الأفق نفسه من الطائرة، ومشاهد لا تعرف الفرق بين حيّ وحيّ. المشكلة ليست السعر، بل أن من جمع تلك اللقطات لم يكن يعرف المكان.',
      'لقطة مكتبة لقطات سعودية: تُراجَع قبل النشر، ومفهرسة بأسماء الأماكن كما ينطقها أهلها — لا كما تُترجم آلياً.',
    ],
  },
  {
    heading: 'ما الذي يميّز الفهرسة',
    headingEn: 'What makes the indexing different',
    bodyEn: [
      'Arabic search here is not a translation of English search. \u201c\u0627\u0644\u0639\u0644\u0627\u201d, \u201cAlUla\u201d and \u201c\u0627\u0644\u0639\u064f\u0644\u0627\u201d all reach the same material, and so do variations of hamza, alef maqsura and teh marbuta. The index is built on a synonym layer the platform team edits, not on text matching.',
    ],
    body: [
      'البحث العربي هنا ليس ترجمة للبحث الإنجليزي. «العلا» و«AlUla» و«العُلا» كلها تصل إلى المادة نفسها، وكذلك اختلافات الهمزة والألف المقصورة والتاء المربوطة. الفهرس مبني على طبقة مرادفات يحرّرها فريق المنصّة، لا على مطابقة نصية.',
    ],
  },
  {
    // DEV-25 (AI disclosure; decision D1). The founder / company / founding
    // date section waits on the owner's details (BIZ-10).
    heading: 'كيف تُصنع اللقطات',
    headingEn: 'How the footage is made',
    bodyEn: [
      'Some albums are filmed on location with a camera; others are made with generative AI tools. We say which on every album, in its details and on the licence certificate, because a buyer choosing footage for a campaign needs to know \u2014 and because presenting a generated scene as a filmed one is something we do not accept.',
      'Both kinds pass the same review before publication. A generated album is also checked for the mistakes these tools make with Saudi places: warped buildings, broken Arabic lettering, the wrong dress or the wrong landmark.',
    ],
    body: [
      'بعض الألبومات مصوّرة بالكاميرا في مواقعها، وبعضها مولّد بأدوات الذكاء الاصطناعي. نذكر ذلك على كل ألبوم، في تفاصيله وفي شهادة الترخيص، لأن من يختار لقطات لحملته يحتاج أن يعرف، ولأن عرض مشهد مولّد على أنه مصوّر أمر لا نقبله.',
      'يمرّ النوعان بالمراجعة نفسها قبل النشر، ويُفحص الألبوم المولّد فوق ذلك بحثاً عن الأخطاء التي تقع فيها هذه الأدوات مع الأماكن السعودية: المباني المشوّهة، والخط العربي المكسور، واللباس الخطأ أو المعلم الخطأ.',
    ],
  },
  {
    heading: 'نموذج العمل',
    headingEn: 'The business model',
    bodyEn: [
      'You buy the album once, with a permanent licence. No subscription, no allowance expiring at the end of the month, no surprises at renewal. An invoice comes with every purchase.',
      'The creator keeps the rights to their material and takes a share of every sale that rises with their total sales. Earnings from each sale are held for thirty days, then become withdrawable.',
    ],
    body: [
      'تشتري الألبوم مرة واحدة بترخيص دائم. لا اشتراك، ولا رصيد ينتهي آخر الشهر، ولا مفاجآت عند التجديد. تصلك فاتورة عن كل عملية.',
      'يحتفظ صانع المحتوى بحقوق مادته، ويأخذ حصّة من كل عملية بيع ترتفع مع إجمالي مبيعاته. تُحجز أرباح كل عملية ثلاثين يوماً، ثم تصبح قابلة للسحب.',
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
      'For any question about an order, a licence, or a file that is not behaving as it should, write to us using the form on this page. Quote the order number if your question is about a purchase \u2014 it saves the entire back-and-forth.',
    ],
    body: [
      'لأي سؤال عن طلب، أو ترخيص، أو ملف لا يعمل كما ينبغي، اكتب لنا من النموذج في هذه الصفحة. اذكر رقم الطلب إن كان سؤالك متعلقاً بعملية شراء — يختصر ذلك المراسلة كلها.',
    ],
  },
  {
    heading: 'صنّاع المحتوى',
    headingEn: 'Creators',
    bodyEn: [
      'If you make Saudi material and want to list it, start from the \u201cSell your footage\u201d page. Partnership and exclusivity questions come through this form too.',
    ],
    body: [
      'إن كنت صانع محتوى وتريد عرض مادتك، ابدأ من صفحة «بِع لقطاتك». أسئلة الشراكات والحصرية تصلنا من هذا النموذج أيضاً.',
    ],
  },
  {
    heading: 'بلاغات الحقوق',
    headingEn: 'Rights reports',
    bodyEn: [
      'Any rights holder may file a takedown report. Include proof of your standing, a link to the material in question, and a specific description of the clips concerned. We act on serious reports as soon as we have assessed them.',
    ],
    body: [
      'لأي صاحب حق أن يتقدّم ببلاغ إزالة. اذكر ما يثبت صفتك، ورابط المادة محل البلاغ، ووصفاً محدّداً للقطات المعنية. نعالج البلاغات الجادة فور تقييمها.',
    ],
  },
  {
    heading: 'الشركات والجهات الحكومية',
    headingEn: 'Companies and government bodies',
    bodyEn: [
      'For organisational accounts, invoicing against a purchase order, and organisation-wide agreements, get in touch and we will put together a proposal.',
    ],
    body: [
      'للحسابات المؤسسية، والفوترة بأمر شراء، والاتفاقيات على مستوى المنظمة، تواصل معنا وسنجهّز لك عرضاً.',
    ],
  },
]
