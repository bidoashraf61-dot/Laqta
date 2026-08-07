# محتوى الموقع — Website Content Source

**Status:** Draft for review · 7 August 2026
**Purpose:** The single source for every user-facing line on the portal. Edit here, then port to `messages/ar.json`.
**Name:** `[الاسم]` — placeholder. Swap with find-and-replace once decided.

> **Site is Arabic-only, RTL.** English glosses below are for review only and never ship.

---

## 0. The decisions this content is built on

| Decision | Locked |
|---|---|
| Market | **Saudi Arabia only.** No Gulf, no Egypt content |
| Product | Albums only — 15 / 30 / 50 / 70 clips. No single clips |
| Quality | 1080p at launch. 4K later as an upsell |
| Licence | **One licence for everyone.** Broadcast, cinema, OOH included |
| Ownership | One-time purchase, perpetual. No subscription |
| Content | AI-generated, **disclosed openly**. No religious sites |
| Creators | Live from day one. **Flat 30% commission** |
| Entity | Egyptian. Prices in **USD** |
| Buyers | Arab freelancers **and** Saudi agencies, equally |

---

## 1. The USP bank

**These are the canonical lines. Reuse them verbatim across pages — repetition is the point.**

### USP 1 — Price

> **٣٠ لقطة بـ ٧٩ دولار.**
> عند غيرنا، ٥٩ دولاراً تشتري لقطة واحدة مدتها ٦ ثوانٍ بجودة SD.

*30 clips for $79. Elsewhere $59 buys one 6-second SD clip.*

| Comparison line | Use on |
|---|---|
| **أقل بـ ١٦ مرة** من أرخص منافس سعودي | Everywhere |
| **أقل بـ ٢٢ مرة** من سعر اللقطة الواحدة عند FootageE | Pricing, landing |
| **أقل بـ ٢٣٧ مرة** من ترخيص البث عند عربستوك | Licences, enterprise |
| **٢٫٦٠ دولار للقطة** | Album pages |

### USP 2 — One licence, forever

> **ترخيص واحد. لكل المشترين. للأبد.**
> تلفزيون، سينما، لوحات الطرق، إعلانات مدفوعة — بلا سقف مشاهدات وبلا تاريخ انتهاء.

*One licence. For everyone. Forever.*

**The contrast line — this is the sharpest weapon you have:**

> عند غيرنا: الترخيص **ينتهي بعد سنتين**، وسقف إنتاج **١٠٠ ألف ريال**، وسقف **٥٠٠ ألف مشاهدة**.
> عندنا: **لا شيء من هذا.**

### USP 3 — Albums that cut together

> **ألبوم كامل، مو لقطات مبعثرة.**
> نفس الإضاءة، نفس التدرّج اللوني، نفس المواصفات. تحطه على التايم لاين ويشتغل من أول مرة.

*A whole album, not scattered clips.*

### USP 4 — No permits

> **أي موقع. أي فصل. أي ساعة.**
> بلا تصاريح، بلا انتظار، بلا طاقم تصوير. حتى اللقطات اللي ما ينفع تُصوَّر أصلاً.

*Any location. Any season. Any hour.*

### USP 5 — Buy once, own forever

> **تشتري مرة واحدة. تملكها للأبد.**
> بلا اشتراك. بلا تجديد. بلا انقطاع.

### USP 6 — Both orientations

> **كل لقطة أفقية ١٦:٩ ورأسية ٩:١٦.**
> نفس اللقطة، جاهزة للمنصتين.

### USP 7 — For the freelancer

> **الألبوم يدفع ثمن نفسه من أول شغلانة سعودية.**

*The album pays for itself on your first Saudi job.*

### USP 8 — Honest about AI

> **محتوى مولّد بالذكاء الاصطناعي — ونقولها بوضوح.**
> لهذا نقدر نوصل لأي مكان في أي وقت، وبهذا السعر.

*AI-generated — and we say so plainly.*

---

## 2. Brand lines

| Slot | Arabic | English |
|---|---|---|
| **Tagline** | لقطات السعودية في متناول الجميع | The Kingdom, within reach |
| **Descriptor** | مكتبة اللقطات السعودية | The Saudi footage library |
| **Offer line** | ترخيص واحد. للأبد. وبسعر أقل ٢٢ مرة. | One licence. Forever. At a twenty-second of the price |
| **Freelancer line** | الألبوم يدفع ثمن نفسه من أول شغلانة سعودية | — |

### Voice

- **Direct, not decorative.** Short sentences. Numbers over adjectives.
- **Concrete nouns.** "٣٠ لقطة بـ ٧٩ دولار" — never "أسعار تنافسية".
- **Never apologise for AI.** State it as the reason the offer exists.
- **Never overclaim.** No "real", no "documentary", no "authentic footage".

---

## 3. Navigation

| Route | Arabic label |
|---|---|
| `/` | الرئيسية |
| `/albums` | الألبومات |
| `/footage` | تصفّح اللقطات |
| `/locations` | المواقع |
| `/categories` | التصنيفات |
| `/collections` | المجموعات |
| `/creators` | صنّاع المحتوى |
| `/licences` | الترخيص |
| `/sell` | بيع أعمالك |

**Header CTA:** `تصفّح الألبومات`

---

## 4. Landing `/`

### Hero

> # السعودية. ٣٠ لقطة بـ ٧٩ دولاراً.
> عند غيرنا، هذا سعر لقطة واحدة.

**Sub:** ألبومات فيديو سعودية جاهزة للمونتاج. تشتري مرة واحدة، وتملكها للأبد — بترخيص واحد يشمل التلفزيون والسينما ولوحات الطرق.

**CTA:** `شاهد الألبومات` · **Secondary:** `كيف يعمل الترخيص؟`

### Trust strip

`ترخيص دائم` · `بلا اشتراك` · `بلا سقف مشاهدات` · `تحميل فوري` · `١٠٨٠p`

### Section 2 — The price comparison ⭐

> ## احسبها معنا

| | ٣٠ لقطة تكلّفك |
|---|---|
| FootageE | ‏١٬٧٧٠ دولاراً |
| عربستوك (ترخيص بث) | ‏١٨٬٥٤٠ دولاراً |
| ذا ستوك | ‏١٬٢٩٠ دولاراً |
| **[الاسم]** | **٧٩ دولاراً** |

**Caption:** نفس المحتوى. نفس الاستخدام التجاري. ترخيص أوسع.

### Section 3 — The licence ⭐

> ## ترخيص واحد. لكل المشترين. للأبد.

| مشمول | |
|---|---|
| سوشيال ميديا ويوتيوب وويب | ✅ |
| إعلانات مدفوعة بلا سقف مشاهدات | ✅ |
| **تلفزيون وبث** | ✅ |
| **سينما وعروض** | ✅ |
| **لوحات الطرق والشاشات الخارجية** | ✅ |
| أعمال العملاء | ✅ |
| حتى ١٠ أشخاص في الشركة | ✅ |
| **تاريخ انتهاء** | ❌ **لا يوجد** |

**Contrast:** عند غيرنا الترخيص ينتهي بعد سنتين وبسقف إنتاج ١٠٠ ألف ريال. عندنا لا.

### Section 4 — Albums

> ## ألبوم كامل يتركّب مع بعضه
> نفس الإضاءة، نفس التدرّج، نفس المواصفات. مو لقطات مبعثرة من كاميرات مختلفة.

*(Album grid — price visible on every card)*

### Section 5 — Locations

> ## تصفّح حسب المكان

الرياض · العلا · الدرعية · جدة · البحر الأحمر · الربع الخالي · حافة العالم

### Section 6 — Why AI ⭐

> ## نعم، مولّد بالذكاء الاصطناعي. وهذا سبب السعر.

بلا تصاريح تصوير. بلا انتظار موسم. بلا طاقم. نقدر نوصل للعلا وقت الغروب، وللربع الخالي بعد المطر، ولمواقع ما تُعطى تصاريح تصويرها أصلاً.

**نقولها بوضوح لأن وكالتك ستسأل.** ونعطيك شهادة ترخيص مكتوبة مع كل عملية شراء.

### Section 7 — For freelancers ⭐

> ## الألبوم يدفع ثمن نفسه من أول شغلانة سعودية

كنت ترفض الشغل السعودي لأن اللقطات أغلى من أجرك كله؟ ما عاد.

### Section 8 — How it works

`اختر الألبوم` ← `ادفع مرة واحدة` ← `حمّل واستخدمه للأبد`

### Section 9 — Creators

> ## عندك لقطات سعودية؟ بِعها هنا.
> تحتفظ بـ ٧٠٪ من كل عملية بيع. **CTA:** `ابدأ البيع`

---

## 5. Albums `/albums`

**H1:** الألبومات
**Sub:** كل ألبوم مجموعة متماسكة من لقطة واحدة. سعر واحد، ترخيص كامل، ملكية دائمة.

**Filters:** الموقع · التصنيف · عدد اللقطات · السعر · صانع المحتوى · الاتجاه

**Card:** اسم الألبوم · `٥٠ لقطة` · `١٠٨٠p` · **`١٢٩ دولاراً`** · ~~٣٢٩~~ · `أفقي ورأسي`

**Empty state:** ما لقينا ألبومات بهذي الفلاتر. جرّب توسيع البحث — المكتبة تكبر كل أسبوع.

---

## 6. Album page `/albums/[creator]/[slug]` ⭐ *the conversion page*

**Above the fold:** trailer · title · creator · `٥٠ لقطة · ١٠٨٠p · أفقي ورأسي · ١٢ دقيقة`

### Price block (sticky)

> ### ١٢٩ دولاراً
> ~~٣٢٩ دولاراً~~ · **عرض الإطلاق — ينتهي [التاريخ]**
> ‏٢٫٥٨ دولار للقطة الواحدة
>
> `أضف إلى السلة` · `اشترِ الآن`
>
> ✅ ترخيص كامل — تلفزيون وسينما ولوحات طرق
> ✅ ملكية دائمة، بلا تاريخ انتهاء
> ✅ تحميل فوري، وإعادة تحميل بلا حدود
> ✅ حتى ١٠ أشخاص في الشركة

**Comparison strip:** نفس الـ ٥٠ لقطة عند FootageE: **٢٬٩٥٠ دولاراً**.

**Sections:** كل اللقطات (grid) · ماذا يشمل الترخيص · المواصفات · عن صانع المحتوى · ألبومات مشابهة

**AI notice:** `محتوى مولّد بالذكاء الاصطناعي` — badge, always visible.

---

## 7. Footage explorer `/footage`

**H1:** تصفّح اللقطات
**Sub:** ابحث باللقطة، واشترِ بالألبوم.

**Search placeholder:** `ابحث… الرياض، العلا، لقطة جوية، غروب`

**Filters:** الاتجاه (أفقي ١٦:٩ / رأسي ٩:١٦) · الموقع · التصنيف · الحركة · حجم اللقطة · وقت اليوم

**Clip card ribbon:** `من ألبوم: العلا — الساعة الذهبية · ١٢٩ دولاراً`

**Zero results:** ما لقينا نتائج لـ «[البحث]». المكتبة تكبر كل أسبوع — أرسل لنا طلبك ونشوف.

---

## 8. Clip page `/footage/[slug]`

Watermarked player · specs table · location · AI badge.

### Conversion block

> **هذي اللقطة جزء من ألبوم «[اسم الألبوم]»**
> ‏٥٠ لقطة · ١٠٨٠p · أفقي ورأسي
> ### ١٢٩ دولاراً — مرة واحدة، ولك للأبد
> `اشترِ الألبوم` · `شاهد كل اللقطات` · `أضف إلى اللوح`

---

## 9. Licences `/licences` ⭐ *your strongest page*

> # ترخيص واحد. لكل المشترين. للأبد.
> ما عندنا ترخيص عادي وترخيص موسّع. ما عندنا سقف مشاهدات. ما عندنا تاريخ انتهاء. تشتري الألبوم، وتستخدمه في أي شيء، للأبد.

### مشمول

سوشيال ميديا · ويوتيوب · مواقع · إعلانات مدفوعة بلا سقف · أعمال العملاء · **تلفزيون** · **سينما** · **لوحات طرق وشاشات خارجية** · فعاليات ومعارض · محتوى داخلي · حتى ١٠ أشخاص في الشركة · عدد لا محدود من العملاء · تعديل وقصّ ودمج · حول العالم · **للأبد**

### غير مشمول

إعادة بيع اللقطات كمحتوى ستوك · تدريب نماذج ذكاء اصطناعي · **الاستخدام الصحفي أو الإخباري** — المحتوى مولّد ولا يمثّل أحداثاً حقيقية · أي استخدام مخالف للأنظمة السعودية

### قارن

| | [الاسم] | ذا ستوك | عربستوك |
|---|---|---|---|
| مدة الترخيص | **للأبد** | ينتهي بعد سنتين | حسب الاشتراك |
| سقف المشاهدات | **بلا سقف** | — | ٥٠٠ ألف |
| سقف ميزانية الإنتاج | **بلا سقف** | ١٠٠ ألف ريال | — |
| البث التلفزيوني | **مشمول** | ترخيص أعلى | ترخيص أعلى |
| سعر لقطة البث | **‏٢٫٦٠ دولار** | — | **‏٦١٨ دولاراً** |

**شهادة ترخيص PDF مع كل عملية شراء** — باسم شركتك، برقم الطلب وقائمة اللقطات. تحتاجها إدارة عميلك القانونية، وعندك.

---

## 10. Pricing block (reusable)

| الألبوم | اللقطات | الإطلاق | السعر الكامل | للقطة |
|---|---|---|---|---|
| الصغير | ١٥ | **‏٣٩ $** | ٩٩ $ | ‏٢٫٦٠ $ |
| المتوسط | ٣٠ | **‏٧٩ $** | ١٩٩ $ | ‏٢٫٦٣ $ |
| الكبير | ٥٠ | **‏١٢٩ $** | ٣٢٩ $ | ‏٢٫٥٨ $ |
| الموسّع | ٧٠ | **‏١٧٩ $** | ٤٤٩ $ | ‏٢٫٥٦ $ |
| **كل الألبومات** | الكل | **يرتفع مع المكتبة ↓** | — | — |

### Bundle ladder — the price must scale with the catalogue

⚠️ **A fixed bundle price breaks at launch.** With 3 albums, buying separately costs ~$337 — a $299 bundle saves almost nothing and looks dishonest.

| حجم المكتبة | مجموع الألبومات | **سعر الحزمة** | التوفير |
|---|---|---|---|
| ٣ ألبومات | ‏٣٣٧ $ | **‏٢٣٩ $** | ٢٩٪ |
| ٦ ألبومات | ‏٦٥٠ $ | **‏٣٤٩ $** | ٤٦٪ |
| ١٠ ألبومات | ‏١٬٠٥٠ $ | **‏٤٩٩ $** | ٥٢٪ |
| ١٤ ألبوماً | ‏١٬٤٥٠ $ | **‏٦٤٩ $** | ٥٥٪ |

**Bundle line:** كل ما في المكتبة بأقل من نصف سعرها. والسعر يرتفع كل ما أضفنا ألبومات — اشترِ الآن واحتفظ بالمكتبة كاملة، بما فيها الجديد.

⚠️ **Decide before launch:** does the bundle grant future albums too? If yes it's a powerful offer but caps your revenue from returning customers. **Recommendation: bundle covers the catalogue at purchase date only**, with a discounted upgrade path.

---

## 11. Locations `/locations`

**H1:** لقطات السعودية حسب المكان
**Sub:** كل موقع مصوّر في أوقات وفصول مختلفة — بما فيها أوقات ما ينفع تصويرها على أرض الواقع.

**Per location `[slug]`:** H1 `لقطات [الموقع]` · intro · album grid · clip grid · related.

**SEO titles** *(these carry the search traffic, not the brand)*:
- `لقطات الرياض ١٠٨٠p — جاهزة للمونتاج | [الاسم]`
- `فيديوهات العلا بدون حقوق ملكية — ترخيص دائم`
- `فوتيج جدة والبحر الأحمر — لقطات جوية`

---

## 12. Sell `/sell`

> # عندك لقطات سعودية؟ بِعها هنا.
> ارفع ألبومك، واحتفظ بـ **٧٠٪** من كل عملية بيع.

| | |
|---|---|
| حصتك | **٧٠٪** من كل بيع |
| الحد الأدنى للسحب | ٥٠ دولاراً |
| موعد الصرف | شهرياً |
| الحصرية | **غير مطلوبة** |
| نوع المحتوى | تصوير حقيقي أو مولّد — بشرط الإفصاح |

**Rules:** ١٥ لقطة كحد أدنى · موضوع واحد متماسك · مواصفات موحّدة · احجز موقعك قبل الإنتاج (أول من يحجز) · موافقة الإدارة قبل النشر.

**CTA:** `قدّم ألبومك`

---

## 13. Cart & checkout

**Cart empty:** سلتك فاضية. `تصفّح الألبومات`

**Cart reassurance:** ✅ ترخيص كامل ودائم · ✅ تحميل فوري · ✅ إعادة تحميل بلا حدود

**Checkout:** الفاتورة تصدر من [الكيان] بالدولار الأمريكي.

**Refund notice:** ⚠️ **لا يوجد استرجاع بعد التحميل.** لك ٧ أيام للاسترجاع إذا لم تُحمّل أي ملف.

**Success:** تم. الألبوم صار ملكك للأبد. `اذهب إلى مكتبتك` · `حمّل شهادة الترخيص`

---

## 14. About `/about`

> # ليش [الاسم]؟

المحتوى المرئي السعودي غالٍ. لقطة واحدة مدتها ست ثوانٍ بجودة SD تكلّف ٥٩ دولاراً. ترخيص بث للقطة واحدة يصل إلى ٦١٨ دولاراً. يعني مستقل عربي يشتغل مع عميل سعودي يدفع أكثر من أجره كله عشان يجيب اللقطات.

بنينا [الاسم] عشان هذا يتغيّر.

نولّد لقطات السعودية بالذكاء الاصطناعي — ونقولها بوضوح. لهذا نقدر نوصل لأي موقع في أي فصل وأي ساعة، بلا تصاريح ولا انتظار. ولهذا سعرنا أقل بستة عشر ضعفاً.

ونعطي الجميع نفس الترخيص: تلفزيون، سينما، لوحات طرق، للأبد. بلا سقف ولا تاريخ انتهاء.

**ما نبيعه:** لقطات سعودية مولّدة، بجودة عالية، بترخيص واضح، بسعر يقدر عليه المستقل.
**ما لا نبيعه:** محتوى إخباري أو وثائقي، ولا مواقع دينية.

---

## 15. Legal pages

| Route | H1 | Must state |
|---|---|---|
| `/terms` | الشروط والأحكام | Egyptian entity, USD, governing law |
| `/refunds` | سياسة الاسترجاع | **No refund after download.** 7 days if undownloaded |
| `/privacy` | سياسة الخصوصية | Data collected, retention, contact |
| `/content-policy` | سياسة المحتوى | **AI disclosure mandatory** · no religious sites · no real people · no editorial use · Saudi content standards |

---

## 16. FAQ (reusable block)

**هل المحتوى مولّد بالذكاء الاصطناعي؟**
نعم، ونقولها بوضوح. كل ألبوم عليه شارة واضحة. هذا سبب قدرتنا على الوصول لأي موقع في أي وقت، وسبب السعر.

**أقدر أستخدمه في إعلان تلفزيوني؟**
نعم. الترخيص يشمل التلفزيون والسينما ولوحات الطرق، بلا رسوم إضافية.

**الترخيص ينتهي؟**
لا. تشتري مرة واحدة وتملكها للأبد.

**ليش السعر رخيص لهذي الدرجة؟**
لأن التوليد أرخص من التصوير. ما فيه طاقم ولا تصاريح ولا سفر. نمرّر الفرق لك.

**أقدر أستخدمه في محتوى إخباري؟**
لا. المحتوى مولّد ولا يمثّل أحداثاً أو أشخاصاً حقيقيين.

**فيه مواقع دينية؟**
لا. لا نولّد ولا نبيع لقطات للحرمين الشريفين أو المساجد.

**أقدر أرجّع الألبوم؟**
بعد التحميل لا. قبل التحميل، لك ٧ أيام.

**الملفات بأي جودة؟**
‏١٠٨٠p حالياً، أفقي ١٦:٩ ورأسي ٩:١٦. الـ ٤K قادم.

---

## 17. Footer

**Columns:** المنتج (الألبومات · اللقطات · المواقع · التصنيفات) · الترخيص (الترخيص · الأسعار · الاسترجاع) · صنّاع المحتوى (بيع أعمالك · سياسة المحتوى) · الشركة (من نحن · تواصل · الخصوصية · الشروط)

**Bottom line:** `[الاسم] — مكتبة اللقطات السعودية · محتوى مولّد بالذكاء الاصطناعي · جميع الحقوق محفوظة ٢٠٢٦`

---

## 18. USP placement map

**Every USP should appear at least three times. Check against this.**

| USP | Landing | Album | Licences | Pricing | About | FAQ |
|---|---|---|---|---|---|---|
| Price / 16× | ✅ hero + §2 | ✅ strip | ✅ table | ✅ | ✅ | ✅ |
| One licence forever | ✅ §3 | ✅ block | ✅ whole page | ✅ | ✅ | ✅ |
| Albums cut together | ✅ §4 | ✅ | — | — | — | — |
| No permits | ✅ §6 | ✅ | — | — | ✅ | ✅ |
| Own forever | ✅ hero | ✅ | ✅ | ✅ | ✅ | ✅ |
| Both orientations | ✅ trust | ✅ | — | ✅ | — | ✅ |
| Freelancer line | ✅ §7 | — | — | ✅ | ✅ | — |
| AI disclosed | ✅ §6 | ✅ badge | ✅ | — | ✅ | ✅ |

---

## 19. Open items

- [ ] **Name** — `[الاسم]` placeholder throughout
- [ ] Launch offer end date
- [ ] Egyptian entity legal name for `/terms` and invoices
- [ ] Licence certificate PDF wording — needs a lawyer
- [ ] Confirm FootageE's $59/6s SD figure in writing before publishing the comparison
- [ ] Decide whether creator albums are opt-in to the bundle
- [ ] Decide whether the bundle grants future albums (recommendation: no)

---

## 20. Where the numbers come from

Every comparison in this document is sourced. **Do not publish a claim that isn't on this list.**

| Claim | Source | Verified |
|---|---|---|
| FootageE — $59 per 6-second SD clip | You, from their site | ⚠️ **Get a screenshot before publishing** |
| عربستوك — $137–158 per standard video | Their points pricing: 20 pts × $6.87–7.90 | ✅ arabsstock.com/ar/plans |
| عربستوك — $618–711 per broadcast video | 90 pts × $6.87–7.90 | ✅ arabsstock.com/ar/plans |
| عربستوك — 500,000 impression cap | Their licence agreement | ✅ |
| ذا ستوك — $43 per clip | 8,000 SAR ÷ 50 clips | ⚠️ You reported this — confirm |
| ذا ستوك — licence expires after 2 years | Their terms | ✅ thestock.sa/ar/more/terms-of-use-and-licences |
| ذا ستوك — 100,000 SAR production cap | Their terms | ✅ |
| Your cost — $257 per 50-clip album | 5,706 credits × $0.045 | ✅ Higgsfield pricing |

⚠️ **Legal note:** comparative advertising against named competitors is legal in most markets but you must be able to prove every figure. Screenshot everything with a date before the site goes live.
