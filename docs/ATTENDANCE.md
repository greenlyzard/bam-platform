# ATTENDANCE.md
# Ballet Academy and Movement — Platform Specification
# Attendance Module

---

## 1. Purpose

The Attendance module tracks student presence at scheduled classes, rehearsals, and private lessons. It serves three audiences:

- **Teachers** — quick check-in at the start of each session
- **Admins** — visibility into attendance trends, makeup eligibility, and billing accuracy
- **Parents** — view their child's attendance history

Attendance data also unlocks the **Overpayment Alert System** — cross-referencing teacher timesheet entries against actual sessions held and students present.

---

## 2. Scope

This spec covers:
- Class attendance (weekly recurring classes)
- Rehearsal attendance (production rehearsals)
- Private lesson attendance
- Attendance UI for teachers and admins
- **Session progress notes per student per class** ← NEW
- Parent attendance history view
- Attendance analytics
- Overpayment alert system (cross-reference with timesheets)
- Database schema

This spec does **not** cover:
- Waitlist management (covered in Registration spec)
- Makeup class scheduling (covered in MAKEUP_POLICY.md)
- Automated billing adjustments for absences (future scope)

---

## 3. Attendance Statuses

| Status | Code | Description |
|---|---|---|
| Present | `present` | Student attended |
| Absent | `absent` | Student did not attend, no notice |
| Excused | `excused` | Student notified studio in advance |
| Late | `late` | Student arrived more than 10 minutes after start |
| Makeup | `makeup` | Student is attending as makeup for a missed class |
| Trial | `trial` | Student is attending a trial class |

---

## 4. Session Model

A **session** is a single occurrence of a class, rehearsal, or private lesson on a specific date.

Sessions are either:
- **Generated** — auto-created from the class schedule (e.g. every Tuesday at 4pm generates a session record each week)
- **Manual** — created by admin for one-off events

```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  session_type    TEXT NOT NULL, -- 'class' | 'rehearsal' | 'private'
  class_id        UUID REFERENCES classes(id),
  rehearsal_id    UUID REFERENCES rehearsals(id),
  teacher_id      UUID REFERENCES user_profiles(id),
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled',
    CONSTRAINT valid_status CHECK (status IN ('scheduled','held','cancelled','rescheduled')),
  cancelled_reason TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_tenant     ON sessions(tenant_id);
CREATE INDEX idx_sessions_class      ON sessions(class_id);
CREATE INDEX idx_sessions_teacher    ON sessions(teacher_id);
CREATE INDEX idx_sessions_date       ON sessions(date);
```

---

## 5. Attendance Records

```sql
CREATE TABLE attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id),
  status          TEXT NOT NULL DEFAULT 'absent',
    CONSTRAINT valid_status CHECK (status IN ('present','absent','excused','late','makeup','trial')),
  checked_in_at   TIMESTAMPTZ,   -- timestamp when marked present
  checked_in_by   UUID REFERENCES user_profiles(id), -- teacher or admin who took attendance

  -- Session Progress Notes ← NEW (from DMP gap analysis)
  session_notes   TEXT,          -- Teacher's optional note for this student this session
                                 -- e.g. "Working on arabesque alignment — significant improvement"
  progress_flag   TEXT CHECK (progress_flag IN ('needs_attention','ready_to_advance','achieving','none') OR progress_flag IS NULL),
                                 -- Quick flag the teacher can set per student per session
  notes_visible_to_parent BOOLEAN NOT NULL DEFAULT false,
                                 -- Teacher controls whether this note surfaces in parent portal
  notes           TEXT,          -- Legacy field — general attendance note (admin-facing only)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_attendance_session  ON attendance_records(session_id);
CREATE INDEX idx_attendance_student  ON attendance_records(student_id);
CREATE INDEX idx_attendance_status   ON attendance_records(status);
CREATE INDEX idx_attendance_flag     ON attendance_records(progress_flag) WHERE progress_flag IS NOT NULL;
```

---

## 6. Session Progress Notes ← NEW

**Purpose:** Teachers can add a brief optional note per student per class session. This creates a longitudinal progress record beyond simple present/absent tracking — surfacing meaningful context on student profiles and in parent communications.

**Design Philosophy:** Notes are optional and fast. Taking attendance should not slow down a teacher. The progress note is a one-tap flag plus an optional text field — not a formal evaluation.

### Teacher UX — Adding a Progress Note

On the attendance sheet, each student row has:
- Status tap buttons (Present / Late / Excused / Absent) — unchanged
- **"+ Note"** expandable field below the student name — only visible when tapped
- Optional text area: "Session note (optional)"
- Optional progress flag dropdown: "Flag this student" → None / Needs Attention / Achieving / Ready to Advance
- Optional toggle: "Share with parent" (default: off)

Teachers can add a note regardless of attendance status (e.g., "Absent — but wanted to note she's been working on this at home per her mom's message").

### Progress Flag Definitions

| Flag | Color | Meaning |
|---|---|---|
| `needs_attention` | Amber | Student is struggling — teacher wants admin aware |
| `achieving` | Green | Particularly strong session — worth acknowledging |
| `ready_to_advance` | Lavender | Teacher recommends level advancement review |
| `none` | — | No flag (default) |

`needs_attention` flags are visible to admins immediately in the student directory. `ready_to_advance` flags trigger an in-app notification to admin: "Ms. Lauryn has flagged Sofia as ready for level advancement review."

### Visibility Rules

| Viewer | What They See |
|---|---|
| Teacher (own students) | Full session note + flag |
| Admin / Super Admin | Full session note + flag for all students |
| Parent | Only notes where `notes_visible_to_parent = true` |
| Student | Same as parent (their own sessions only) |
| Other Teachers | Never — isolated per teacher |

### Parent Portal Surface

When `notes_visible_to_parent = true`, the note appears on the student profile under "Recent Class Notes":

```
Tuesday, April 8 — Pre-Ballet with Ms. Amanda
"Beautiful focus today — Sofia held her arabesque for a full 5 counts. 
 Keep encouraging practice at home."
```

Notes are shown chronologically (newest first), limited to the last 10 visible notes in the portal. Older notes remain in history but paginated.

### Admin Surface

Admins see ALL session notes on the student profile under a dedicated "Session Notes" tab, including non-parent-visible notes. This creates a complete longitudinal record for:
- Level placement decisions
- Parent communication context
- Teacher performance review

### Student Directory — Flag Alerts

The student directory in `/admin/students` shows a `needs_attention` badge on any student who has received that flag in the last 14 days. Admin can click to see which teacher flagged them and the note context.

---

## 7. Teacher — Taking Attendance

### Entry Point

Teachers access attendance from:
- **Teacher portal nav** → "Take Attendance"
- **Class roster page** → "Take Attendance" button next to today's session
- **Mobile** — prominent button on the teacher home screen

### Today's Sessions

When a teacher opens the attendance screen they see a list of their sessions for today, ordered by start time:

```
Today — Tuesday, March 15

● 4:00 PM  Ballet II — Studio A        [Take Attendance]
● 5:30 PM  Ballet III — Studio B       [Take Attendance]
● 7:00 PM  Adult Ballet — Studio A     [Not started]
```

Sessions within 30 minutes of start time show an active **"Take Attendance"** button. Sessions more than 2 hours past end time are locked (admin can still edit).

### Attendance Sheet

Clicking "Take Attendance" opens the attendance sheet for that session:

- Session header: class name, date, time, room
- Student list sorted alphabetically by last name
- Each student row:
  - Avatar / initials
  - Student name
  - **Allergen badge** if `allergy_severity = 'severe'` (🥜 etc.) — from `student_health_records`
  - Current status badge (defaults to `absent` until marked)
  - Quick tap buttons: ✓ Present | Late | Excused | Absent
  - **"+ Note" expandable** — session_notes + progress_flag + notes_visible_to_parent toggle
- **"Mark All Present"** button at top (one-tap for full classes)
- **Save** button — saves current state, can return and edit until locked

### Auto-population

When a session is opened for attendance:
- All enrolled students are pre-populated with status `absent`
- Teacher taps to mark each student present, late, etc.
- Students not enrolled who show up (trials, makeups) can be added via search

### Lock Behavior

- Attendance is **editable by the teacher** until 2 hours after session end time
- After that, only Admin and above can edit
- Locked sessions show a 🔒 icon

---

## 8. Admin — Attendance Management

### `/admin/attendance` — Overview Page

Filters:
- Date range (default: current week)
- Class / Teacher / Student
- Status filter
- **Progress flag filter** (needs_attention / ready_to_advance)

Views:
- **By Session** — list of sessions with attendance summary (e.g. "12/15 present") + note count
- **By Student** — list of students with attendance rate + flag badges
- **By Class** — class-level attendance rates

### Session Detail

Clicking a session shows the full attendance sheet with all student statuses and session notes. Admin can edit any record regardless of lock status.

### Attendance Rate Indicators

Color coded:
- 90%+ present: green
- 75–89%: amber
- Below 75%: red

---

## 9. Parent — Attendance History

On the parent portal, the student profile page includes an **"Attendance"** tab:

- List of all sessions for enrolled classes
- Date, class name, status badge
- **Session note** (when teacher marked `notes_visible_to_parent = true`)
- Attendance rate: "Your child has attended 18 of 20 sessions (90%)"

Parents can see status and visible notes but cannot edit.

---

## 10. Overpayment Alert System

This is the cross-reference engine between timesheets and attendance. It runs as a background check when a timesheet entry is submitted or when an admin runs payroll.

### Alert Types

**Alert Type 1 — Session Not Found**
Triggered when a teacher logs hours for a class but no session record exists for that teacher + class + date. Severity: ⚠️ Warning.

**Alert Type 2 — Session Cancelled**
Triggered when teacher logs hours but session is marked `cancelled`. Severity: 🔴 Flag.

**Alert Type 3 — Zero Attendance**
Triggered when teacher logs hours but 0 students marked present. Severity: ⚠️ Warning.

**Alert Type 4 — Private Lesson — Student Absent**
Triggered when teacher logs Private hours but named student has `absent` status. Severity: 🔴 Flag.

**Alert Type 5 — Hours Exceed Session Duration**
Triggered when logged hours exceed the scheduled session length. Severity: ⚠️ Warning.

**Alert Type 6 — Duplicate Entry**
Triggered when two timesheet entries exist for same class + date. Severity: 🔴 Flag — blocks submission.

### Alert Storage

```sql
CREATE TABLE timesheet_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  timesheet_entry_id  UUID NOT NULL REFERENCES timesheet_entries(id) ON DELETE CASCADE,
  alert_type          TEXT NOT NULL,
  severity            TEXT NOT NULL, -- 'warning' | 'flag'
  message             TEXT NOT NULL,
  session_id          UUID REFERENCES sessions(id),
  is_resolved         BOOLEAN NOT NULL DEFAULT false,
  resolved_by         UUID REFERENCES user_profiles(id),
  resolved_at         TIMESTAMPTZ,
  resolution_note     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 11. Session Auto-Generation

Daily cron at 12:00 AM Monday creates session records for the coming week from active class schedules.

```
/api/cron/generate-sessions  (schedule: 0 0 * * 1)
```

---

## 12. Analytics

### Studio-Level (Admin Dashboard)
- Overall attendance rate this month
- Classes with lowest attendance (bottom 5)
- Students with most absences (flagged for outreach)
- **Students flagged `needs_attention` in last 14 days**
- **Students flagged `ready_to_advance` pending admin review**

### Teacher-Level
- Attendance rate per class
- Classes where attendance was never taken

### Student-Level
- Per-student attendance rate per class
- Trend over time
- **Progress note history (longitudinal view)**

---

## 13. API Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/attendance/sessions` | List sessions | Teacher+ |
| GET | `/api/attendance/sessions/[id]` | Get session with attendance records | Teacher+ |
| POST | `/api/attendance/sessions/[id]/records` | Submit attendance for a session | Teacher+ |
| PATCH | `/api/attendance/records/[id]` | Update a single record (status + note + flag) | Admin+ or Teacher if unlocked |
| GET | `/api/attendance/students/[id]` | Get attendance history for a student | Admin+ / Parent (own child) |
| GET | `/api/attendance/students/[id]/notes` | Get session notes for a student | Admin+ |
| GET | `/api/attendance/flags?type=needs_attention` | Get all flagged students | Admin+ |
| GET | `/api/cron/generate-sessions` | Auto-generate upcoming sessions | Cron secret |

---

## 14. Build Notes for Claude Code

Reference these files first:
```
docs/ATTENDANCE.md             ← this file
docs/ROLES_AND_PERMISSIONS.md
docs/SCHEDULING_AND_LMS.md
docs/STUDENT_PROFILE.md        ← for health records / allergen badge integration
CLAUDE.md
```

Build order:
1. Migration — update `attendance_records` with `session_notes`, `progress_flag`, `notes_visible_to_parent` columns
2. Teacher attendance UI — add "+ Note" expandable + allergen badge
3. Admin attendance overview — add flag filter + needs_attention badges
4. Parent attendance history tab — render visible notes
5. Student directory — needs_attention badge + ready_to_advance notification
6. Session auto-generation cron job
7. Overpayment alert engine + `timesheet_alerts` table
