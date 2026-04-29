# CLAUDE.md — BAM Platform AI Context

> This file is read by Claude Code at the start of every session.  
> It is the single source of truth for project context, decisions made, and work in progress.  
> **Keep this file updated as the project evolves.**

---

## 0. Claude Code — Session Start Protocol

**Every Claude Code session must begin by:**

1. Reading this file (`CLAUDE.md`) in full
2. Reading `docs/DATABASE_SCHEMA.md` (tables, columns, views, naming conventions)
3. Reading any spec file in `docs/` relevant to the current task
4. Never assuming a table, column, or view exists without checking `docs/DATABASE_SCHEMA.md` first

**Before writing any SQL or Supabase query:**
- Confirm the table exists in `docs/DATABASE_SCHEMA.md`
- Confirm the exact column name — do not guess
- Confirm FK column name (`user_id` not `profile_id`)
- Check whether `tenant_id` exists on that table before filtering by it

**Before creating a migration:**
- Check if the table already exists in `docs/DATABASE_SCHEMA.md`
- Use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` always
- Use `DROP POLICY IF EXISTS` before every `CREATE POLICY`

**After any schema change:**
- Run `NOTIFY pgrst, 'reload schema';` in Supabase SQL editor
- Update `docs/DATABASE_SCHEMA.md`

---

## 0.5. Canonical Doc Index — READ BEFORE ANY SPEC

**Before reading or writing any spec in `docs/`, consult `docs/_INDEX.md`.**

The index lists exactly one canonical doc per topic. If a doc has a 
deprecation header at the top, do not implement from it — it has drift 
or has been superseded.

Subordinate docs are read only when explicitly referenced from a canonical 
doc. Do not try to reconcile multiple specs on the same topic by reading 
all of them — find the canonical via `docs/_INDEX.md` and stop there.

If you find drift between any spec and the live database (`types/database.types.ts`), 
add a deprecation header to the spec and flag it in the next session.

- Building anything visual for the portal? Read 
  `docs/UI_STYLE_DIRECTIVES.md` first — it's the canonical source for 
  colors, typography, button styles, and the dropdown rule.

---

## 1. Project Identity

**Studio:** Ballet Academy and Movement  
**Founder:** Amanda Cobb — former professional ballerina  
**Mission:** High-level classical ballet training in a nurturing environment  
**Location:** 400-C Camino De Estrella, San Clemente, CA 92672  
**Phone:** (949) 229-0846  
**Email:** dance@bamsocal.com  
**Primary domain:** balletacademyandmovement.com  
**Redirect domain:** bamsocal.com (Cloudflare 301 → main site)  
**Payroll email:** PAYROLL@BAMSOCAL.COM

**Do not abbreviate the studio as "BAM" in public-facing content** — trademark conflict.

---

## 2. What We Are Building

A full studio management platform that serves BAM first, then white-labels as SaaS for other classical ballet studios.

**White-label ICP:** Classical ballet studios, 50–300 students, single location  
**White-label pricing:** $99–149/mo studio + $4.99–9.99/mo family app  
**White-label name candidates:** Reverence, Arabesque, Curtain, Pointe

**Current operational system:** Studio Pro (GoStudioPro) — still live. BAM Platform is being built in parallel. **Target go-live: Fall 2026 season.**

---

## 3. Platform Technical Stack

| Layer | Tool | Detail |
|-------|------|--------|
| Framework | Next.js 14 (App Router) | TypeScript throughout |
| Database | Supabase | Project ref: `niabwaofqsirfsktyyff` |
| Auth | Supabase Auth | Magic link + Google OAuth + password |
| Styling | Tailwind CSS + shadcn/ui | BAM theme in tailwind.config |
| Email transactional | Resend | Via `/api/auth/send-email` hook |
| Email marketing | Klaviyo | Sending domain: `send.bamsocal.com` |
| AI | Anthropic Claude API | Angelina chatbot |
| Payments | Stripe | Existing BAM account |
| Video | Cloudflare Stream | Token + Account ID needed |
| Hosting | Vercel Pro | Account: `derek@greenlyzard.com` |
| DNS | GoDaddy (balletacademyandmovement.com) + Cloudflare (bamsocal.com) |
| Repo | github.com/greenlyzard/bam-platform (private) |

**Production:** `https://portal.balletacademyandmovement.com`  
**Staging:** `https://staging.balletacademyandmovement.com`  
**BAM Tenant UUID:** `84d98f72-c82f-414f-8b17-172b802f6993`

### Key People

| Person | Email | Platform Role |
|--------|-------|--------------|
| Amanda Cobb | amandacobb@bamsocal.com | super_admin |
| Cara Matchett | cara@bamsocal.com | admin (also teaches) |
| Derek Shaw | derek@greenlyzard.com | Platform builder |

---

## 4. Database Naming Conventions — CRITICAL

**Check `docs/DATABASE_SCHEMA.md` before writing any query. These are the most common errors:**

| Convention | Correct | Wrong |
|------------|---------|-------|
| FK to profiles | `user_id` | `profile_id` |
| Role check | Query `profile_roles` table | Query `profiles.role` |
| Role values | Plain text strings | `::user_role` enum (DROPPED) |
| Teacher view | `teacher_profiles` (VIEW) | Assumes it's a table |
| Tenant filter | Only on tables with `tenant_id` | `classes` has no `tenant_id` |
| View columns | Check actual columns | `teacher_profiles` has no `tenant_id` or `full_name` |

### `user_role` enum is DROPPED
Never use `::user_role` cast. Use plain text: `'teacher'`, `'admin'`, `'super_admin'`, `'parent'`, `'student'`, `'front_desk'`, `'finance_admin'`.

### RBAC Architecture
Roles live in `profile_roles` table. `profiles.role` still exists but is unreliable — always use `profile_roles`.

```sql
-- Correct
SELECT 1 FROM profile_roles
WHERE user_id = auth.uid() AND role = 'teacher' AND is_active = true

-- Wrong — causes RLS recursion
SELECT 1 FROM profiles WHERE role = 'teacher'
```

### RLS Helper Functions (SECURITY DEFINER — use these in all policies)

| Function | Use |
|----------|-----|
| `is_admin()` | Checks profile_roles for admin/super_admin |
| `is_teacher()` | Checks profile_roles for teacher |
| `is_front_desk()` | Checks profile_roles for front_desk |
| `get_user_role()` | Returns primary role text from profile_roles |

### `teacher_profiles` View
- Is a **VIEW** not a table
- Columns: `id`, `first_name`, `last_name`, `email`, `phone`, `avatar_url`, `employment_type`, `hire_date`, `is_active`
- No `tenant_id`, no `full_name`, no `teacher_id` (use `id`)

---

## 5. Supabase Migration Protocol

Run in a **regular terminal** (not inside Claude Code):

```bash
npx supabase login
npx supabase link --project-ref niabwaofqsirfsktyyff
npx supabase db push
```

If migration was applied manually but not tracked:
```bash
npx supabase migration repair --status applied MIGRATION_TIMESTAMP
```

---

## 6. Current Build Status (March 2026)

### Built and Deployed

| Feature | Status |
|---------|--------|
| Auth (magic link, Google, password) | ✅ Live |
| RBAC (profile_roles + RLS) | ✅ Live |
| Admin dashboard | ✅ Live |
| Teacher portal | ✅ Live |
| Teacher timesheets (full module) | ✅ Live |
| Pay periods + payroll report | ✅ Live |
| Casting & rehearsal management | ✅ Live |
| Productions management | ✅ Live |
| Schedule instances (schema) | ✅ Live |
| Angelina AI chatbot | ✅ Live |
| Email templates editor | ✅ Live |
| Avatar upload + preferred name | ✅ Live |

### Not Yet Built (Studio Pro Parity — required for go-live)

| Feature | Priority |
|---------|----------|
| Parent registration + enrollment checkout (Stripe) | P0 |
| Recurring billing / autopay | P0 |
| Mass SMS + email to groups | P0 |
| Parent-facing schedule view | P0 |
| Fee billing (costumes, competitions, privates) | P1 |
| Waiver upload + digital signing | P1 |
| Studio store / product sales | P1 |
| Enrollment quiz with Stripe | P1 |
| Communications module | P1 |
| Badge system (M2) | P2 |
| Performance ticketing (M11) | P2 |
| San Clemente SEO landing page | P2 |

---

## 7. Thirteen Platform Modules

| # | Module | Replaces |
|---|--------|---------|
| M1 | Communications Hub | Quo + Robo-Texter |
| M2 | Badge + Achievement System | (net new) |
| M3 | Session & Scheduling | Studio Pro |
| M4 | Teacher Management | Studio Pro + Google Sheets |
| M5 | Sub-Brand Architecture | (net new) |
| M6 | Student & Family Profiles | Studio Pro |
| M7 | Registration & Enrollment | Studio Pro parent portal |
| M8 | Reporting & Intelligence | Studio Pro + Quo analytics |
| M9 | Physical Merchandise | (already built) |
| M10 | Group Communication & Social Feed | BAND |
| M11 | Performance Events & Ticketing | TutuTix |
| M12 | Legal, Waivers & Compliance | (net new) |
| M13 | Media Archive & Photo Distribution | Google Photos |

Full specs: `docs/strategy/platform-product-requirements.md`

---

## 8. Sub-Brand Structure

| Program | Palette | Entry |
|---------|---------|-------|
| Ballet Academy and Movement (all) | Lavender/Cream/Gold | Open |
| BAM Recreational / BAM Petite | Soft blue | Open enrollment |
| BAM Performance Company | Lavender | Teacher-selected |
| BAM Competition Company | Black / Gold | Auditioned |

---

## 9. Current Faculty

| Name | Notes |
|------|-------|
| Amanda Cobb | Founder, super_admin, lead instructor |
| Cara Matchett | admin + teacher |
| Samantha Weeks | Teacher |
| Paola Gonzalez | Teacher / Coach |
| Campbell Castner | Teacher |
| Lauryn Rowe | Teacher |
| Deborah Fauerbach | Teacher |
| Kylie Yamano | Teacher |
| Katherine Thomas | Teacher |
| Leila Meghdadi | Teacher |
| Catherine Galpin | Teacher |
| Aleah Doone | Teacher |
| Madelynn Hampton | Teacher |
| Ally Helmen | Teacher |

---

## 10. Brand Guidelines

**Palette:** Lavender `#9C8BBF` · Dark Lavender `#6B5A99` · Cream `#FAF8F3` · Gold `#C9A84C`  
**Typography:** Headings: Cormorant Garamond · UI: Montserrat (300–600)  
**Aesthetic:** Minimal luxury ballet studio. No cartoonish graphics, no generic fitness branding.  
**Tone:** Warm, refined, encouraging, knowledgeable.

Full guidelines: `docs/brand/brand-guidelines.md`

---

## 11. SEO Strategy

**Goal:** Rank #1 for ballet training across South Orange County.  
**Rule:** Ballet always featured first on every page.

| Tier | Cities |
|------|-------|
| 1 | San Clemente, Laguna Niguel, Dana Point |
| 2 | Ladera Ranch, Mission Viejo, San Juan Capistrano, Rancho Mission Viejo |

Full strategy: `docs/marketing/local-seo-strategy.md`

---

## 12. Platform Decisions Log

| Decision | Rationale |
|----------|-----------|
| Stay on Studio Pro until Fall 2026 | Risk of switching mid-season |
| Multi-tenant from day one | White-label SaaS requirement |
| Pluggable payment processors | Stripe first; others as alternatives |
| Roles in profile_roles, not profiles.role | Supports multi-role users |
| SECURITY DEFINER on RLS helpers | Prevents infinite recursion |
| user_role enum dropped | Use plain text role strings |
| Internal ad server first | Evaluate at scale |
| Video pre-roll in Phase 2 | Needs Cloudflare Stream |
| BAM Marketplace — build | Platform-wide, free tier included |
| Spec-first, then code | MD spec committed before any build |
| All features multi-tenant | Required for white-label |

---

## 13. Working Principles

- Spec-first: write full markdown spec, commit to `docs/`, then build
- Never build before the spec is committed
- All features must be multi-tenant from the start
- Ballet always featured first in all content
- Do not abbreviate studio as "BAM" in public-facing content
- DNS changes: always protect Google Workspace MX and Klaviyo DNS records
- Competition messaging: culture first, not a competition factory

---

## 14. UI Component Guidelines

For all visual styling in the portal — colors, typography, buttons, 
inputs, dropdowns, cards, and the full design system — see 
`docs/UI_STYLE_DIRECTIVES.md` (canonical). This section used to inline 
those directives but they now live in their own doc.

---

## Schema Verification (Mandatory Before Any DB Work)

Before writing ANY Supabase query or migration:
1. Read /types/database.types.ts — auto-generated from live DB, single source of truth
2. Every column you use MUST appear in this file exactly as spelled. If it's not there, it does not exist in the live DB.
3. After any migration push (done by Derek in Regular Terminal), regenerate types:
   Regular Terminal: supabase gen types typescript --project-id niabwaofqsirfsktyyff > types/database.types.ts
4. Then verify: npx tsc --noEmit (must be clean before writing new code)
5. Run the schema check script: bash docs/skills/bam-schema-sync/scripts/schema-check.sh

Supabase project ID: niabwaofqsirfsktyyff
Types file: /types/database.types.ts
Key tables reference: /docs/skills/bam-schema-sync/references/key-tables.md

Known column name traps from past bugs:
- students: use active (not is_active), no full_name column
- profile_roles: FK column is user_id (not profile_id)
- classes: no tenant_id column directly
- profiles: no full_name column — use first_name + last_name

---

## 15. Workflow Rules

- Do not enter plan mode for simple execution requests like commits, pushes, or running commands. Only plan for multi-step feature work.
- For execution-only tasks prefix internally with "Execute directly without entering plan mode"
- Batch no more than 2 tasks per request — a third task will be deferred to planning and never executed
- Run tsc after EVERY file edit, not just at the end of a session

## 16. Implementation Rules

- Before implementing from ANY spec, read ALL referenced spec docs fully first — confirm understanding before writing a single line of code
- If a spec references other docs, read those too before coding
- Never rebuild from an outdated spec — always check the docs/ directory for the latest version of any spec file
- Verify enum/level values against actual production DB before writing any filter or WHERE clause

## 17. Database / Supabase Rules

- Supabase joined relations return as arrays — type casts must always account for this (never assume .single() on a join)
- Verify FK relationships are unambiguous before writing joins
- Before writing any migration: list every table and enum it references and verify each exists in the current schema
- Before writing any filter: run SELECT DISTINCT on that column via supabase to confirm exact production values
- Never assume a column, table, or enum exists — check types/database.types.ts first
- Always use supabaseAdmin (not the regular client) for all server-side DB writes in API routes and webhooks

## 18. Parallel Agent Strategy

These module groups can run in parallel — no file conflicts:
- Group A: Tuition/Billing, Contract signing, Parent checkout
- Group B: SEO landing pages, Help Center, Marketing content
- Group C: Playwright test setup, GitHub Actions, Test fixtures

Rules for parallel sessions:
- Each session starts with: git pull origin main
- Each session works in a different route group or module
- Only ONE session pushes at a time — coordinate via Derek in Claude Chat
- Final step of every session: git add -A && git commit -m "..." && git push origin main

---

*Last updated: April 2026*
*Update whenever a major decision is made, a module ships, a table is added, or strategy shifts.*
