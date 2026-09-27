# Blog article

**Route** `/blog/[slug]` · **Access** public · **Rendering** server component, dynamic

## Purpose
One article (DEV-43).

## Data in
- `getPublicPost(slug)` (public only — else 404), with category and author.
- Body: `bodyEn` on the English page when written, else `bodyAr`, parsed by `lib/blog-render.ts#parseBody` (paragraphs, `## `/`### ` headings, `- ` lists, `> ` quotes, `**bold**`, `[text](/path|https://…)` — any other scheme drops to text — and `[[album:handle/slug]]` embeds). Never HTML.
- Embeds: `getAlbumCardsByRef` — live albums only; an embed of a paused/unknown album renders nothing.
- «من المدونة أيضاً»: up to two other posts of the same category.

## Controls
Breadcrumb «المدونة» (Link) › category (plain `<a>`); links inside the body; embedded album cards; related post titles.

## States
- Header: title (display serif, balanced) and a line — date, «قراءة {n} د» (`readingMinutes`, ~180 words/min, at least 1).
- Cover (16:9, wide) when `coverKey` is set.
- Body on a 68ch serif measure; headings with space above; album embeds as real `AlbumCard`s.

## SEO
Title: own-language `seoTitle*`, else the title; description: own-language `seoDesc*`, else the excerpt, else the body's first 155 characters; `og:type=article` with published/modified times and the cover; **Article JSON-LD** (headline, description, `inLanguage`, dates, `mainEntityOfPage`, image, author/publisher Laqta with logo); canonical + hreflang.

## Invariants
- Nothing typed in the editor reaches the page as HTML; `javascript:`/`data:`/protocol-relative links are refused.

## Verified by
Unit tests `tests/unit/blog-render.test.ts`; `verify:seo` (Article JSON-LD); `verify:flows` publishes a post and reads it back; `verify:arabic`, `audit`.
