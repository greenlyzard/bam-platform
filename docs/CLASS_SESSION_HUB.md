# Class Session Hub

**Status:** DRAFT — spec only, no implementation
**Author:** Derek Shaw
**Date:** 2026-07-28
**Investigated against live DB:** 2026-07-28

---

## 1. Why

A teacher finishing a class has five things they might do: mark the roster, note what was covered, note something about a student, tell the parents something, and share music. Today that is one form and four places that do not exist.

The session — a single occurrence of a class on a date — is where the teacher already is. Everything tied to that class on that day belongs there.

This is also the surface that makes `FAMILY_DATA_ACCESS.md` workable. Teachers must not see parent contact details; messaging *from the session*, with recipients resolved server-side from the roster, is the sanctioned path that makes the restriction survivable instead of something people route around.

---

## 2. Findings

### 2.1 The foundation shipped today

Attendance is now keyed on `schedule_instances.id`, not `(class_id, class_date)`. Two occurrences of a class on one day are two sessions with two rosters. That is what makes a *session* hub coherent — before today there was no stable identity for "this class, this time."

### 2.2 The live messaging family is `communication_*`

Row counts settle the audit that `COMMUNICATIONS_HUB.md` has been waiting on:

| Family | Rows |
|---|---|
| `communication_threads` | **26** |
| `announcements` | 0 |
| `studio_announcements` | 0 |
| `channel_posts` | 0 |

`communication_threads` / `communication_messages` / `communication_groups` / `communication_group_members` / `communication_thread_reads` / `communication_attachments` is the family in use. **Build on it. The other five are candidates for retirement**, and confirming that is cheaper now than after a sixth is added.

### 2.3 Two attendance tables

| Table | Rows | Written by |
|---|---|---|
| `attendance` | 0 | `markAttendance` — occurrence-keyed as of today |
| `attendance_records` | 0 | `/teach/classes/[classId]/attendance`, from the **browser client** |

`attendance_records` has `class_id, student_id, teacher_id, date, status, notes` and **no `schedule_instance_id`**. Two write paths into two tables is how records end up in the one nobody reads. **The session hub uses `attendance` and the second path is retired**, not extended.

### 2.4 Curriculum tables exist and are empty

`season_curriculum` — `season_id`, `level_tag`, `skill_id`, `sort_order`, `is_visible_to_parents`, `is_primary`. **0 rows.**
`lms_content` — `title`, `content_type`, `video_url`, `thumbnail_url`, `duration_seconds`, `target_level`, `target_age_min/max`, `is_published`, `tags`. **0 rows.**

`is_visible_to_parents` on the curriculum row is the right shape — a skill can be tracked internally and shown to families separately.

⚠️ **`lms_content` has no `tenant_id`.** It is one of the 41 untenanted tables. Any file a teacher uploads through this surface lands there, so this is a tenant-scoping fix that has to happen *before* the feature, not after.

### 2.5 Notes have two homes and no distinction

`attendance.teacher_notes` is per student. `schedule_instances.notes` is per occurrence. Neither declares an audience, and they are very different things: "Ella is struggling with turnout" and "covered variation 2, half the class out sick" need different visibility and different retention.

---

## 3. Design

### 3.1 The surface

One route per occurrence — `/teach/session/[instanceId]` — showing class name, date, time, room, and the roster. Sections:

| Section | What |
|---|---|
| **Roster & attendance** | Present / absent / excused / late per student. Saves to `attendance`, keyed on the occurrence |
| **Session note** | What was covered, conditions, anything about the class as a whole |
| **Student notes** | Per student, private to staff |
| **Message families** | Compose to the roster's families without seeing an address |
| **Curriculum** | Mark skills covered this session |
| **Files** | Music and materials, optionally pushed to families |

The teacher reaches it from their schedule, from the dashboard, or from a timesheet draft — the draft already carries `schedule_instance_id`, so "confirm these hours" and "mark this roster" are one click apart.

### 3.2 Notes, and who sees them

```
session_notes
  schedule_instance_id, tenant_id, author_id, body,
  visibility            -- staff | admin_only
  created_at
```

Student-level notes stay on `attendance.teacher_notes`, which is already per student per occurrence.

**Neither is parent-visible.** A note a teacher writes about a child is a staff record. If something should reach a family, it goes through §3.3 as a message, deliberately, with the teacher choosing the words — not by a note's visibility flag being flipped later.

Two rules worth stating because they are easy to get wrong under time pressure: notes about a child are **never** bulk-exported to families, and a note is not the place for anything that belongs in a mandated-reporter report. The studio has a separate obligation there (`mandated_reporter_incidents` exists), and a note that quietly becomes the record of a disclosure is a compliance problem.

### 3.3 Messaging families from the session

**The teacher composes; the platform addresses.** Recipients resolve server-side from the occurrence's roster → students → guardians. The teacher's device never receives an email address or phone number.

- Threads and messages go in `communication_*` (§2.2), tagged with `schedule_instance_id` and `class_id` so the conversation stays attached to the session that prompted it.
- Delivery to email or SMS happens server-side; the address is resolved at send and never returned to the sender.
- **Admins can read threads for their tenant.** This is a youth-serving organisation and unmonitored adult-to-family channels are their own risk.
- Replies land back in the thread, so the teacher never needs an out-of-band channel.

Two guardrails: a message to the whole roster should be obviously that, not a set of individual sends that look private; and there is no "reply to one family" that silently becomes a group message.

### 3.4 Curriculum progress

Mark which `season_curriculum` skills were covered in this session:

```
session_curriculum_coverage
  schedule_instance_id, curriculum_id, tenant_id,
  covered_at, marked_by, note
```

Progress by class, by level, by student's class history falls out of it. `is_visible_to_parents` on the curriculum row governs whether a family sees the skill at all — so internal pedagogy and the parent-facing story are the same data with two audiences.

This is the most valuable section long-term and the least urgent for Fall: it is what turns attendance into a teaching record, and it needs curriculum content to exist first (0 rows today).

### 3.5 Files and music

Upload to the session; optionally push to the roster's families.

**Two constraints, and the second is not optional:**

1. `lms_content` needs `tenant_id` before anything is uploaded (§2.4).
2. **Licensing.** Studio-recorded and studio-licensed tracks are fine. A commercial recording distributed to families is distribution, and "we put it in the parent portal" does not change that. The upload flow should require an explicit acknowledgment that the uploader has the right to share the file, recorded with the upload. That is not legal cover — it is a prompt that makes people think, and a record of who said yes.

Also worth deciding early: retention, and whether a file pushed to families can be un-pushed. Once it is downloaded it is gone, so "remove" means "stop offering it," and the UI should say so.

---

## 4. Access

| Viewer | Roster | Session note | Student notes | Messages | Files |
|---|---|---|---|---|---|
| Assigned teacher | Yes | Yes | Yes | Compose to roster | Yes |
| Substitute on that occurrence | **Yes** | Yes | Yes | Compose to roster | Yes |
| `admin`, `studio_admin` | Yes | Yes | Yes | Yes | Yes |
| `finance_admin` | No | No | No | No | No |
| Parent | Own child only | No | No | Own thread | Pushed files only |

**The substitute row is a live gap.** `markAttendance` authorizes on `classes.teacher_id = auth.uid()`, so a substitute assigned via `schedule_instances.substitute_teacher_id` **cannot mark attendance for a class they are covering.** Found during today's occurrence-keying work and deliberately not widened in passing. It has to be fixed before the session hub, or the hub inherits it.

No parent contact details on any of these surfaces (`FAMILY_DATA_ACCESS.md` §3.1). Emergency contact stays break-glass with an audit log.

---

## 5. Build order

| Phase | Scope | Risk |
|---|---|---|
| **1** | Confirm `communication_*` is the surviving family; mark the other five for retirement | Decision |
| **2** | Fix substitute authorization on attendance (§4) | Low. **Blocks the hub** |
| **3** | `tenant_id` on `lms_content` | Low. **Blocks files** |
| **4** | `/teach/session/[instanceId]` shell: header, roster, attendance — replacing the standalone marker | Medium |
| **5** | Retire `attendance_records` and its browser-client write path (§2.3) | Low |
| **6** | `session_notes` + per-student notes on the session view | Low |
| **7** | Message families from the session, server-side address resolution, admin-readable threads | **Medium–high. The privacy boundary lives here** |
| **8** | File upload with licensing acknowledgment; push to families | Medium |
| **9** | Curriculum coverage — after curriculum content exists | Medium |

Phases 2 and 3 are prerequisites disguised as chores. Phase 7 is where a mistake exposes contact details.

---

## 6. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | **Can a substitute mark attendance and message families** for a class they cover? Assumed yes above — confirm | Phase 2 |
| 2 | **Are the other five messaging/announcement families retired or reserved?** All zero rows (§2.2) | Phase 1 |
| 3 | **Do admins read teacher-to-family threads by default**, or only on report? Default-on is the safer posture | Phase 7 |
| 4 | **Retention** — session notes, student notes, threads, files | Phase 6, 7, 8 |
| 5 | **Can a pushed file be withdrawn?** Only in the sense of no longer offering it | Phase 8 |
| 6 | **Does a parent see curriculum progress** for their own child, or only the class-level skill list? | Phase 9 |

---

## 7. Related

- `FAMILY_DATA_ACCESS.md` — §3.3 is the mediated-messaging requirement this implements; §4 the mobile enforcement note
- `TIMESHEET_AUTODRAFT.md` — drafts carry `schedule_instance_id`, so confirm-hours and mark-roster are one click apart
- `ABSENCE_SUBSTITUTION_AND_ASSIGNMENT.md` — substitute assignment is what §4 row two depends on
- `COMMUNICATIONS_HUB.md` — §2.2 answers its outstanding audit
- `_INDEX.md` task 19 — **87 of 153 active classes have no occurrences**, so they have no session to open
