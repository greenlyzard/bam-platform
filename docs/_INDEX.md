# BAM Platform — Canonical Doc Index

> **READ THIS FIRST.** Before reading or writing any spec in `docs/`, consult
> this index to find the canonical doc for the topic. Subordinate docs are
> read only when explicitly referenced from canonical.
>
> Last reconciled: 2026-04-29 (topical map) · 2026-07-09 (spec-manifest + drift pass)
> See `docs/_AUDIT_2026_04_29.md` for the audit that produced the topical map, and the
> **Spec Manifest** + **Locations & Facilities** sections below (added 2026-07-09) for the
> per-spec mapping and the open drift list.

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

## Locations & Facilities
| Topic | Canonical | Status |
|---|---|---|
| Multi-location model (`studio_locations`, `rooms`, `location_hours`, `studio_closures`) | `docs/LOCATIONS_AND_FACILITIES.md` | ✅ Canonical (approved 2026-07-09) |
| Room / resource management | `docs/RESOURCE_INTELLIGENCE_SPEC.md` | Vision only — single-location, invents non-live tables |

🔴 **Known gap (flagged 2026-07-09).** The live DB has a multi-location model with **no governing
spec**: `studio_locations` (only `is_active` + `is_primary` — no published/visible flag), `rooms`
(`location_id`, `is_bookable`, `is_active`), `location_hours`, `studio_closures`, and
`classes.location_id`. Live admin CRUD exists in **two** duplicated places —
`app/(admin)/admin/settings/studio` and `app/(admin)/admin/resources/manage` — and rooms are
modelled **twice** (`rooms` **and** `studio_resources`, both carrying `location_id`).
`classes.location_id` is **display-only** (no staff editor sets it). The parent/public side has
**no location concept** (no label from `studio_locations`, no filter by `location_id`, no picker).
Live data: 2 locations — **San Clemente** (primary, 63 classes, 4 rooms) and **Rancho Santa
Margarita / "RSM"** (`is_active=true`, 0 classes, 3 rooms). Only *deprecated* docs
(`CLASSES_ARCHITECTURE_CLEANUP.md`, `TENANT_PAYMENT_CONFIG.md`) even name these columns;
`strategy/platform-product-requirements.md` describes multi-location conceptually (M5) but names no
table and no route. ✅ **Resolved (2026-07-09):** canonical spec approved — see `docs/LOCATIONS_AND_FACILITIES.md`,
which supersedes this gap note with the reconciliation + build sequence. Pending task 11 tracks it.

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

## Spec Manifest — every spec → module · tables · routes · purpose

> Added 2026-07-09. One row per doc. The topical sections above remain the place to find the
> **canonical** doc for a topic; this manifest is the flat lookup of what each file governs.
> `⚠` after a table = named in the doc but **not in the live DB** (drift signal).
> **Status:** ✅ Canonical · 📖 Reference · 🟢 Living · 🔵 Vision (unbuilt/aspirational) ·
> 🧱 Unbuilt-schema (spec rides mostly on non-live tables) · 🟠 Stale · 🔴 Deprecated ·
> 🟡 Pending (canonical undecided) · 📝 Prompt/Archive.

| Doc | Status | Module | Central tables | Key routes / files | Purpose |
|---|---|---|---|---|---|
| `ACTION_PLAN.md` | 🟢 | Strategy | production_dances | admin/dashboard | Sprint task list, owners, backlog |
| `ADVERTISING.md` | 🔵 | Marketing | ad_campaigns⚠ | ~admin/ads | Freemium tiers, ad placements, advertiser portal |
| `ANGELINA_AND_CLAUDE_API.md` | 🔴 | Angelina/AI | — | api/chat, chatbot-widget | Early Angelina/Claude API integration (superseded by V2) |
| `ANGELINA_SPEC_V2.md` | ✅ | Angelina/AI | angelina_conversations, angelina_feedback | api/angelina/chat, lib/angelina/context | Angelina architecture: context, skills, streaming, security |
| `APP_STORE_SETUP.md` | 📖 | Ops | — | capacitor.config, ios/, android/ | Capacitor native iOS/Android wrapper setup |
| `ATTENDANCE.md` | 🟠 | Students | attendance_records, timesheet_alerts, timesheet_entries, sessions⚠ | api/attendance, cron/generate-sessions | Attendance tracking + overpayment alerts (legacy `sessions`/`user_profiles`) |
| `BALLET_DOMAIN.md` | 📖 | Brand/Domain | — | lib/ai prompts | Ballet vocab, curriculum, skill/badge taxonomy reference |
| `BILLING_AND_CREDITS.md` | 🧱 | Billing | credit_accounts, credit_transactions, invoices⚠, billing_charges⚠ | admin/billing, portal/billing | Credit/point + dollar billing engine (most tables unbuilt) |
| `BRAND.md` | ✅ | Brand | — | tailwind, UI_STYLE_DIRECTIVES | Studio identity, voice, colors, typography |
| `CALENDAR_AND_SCHEDULING.md` | 🔴 | Scheduling | schedule_instances, schedule_templates, rooms, calendar_subscriptions, approval_tasks | admin/calendar, widget/schedule | (dep) calendar/scheduling approvals + sync |
| `CASTING_AND_REHEARSAL.md` | ✅ | Scheduling | productions, dances, production_dances, casting, rehearsals, rehearsal_attendance | admin/schedule, portal rehearsals | Casting/rehearsal/production schema + approvals |
| `CHATBOT_AND_LEAD_CAPTURE.md` | 🟠 | Marketing | — | components/angelina, api/angelina/chat | Public-site chatbot conversation + lead capture |
| `CLASS_MEETINGS.md` | ✅ *(Draft)* | Scheduling/Classes | class_meetings (new), classes | class-edit-drawer, lib/queries/enroll, enrollment-chat, teach/schedule | Per-day `class_meetings` (day/time/room per meeting) + `allow_single_day` commitment toggle; replaces the scalar day/time split-brain. Consumed by task 19 generator; `allow_single_day` gates future billing |
| `CLASS_SCHEMA_DECISIONS.md` | ✅ | Classes | classes | migrations/…classes_status_constraint | Decision record reconciling class schema drift |
| `CLASSES_AND_RESOURCES.md` | 🔴 | Classes | class_resources⚠, class_resource_assignments⚠ | ~admin/classes | (dep) room/resource assignment + embed |
| `CLASSES_ARCHITECTURE_CLEANUP.md` | 🔴 | Classes | classes, studio_levels, tenants, seasons, class_teachers, class_levels⚠ | lib/queries/admin, api/admin/classes | (dep) 44-col classes cleanup plan |
| `CLASSES.md` | ✅ | Classes | classes, class_teachers, disciplines, dance_curriculum, class_pricing_rules, class_phases | admin/classes, embed/pricing | Consolidated class mgmt (model, UI, curriculum, pricing) |
| `CLAUDE_CODE_TEACHER_PORTAL_INSTRUCTIONS.md` | 📝 | Teachers | timesheets, timesheet_entries, pay_periods, private_billing_records, teacher_profiles⚠, rate_definitions⚠ | api/teacher/timesheet | One-shot timesheet MVP build steps (8+ phantom tables) |
| `docs/CLAUDE.md` | 🔴 | Ops | — | — | (dep) old AI context index → docs/claude/ (9 vs 13 modules) |
| `COMMUNICATIONS.md` | ✅ | Communications | channels, channel_members, channel_messages, sms_threads, studio_announcements, angelina_admin_consultations | admin/communications | Full messaging arch v2 (contested vs HUB) |
| `COMMUNICATIONS_AND_STAFF_VISIBILITY.md` | 🟠 | Communications/RBAC | leads, chat_sessions⚠, lead_activities⚠, staff⚠ | admin/leads | Staff visibility matrix + contact firewall (orphaned, unmarked) |
| `COMMUNICATIONS_HUB.md` | ✅sub | Communications | communication_groups, communication_group_members, group_posts, group_post_reactions, absence_records | ~admin/settings/groups | Band-replacement group feed (contested vs COMMUNICATIONS) |
| `COMMUNICATIONS_INBOX.md` | ✅sub | Communications | communication_threads, communication_messages, communication_attachments, communication_thread_reads, leads, families | api/communications/threads, inbound | Unified inbox reply capture + threading |
| `COMMUNICATIONS_PRIVATE_FEED.md` | 🔵 | Communications | private_sessions | ~portal/privates | Private-lesson social feed + booking (pre-spec) |
| `COMMUNICATIONS_TRIAGE.md` | ✅sub | Communications | communication_messages, leads, unmatched_sms⚠ | lib/communications/classify, webhooks/quo | Inbound classification + auto-lead |
| `COMPETITION_SEASONS_PRIVATES.md` | 🧱 | Classes/Billing | seasons, private_sessions, competition_events⚠, routines⚠, teacher_rates⚠ | admin/seasons, admin/privates | Season types, competition roster, private pricing |
| `COMPETITIVE_ANALYSIS.md` | 📖 | Strategy | attendance, timesheet_entries, student_guardians | — | Master feature matrix vs competitors |
| `COMPETITIVE_DANCEMASTERPRO.md` | 📖 | Strategy | — | — | Gap analysis vs Dance Master Pro |
| `CONTACT_ALIASES.md` | ✅sub | Communications | contact_channels, leads, families, profiles | api/communications/inbound | Link multiple contact channels per profile |
| `CONTACT_CHANNELS.md` | ✅ | Communications | contact_channels, sms_threads, sms_messages, quo_call_logs⚠, unmatched_sms⚠ | webhooks/quo, portal/settings/contact | Multi-email/phone per profile + opt-in/Klaviyo/Quo |
| `CONTRACTS_AND_COMMITMENTS.md` | 🧱 | Enrollment | students, enrollments, contract_templates⚠, signed_contracts⚠ | ~admin/settings/programs, students/documents | Program contract/e-sign at enrollment (schema unbuilt) |
| `CURRENT_STATE.md` | 🟠 | Ops | seasons, schedule_instances, schedule_change_requests, approval_tasks, rooms, casting | api/admin/schedule-change-requests | Session snapshot (stale 2026-03-11) |
| `CURRICULUM_AND_PROGRESSION.md` | ✅ | Students | curriculum_categories, curriculum_skills, season_curriculum, student_skill_records, evaluation_templates, evaluation_template_questions | ~admin/settings/curriculum | Skill/badge curriculum builder + level advancement |
| `DATA_MODEL.md` | 🔴 | Ops | profiles, students, classes, enrollments, attendance, teachers | — | (stale, unmarked) legacy schema; uses dropped `user_role` enum |
| `DATABASE_SCHEMA.md` | ✅ | Ops | profiles, profile_roles, teachers, students, classes, enrollments | types/database.types.ts | Canonical live schema ref — **stale (Mar 2026), needs refresh** |
| `DOCUMENT_LIBRARY.md` | ✅ | Ops/Compliance | family_documents, enrollments, seasons, students, families, contract_templates⚠ | admin/documents, portal/documents, cron/document-expiry | Family/admin document store + parent to-do |
| `EMAIL_TEMPLATES.md` | ✅ | Communications | email_templates | api/email-templates | Block-based email template editor (schema-drift: proposes 3 tables) |
| `ENROLLMENT_AND_PLACEMENT.md` | 🟡 | Enrollment | bundle_configs, enrollment_carts, season_placements, season_placement_releases, enrollment_recommendations, cart_bundles⚠ | ~admin/seasons/placement, portal/enroll | Admin pre-placement + self-enroll + bundles (master TBD) |
| `ENROLLMENT_FLOW_SPEC.md` | ✅ | Enrollment | ~classes, students, enrollments | (public)/enroll | 7-step new-student registration wizard UX |
| `ENROLLMENT_POLICY.md` | 🔴 | Enrollment | studio_settings, classes, students, admin_tasks⚠, promo_codes⚠ | — | (dep) trial/enrollment eligibility rules |
| `ENROLLMENT_QUIZ_SPEC.md` | ✅ | Enrollment | ~leads, classes | (public)/enroll | Branching enroll quiz logic |
| `ENROLLMENT_WIDGET.md` | ✅ | Enrollment | ~enrollment_carts, tenants | (widget)/widget, api/widget | Embeddable white-label enrollment widget (likely unbuilt) |
| `EXPANSION.md` | ✅ | Expansion | expansion_markets, competitor_studios | admin/expansion, lib/queries/admin | Market/competitor readiness scoring for Location #2 |
| `HOW_TO_ADD_SKILLS.md` | 📖 | Ops | — | CLAUDE.md | Skill-file loading guide (recommends @import — conflicts convention) |
| `INTEGRATIONS.md` | 🔵 | Ops | tenant_integrations⚠ | admin/settings/integrations | Tenant-scoped integration adapter pattern (unbuilt) |
| `INVOICE_PDF.md` | 🧱 | Billing | invoices⚠ | api/invoices, portal/billing/invoices | FSA/HSA PDF invoices (only Stripe receipts today) |
| `LEVEL_SYSTEM.md` | 🔴 | Students | — | ~admin/settings/levels | Fixed level taxonomy (conflicts LEVELS_AND_PROGRAMS) |
| `LEVELS_AND_PROGRAMS.md` | ✅ | Students | studio_levels, studio_programs, program_eligible_levels, student_programs | ~admin/settings/levels-programs | Dynamic per-tenant Levels vs Programs model |
| `LOCATIONS_AND_FACILITIES.md` | ✅ | Locations & Facilities | studio_locations, rooms, location_hours, studio_closures, schedule_instances (location fields), classes.location_id | admin/settings/studio, admin/schedule, class-edit-drawer, portal/public catalog + ICS | Canonical multi-location + facilities model; fork reconciliation + per-surface location resolution |
| `MAKEUP_POLICY.md` | 🧱 | Scheduling | enrollments, students, private_billing_records, makeup_credits⚠, school_years⚠ | ~admin/makeups | Makeup credit eligibility, requests, scheduling |
| `MARKETING.md` | 📖 | Marketing | — | ~SEO city pages | SEO/ads/Klaviyo/social acquisition playbook |
| `MARKETING_INTEGRATIONS.md` | 🔵 | Marketing | marketing_consents⚠, marketing_assets⚠, marketing_campaigns⚠ | admin/integrations/marketing | Ad-audience sync + marketing AI (all unbuilt) |
| `MEDIA_HUB.md` | 🔵 | Media | productions, students, families, media_albums⚠, media_items⚠, media_purchases⚠ | admin/media, portal/media | Photo/video sales storefront (competes w/ live media tables) |
| `MODULES.md` | 📖 | Ops/Strategy | — | →PORTAL_SURFACES, →PRD | Pointer to surfaces + M1–M13 taxonomy |
| `NEW_STUDENT_PIPELINE.md` | ✅ | Enrollment | leads, trial_history, evaluation_requests, communication_threads, students | admin/enrollment/pipeline | CRM Kanban for new-student intake |
| `NOTIFICATIONS.md` | ✅ | Communications | notifications, device_tokens, notification_preferences | api notifications, settings/notifications | Notification fan-out (in-app/push/email); uses `profile_id`⚠ |
| `PERFORMANCE_COMPETITION_COSTS.md` | ✅ | Billing | productions, timesheet_entries, pay_periods, teacher_rate_cards, competition⚠ | admin/reports/productions | Tag rehearsal/perf hours to production/competition costs |
| `PERFORMANCE_MEDIA_AND_MONETIZATION.md` | 🔵 | Media | — | ~admin/stream-events | Multi-cam live stream + AI-edited paid media (vision) |
| `PERMISSIONS_AUDIT.md` | 📖 | RBAC | profile_roles, profiles, timesheets, private_sessions, class_teachers, students | lib/auth/guards, lib/rbac/permissions | RLS/guard audit findings (open P0s) |
| `PORTAL_FEATURES.md` | 🟠 | RBAC | — | portal/teacher⚠(→/teach), portal/messages | Per-role capability map for Angelina (stale routes) |
| `PORTAL_SURFACES.md` | ✅ | Ops | schedule_embeds, schedule_instances, rooms, productions, production_dances, studio_resources | portal, teach, admin, enroll, shop, learn | Canonical 12-surface route/UI map (**no Locations surface**) |
| `PRIVATE_LESSONS.md` | ✅ | Scheduling | private_sessions, private_session_billing, teacher_availability, teacher_booking_approvals, teacher_rate_cards, credit_transactions | admin/privates, teach privates | Native private-lesson scheduling/billing (**doc duplicated verbatim**) |
| `PROGRAMS.md` | 🧱 | Ticketing | productions, casting, students, programs⚠, program_blocks⚠ | admin/programs, program/[slug] | Digital performance program builder (deadline past) |
| `PROMPT_communications_inbox.md` | 📝 | Communications | communication_threads, communication_messages, communication_attachments, platform_modules | api/communications | One-shot build script for inbox module |
| `RBAC_AND_PERMISSIONS.md` | ✅ | RBAC | permissions, roles, role_permissions, profile_roles, profiles, tenants | lib/auth/permissions, admin/settings/roles | Dynamic tenant-configurable RBAC (canonical); FK shown `profile_id`⚠ |
| `REGISTRATION_AND_ONBOARDING.md` | 🟡 | Enrollment | enrollments, students, families, trial_history, classes, enrollment_windows⚠, class_sessions⚠ | ~admin/enrollment, portal/enrollment | New/returning registration + trials (master TBD) |
| `RESOURCE_INTELLIGENCE_SPEC.md` | 🔵 | Ops/Facilities | rooms, classes, enrollments, room_rentals⚠, studio_hours⚠, class_instances⚠ | admin/resources, admin/resources/rentals | Room utilization + AI recs + rental manager (single-location) |
| `ROLE_BASED_NAV_SPEC.md` | 🔴 | RBAC | profiles | ~layouts, components/layouts/*-nav | (dep) per-role nav matrix; uses `profiles.role`/`full_name` |
| `ROLES_AND_PERMISSIONS.md` | 🔴 | RBAC | tenants, user_roles⚠, parent_student_links⚠ | — | (dep) competing 3rd RBAC spec |
| `SAAS.md` | 🔵 | SaaS | tenants, students, families, classes, studios⚠, import_jobs⚠ | api/admin/provision-tenant, middleware | Multi-tenant white-label arch (DB-silo — **contradicts live** shared-DB) |
| `SCHEDULING_AND_LMS.md` | 🔵 | Scheduling | classes, productions, class_sessions⚠, session_attendance⚠, curriculum_stages⚠ | admin/schedule, teach/schedule | Scheduling + LMS vision (free-text room, single-location) |
| `SEASONS_AND_ARCHIVAL.md` | ✅ | Classes | seasons, classes, enrollments, attendance, profiles | admin/seasons, lib/seasons/archive | Season lifecycle, class archival, re-registration |
| `SECURITY.md` | ✅ | Ops/Security | mandated_reporter_incidents, students, attendance, student_content_progress, stream_access, live_sessions | RLS templates, api/* | Auth/RLS/COPPA/payment security (RLS examples stale) |
| `STACK.md` | ✅ | Ops | — | app/, lib/supabase, types | Tech stack, structure, env vars, conventions (says Next 15⚠) |
| `STAFF_RESOURCE_LIBRARY.md` | 🔵 | Ops/Facilities | profiles, tenants, staff_library_folders⚠, staff_library_documents⚠ | admin/resources/library, teach/library | Internal staff document library (invents tables; live=studio_resources) |
| `STREAMING_AUTH.md` | 🔵 | Media | live_sessions, stream_access, students, family_members⚠, guest_stream_tokens⚠ | lib/cloudflare/stream | Stream authorization, family access, guest tokens |
| `STUDENT_PROFILE.md` | ✅ | Students | students, student_profile_relatives, student_profile_share_permissions, student_badges, student_evaluations, student_google_photo_albums | admin/students/[id]/profile | Gamified + shareable per-relative student profile |
| `STUDENT_PROFILE_ACCESS_CONTROL.md` | ✅sub | RBAC/Students | profile_roles, student_evaluations, student_opportunities, students, family_documents, season_curriculum | ~admin/students/[id] | Role-based student-profile access matrix |
| `STUDENT_PROFILE_ENHANCEMENT.md` | ✅sub | Students | student_opportunities, students, family_documents, season_curriculum, casting, productions | ~admin/students/[id] | Student-profile build backlog |
| `STUDIO_CLOSURES.md` | ✅ *(Draft)* | Studio Closures | studio_closures, closure_locations (new), private_sessions | admin/settings/studio-calendar | Location-scoped closures (all / multi-select studios) + privates cancel/override; class-cancel deferred (task 19) |
| `STUDIO_PRO_COMPARISON.md` | 📖 | Strategy | help_articles⚠, help_article_feedback⚠ | /help, admin/help | Studio Pro gap analysis + Help Center spec (stale statuses) |
| `SUBSTITUTE_TEACHER.md` | 🔴 | Teachers | teachers, approval_tasks, teacher_hours, substitute_requests, teacher_compliance, onboarding_*⚠ | ~teacher/onboarding | (dep) teacher onboarding + AB5 + substitute policy |
| `SUPABASE_EMAIL_TEMPLATES.md` | ✅ | Communications | email_templates | Supabase Auth templates, api/auth/send-email | Branded HTML for Supabase auth emails |
| `TEACHER_ABSENCE_SUBSTITUTE_SUMMARY.md` | ✅ | Teachers | absence_records, substitute_requests, substitute_alerts, schedule_instances, timesheet_entries, substitute_authorizations | ~admin/reports/absences | Read-only absence/substitution reporting |
| `TEACHER_PORTAL.md` | ✅ | Teachers | teachers/teacher_profiles(view), timesheets, profile_roles, attendance | teach/* | Teacher portal sections, roles, auth |
| `TEACHER_RATE_MANAGEMENT.md` | ✅ | Teachers | teacher_rate_cards, payroll_change_log, timesheet_entries, tenants | admin staff rate profile | Per-teacher pay-rate cards + override hierarchy |
| `TEACHER_SUBSTITUTE_COVERAGE.md` | ✅ | Teachers | absence_records, substitute_requests, substitute_alerts, substitute_authorizations, teacher_sub_eligibility, schedule_instances | ~admin coverage | Absence→substitute assignment workflow |
| `TEACHER_TIME_ATTENDANCE.md` | ✅ | Teachers | timesheets, timesheet_entries, pay_periods, private_billing_records, private_billing_splits, productions | teacher timesheet, Square CSV | Timesheets + private billing splits + payroll export |
| `TENANT_PAYMENT_CONFIG.md` | 🔴 | SaaS/Billing | tenants, tenant_payment_configs⚠ | ~api/payments/webhook, lib/payments | (dep) per-tenant payment-processor config |
| `TESTING.md` | ✅ | Ops | leads, lead_stage_history, attendance, family_documents | tests/e2e, playwright.config, .github/workflows | Playwright + GitHub Actions E2E strategy |
| `TICKETING.md` | 🧱 | Ticketing | productions, tenants, shows⚠, tickets⚠, ticket_orders⚠ | /claim/[token] | Ticket sales, comps, scanning (6-table schema unbuilt) |
| `UI_STYLE_DIRECTIVES.md` | ✅ | Brand | — | components/ui/select, tailwind, app/(admin\|portal\|teach) | Canonical portal visual system |
| `UNIFIED_SCHEDULE.md` | 🔴 | Scheduling | classes, private_sessions, studio_closures, rooms, disciplines, rehearsals, productions | ~admin/schedule, admin/classes | (dep, rejected) merge /admin/classes into /admin/schedule |
| `UX_PATTERNS.md` | ✅ | Brand | — | shells, DancerCard, ClassCard, EmptyState | UX component behaviors (some conflict w/ UI_STYLE_DIRECTIVES) |
| `brand/brand-guidelines.md` | 🔴 | Brand | — | →BRAND, →UI_STYLE_DIRECTIVES | (dep) brand identity, split into successors |
| `brand/website-theme-settings.md` | ✅ | Brand | — | public site, ~/ballet-classes-[city] | Flatsome/WordPress styling (public site only) |
| `claude/COMMUNICATIONS.md` | 📖 | Communications | channels, channel_messages, communication_threads, communication_messages, announcements, class_reminders | api/communications/channels, lib/communications/thread | Claude quick-ref for the 3 messaging systems |
| `expansion/location-expansion-strategy.md` | 📖 | Expansion | — | — | Framework for opening BAM 2nd location (no schema) |
| `marketing/competitive-intelligence.md` | 📖 | Marketing | competitor_studios | — | Track South OC competitor studios |
| `marketing/content-marketing-plan.md` | 📖 | Marketing | — | ~WP blog, Klaviyo | Parent-education article library + calendar |
| `marketing/lead-capture-funnel.md` | 📖 | Marketing | — | ~registration, Angelina, Klaviyo | Visitor→enrolled funnel (chatbot already Live) |
| `marketing/local-seo-strategy.md` | ✅ | Marketing | — | ~/ballet-classes-[city] | City landing pages + schema to rank South OC |
| `operations/mandated-reporter-protocol.md` | ✅ | Ops/Compliance | mandated_reporter_incidents, teacher_compliance | ~M12 (Legal & Compliance) | CA AB 1432 mandated-reporter duties |
| `operations/studio-pro-gap-analysis.md` | 📖 | Ops/Strategy | — | — | Studio Pro strengths/gaps vs BAM modules (stale) |
| `operations/teacher-onboarding.md` | ✅ | Teachers/HR | staff_documents, teacher_compliance | ~M4, ~M12 | Two-week new-instructor apprenticeship + compliance |
| `operations/teacher-recruitment.md` | ✅ | Teachers/HR | — | ~M4 | Faculty sourcing, interviewing, retention |
| `strategy/platform-product-requirements.md` | ✅ | Strategy | studio_locations | (admin/teacher/parent) surfaces | Canonical M1–M13 capability-module PRD |

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

### Added 2026-07-09 (spec-manifest + drift pass)
11. **Locations & Facilities — ✅ canonical spec approved 2026-07-09 · see `docs/LOCATIONS_AND_FACILITIES.md`.** The spec canonicalizes `studio_locations`/`rooms`/`location_hours`/`studio_closures`/`classes.location_id` (+ new `location_type` and `schedule_instances` override fields). Resolve the **duplicated admin CRUD** (`settings/studio` vs `resources/manage`) and the **double room model** (`rooms` vs `studio_resources`) into one. Decide whether the parent/public side gets a location label/filter/picker (today it has none) and whether a location needs a published/visible flag distinct from `is_active`. RSM now live as a 2nd location with 0 classes — before RSM classes publish, parents can't tell the two studios apart. See the Locations & Facilities section above.
    - **Verdict (rooms vs studio_resources, investigated 2026-07-09):** **`rooms` is canonical.** It is the FK target for `classes.room_id`, `schedule_instances.room_id`, and `schedule_templates.room_id` (all 63 live classes carry a `room_id`); it backs the class Room dropdown (`admin/classes/page.tsx:145` → `class-edit-drawer.tsx:830-838`, saving `classes.room_id`) and drives schedule, calendar, portal/widget feeds, **and** rentals + utilization (`lib/resources/utilization.ts`, `resources/rentals` read `rooms`, not `studio_resources`). It is written by exactly one CRUD, `settings/studio/actions.ts` ("Studio Profile"). **`studio_resources` is legacy/secondary:** its only live consumer beyond its own `resources/manage` CRUD is the per-class "Resources" multi-select, which writes `studio_resource_assignments` — **0 rows in prod**. Its 3 room-type rows are inactive duplicates of `rooms`; its `type`/`is_portable` equipment fields are read by nothing. Both CRUDs also write `studio_locations` (a genuine double-write, incl. two independent primary-flag-clear paths).
    - **Reconciliation plan (in order):**
      1. Strip the location CRUD (`createLocation`/`updateLocation`/`toggleLocationActive`) from `app/(admin)/admin/resources/manage/actions.ts` so `app/(admin)/admin/settings/studio/actions.ts` is the **sole `studio_locations` writer** — fixes the double primary-flag-clear bug.
      2. Remove the "Resources" multi-select in `app/(admin)/admin/classes/class-edit-drawer.tsx` (`:158-168`, `:527-539`) — it writes to the empty `studio_resource_assignments`.
      3. Keep the `studio_resources` table **dormant** (unused-but-harmless) for possible future equipment booking; retire only its CRUD (`resources/manage`) + the class-tag UI, not the table itself.
12. **RBAC specs — collapse three into one.** `RBAC_AND_PERMISSIONS.md` (canonical) vs deprecated `ROLE_BASED_NAV_SPEC.md`/`ROLES_AND_PERMISSIONS.md`. Even canonical shows FK `profile_roles.profile_id` while live is `user_id`; `SECURITY.md` RLS examples still use dropped `profiles.role`/`students.parent_id`/`classes.teacher_id`. Fix FK names + RLS examples to match live.
13. **Communications schema — reconcile the triple fork.** `COMMUNICATIONS.md` (`channels`) vs `COMMUNICATIONS_HUB.md` (`communication_groups`/`group_posts`) vs `COMMUNICATIONS_INBOX/TRIAGE` (`communication_threads`) — all three "authoritative/ready", all backed by live tables, none reconciled. Mark orphaned `COMMUNICATIONS_AND_STAFF_VISIBILITY.md` deprecated.
14. **Canonical schema doc is stale.** `DATABASE_SCHEMA.md` (declared canonical) last updated Mar 2026 — missing `contact_channels`, `curriculum_*`, `family_documents`, locations tables, etc. Regenerate from `types/database.types.ts`. Add deprecation header to parallel `DATA_MODEL.md` (uses dropped `user_role` enum).
15. **Naming drift sweep.** `user_profiles`→`profiles`, `sessions`/`class_sessions`→`schedule_instances`, `profile_id`→`user_id`, singular `timesheet_entry`/`pay_period`→plural. Recurs in ATTENDANCE, COMMUNICATIONS_INBOX, DATA_MODEL, NOTIFICATIONS, teacher timesheet docs.
16. **Unbuilt-schema (🧱) docs ride on ⚠NOT-IN-DB tables** — Billing (`invoices`/`billing_charges`), Contracts (4 tables), Ticketing (6 tables), Media Hub, Programs, Competition/Privates, Marketing Integrations, Integrations, Makeup. Decide build-vs-defer per area; add "schema not built" banners so they aren't implemented as-is.
17. **Route groups `(learn)` and `(shop)` are undocumented** in `PORTAL_SURFACES.md` (the canonical surface map). `(shop)/shop` is a placeholder (no `products`/`shop_orders` code). Either add them to the surface map or mark them not-yet-built.
18. **Stale build-status docs** contradict CLAUDE.md ✅-Live status (Angelina chatbot, M4 timesheets, RBAC described as "to-build"): `ACTION_PLAN.md`, `CURRENT_STATE.md` (3/11), `COMPETITIVE_ANALYSIS.md`, `PORTAL_FEATURES.md`, `operations/*`. Refresh or archive. Past-dated deadlines: PROGRAMS (Jun 6), Jackrabbit eval (Jun 2026), expansion (Q3 2026).

### Added 2026-07-09 (class_sessions blast-radius)
19. **🔴 P0 — Schedule occurrences: two competing models, both non-functional.** Investigated 2026-07-09.
    - **`class_sessions` is a phantom table.** Its migration `20260312000004_schedule_phase1.sql` (also `class_recurrence_rules`) was **never applied** — the tables don't exist in the live DB. The entire `lib/schedule/` stack (`queries.ts`, `actions.ts`, `generate-sessions.ts`) plus a few pages query `.from("class_sessions")` and **error at runtime**. Errors are swallowed (`[]`/`null` in queries, `{error}` in actions), so the symptom is **silent-empty / failed-save**, not crashes.
    - **`schedule_instances` is the live table but has no generator.** Only **61 rows, all 2026-03-09→03-14** (one stale week), 0 `schedule_templates`, `template_id`/`created_by` all null. The only session generator (`generateSessionsForClass`) targets the phantom `class_sessions`, so **nothing populates current occurrences**.
    - **Live-and-broken paths (user-reachable, silently failing today):** (1) **class create/edit save** (`upsertClass` → recurrence + generate steps error; the class row still saves); (2) **admin class detail "Sessions" table** (`/admin/schedule/classes/[id]`, linked from the classes list — renders empty); (3) **parent "My Children" upcoming sessions** (`/portal/students` via `getUpcomingSessionsForStudents` — renders empty); (4) **Admin Tasks cancellation-pay resolution** (`setCancellationPayDecision`).
    - **Works but on stale data:** substitute/approval workflows, `/portal/schedule`, and `/teach/schedule` list all use `schedule_instances` (no error) — but operate on the 61 frozen March rows.
    - **Dead/orphaned (broken but unreachable):** `getClassSessions`, `cancelSession`, `createPayDecisionTask`, the teacher & admin **session-detail pages** + their attendance/absent/back-to-back actions, the redirected `/admin/schedule` calendar tree.
    - **Correct instance surface requires an occurrence generator FIRST**, then repointing `class_sessions`→`schedule_instances` with column renames (`session_date`→`event_date`, `lead_teacher_id`→`teacher_id`, `session_notes`→`notes`, `room` text→`room_id`, `is_cancelled`→`status='cancelled'`) and a schema decision for the no-equivalent columns (`attendance_locked_at`, `needs_coverage`, `duration_minutes`, `cancellation_pay_decision`/`_rate_override`, `timesheet_entries_generated`, …). This is the root blocker for LOCATIONS Step 4b (see `LOCATIONS_AND_FACILITIES.md` §10). Extends the naming-drift item (15) with the full footprint. **Also gates the class-side of `STUDIO_CLOSURES.md`** (§4/§6): closures cannot cancel class occurrences until a generator materializes them — the privates-side of that spec is buildable now, the class-cancel + admin/super_admin class-override is deferred here.
    - **Feeds from `class_meetings` (new — see `CLASS_MEETINGS.md`, Draft 2026-07-10).** The generator must materialize `schedule_instances` from **`class_meetings`** (per-meeting `day_of_week`/`start_time`/`end_time`/`room_id`), **not** the deprecated `classes` scalar day/time — design it against `class_meetings` from the start (that table is scoped precisely to give the generator per-meeting day/time/room). **Billing-engine dependency:** `CLASS_MEETINGS.md` also adds `classes.allow_single_day` (the commitment toggle) — stored + displayed now, but a future billing engine (`BILLING_ENGINE.md`) reads it to drive per-day vs. whole-class pricing; keep the column's meaning stable and do not repurpose it.
