# Blog post editor

**Route** `/admin/blog/[id]` · **Access** admin · **Rendering** server component + `BlogEditor` (client)

## Purpose
Write one post (DEV-44): both languages, SEO fields, category, cover, album embeds, with a live
preview of what the article page renders; save as draft, publish now, or schedule.

## Data in
- The post; categories; up to 200 live albums (`handle/slug` + Arabic title) for the embed picker.
- `publishAt` shown as Riyadh wall-clock time in the datetime input.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| العنوان عربي (required)/إنجليزي, الرابط (`[a-z0-9-]`, unique), التصنيف, الملخص عربي/إنجليزي, صورة الغلاف (media key or `/` path) | form fields | Saved with any of the three buttons |
| «ألبوم للإدراج» + «أدرجه في النص العربي» / «في الإنجليزي» | client | Inserts `[[album:handle/slug]]` on its own line at the cursor |
| النص عربي / إنجليزي (textareas; hint lists the markup) | form fields | `bodyAr` / `bodyEn` |
| «المعاينة» with «العربية» / «الإنجليزية» | client | Renders the same `parseBody` output live, RTL/LTR; embeds shown as named placeholders, «غير منشور — لن يظهر» for an unknown album |
| «في نتائج البحث»: العنوان عربي/إنجليزي (≤70), الوصف (≤160) | form fields | `seo*` |
| «انشر الآن» / «حدّث المنشور» (gold) | `savePost` intent `publish` | `status=published`; `publishAt` = now on first publish, kept on later updates; toast «نُشر المقال.» |
| «احفظ مسودة» / «أرجعه مسودة» | intent `draft` | `status=draft` (hidden) — «حُفظت المسودة.» |
| «موعد النشر (توقيت الرياض)» + «جدوِل» | intent `schedule` | Read as +03:00; must be in the future («موعد النشر لازم يكون في المستقبل.»); `status=scheduled` — «جُدول المقال — يظهر وحده في موعده.» |
| «افتح الصفحة» (not for drafts) | plain `<a target=_blank>` | The public article |
| «احذف المقال» (confirm) | `deletePost` | Deletes; audited; back to the list |

Refusals: invalid/taken slug, no Arabic title, publishing/scheduling without an Arabic body, a description over 160.
Every save revalidates the list, both languages of the post, and the blog index; audited `blog.save|published|scheduled`.

## Verified by
`verify:flows` (preview renders a typed heading; publish → `/blog/[slug]` 200; schedule for later → 404 until then).
