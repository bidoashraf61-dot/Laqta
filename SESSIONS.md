# Running Parallel Sessions — Operating Manual

How six Claude Code sessions build **one website** without colliding.

---

## 1. How they all become one site

There is **one app, one repo, one deployment, one link.** Not six.

```
laqta.sa                         ← ONE Next.js app, ONE host
├── /                landing     ← session: landing
├── /footage /albums catalogue   ← session: catalogue
├── /account/*       client      ← session: client
├── /studio/*        creator     ← session: studio
└── /admin/*         admin       ← session: admin
```

Each surface is a **route folder inside the same codebase**, sharing one database, one auth system, one design system. Visitors see different sections based on their role. That's how every marketplace works.

**The flow:**

```
6 sessions, 6 branches
        │
        ▼  git push
   GitHub repo
        │
        ▼  merge each branch → main
      main
        │
        ▼  auto-deploy
   laqta.sa  ← the one link, always current
```

Each branch also gets its **own preview URL** on push (Vercel does this automatically), so you can review a session's work in isolation before merging.

---

## 2. Why git worktrees, not branches

You cannot run six parallel sessions in one folder — a folder can only have one branch checked out at a time.

**Git worktrees** solve this: multiple folders, one shared repo, each on its own branch.

```
Bido Visuals/
├── Stock Footage Portal/          ← main (this folder — your hub)
└── laqta-worktrees/
    ├── foundation/                ← feat/foundation
    ├── landing/                   ← feat/landing
    ├── studio/                    ← feat/studio
    ├── client/                    ← feat/client
    ├── catalogue/                 ← feat/catalogue
    └── admin/                     ← feat/admin
```

Same git history, same remote, zero collisions. Delete a worktree when its work is merged.

---

## 3. ⚠️ Step 1 — Foundation runs FIRST and ALONE

**Already created for you:** `/Users/bido/Bido Visuals/laqta-worktrees/foundation`

Open a Claude Code session **in that folder** and paste:

```
Read briefs/00-README-START-HERE.md and briefs/01-foundation.md, then build the foundation.
```

**Do not start any other session until this is merged.** It defines the schema, auth and design tokens that all five others build against. Skip this and you get five incompatible schemas.

When it's done:

```bash
cd "/Users/bido/Bido Visuals/laqta-worktrees/foundation"
git add -A && git commit -m "Foundation: schema, auth, design system, i18n"
git checkout main && git merge feat/foundation      # or open a PR
```

---

## 4. Step 2 — Create the other five worktrees

**Only after foundation is merged to `main`.** Run from the main folder:

```bash
cd "/Users/bido/Bido Visuals/Stock Footage Portal"
git worktree add "../laqta-worktrees/landing"   -b feat/landing
git worktree add "../laqta-worktrees/studio"    -b feat/studio
git worktree add "../laqta-worktrees/client"    -b feat/client
git worktree add "../laqta-worktrees/catalogue" -b feat/catalogue
git worktree add "../laqta-worktrees/admin"     -b feat/admin
```

Each branches from the *current* main, so each starts with the foundation already in place.

---

## 5. Step 3 — Open five sessions in parallel

Open a Claude Code session in each folder and paste its prompt:

| Folder | Prompt to paste |
|---|---|
| `landing/` | `Read briefs/00-README-START-HERE.md and briefs/02-landing-page.md, then build it.` |
| `studio/` | `Read briefs/00-README-START-HERE.md and briefs/03-creator-portal.md, then build it.` |
| `client/` | `Read briefs/00-README-START-HERE.md and briefs/04-client-portal.md, then build it.` |
| `catalogue/` | `Read briefs/00-README-START-HERE.md and briefs/05-catalogue-search.md, then build it.` |
| `admin/` | `Read briefs/00-README-START-HERE.md and briefs/06-admin-dashboard.md, then build it.` |

**Optional — use spec-kit for a more rigorous run.** In any session:

```
/speckit-specify   turn the brief into a formal spec
/speckit-plan      technical implementation plan
/speckit-tasks     dependency-ordered task list
/speckit-implement execute it
```

Heavier, but it produces a reviewable spec before code — worth it for the complex surfaces (studio, client, admin).

---

## 6. Merging without conflicts

**Each session merges to main when its slice works.** Rough order, though they're largely independent:

```
foundation → catalogue → client → studio → admin → landing
```

**Before merging, from inside the worktree:**

```bash
git fetch origin
git rebase main          # pull in others' merged work
npm run build            # must pass
git checkout main && git merge feat/<name>
```

**Conflicts should be rare** because each session owns a different route folder. When they do happen it's almost always in a shared file — which means someone edited outside their lane (see below).

---

## 7. The rules that keep this working

1. **Stay in your route folder.** Your brief names exactly what you own.
2. **Never edit shared files** — `prisma/schema.prisma`, `lib/auth.ts`, `components/ui/*`, `app/layout.tsx`. Those belong to Foundation.
3. **Need a schema change?** Write it in your brief's *Schema requests* section. Don't edit the schema. Batch these and apply them in one foundation follow-up.
4. **Merge often.** Long-lived branches are where conflicts breed.
5. **Arabic first.** Every string ships in Arabic. RTL is the default.

---

## 8. Deployment

**Recommended: Vercel.** Connect the GitHub repo once and you get:
- `main` → production at your domain
- every branch → its own preview URL automatically
- every PR → a preview link for review

**Set up:** push to GitHub → import the repo in Vercel → add env vars (`DATABASE_URL`, auth secrets, S3, gateway keys) → point your domain at it.

**Database:** one shared Postgres (Neon or Supabase). All sessions use the **same** `DATABASE_URL` in development so they're testing against the same schema and seed data.

---

## 9. Quick reference

```bash
# see all worktrees
git worktree list

# remove one when merged
git worktree remove "../laqta-worktrees/landing"
git branch -d feat/landing

# what changed on a branch
git diff main..feat/studio --stat
```
