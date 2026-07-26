# Session Findings — 2026-07-25

Companion to `SESSION_2026-07-21_FINDINGS.md`. Everything below was verified against the live database or codebase on 2026-07-25. Nothing here is speculative.

---

## 1. P0 — 41 tables lack `tenant_id`

The single largest architectural finding of the session. For a white-label multi-tenant product, this is a correctness problem, not a tidiness one.

**Tables affected:**

```
announcement_recipients   attendance                casting
channel_members           channel_messages          channel_post_comments
channel_posts             class_reminders           classes
communication_thread_reads competitor_studios       dances
email_templates           expansion_markets         extended_contact_students
group_post_reactions      ledger_accounts           live_sessions
lms_content               mandated_reporter_incidents module_permissions
permissions               platform_modules          production_dances
products                  profiles                  program_eligible_levels
rehearsal_attendance      rehearsals                role_permissions
schedule_approvers        shop_configs              shop_orders
skill_assessments         stream_access             student_content_progress
student_guardians         studio_settings           teacher_hours
teachers
```
*(`productions` was on this list; fixed 2026-07-25 in Phase A1. `tenants` is n/a.)*

**Why it matters most:**

| Table | Consequence |
|---|---|
| `classes` | Joined by every enrollment, attendance, schedule, and tuition query. Tenant scoping must come from `enrollments.tenant_id` or `students.tenant_id` — never from the class itself |
| `profiles`, `teachers`, `teacher_hours` | The entire staff dimension is unscoped |
| `attendance`, `rehearsal_attendance` | Attendance is unscoped (note: `attendance_records` *does* carry `tenant_id` — see §5) |
| `studio_settings` | Per-tenant configuration, not tenant-scoped |
| `ledger_accounts` | Chart of accounts is global. `ledger_entries` is scoped, so account rollups are safe only via the entries side |
| `shop_orders`, `products` | Merchandise unscoped |

**Action:** needs its own spec and its own phase. Do not attempt piecemeal — a partial fix creates the illusion of safety. This blocks any tenant-facing reporting view (see §7).

---

## 2. P1 — `teacher_profiles` view silently hides departed teachers from payroll

The only view in the database:

```sql
SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.avatar_url,
       t.employment_type, t.hire_date, t.is_active
FROM profiles p JOIN teachers t ON t.id = p.id
WHERE t.is_active = true
```

The `WHERE t.is_active = true` is baked into the view. Three payroll/reporting surfaces join it:

- `app/(admin)/admin/timesheets/payroll/page.tsx:35`
- `app/(teach)/teach/timesheets/summary/page.tsx:30`
- `lib/queries/admin.ts:170`

**Consequence:** deactivate a teacher and their historical hours disappear from payroll reports retroactively. Money owed to a departed teacher vanishes from the report that would surface it.

**Action:** split into `teacher_profiles` (all) and `teacher_profiles_active` (filtered), or drop the filter and let callers scope. Do not leave a reporting view with a hidden lifecycle filter.

---

## 3. P1 — `cancelled` vs `canceled` split across six tables

| Spelling | Tables |
|---|---|
| `cancelled` (double-L) | `classes`, `private_sessions`, `schedule_instances` |
| `canceled` (single-L) | `enrollments`, `charges`, `tuition_schedule_intent` |

A `WHERE status = 'cancelled'` filter silently returns zero rows against half of them. **Silent, not loud** — no error, just wrong numbers.

**Action:** normalize on one spelling. American single-L matches the Stripe vocabulary already in `charges`.

---

## 4. P1 — Four vocabularies for "did the money land"

| Table | Column | Values |
|---|---|---|
| `charges` | `status` | created · processing · succeeded · failed · canceled · refunded · partially_refunded |
| `enrollment_charge_items` | `status` | pending · approved · charging · charged · deferred · declined · failed |
| `ledger_entries` | `charge_status` | pending · authorized · captured · succeeded · failed · refunded · returned |
| `refunds` | `status` | created · succeeded · failed |

Only `failed` appears in all four. `charged` and `captured` are synonyms in different tables. `succeeded` appears in three.

**Related:** "partial" is split three ways — `private_sessions.billing_status` has `partial`, `charges.status` has `partially_refunded`, `private_session_billing.billing_status` has neither.

**Related:** `comp` appears as three different things — a `billing_model` on `private_sessions`, a `payment_method` on `private_session_billing`, and an enrollment type on `enrollments` (which has **no CHECK constraint at all** on that column).

**Also:** `charge_timing` means `immediate | scheduled` on `enrollment_cart_items` and `charge_now | deferred` on `enrollment_charge_items`. Same concept, silent translation between them.

---

## 5. P2 — Two attendance tables

`attendance` (8 cols, **no** `tenant_id`) and `attendance_records` (10 cols, **has** `tenant_id`) both exist and are both in use:

- `app/(teach)/teach/classes/[classId]/metrics/page.tsx` reads `attendance_records`
- `app/api/cron/attendance-summary/route.ts` reads `attendance`

Any attendance report picks one and silently misses the other's rows.

---

## 6. Admin enrollment paths create no billing artifacts

Full map (verified 2026-07-25). The sole writer of `enrollment_charge_items` in the entire system is `app/api/enrollment/webhook/route.ts:491`.

| Path | Route | Enrollment | Billing | Verdict |
|---|---|---|---|---|
| Class roster modal | `/admin/schedule/classes/[id]` | ✅ | ❌ | WORKS, bills nothing |
| Student profile | `/admin/students/[id]/profile` | ✅ | ❌ | PARTIAL — see below |
| `/admin/enrollments` | — | — | — | Read-only, no write path |
| Lead convert | `/admin/enrollment/pipeline` | ❌ | ❌ | Creates student, never enrolls |
| Placement release | `/admin/enrollment/placement` | ❌ | ❌ | BROKEN — notifies only |

**Silent failures inside those paths:**

| Item | Location |
|---|---|
| Billing override collected, written to `enrollments`, never read by anything | `families/actions.ts:395-400` |
| `checkBillingPlan` queries `unlimited_plans` — **table does not exist**; wrapped in try/catch, no-ops every call | `students/[id]/profile/actions.ts:457-499` |
| Modal never sends `billingPlanType` to server, so the bundle branch is unreachable | `add-to-class-modal.tsx` `handleConfirm` |
| No `enrolled_count` increment — roster counts drift vs the class roster path | `students/[id]/profile/actions.ts` |
| `private_session_billing.billing_status` emits `deducted_from_pack` — names a table that does not exist | `privates/actions.ts:226-233` |
| `lib/billing/ledger-posting.ts` never populates the 9 dimension columns on `ledger_entries` (`location_id` null on all live rows) | `lib/billing/ledger-posting.ts` |

Addressed by `BILLING_GENERALIZATION_SPEC_V2.md`. Logged here so the defects are tracked independently of the spec.

---

## 7. Reporting — current state

| Area | State |
|---|---|
| Dedicated reporting UI | **Does not exist.** `/admin/reports` and `/admin/billing` are both `EmptyState` "Coming soon" stubs |
| Report persistence | **Does not exist.** No saved reports, definitions, dashboards, or metric snapshots |
| Aggregation location | Scattered across 7 page files; ~50% inline, ~50% in `lib/queries/` |
| Views | **1** (`teacher_profiles`, see §2). **0** materialized views |
| Export | CSV in timesheets only, hand-rolled client-side Blob. ICS for calendars. No PDF |
| `xlsx` dependency | Present at `^0.18.5`, **zero imports**. That version predates SheetJS leaving npm and carries published advisories. Remove or replace |

**Blocked by §1.** A tenant-facing reporting view cannot include `classes`, `profiles`, `productions`, or `attendance` until those are tenant-scoped.

---

## 8. `productions` has no archive path

Phase A1 added `timesheet_entries.production_id → productions(id) ON DELETE NO ACTION` (deliberately, to protect labor-cost attribution for production P&L).

`productions` has no `archived_at`, `is_active`, or soft-delete column — `is_published` and `approval_status` are workflow flags, not lifecycle. So once hours are logged against a production, it becomes undeletable with no clean alternative.

**Action:** add `archived_at` before anyone tries to clean up a past season.

---

## 9. Live copy problem — Amanda decision

Checkout consent text at `app/(portal)/portal/enrollment/cart/cart-view.tsx:216` and `app/(public)/enroll/cart/cart-view.tsx:268`:

> "...studio-approved fees (registration, costumes, competitions, and adjustments)"

**Costumes and competitions have no billing mechanism anywhere in the codebase.** Parents are consenting to charges the platform cannot produce. Same class as the trial/refund promise removed in `d74fa15`.

Live in production right now.

---

## 10. Housekeeping

- **`tsconfig.json` should exclude `scripts/`.** `scripts/e2e-teardown.ts` produces 8 `PostgrestFilterBuilder` vs `Promise` errors on every `tsc --noEmit`. A check that always fails is a check nobody reads — a real error will hide in the noise.
- **`SUPER_EMAIL = "derek@greenlyzard.com"`** is hardcoded in `components/layouts/admin-nav.tsx:25`. Gates `settings_platform` and disabled-module visibility. Landmine for a white-label product.
- **`platform_modules.requires_role` is dead code.** In the table, selected in `layout.tsx:23`, typed on the interface — never read by any consumer.
- **`GROUP_ORDER` is hardcoded** in `admin-nav.tsx:27`. A `nav_group` value not in that array renders nothing, silently. `portal_absences` (nav_group `Parent Portal`) is invisible today for exactly this reason — likely intended for `portal-nav.tsx`.
- **`app/(admin)/admin/schedule/` is ~59 KB of dead source** behind a 308 in `next.config.ts`. `page.tsx` + `schedule-calendar.tsx` are unreachable. Child routes (`schedule/classes/**`, `schedule/sessions/**`) are live and heavily linked — only the index is dead. Decision (2026-07-25): the redirect stays; `/admin/classes` is the better calendar.
