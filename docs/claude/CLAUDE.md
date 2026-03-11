# BAM Platform — Claude Code Context
## Last Updated: March 2026 — 14 context files, 3,500+ lines

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
4. **Cormorant Garamond** for display text, **Nunito** for UI
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
