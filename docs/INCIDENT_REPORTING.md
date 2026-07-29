# Incident Reporting & Escalation

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28

---

## 1. Two objects, deliberately separate

**An incident** is something that happened in the studio: an injury, a behavior issue, property damage, a near-miss. It is an internal record with operational and insurance value.

**A mandated report** is a legal obligation triggered by suspected child abuse or neglect. It has a statutory timeline, a specific recipient, and a named individual responsible for making it.

These must never be the same object, and one must never quietly become the other. A scraped knee is an incident. A child's disclosure is a mandated report. A system that files both through one form will produce a studio that treats every skinned knee as a legal event, or — far worse — treats a disclosure as an internal note.

---

## 2. Findings

### 2.1 `mandated_reporter_incidents` exists and is well shaped

`reporter_id`, `student_id`, `observed_at`, `concern_type`, `description`, `action_taken`, `reported_to_authorities`, `reported_to_authorities_at`, `authority_name`, `report_number`, `admin_acknowledged_by`, `admin_acknowledged_at`, `status`. **0 rows.**

Whoever designed this understood the domain: it separates *observing* from *reporting to authorities*, captures the authority and report number, and has an admin acknowledgment distinct from the report itself.

⚠️ **It has no `tenant_id`.** Child-safety records are among the 41 untenanted tables. With one tenant this is latent; with two it is a cross-studio data exposure of the most sensitive category the platform holds. **This must be fixed before a second tenant exists**, and arguably before the first record is written.

### 2.2 There is no general incident table

Nothing records an injury, a behavior issue, or property damage. Today those live in a teacher's memory, a text message, or `attendance.teacher_notes` — which §3.2 of `CLASS_SESSION_HUB.md` explicitly says must not become the record of anything consequential.

### 2.3 The notification surface does not exist

`notifications` holds **88 rows, all 88 unread.** The table and API exist; the UI does not (`FINANCIAL_ANOMALY_DETECTION.md` §3.1).

**This is the load-bearing problem for escalation.** An incident spec that says "notify the owner" against a table nobody can read is a spec that produces silence. Escalation is not a row — it is somebody finding out.

### 2.4 Delivery preferences have no SMS channel

`notification_preferences` has `push_enabled` and `email_enabled`, plus per-type toggles (`check_in`, `announcements`, `billing`, `rehearsal_schedule`, `class_reminder`, `late_pickup`, `timesheet_reminder`, `attendance_summary`). **No `sms_enabled`.** **0 rows** — so no one has preferences, and `device_tokens` is empty, so push has nowhere to go.

For the multi-channel messaging in `CLASS_SESSION_HUB.md` §3.3, SMS needs a preference column before it can be a channel.

---

## 3. Incidents

### 3.1 Shape

```
incidents
  id, tenant_id                       not null
  schedule_instance_id                null   -- the session, when there is one
  class_id, location_id               null
  incident_type                       not null -- injury | behavior | property
                                               --   | near_miss | other
  severity                            not null -- minor | moderate | serious
  occurred_at                         not null
  reported_by, reported_at            not null
  description                         not null
  action_taken                        null
  parent_notified_at, parent_notified_by  null
  status                                       -- open | acknowledged | closed
  acknowledged_by, acknowledged_at    null
  closed_at, closure_note             null

incident_students        incident_id, student_id, role  -- involved | witness | affected
incident_addenda         incident_id, author_id, body, created_at
```

**Append-only.** An incident is a record of what someone observed at a point in time. Corrections are **addenda**, never edits — a record that can be quietly revised is worth less as evidence than one that cannot, and the studio's own protection depends on it having been written contemporaneously.

`schedule_instance_id` ties it to the session, so an incident is reachable from the class it happened in and rolls up per class, per teacher, per location over time.

### 3.2 Escalation

Severity determines who is told and how fast:

| Severity | Notified | When |
|---|---|---|
| `minor` | Studio owner, studio manager | Daily digest |
| `moderate` | Owner, manager, admin | Immediately, in-app + email |
| `serious` | Owner, manager, super_admin | Immediately, every available channel |

**Escalation must be a real notification.** Given §2.3, this spec depends on the notification UI existing — and until it does, `serious` should send email directly rather than only writing a row.

**Unacknowledged serious incidents re-escalate.** A notification nobody opens is not a notification; if a serious incident is unacknowledged after a set interval, it repeats and widens.

### 3.3 Telling the parent

`parent_notified_at` is a deliberate act by a person, never automatic. An injury notification a family receives before a human has spoken to them is worse than none, and a system that auto-sends removes the judgment that makes the conversation humane.

What the platform does: prompt for it, record that it happened, and surface incidents where it has not.

### 3.4 Who can see incidents

| Viewer | Own class incidents | All incidents |
|---|---|---|
| Reporting teacher | Yes | No |
| Other teachers | No | No |
| `admin`, `studio_admin`, `studio_manager` | Yes | Yes |
| `super_admin` | Yes | Yes |
| Parent | **Only what was communicated to them** — never the raw record |

An incident naming a child is sensitive in the same way family contact data is (`FAMILY_DATA_ACCESS.md`), and behavior incidents name two children as often as one. A parent seeing the raw record would frequently be seeing another family's child.

---

## 4. Mandated reporting — a different path

**Nothing in this spec should be read as legal guidance, and no one on this project is qualified to give any.**

California Penal Code §11165.7 defines mandated reporters by role. Whether a given dance instructor falls within it depends on facts about their duties and the organisation, and it is a determination for the studio and its counsel — not for this document and not for the platform.

What the platform must do, regardless of how that determination lands:

**Keep the paths separate.** `mandated_reporter_incidents` already exists and is not `incidents`. An incident may prompt someone to file a mandated report; it never becomes one automatically, and no status transition should convert between them.

**Never file on someone's behalf.** The legal obligation belongs to the individual who has the knowledge or suspicion. It cannot be delegated to a supervisor, and it is not discharged by telling an administrator. The platform's role is to **record that a report was made, by whom, to whom, and when** — the `reported_to_authorities`, `authority_name`, and `report_number` columns are exactly right for that. A UI that implies "submit and the studio handles it" would be actively harmful, because the reporter would believe their obligation was met when it was not.

**Do not gate the record on training or role.** If a teacher believes something needs recording, the system takes it. Whether that person is a mandated reporter under the statute is not a question a form should adjudicate at the moment someone is trying to write down what a child said.

**Notify leadership immediately and separately.** Acknowledgment by an administrator (`admin_acknowledged_by`) is an internal control, not a substitute for the report.

**Restrict visibility tightly.** These records name a child and a concern. Access should be narrower than general incidents — `super_admin` and whoever the studio designates, logged on read. This is one of the few places where read-auditing is warranted.

The studio also needs a written procedure that lives outside the software — who to call, what the timeline is, what training staff receive. `KNOWLEDGE_REPOSITORY_AND_AI.md` is where that document belongs, and the platform should link to it from the form rather than restate it.

---

## 5. Multi-channel delivery

For both incidents and the session messaging in `CLASS_SESSION_HUB.md` §3.3:

**The sender writes once; the platform fans out.** A teacher should not be choosing between in-app, SMS, and email — the family already expressed a preference, and asking the sender to pick means the preference is ignored.

```
notification_preferences
  + sms_enabled boolean not null default false
```

Resolution: for each recipient, deliver to every enabled channel. In-app always (it is the record); push where a `device_token` exists and `push_enabled`; email where `email_enabled`; SMS where `sms_enabled` and a verified number exists.

**Serious incidents ignore preferences.** A studio owner does not get to miss a serious injury because they turned off email.

**Lock-screen previews are unauthenticated surfaces** (`FAMILY_DATA_ACCESS.md` §4.2). An incident push carries a title and a deep link — never a child's name and never the description.

---

## 6. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | `tenant_id` on `mandated_reporter_incidents` (§2.1) | Low. **Do before any record exists** |
| **2** | Notification UI over the existing 88 rows (`FINANCIAL_ANOMALY_DETECTION.md` §3.1) | Medium. **Escalation is meaningless without it** |
| **3** | `incidents`, `incident_students`, `incident_addenda`; append-only enforcement | Medium |
| **4** | Report an incident from the session (`CLASS_SESSION_HUB.md`) and standalone | Medium |
| **5** | Severity-based escalation, with `serious` sending email directly | Medium |
| **6** | Acknowledgment, re-escalation of unacknowledged serious incidents | Low |
| **7** | Parent-notified prompt and record (§3.3) | Low |
| **8** | `sms_enabled` + the fan-out resolver (§5) | Medium |
| **9** | Mandated-report form: separate path, separate visibility, read-audited | **High. Get the framing right, not just the schema** |

Phase 1 is a small migration guarding the most sensitive table in the system. Phase 2 is a dependency this spec inherits rather than creates.

---

## 7. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Who is designated to receive mandated-report notifications?** Owner only, or a named safeguarding lead? | Phase 9 |
| 2 | **What is the studio's written incident procedure?** The platform links to it; it does not define it | Phase 4 |
| 3 | **Does a serious incident notify the parent automatically?** Recommended **no** (§3.3) — confirm | Phase 7 |
| 4 | **Retention** — incidents, addenda, mandated reports. Different answers, and the last may be governed by more than preference | Phase 3, 9 |
| 5 | **Does insurance require a specific format or timeline** for injury reports? That shapes the fields | Phase 3 |
| 6 | **Re-escalation interval** for an unacknowledged serious incident | Phase 6 |

**For counsel, not Amanda:** whether the studio's instructors are mandated reporters under §11165.7, and what training or documentation that carries. The platform is built the same way either way; the answer determines the procedure and the copy.

---

## 8. Related

- `CLASS_SESSION_HUB.md` — incidents are reported from the session; §3.2 there says notes are not the place for a disclosure
- `FAMILY_DATA_ACCESS.md` — §4.2 push-payload rules; the visibility model §3.4 follows
- `FINANCIAL_ANOMALY_DETECTION.md` §3.1 — the notification UI this depends on
- `KNOWLEDGE_REPOSITORY_AND_AI.md` — where the written procedure lives
- `SESSION_2026-07-25_FINDINGS.md` — the 41 untenanted tables, including `mandated_reporter_incidents`
