# Family Data Access & Mediated Communication

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28

---

## 1. The requirement

Two things, from the studio owner:

1. **Pay rates** are visible only to the owner, finance, and the Co-Director
2. **Family contact information** — parent email, phone, address — is visible to admin-tier staff and **not** to teachers, so that a departing teacher cannot leave with a contact list

The second is the one this spec exists for. It is a commercial control, not a privacy nicety: a teacher's own families are precisely the ones they could take.

It has to hold on the web app, on iOS, on Android, and inside Angelina, or it does not hold at all.

---

## 2. Findings

### 2.1 The exposure is live today

```
profiles_select_teacher_parents  SELECT
  is_teacher() AND id IN (
    SELECT s.parent_id FROM students s
    JOIN enrollments e ON e.student_id = s.id
    WHERE e.class_id = ANY (my_class_ids())
  )
```

**Any teacher can read the full `profiles` row of every parent of every student in their own classes** — including email and phone, whatever columns that table carries. Scoped to their roster, which is the worst possible scoping for this risk: their roster *is* the set of families they would take.

`student_guardians` is not exposed to teachers (`admin_full_access` plus own-row only), so secondary guardians are not reachable. The leak is `students.parent_id → profiles`.

### 2.2 RLS filters rows, not columns — the pattern has to change

There is no policy expressible as "teachers may read this row but not the phone column." Postgres column-level `GRANT` operates on *database* roles, and Supabase issues one (`authenticated`) to every signed-in user, so grants cannot vary by application role either.

**The workable pattern is a view.** Teachers lose `SELECT` on `profiles` for parent rows entirely and read a view exposing only what they need. Attempting this with policies alone will appear to work and quietly expose the columns.

### 2.3 `is_admin()` is too wide for family contact

`is_admin()` admits `admin`, `super_admin`, `studio_admin`, `studio_manager`, `finance_admin`. Family contact and pay are **different axes**: a `finance_admin` needs rates and arguably not phone numbers; a front-desk role needs phone numbers and certainly not rates. One predicate cannot express both.

### 2.4 The communication layer is built three times over

Twenty-two tables in this space. At least three announcement families and two messaging families:

| Family | Tables |
|---|---|
| Announcements A | `announcements`, `announcement_recipients` |
| Announcements B | `studio_announcements` |
| Announcements C | `channel_posts`, `channel_post_comments`, `group_posts`, `group_post_reactions` |
| Messaging A | `communication_threads`, `communication_messages`, `communication_groups`, `communication_group_members`, `communication_thread_reads`, `communication_attachments` |
| Messaging B | `channel_messages` |
| SMS | `sms_threads`, `sms_messages` |
| Infrastructure | `device_tokens`, `notification_preferences`, `notifications`, `tenant_communication_modes` |

`device_tokens` and `tenant_communication_modes` already exist — push notification and per-tenant channel configuration were anticipated.

**Nothing here should be extended before an audit determines which family is live.** `COMMUNICATIONS_HUB.md` carries the same warning. Building mediated messaging on the wrong family means building it twice.

---

## 3. The access model — two independent axes

| Predicate | Roles | Governs |
|---|---|---|
| `can_manage_pay()` | `super_admin`, `finance_admin`, `studio_manager` | Rates, timesheet amounts, payroll reports |
| `can_view_family_contact()` | `super_admin`, `admin`, `studio_admin`, `studio_manager`, `front_desk` | Parent email, phone, address, billing contact |

Neither implies the other. A person may hold both, one, or neither. Both are `SECURITY DEFINER`, both query `profile_roles`, and both take a `p_tenant_id` argument from the start — a second studio's admin must not read the first studio's families.

**Co-Director maps to `studio_manager`.** The role already exists, already satisfies `is_admin()`, is already in the pay set, and is currently held by nobody. Label it "Co-Director" in the UI; grant `studio_manager` + `teacher`; drop `admin`. No new role value, no guard changes, and it keeps plain `admin` as the generic bucket that does *not* carry pay access.

### 3.1 What a teacher may see

| Data | Teacher | Notes |
|---|---|---|
| Student first and last name | Yes | Roster, attendance, casting |
| Student age or level | Yes | |
| Parent display name | Yes | "Ella's mom, Sarah Turner" — teachers need to know who they are talking to |
| Parent email, phone, address | **No** | The control |
| Billing status, balances, rates | **No** | |
| Emergency contact | **Break-glass only** — see §5 | |
| Medical or allergy notes | Yes | Safety necessity, and see §5 |

Scoped as today: their own classes only, via `my_class_ids()`.

### 3.2 Implementation

```sql
create view teacher_visible_families with (security_invoker = true) as
select s.id            as student_id,
       s.first_name    as student_first_name,
       s.last_name     as student_last_name,
       p.id            as parent_profile_id,
       p.first_name    as parent_first_name,
       p.last_name     as parent_last_name
from students s
join profiles p on p.id = s.parent_id;
```

Then **drop `profiles_select_teacher_parents`** and grant teachers `SELECT` on the view only. The `parent_profile_id` is what messaging addresses — it is a handle, not a contact detail.

Dropping that policy is the moment the control takes effect. Until then everything else is decoration.

---

## 4. Mediated communication is the substitute, not the consolation

A control that leaves teachers unable to reach families does not survive contact with a Tuesday afternoon. They will text from personal phones, which is worse: off-platform, unlogged, and the contact list ends up in a personal device anyway.

**The sanctioned path has to be easier than the workaround.** Requirements:

- A teacher can message the families of their own classes without ever seeing an address or number
- A parent can reply, and the thread lives in the platform
- Class-level announcements reach every enrolled family at once
- Admins can read threads for their tenant — this is a youth-serving organization and unmonitored adult-to-minor-family channels are their own risk
- Delivery to email or SMS happens **server-side**, with the address resolved at send time and never returned to the sender's client

That last point is the crux. The platform knows the phone number; the teacher's device never receives it.

### 4.1 Mobile is why this must live in the database

Native iOS and Android apps are a second and third client against the same data. Any rule enforced in a Next.js route handler is enforced **zero times** on mobile.

Expo and the web app share the Supabase client and inherit identical RLS, so the view-plus-policy approach is free across all three surfaces — provided nothing reaches for the service-role key to "simplify" a mobile endpoint. Service-role bypasses RLS entirely; using it in an app-facing path silently voids this entire spec.

### 4.2 Push notification leakage

`device_tokens` already exists. Two constraints when it is wired:

- **Lock-screen previews are unauthenticated surfaces.** A push reading "Sarah Turner (949) 555-0182 replied" defeats the control on a phone sitting face-up on a studio bench. Push payloads carry a title and a deep link, never contact details or dollar figures
- **Notification content is not a place to put pay information.** "Your timesheet was approved — $1,093.75" on a shared or visible screen is a pay disclosure

### 4.3 Angelina is the obvious bypass

`lib/angelina/context.ts` reads `profiles`, `students`, `student_guardians`, and `enrollments`. If the teacher context is not gated identically, the assistant will recite a phone number the interface hides, in a friendly sentence, on request.

Gate at the **query**, not in the system prompt. A prompt instruction is a suggestion; a policy is a control. The existing prompt guardrail ("never share another teacher's schedule, pay, or student details") is evidence the risk was understood and evidence of the wrong mechanism.

---

## 5. Break-glass: emergency contact

Teachers run offsite rehearsals — Katherine's June sheet shows dress rehearsals at SJHHS. A teacher in a parking lot with an unclaimed nine-year-old needs a phone number, and a policy that says no is a policy that gets ignored or gets a child hurt.

**Emergency contact is reachable, not blocked.** The teacher takes a deliberate action — "show emergency contact" — and the platform records who looked, at which student, and when. Visible to admins.

Design notes:
- Log first, then reveal. A logging failure must not silently become a silent disclosure
- Show the emergency contact only, not the full profile
- Medical and allergy information is **not** break-glass. A teacher must see an epi-pen note before the emergency, not during it

Auditability is what makes the exception safe. A teacher pulling forty emergency contacts in a week is a signal.

---

## 6. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Audit the communication tables (§2.4) — determine which family is live, retire the rest | Decision. **Blocks 5** |
| **2** | `can_view_family_contact(p_tenant_id)` and `can_manage_pay(p_tenant_id)` | Low |
| **3** | `teacher_visible_families` view; grant to teachers | Low |
| **4** | **Drop `profiles_select_teacher_parents`**; sweep every read path that relied on it | Medium — this is where things break loudly |
| **5** | Mediated messaging on the surviving family: server-side address resolution | Medium. Depends on 1 |
| **6** | Angelina teacher context re-scoped to the view (§4.3) | Low |
| **7** | Break-glass emergency contact with audit log (§5) | Low |
| **8** | Push payload rules when `device_tokens` is wired (§4.2) | Low |
| **9** | Cara → `studio_manager` + `teacher`; drop `admin`; label "Co-Director" | Low |

Phase 4 is deliberately after 3 and 5: removing the teacher's access to parent contact before a messaging path exists produces exactly the workaround §4 warns about.

---

## 7. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Does `front_desk` belong in `can_view_family_contact()`?** It is in no `profile_roles` row today and `requireAdmin()` excludes it while `roleHome()` routes it to the admin dashboard — an unresolved inconsistency noted during the 2026-07-28 role work | Phase 2 |
| 2 | **Can teachers see secondary guardians at all?** `student_guardians` is admin-only today. A teacher may reasonably need to know a grandparent does pickup — name only, no contact | Phase 3 |
| 3 | **Should admins read teacher-parent message threads by default**, or only on report? Default-on is the safer posture for a youth-serving organization | Phase 5 |
| 4 | **Retention** — how long do threads and break-glass logs persist? | Phase 5, 7 |
| 5 | **Do teachers keep access after a class ends?** `my_class_ids()` presumably drops the class; a teacher mid-season on leave should probably retain it. A departed teacher must not | Phase 3 |

---

## 8. Multi-tenant notes

- Both predicates take `p_tenant_id`. Untenanted role checks are the same defect as `has_finance_role()` today
- Which roles may see family contact is **tenant configuration**, not a constant — a small studio may want teachers to have contact details, and should be able to choose that
- `tenant_communication_modes` already exists and is where channel preference belongs
- `profiles` and `students` are among the **41 tables lacking `tenant_id`** (`SESSION_2026-07-25_FINDINGS.md`). Tenant scoping here resolves through `profile_roles`, and that remediation is a prerequisite for a second tenant, not this spec

---

## 9. Related

- `PAYROLL_CORRECTNESS_AND_REPORTING.md` §3.3 — the pay visibility axis; `can_manage_pay()` is defined there
- `COMMUNICATIONS_HUB.md` — BAND replacement, partially built. **Audit before building more**
- `KNOWLEDGE_REPOSITORY_AND_AI.md` — Angelina's access model; §4.3 here is a constraint on it
- `SESSION_2026-07-25_FINDINGS.md` — the 41 untenanted tables
- `CLAUDE.md` §4 — role semantics; `is_admin()` is five roles, not two
