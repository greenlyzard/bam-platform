# BAM Platform — Canonical Doc Index

> **READ THIS FIRST.** Before reading or writing any spec in `docs/`, consult
> this index to find the canonical doc for the topic. Subordinate docs are
> read only when explicitly referenced from canonical.
>
> Last reconciled: 2026-04-29
> See `docs/_AUDIT_2026_04_29.md` for the audit that produced this.

## How to use this index

- **Canonical** = the one authoritative file for a topic
- **Subordinate** = supporting specs that extend or detail the canonical
- **Deprecated** = drifted, superseded, or stale; flagged inline; do not implement
- **🟡 Pending** = canonical not yet decided; reconciliation scheduled

## Foundation
| Doc | Status |
|---|---|
| `/CLAUDE.md` | Canonical — session-start protocol |
| `docs/DATABASE_SCHEMA.md` | Canonical — schema source of truth |
| `docs/UI_STYLE_DIRECTIVES.md` | Canonical — portal styling (visual tokens) |
| `docs/_INDEX.md` | This file |
| `docs/_AUDIT_2026_04_29.md` | Reference — historical audit |

## Strategy & Modules
| Topic | Canonical | Notes |
|---|---|---|
| Module map (capabilities, M1–M13) | `docs/strategy/platform-product-requirements.md` | Canonical |
| Portal/route surface map | `docs/PORTAL_SURFACES.md` | Canonical |
| Sprint plan | `docs/ACTION_PLAN.md` | Living |
| Current state | `docs/CURRENT_STATE.md` | Stale — refresh needed |
| Studio Pro comparison | `docs/STUDIO_PRO_COMPARISON.md` | + `docs/operations/studio-pro-gap-analysis.md` |
| Competitive analysis | `docs/COMPETITIVE_ANALYSIS.md` | + DANCEMASTERPRO, marketing/competitive-intelligence |

## Communications
| Topic | Canonical | Subordinate |
|---|---|---|
| All comms | `docs/COMMUNICATIONS.md` | HUB, INBOX, TRIAGE, PRIVATE_FEED, CONTACT_ALIASES, CONTACT_CHANNELS |
| Quick ref for Claude | `docs/claude/COMMUNICATIONS.md` | — |

## Scheduling
| Topic | Canonical | Vision/Reference |
|---|---|---|
| Schedule + classes | `docs/CLASSES.md` + `docs/DATABASE_SCHEMA.md` (current state) | `docs/SCHEDULING_AND_LMS.md` (design exploration) |
| Seasons & archival | `docs/SEASONS_AND_ARCHIVAL.md` | — |

**Deprecated:** `CALENDAR_AND_SCHEDULING.md`, `UNIFIED_SCHEDULE.md` (proposal rejected — see header)

## Enrollment & Registration
| Topic | Canonical | Status |
|---|---|---|
| Master flow | 🟡 Pending | REGISTRATION_AND_ONBOARDING vs ENROLLMENT_AND_PLACEMENT — choose one |
| Wizard UX | `docs/ENROLLMENT_FLOW_SPEC.md` | Canonical |
| Quiz logic | `docs/ENROLLMENT_QUIZ_SPEC.md` | Canonical |
| Embeddable widget | `docs/ENROLLMENT_WIDGET.md` | Canonical |
| New-student CRM pipeline | `docs/NEW_STUDENT_PIPELINE.md` | Canonical |

**Deprecated:** `ENROLLMENT_POLICY.md`

## Classes
| Topic | Canonical |
|---|---|
| Class management | `docs/CLASSES.md` |
| Levels & programs | `docs/LEVELS_AND_PROGRAMS.md` |
| Curriculum & badges | `docs/CURRICULUM_AND_PROGRESSION.md` |

**Deprecated:** `CLASSES_AND_RESOURCES.md`, `LEVEL_SYSTEM.md`

## Students & Profiles
| Topic | Canonical | Subordinate |
|---|---|---|
| Student profile | `docs/STUDENT_PROFILE.md` | STUDENT_PROFILE_ACCESS_CONTROL, STUDENT_PROFILE_ENHANCEMENT |

## Teachers
| Topic | Canonical | Status |
|---|---|---|
| Portal overview | `docs/TEACHER_PORTAL.md` | Canonical |
| Time & attendance | `docs/TEACHER_TIME_ATTENDANCE.md` | Canonical |
| Onboarding (HR) | `docs/operations/teacher-onboarding.md` | Canonical |
| Recruitment | `docs/operations/teacher-recruitment.md` | Canonical |
| Rate management | `docs/TEACHER_RATE_MANAGEMENT.md` | Canonical |
| Substitute coverage | `docs/TEACHER_SUBSTITUTE_COVERAGE.md` | Canonical |
| Substitute reporting | `docs/TEACHER_ABSENCE_SUBSTITUTE_SUMMARY.md` | Canonical |

**Deprecated:** SUBSTITUTE_TEACHER

## RBAC & Permissions
| Topic | Canonical |
|---|---|
| RBAC architecture | `docs/RBAC_AND_PERMISSIONS.md` |
| RLS audit findings | `docs/PERMISSIONS_AUDIT.md` |

**Deprecated:** `ROLES_AND_PERMISSIONS.md`, `ROLE_BASED_NAV_SPEC.md`

## Billing
| Topic | Canonical |
|---|---|
| Tuition & credits | `docs/BILLING_AND_CREDITS.md` |
| FSA/HSA invoice PDF | `docs/INVOICE_PDF.md` |
| Performance/competition costs | `docs/PERFORMANCE_COMPETITION_COSTS.md` |

**Deprecated:** `TENANT_PAYMENT_CONFIG.md` (white-label feature deferred)

## Brand
| Topic | Canonical | Status |
|---|---|---|
| Brand identity, voice, photography | `docs/BRAND.md` | Canonical |
| Portal styling (visual tokens) | `docs/UI_STYLE_DIRECTIVES.md` | Canonical |
| UX patterns (component behaviors) | `docs/UX_PATTERNS.md` | Canonical |
| Public website styling (Flatsome / WordPress) | `docs/brand/website-theme-settings.md` | Canonical (website only) |

**Deprecated:** `brand/brand-guidelines.md` (split between BRAND.md and UI_STYLE_DIRECTIVES.md)

## Marketing
| Topic | Canonical |
|---|---|
| Master overview | `docs/MARKETING.md` |
| Ad platform integrations | `docs/MARKETING_INTEGRATIONS.md` |
| Local SEO | `docs/marketing/local-seo-strategy.md` |
| Content plan | `docs/marketing/content-marketing-plan.md` |
| Lead capture funnel | `docs/marketing/lead-capture-funnel.md` |
| Competitive intel | `docs/marketing/competitive-intelligence.md` |
| In-platform ads | `docs/ADVERTISING.md` |
| Chatbot/lead capture | `docs/CHATBOT_AND_LEAD_CAPTURE.md` |

## Operations & Compliance
| Topic | Canonical |
|---|---|
| Mandated reporter | `docs/operations/mandated-reporter-protocol.md` |
| Studio Pro gap | `docs/operations/studio-pro-gap-analysis.md` |
| Expansion strategy | `docs/expansion/location-expansion-strategy.md` |
| Security | `docs/SECURITY.md` |
| Testing | `docs/TESTING.md` |
| Stack | `docs/STACK.md` |
| Integrations | `docs/INTEGRATIONS.md` |

## Other Active Docs
- `docs/ATTENDANCE.md`
- `docs/CASTING_AND_REHEARSAL.md`
- `docs/DOCUMENT_LIBRARY.md`
- `docs/EMAIL_TEMPLATES.md`
- `docs/SUPABASE_EMAIL_TEMPLATES.md`
- `docs/NOTIFICATIONS.md`
- `docs/MAKEUP_POLICY.md`
- `docs/CONTRACTS_AND_COMMITMENTS.md`
- `docs/RESOURCE_INTELLIGENCE_SPEC.md`
- `docs/STAFF_RESOURCE_LIBRARY.md`
- `docs/PORTAL_FEATURES.md`
- `docs/STREAMING_AUTH.md`
- `docs/PERFORMANCE_MEDIA_AND_MONETIZATION.md`
- `docs/MEDIA_HUB.md`
- `docs/TICKETING.md`
- `docs/APP_STORE_SETUP.md`
- `docs/BALLET_DOMAIN.md`
- `docs/COMPETITION_SEASONS_PRIVATES.md`
- `docs/PRIVATE_LESSONS.md`
- `docs/DATA_MODEL.md`
- `docs/ANGELINA_SPEC_V2.md`
- `docs/ANGELINA_AND_CLAUDE_API.md`
- `docs/SAAS.md`

## Archive Candidates (Phase 2)
- `docs/bam-schedule-v10.html` — 99KB HTML mockup
- `docs/PROMPT_communications_inbox.md` — one-shot prompt
- `docs/CLAUDE_CODE_TEACHER_PORTAL_INSTRUCTIONS.md` — one-shot prompt
- `docs/HOW_TO_ADD_SKILLS.md` — generic tutorial
- `docs/CLAUDE.md` — stale catalog (deprecated header added in this commit)

## Pending Reconciliation Tasks
1. Enrollment master: pick REGISTRATION_AND_ONBOARDING vs ENROLLMENT_AND_PLACEMENT
2. ✅ RESOLVED 2026-04-29 — Module count discrepancy. The two docs were not versions of the same list — they describe the platform from different angles. MODULES.md renamed to PORTAL_SURFACES.md (12 route surfaces); strategy PRD remains canonical for the M1–M13 capability taxonomy. New thin MODULES.md pointer file created to route readers to the right doc.
3. ✅ RESOLVED 2026-04-29 — UNIFIED_SCHEDULE proposal rejected. /admin/schedule and /admin/classes intentionally remain separate surfaces serving distinct workflows. Class Builder enhancement tracked as item 10 below.
4. ✅ RESOLVED 2026-04-29 — Teacher rate management. Doc rewritten to match live `teacher_rate_cards` schema. The earlier proposal of three split tables was replaced by a single consolidated rate-cards table in the live DB; doc now reflects that.
5. ✅ RESOLVED 2026-04-29 — Teacher substitute system. Three docs rewritten: TEACHER_SUBSTITUTE_COVERAGE.md and TEACHER_ABSENCE_SUBSTITUTE_SUMMARY.md aligned to plural table names (absence_records, substitute_requests, substitute_alerts, substitute_authorizations, teacher_sub_eligibility) with workflow notes on the request-fill model. SUBSTITUTE_TEACHER.md (item #6) remains separately pending.
6. SUBSTITUTE_TEACHER (39KB): decide whether to build onboarding tables or rewrite doc
7. ✅ RESOLVED 2026-04-29 — Style/UX nuance pass. Canonical UI_STYLE_DIRECTIVES.md created for portal app. Five docs reduced to three canonicals (BRAND.md for identity, UI_STYLE_DIRECTIVES.md for portal styling, UX_PATTERNS.md for component behaviors). website-theme-settings.md scoped to public WordPress site only. brand/brand-guidelines.md deprecated.
8. ✅ RESOLVED 2026-04-29 — CLASSES_ARCHITECTURE_CLEANUP rewrite no-longer-needed. Underlying conflicts resolved via D3 status constraint migration and CLASS_SCHEMA_DECISIONS.md. Doc stays deprecated as historical artifact.
9. ✅ RESOLVED 2026-04-29 — Inter-canonical class conflict resolution. See docs/CLASS_SCHEMA_DECISIONS.md. SCHEDULING_AND_LMS.md demoted to vision doc; CLASSES.md + DATABASE_SCHEMA.md are operational canonical.
10. Class Builder module — current /admin/classes is a basic CRUD surface. Spec needed for the real Class Builder workflow: bulk CSV import (see deferred docs/CLASS_CSV_IMPORT.md draft), drag-and-drop draft mode, multi-class conflict detection, capacity vs demand planning, atomic publish action that promotes drafts to active classes visible in /admin/schedule. Used during season planning, not day-to-day. Distinct from the operational /admin/schedule view.
