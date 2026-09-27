# Blog

**Route** `/blog`, `/blog/category/[slug]` (+ `?page=n`), `/blog/rss.xml` (+ `?lang=en`) · **Access** public · **Rendering** server components, dynamic; the feed revalidates hourly

## Purpose
The Laqta blog (DEV-43): guides for people making Saudi content — choosing footage, seasonal
campaigns, the licence. Read mode, in the site's editorial voice.

## Data in
- `lib/blog.ts`: a post is public when `status` is `published` or `scheduled` **and** `publishAt <= now` (`publicPostWhere`) — a scheduled post appears on its own at its time; no job flips it.
- `listPosts({ categorySlug, page })` — 12 per page, newest first; `blogCategories()` — categories holding at least one public post.
- Titles/excerpts via `pickLocalised` (English when written, else Arabic).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Category chips — «الكل» + each category (plain `<a>`, `aria-current` on the active one) | navigation | `/blog` or `/blog/category/[slug]`; an unknown or empty category → 404 |
| Post title (card) | Link | `/blog/[slug]` |
| «الأحدث» / «الأقدم» + `n / N` | plain `<a>` | `?page=n` |

## States
- Header: two-cut headline «من مدونة لقطة، / دليل من يصنع محتوى سعودي.» (on a category page the bold line is the category name) and an intro in serif.
- Page 1: the newest post leads wide (cover 3fr beside the text), the rest in two columns; later pages: two columns.
- **No posts** — «ما فيه مقالات بعد» / «أول المقالات قريباً.»
- Card: 16:9 cover when set (`mediaUrl`), category and date, title, excerpt.

## Feed
`/blog/rss.xml` — RSS 2.0, the latest 50 public posts, Arabic; `?lang=en` for English (the locale rewrite skips paths with an extension, hence a parameter). Linked from `/blog` as `alternates.types['application/rss+xml']`.

## SEO
Title «المدونة» / "Blog"; description `brand.seo.blog`; category pages «مقالات {name}» with `brand.seo.blogCategory`; canonical + hreflang per language; the index, each category and each post are in the sitemap (while there are public posts). Linked from the footer («المدونة», `FOOTER_LEGAL`).

## Invariants
- Drafts and future-scheduled posts never render publicly.

## Verified by
`verify:seo` (`/blog` and an article: canonical, hreflang, title, JSON-LD language; the feed in both languages), `verify:arabic`, `audit`. The demo seed publishes two posts.
