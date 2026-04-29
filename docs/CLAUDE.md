---
> ⚠️ **DEPRECATED — DO NOT IMPLEMENT FROM THIS SPEC**
>
> This document references tables, columns, or architectural decisions that 
> conflict with the live database or current canonical specs. Last verified 
> against live DB on 2026-04-29.
>
> **Issue:** Stale module catalog (says 9 modules, root CLAUDE.md says 13). Lists 16 files in `/docs/claude/` that don't exist there.
>
> **Canonical replacement:** Root /CLAUDE.md
>
> See `docs/_AUDIT_2026_04_29.md` for full audit findings.
> See `docs/_INDEX.md` for the current canonical doc map.

---

# BAM Platform — Claude Code Context
## Last Updated: March 2026 — 16 context files, 4,000+ lines

This is the AI development context for **Ballet Academy and Movement's** proprietary studio platform.

Read all files in `/docs/claude/` before beginning any work.

## Quick Reference

| File | Contents |
|------|----------|
| `BRAND.md` | Colors, typography, tone of voice, visual identity |
| `DATA_MODEL.md` | Supabase schema, all tables, RLS policies |
| `MODULES.md` | All 9 platform modules with full feature specs |
| `STACK.md` | Tech stack, project structure, env vars, coding conventions |
| `UX_PATTERNS.md` | Component patterns, layouts, animations, accessibility |
| `SECURITY.md` | Auth, RLS, COPPA, mandated reporter compliance |
| `STREAMING_AUTH.md` | Family access model, guest tokens, GameChanger-style permissions |
| `BALLET_DOMAIN.md` | Curriculum, class levels, skill taxonomy, badge names, language guide |
| `MARKETING.md` | SEO system, Klaviyo sequences, Google/Meta ads, social content |
| `COMPETITIVE_ANALYSIS.md` | All 11 local competitors, platform rivals, pricing intel |
| `ACTION_PLAN.md` | Sprint-by-sprint task list with owner + AI-assist assignments |
| `EXPANSION.md` | Readiness score formula, expansion_markets/competitor_studios schemas, target markets |
| `SUPABASE_EMAIL_TEMPLATES.md` | Ready-to-paste branded HTML for Supabase auth emails (magic link, signup, reset, email change) |
| `SAAS.md` | Multi-tenant architecture, payment adapter pattern, onboarding wizard |

---

## Platform Purpose

Build the **most advanced studio management platform ever created** for a classical ballet studio.

This platform must:
- Beat every competitor (Jackrabbit, Mindbody, Dance Studio Pro, iClassPro) on UX
- Feel like a luxury product worthy of a Royal Ballet-caliber studio
- Be loved by parents, teachers, and students equally
- Eventually be white-labeled and licensed to other studios

---

## The 9 Modules

1. **Parent Portal** — enrollment, schedule, payments, communications
2. **Teacher Portal** — attendance, student progress, content upload, live streaming
3. **Admin Dashboard** — full studio operations, metrics, lead pipeline
4. **SEO Engine** — landing page generator for South OC cities
5. **Lead Capture + Nurture** — chatbot, trial class funnel, Klaviyo sequences
6. **Class Placement AI** — age → recommended class logic
7. **Studio Shop** — white-label POS (custom name/logo per event)
8. **Expansion Intelligence** — competitor tracking, market readiness scoring
9. **BAM Learning Studio (LMS)** — TikTok-style student feed, parent view, teacher tools, live streaming, gamified badges

---

## Non-Negotiables

1. **RLS on every Supabase table** — no exceptions
2. **Mobile-first** for parent and student interfaces
3. **Lavender (#9C8BBF) + Cream + Gold (#C9A84C)** color palette always
4. **Cormorant Garamond** for display text, **Montserrat** for UI
5. **Mandated reporter workflow** must always be visible and functional
6. **Never expose service_role key** to client-side code
7. **Class max = 10 students** — enforce at enrollment
8. **Tone: warm, refined, encouraging** — never corporate, never childish
9. **Never abbreviate to "BAM" publicly** — trademark conflict

---

## Studio Info

- **Address:** 400-C Camino De Estrella, San Clemente, CA 92672
- **Phone:** (949) 229-0846
- **Email:** dance@bamsocal.com
- **Repo:** github.com/greenlyzard/bam-platform
- **Production URL:** portal.balletacademyandmovement.com

- ## Migration Rules (MANDATORY)

These rules apply to every migration file written in this project. Violations cause deployment failures and require manual nano edits in production. Follow them without exception.

### 1. No Forward Foreign Key References

**Never** add a `REFERENCES` constraint to a table that may not exist yet in the migration sequence. This includes but is not limited to:

- `families`
- `students`
- `profiles`
- `user_profiles`
- `classes`
- `teachers`
- `productions`
- `enrollments`

**Wrong:**
```sql
family_id UUID REFERENCES families(id) ON DELETE SET NULL,
student_id UUID REFERENCES students(id),
```

**Correct:**
```sql
family_id UUID,
student_id UUID,
```

FK constraints will be added in a dedicated later migration once all referenced tables are confirmed to exist in the remote database.

### 2. Always Use `IF NOT EXISTS`

All `CREATE TABLE` statements must use `IF NOT EXISTS`. All `CREATE INDEX` statements must use `IF NOT EXISTS`. All `ALTER TABLE ADD COLUMN` statements must use `IF NOT EXISTS`.

**Wrong:**
```sql
CREATE TABLE enrollments (...);
CREATE INDEX idx_enrollments_family ON enrollments(family_id);
```

**Correct:**
```sql
CREATE TABLE IF NOT EXISTS enrollments (...);
CREATE INDEX IF NOT EXISTS idx_enrollments_family ON enrollments(family_id);
```

### 3. No Assumptions About Table Order

Do not assume that tables created in earlier migrations exist on the remote database. The remote DB may be behind by multiple migrations. Every migration must be self-contained and safe to run regardless of current remote state.

### 4. Check Before Adding Columns

When using `ALTER TABLE ADD COLUMN`, always use `IF NOT EXISTS`:

```sql
ALTER TABLE timesheet_entries
ADD COLUMN IF NOT EXISTS production_id UUID,
ADD COLUMN IF NOT EXISTS event_tag TEXT;
```

### 5. Supabase DB Push Runs in a Separate Terminal

The Supabase CLI browser-based login cannot complete inside Claude Code. Never attempt to run `npx supabase db push` inside a Claude Code session. Always remind Derek to run it in a separate normal terminal window:

```bash
cd /Users/derekshaw/bam-platform
npx supabase db push
```

### 6. Migration Filename Format

Always use the format:
```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Use the current timestamp at the time of writing. Never reuse or duplicate timestamps.

---

## Environment Variables

The following env vars are required in both `.env.local` and Vercel. Never hardcode these values in source code.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |
| `SUPABASE_AUTH_HOOK_SECRET` | Auth hook verification |
| `RESEND_API_KEY` | Transactional email |
| `RESEND_FROM_EMAIL` | Sender address |
| `ANTHROPIC_API_KEY` | Angelina chatbot |
| `STRIPE_SECRET_KEY` | Stripe payments (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe (client) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `PAYMENT_ENCRYPTION_KEY` | Tenant payment config encryption (add when building TENANT_PAYMENT_CONFIG) |
| `DEFAULT_TENANT_ID` | BAM tenant UUID |
| `NEXT_PUBLIC_APP_URL` | Full production URL |
| `DATABASE_URL` | Direct DB connection for migrations |

Never commit `.env.local` to git. Never log secret keys. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` to client-side code.

---

## Build Verification

After every Claude Code session, run before final push:

```bash
npx tsc --noEmit 2>&1 | head -20
npx next build 2>&1 | tail -30
```

Fix all TypeScript errors before committing. A passing build is required before `git push origin main`.

