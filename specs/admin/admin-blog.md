# Blog (admin)

**Route** `/admin/blog` · **Access** admin · **Rendering** server component, dynamic

## Purpose
The blog's posts and categories (DEV-44).

## Data in
- `BlogPost` (latest 200 by `updatedAt`): title, slug, status, `publishAt`, category.
- `BlogCategory` with post counts.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «مقال جديد» (gold, header) | `createPost` | Creates a draft «مقال بلا عنوان» with a `draft-…` slug and the admin as author; audited `blog.create`; redirects to its editor |
| Post title (plain `<a>`) | navigation | `/admin/blog/[id]` ([spec](admin-blog-id.md)) |
| «أضف تصنيفاً» — الاسم عربي/إنجليزي + الرابط | `saveBlogCategory` | Upsert by slug (`[a-z0-9-]`); audited `blog.category` |

## States
- Status badge: «مسودة» (neutral) · «منشور» (success, when public now) · «مجدول» + date (warning, when its time has not come).
- **No posts** — «ما فيه مقالات بعد».

## Verified by
`verify:flows` (create → publish → public → schedule → hidden), `verify:arabic`, `audit`.
