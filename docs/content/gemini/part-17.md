# لقطة — الجزء 17 من 18

هذا الجزء فيه **112 سطراً**. أعد **كل** الأسطر، بنفس المفاتيح وبنفس الترتيب، حتى ما لم تغيّره.
كل سطر على الشكل: `- \`المفتاح\` :: النص` — احذف ما بعد العلامة ⟂ (الترجمة الإنجليزية للاسترشاد فقط).
طبّق قواعد الموجز كاملة. لا تُضف أسطراً ولا تحذف أسطراً ولا تدمج سطرين.

## payoutRun


- `payoutRun.sectionTitle` :: الدفعة الجارية
- `payoutRun.historyTitle` :: سجل الدفعات
- `payoutRun.create` :: جمّع المعتمد في دفعة
- `payoutRun.readyHint` :: طلبات معتمدة جاهزة للدفعة القادمة: {count}. تُجمع كلها معًا، ويُصدَّر ملف لكل قناة تحويل.
- `payoutRun.noneReady` :: لا طلبات معتمدة بعد. اعتمد الطلبات من القائمة أدناه لتدخل الدفعة القادمة.
- `payoutRun.nothingToBatch` :: ما فيه طلبات معتمدة لتجميعها
- `payoutRun.created` :: أُنشئت الدفعة. عدد التحويلات فيها: {count}
- `payoutRun.filesTitle` :: ملفات التحويل
- `payoutRun.filesHint` :: نزّل ملف كل قناة وارفعه في بوابتها. المبلغ في الملف هو الصافي بعد الاستقطاع.
- `payoutRun.download` :: تنزيل الملف
- `payoutRun.noLinesOnRail` :: لا تحويلات على هذه القناة
- `payoutRun.linesTitle` :: بنود الدفعة
- `payoutRun.exclude` :: استبعاد
- `payoutRun.excludeReason` :: سبب الاستبعاد
- `payoutRun.excludeConfirm` :: يعود الطلب إلى القائمة معتمدًا، ويخرج من ملفات هذه الدفعة. هل تتابع؟
- `payoutRun.excluded` :: أُعيد الطلب إلى القائمة
- `payoutRun.returnedNote` :: أُعيد من دفعة:
- `payoutRun.payTitle` :: تأكيد تحويل الدفعة
- `payoutRun.payHint` :: بعد أن تنفّذ القناة الدفعة، أدخل مرجعها. يُسجَّل كل بند محوَّلًا ويُقيَّد في رصيد صانعه دفعة واحدة.
- `payoutRun.runReference` :: مرجع الدفعة
- `payoutRun.markRunPaid` :: تأكيد تحويل الدفعة كاملة
- `payoutRun.payConfirm` :: سيُسجَّل تحويل كل البنود (عددها {count}) بإجمالي {total}. لا يمكن التراجع. هل تتابع؟
- `payoutRun.referenceRequired` :: أدخل مرجع الدفعة أولًا
- `payoutRun.paid` :: سُجّل التحويل. عدد البنود: {count}
- `payoutRun.alreadyPaid` :: هذه الدفعة مسجّلة محوّلة من قبل
- `payoutRun.noRuns` :: لم تُنشأ أي دفعة بعد
- `payoutRun.view` :: عرض
- `payoutRun.inRun` :: ضمن الدفعة
- `payoutRun.colRun` :: الدفعة
- `payoutRun.colLines` :: البنود
- `payoutRun.colTotal` :: الصافي
- `payoutRun.colReference` :: المرجع
- `payoutRun.colCreated` :: أُنشئت
- `payoutRun.statusDraft` :: بانتظار التحويل
- `payoutRun.statusPaid` :: محوّلة
- `payoutRun.statusVoid` :: ملغاة
- `payoutRun.closedHint` :: أُغلقت هذه الدفعة. الملفات متاحة للمراجعة فقط.

## promo


- `promo.notFound` :: الكود غير صحيح أو غير مفعّل.   ⟂ EN: This code is not valid or not active.
- `promo.notActiveNow` :: الكود خارج فترة صلاحيته.   ⟂ EN: This code is outside its valid dates.
- `promo.exhausted` :: انتهت مرات استخدام هذا الكود.   ⟂ EN: This code has no uses left.
- `promo.minimum` :: الكود يحتاج طلباً بقيمة {amount} دولار أو أكثر.   ⟂ EN: This code needs an order of ${amount} or more.
- `promo.notApplicable` :: الكود لا يشمل الألبومات اللي في سلتك.   ⟂ EN: This code does not cover the albums in your cart.

## bundle


- `bundle.albums` :: ألبومات الحزمة: {count}   ⟂ EN: Albums in the bundle: {count}
- `bundle.regular` :: بشرائها منفصلة   ⟂ EN: Bought separately
- `bundle.price` :: سعر الحزمة   ⟂ EN: Bundle price
- `bundle.save` :: توفّر   ⟂ EN: You save
- `bundle.ends` :: ينتهي العرض   ⟂ EN: Offer ends
- `bundle.buy` :: اشترِ الحزمة   ⟂ EN: Buy the bundle
- `bundle.buyHint` :: تُضاف ألبومات الحزمة إلى سلتك، ويُطبَّق سعرها تلقائياً.   ⟂ EN: The bundle's albums go into your cart and the bundle price applies automatically.
- `bundle.ownedSome` :: اشتريت {count} من ألبومات هذه الحزمة سابقاً. سعر الحزمة يحتاج كل ألبوماتها في طلب واحد، فتُضاف البقية بسعرها العادي.   ⟂ EN: You have already bought {count} of these albums. The bundle price needs all of them in one order, so the rest are added at their usual price.
- `bundle.ended` :: انتهى عرض هذه الحزمة.   ⟂ EN: This bundle has ended.
- `bundle.unavailable` :: هذه الحزمة غير متاحة حالياً.   ⟂ EN: This bundle isn't available right now.
- `bundle.onAlbum` :: ضمن حزمة   ⟂ EN: Part of the bundle
- `bundle.onAlbumSave` :: — وفّر مع الحزمة   ⟂ EN: — save

## doc.terms
> الشروط والأحكام — نص قانوني: فصحى دقيقة، بلا عامية

- `doc.terms.1.heading` :: من نحن وما الذي تشتريه   ⟂ EN: Who we are and what you are buying
- `doc.terms.1.body.1` :: لقطة سوق رقمي للقطات فيديو سعودية. تصل المنصّة صنّاع المحتوى بالمشترين، ولا تدّعي ملكية المواد المعروضة: تظل حقوق كل لقطة لصانعها، وما تشتريه أنت ترخيص استخدام محدّد النطاق، لا ملكية المادة نفسها.   ⟂ EN: Laqta is a digital marketplace for Saudi video footage. The platform connects creators with buyers and claims no ownership of the material listed: the rights to every clip remain with its creator, and what you buy is a licence of defined scope, not ownership of the material itself.
- `doc.terms.1.body.2` :: الوحدة المعروضة للبيع هي الألبوم، لا اللقطة المفردة. عند إتمام الشراء تُثبَّت قائمة اللقطات المشمولة في طلبك كما هي لحظة الدفع، وتبقى ملكك للتحميل بلا حد زمني حتى لو عدّل الصانع الألبوم أو أزاله من الكتالوج لاحقاً.   ⟂ EN: The unit of sale is the album, not the individual clip. When a purchase completes, the list of clips included in your order is fixed exactly as it stood at the moment of payment, and stays yours to download with no time limit — even if the creator later edits the album or removes it from the catalogue.
- `doc.terms.2.heading` :: الحساب   ⟂ EN: Your account
- `doc.terms.2.body.1` :: أنت مسؤول عن صحة بيانات حسابك وعن سرّية وسائل الدخول إليه. حسابات صنّاع المحتوى وحسابات الإدارة ملزمة بتفعيل التحقق بخطوتين.   ⟂ EN: You are responsible for the accuracy of your account details and for keeping your means of access to it confidential. Creator and administrator accounts are required to have two-factor authentication enabled.
- `doc.terms.2.body.2` :: يجوز لنا إيقاف حساب يخالف هذه الشروط أو يستخدم المنصّة لغرض غير مشروع، مع إشعارك بالسبب. إيقاف الحساب لا يلغي التراخيص التي اشتريتها ودفعت قيمتها.   ⟂ EN: We may suspend an account that breaches these terms or uses the platform for an unlawful purpose, and will tell you why. Suspending an account does not cancel licences you have already bought and paid for.
- `doc.terms.3.heading` :: الأسعار والدفع والفاتورة   ⟂ EN: Prices, payment and invoicing
- `doc.terms.3.body.1` :: الأسعار معروضة بالدولار الأمريكي لكل ألبوم. تصدر لك فاتورة إلكترونية عن كل عملية شراء، وتُضاف ضريبة القيمة المضافة للمشترين داخل المملكة وفق النظام.   ⟂ EN: Prices are shown in US dollars per album. An electronic invoice is issued for every purchase, and VAT is added for buyers inside the Kingdom as the regulations require.
- `doc.terms.3.body.2` :: يُحتسب نصيب المنصّة من كل عملية بيع بالنسبة السارية لحظة الشراء، وتُجمَّد تلك النسبة على الطلب. أي تغيير لاحق في شريحة الصانع أو في سياسة العمولة لا يسري بأثر رجعي على طلب سابق.   ⟂ EN: The platform's share of each sale is calculated at the rate in force at the moment of purchase, and that rate is frozen against the order. Any later change to the creator's tier or to the commission policy does not apply retroactively to an earlier order.
- `doc.terms.4.heading` :: ما لا يشمله الترخيص   ⟂ EN: What the licence does not cover
- `doc.terms.4.body.1` :: لا يمنحك الترخيص حقاً في إعادة بيع اللقطة كما هي، أو إتاحتها في مكتبة لقطات أخرى، أو استخدامها بما يسيء إلى شخص ظاهر فيها أو إلى مكان أو رمز ديني أو وطني.   ⟂ EN: The licence gives you no right to resell the clip as it is, to make it available in another footage library, or to use it in a way that reflects badly on a person appearing in it, or on a place or a religious or national symbol.
- `doc.terms.4.body.2` :: راجع صفحة الترخيص لتفصيل ما يشمله وما لا يشمله.   ⟂ EN: See the licence page for a breakdown of what the licence covers and the few things it does not.
- `doc.terms.5.heading` :: مسؤولية صانع المحتوى   ⟂ EN: The creator's responsibility
- `doc.terms.5.body.1` :: يقرّ الصانع بأنه يملك المادة المرفوعة أو يملك الحق الكامل في ترخيصها، وأنه حصل على التصاريح اللازمة: تصريح نموذج لكل شخص يظهر وجهه بوضوح، وتصريح موقع أو تصريح تصوير حيثما تطلبت الجهة المالكة ذلك.   ⟂ EN: The creator confirms that they own the material uploaded, or hold the full right to license it, and that they have obtained the necessary clearances: a model release for every person whose face is clearly identifiable, and a location or filming permit wherever the owning authority requires one.
- `doc.terms.5.body.2` :: اللقطات التي تظهر فيها وجوه واضحة بلا تصريح نموذج لا يمكن إرسالها للمراجعة أصلاً — المنصّة تمنع ذلك عند الإرسال، لكن المنع التقني لا ينقل المسؤولية عن الصانع.   ⟂ EN: Clips showing identifiable faces without a model release cannot be submitted for review at all — the platform blocks it at submission — but a technical block does not move the responsibility off the creator.
- `doc.terms.6.heading` :: حدود مسؤولية المنصّة   ⟂ EN: Limits of the platform's liability
- `doc.terms.6.body.1` :: نبذل عناية معقولة في مراجعة كل ألبوم قبل نشره، لكن المراجعة لا تُغني عن تقديرك لملاءمة اللقطة لاستخدامك المحدّد. مسؤوليتنا في كل الأحوال لا تتجاوز المبلغ المدفوع فعلياً عن الطلب محل النزاع.   ⟂ EN: We take reasonable care in reviewing every album before it is published, but that review is no substitute for your own judgement about whether a clip suits your particular use. Our liability in every case is limited to the amount actually paid for the order in dispute.
- `doc.terms.6.body.2` :: لا نضمن استمرار توفّر لقطة بعينها في الكتالوج، لأن الصانع قد يوقف ألبومه. هذا لا يمسّ ما اشتريته قبل الإيقاف.   ⟂ EN: We do not guarantee that any given clip stays available in the catalogue, because a creator may withdraw their album. That does not affect anything you bought before the withdrawal.
- `doc.terms.7.heading` :: النظام الواجب التطبيق   ⟂ EN: Governing law
- `doc.terms.7.body.1` :: تخضع هذه الشروط لقوانين جمهورية مصر العربية، حيث تُسجَّل الشركة المشغّلة، وتختص المحاكم المصرية المختصة بالنظر في أي نزاع ينشأ عنها.   ⟂ EN: These terms are governed by the laws of the Arab Republic of Egypt, where the operating company is registered, and the competent Egyptian courts have jurisdiction over any dispute arising from them.

## doc.privacy
> سياسة الخصوصية — نص قانوني

- `doc.privacy.1.heading` :: ما الذي نجمعه   ⟂ EN: What we collect
- `doc.privacy.1.body.1` :: نجمع الحد الذي تحتاجه الخدمة فعلاً، لا أكثر:   ⟂ EN: We collect what the service genuinely needs, and no more:
- `doc.privacy.1.list.1` :: بيانات الحساب: الاسم، البريد الإلكتروني، رقم الجوال إن اخترت الدخول به.   ⟂ EN: Account details: your name, email address, and mobile number if you choose to sign in with it.
- `doc.privacy.1.list.2` :: بيانات الفوترة: الاسم النظامي والرقم الضريبي والعنوان، وهي بيانات تفرضها الفاتورة الضريبية.   ⟂ EN: Billing details: legal name, VAT number and address — the details a tax invoice requires.
- `doc.privacy.1.list.3` :: سجل الطلبات والتحميلات، لأنه ما يثبت حقك في المادة التي اشتريتها.   ⟂ EN: Your order and download history, because it is what proves your right to the material you bought.
- `doc.privacy.1.list.4` :: عمليات البحث داخل الموقع. تُستخدم لتحسين النتائج، ولمعرفة ما يبحث عنه المشترون ولا نملكه.   ⟂ EN: Searches made on the site. These improve results, and show us what buyers are looking for that we do not have.
- `doc.privacy.1.list.5` :: بيانات تقنية أساسية عن الجلسة لأغراض الأمان ومنع إساءة الاستخدام.   ⟂ EN: Basic technical session data, for security and to prevent abuse.
- `doc.privacy.2.heading` :: ما الذي لا نجمعه   ⟂ EN: What we do not collect
- `doc.privacy.2.body.1` :: لا نخزّن بيانات بطاقتك. تمرّ عملية الدفع عبر مزوّد خدمة الدفع ولا يصلنا منها سوى مرجع العملية.   ⟂ EN: We do not store your card details. Payment goes through the payment provider, and all that reaches us is a transaction reference.
- `doc.privacy.2.body.2` :: لا نبيع بياناتك الشخصية لأي طرف، ولا نستخدمها في إعلانات خارج المنصّة.   ⟂ EN: We do not sell your personal data to anyone, and we do not use it for advertising off the platform.
- `doc.privacy.3.heading` :: من يطّلع على بياناتك   ⟂ EN: Who sees your data
- `doc.privacy.3.body.1` :: يطّلع فريق الدعم على بياناتك عند الحاجة لخدمتك فقط. أي دخول إداري إلى حساب مستخدم يُسجَّل مع سببه، ويمكن مراجعته لاحقاً.   ⟂ EN: Our support team sees your data only when they need it to help you. Any administrative access to a user account is logged with its reason, and can be reviewed afterwards.
- `doc.privacy.3.body.2` :: يرى صانع المحتوى أرقام مبيعاته، ولا يرى هويتك كمشترٍ.   ⟂ EN: A creator sees their own sales figures. They do not see your identity as a buyer.
- `doc.privacy.3.body.3` :: عند حدوث خطأ تقني في الموقع، قد يُرسَل تقرير عنه (الصفحة والمتصفح ونص الخطأ، دون بريدك أو عنوان الإنترنت الخاص بجهازك أو ملفات تعريف الارتباط) إلى مزوّد خدمة لرصد الأخطاء يعالجه نيابةً عنّا، لغرض واحد: إيجاد الخلل وإصلاحه.   ⟂ EN: When something on the site breaks, a technical report of the error (the page, the browser and the error message, without your email, your IP address or your cookies) may be sent to an error-monitoring service that processes it on our behalf, only to find and fix the fault.
- `doc.privacy.4.heading` :: مدة الحفظ   ⟂ EN: How long we keep it
- `doc.privacy.4.body.1` :: نحتفظ ببيانات الفوترة للمدة التي تفرضها الأنظمة الضريبية. نحتفظ بسجل الطلبات ما دام حسابك قائماً، لأنه أساس حقك الدائم في التحميل.   ⟂ EN: We keep billing data for the period the tax regulations require. We keep your order history for as long as your account exists, because it is the basis of your permanent right to download.
- `doc.privacy.5.heading` :: حقوقك   ⟂ EN: Your rights
- `doc.privacy.5.body.1` :: لك حق الاطلاع على بياناتك وتصحيحها وطلب حذفها، ضمن ما تسمح به قوانين حماية البيانات الشخصية الواجبة التطبيق. الحذف لا يشمل ما يلزمنا الاحتفاظ به نظاماً كالفواتير.   ⟂ EN: You have the right to see your data, correct it, and ask for it to be deleted, within what the applicable personal data protection laws allow. Deletion does not extend to what we are legally required to keep, such as invoices.
- `doc.privacy.5.body.2` :: للتقدّم بأي من هذه الطلبات تواصل معنا عبر صفحة التواصل.   ⟂ EN: To make any of these requests, get in touch through the contact page.

## doc.licences
> تفاصيل الترخيص — ترخيص واحد فقط

- `doc.licences.1.heading` :: ترخيص واحد يُشترى مرة واحدة   ⟂ EN: One licence, bought once
- `doc.licences.1.body.1` :: لا يوجد اشتراك ولا رصيد شهري ينتهي. تشتري الألبوم مرة واحدة، وتحتفظ بحق استخدام لقطاته بلا حد زمني، ويبقى الألبوم قابلاً للتحميل من مكتبتك.   ⟂ EN: There is no subscription and no monthly allowance that expires. You buy the album once, keep the right to use its clips with no time limit, and the album stays downloadable from your library.
- `doc.licences.2.heading` :: ما يغطّيه الترخيص   ⟂ EN: What the licence covers
- `doc.licences.2.body.1` :: ترخيص واحد، ويغطي الاستخدام التجاري كاملاً:   ⟂ EN: One licence, and it covers commercial use in full:
- `doc.licences.2.list.1` :: الإعلانات الرقمية، ومنصّات التواصل، ومواقع الويب، والعروض الداخلية.   ⟂ EN: Digital advertising, social platforms, websites and internal presentations.
- `doc.licences.2.list.2` :: الأعمال التلفزيونية والسينمائية والمحتوى المدفوع، بلا حد لعدد المشاهدات.   ⟂ EN: Television, cinema and paid content, with no cap on views.
- `doc.licences.2.list.3` :: العرض خارج المنزل والشاشات التجارية.   ⟂ EN: Out-of-home and commercial displays.
- `doc.licences.2.list.4` :: المنتجات المعدّة لإعادة البيع: القوالب، وخلفيات المنتجات الرقمية، والتغليف.   ⟂ EN: Products made for resale: templates, digital product backgrounds and packaging.
- `doc.licences.2.list.5` :: الاستخدام في أكثر من مشروع عميل.   ⟂ EN: Use across more than one client project.
- `doc.licences.3.heading` :: ما يمنعه الترخيص   ⟂ EN: What the licence prohibits
- `doc.licences.3.list.1` :: إعادة بيع اللقطة كما هي أو إدراجها في مكتبة لقطات أخرى.   ⟂ EN: Reselling the clip as it is, or listing it in another footage library.
- `doc.licences.3.list.2` :: الاستخدام الذي يسيء إلى شخص ظاهر في اللقطة أو يوحي بتأييده لمنتج أو رأي.   ⟂ EN: Any use that reflects badly on a person appearing in the clip, or implies their endorsement of a product or opinion.
- `doc.licences.3.list.3` :: الاستخدام الذي يمسّ الرموز الدينية أو الوطنية أو الأماكن المقدّسة.   ⟂ EN: Any use that touches religious or national symbols, or holy places.
- `doc.licences.3.list.4` :: استخدام لقطة موسومة «للاستخدام التحريري فقط» في سياق تجاري.   ⟂ EN: Using a clip marked “editorial use only” in a commercial context.
- `doc.licences.3.list.5` :: نشر معاينة عليها علامة مائية. المعاينة التي تحمّلها لتجربة اللقطة في مونتاجك قبل الشراء، والترخيص يشمل فقط الملفات التي تصلك بعد الشراء.   ⟂ EN: Publishing a watermarked preview. A preview you download is for testing a clip in your own edit before you buy; the licence covers only the files delivered after purchase.
- `doc.licences.4.heading` :: التحريري مقابل التجاري   ⟂ EN: Editorial versus commercial
- `doc.licences.4.body.1` :: الألبوم الموسوم «مرخّص للاستخدام التجاري» اكتملت تصاريحه: تصاريح النماذج والمواقع والتصوير كلها موثّقة. أما «للاستخدام التحريري فقط» فيعني أن تصريحاً ما ناقص، ويقتصر استخدامه على السياق الإخباري والتوثيقي دون الترويج لمنتج أو خدمة.   ⟂ EN: An album marked “cleared for commercial use” has complete clearance: model, location and filming permits are all documented. “Editorial use only” means some clearance is missing, and use is limited to news and documentary contexts, without promoting a product or service.
- `doc.licences.5.heading` :: شهادة الترخيص   ⟂ EN: The licence certificate
- `doc.licences.5.body.1` :: تصدر مع كل عملية شراء شهادة ترخيص تحمل رقماً وقائمة اللقطات المشمولة ونص الترخيص الساري لحظة الشراء. تعديل نص الترخيص لاحقاً لا يغيّر ما اشتريته: الشهادة تحفظ النص كما كان.   ⟂ EN: Every purchase issues a licence certificate carrying a number, the list of clips covered, and the text of the licence as it stood at the moment of purchase. Changing the licence text later does not change what you bought: the certificate preserves the text as it was.
