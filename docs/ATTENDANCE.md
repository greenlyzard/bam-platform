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
- Parent attendance history view
- Attendance analytics
- Overpayment alert system (cross-reference with timesheets)
- Database schema

This spec does **not** cover:
- Waitlist management (covered in Registration spec)
- Makeup class scheduling (future scope)
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
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_attendance_session  ON attendance_records(session_id);
CREATE INDEX idx_attendance_student  ON attendance_records(student_id);
CREATE INDEX idx_attendance_status   ON attendance_records(status);
```

---

## 6. Teacher — Taking Attendance

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
  - Current status badge (defaults to `absent` until marked)
  - Quick tap buttons: ✓ Present | Late | Excused | Absent
  - Notes field (expandable)
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

## 7. Admin — Attendance Management

### `/admin/attendance` — Overview Page

Filters:
- Date range (default: current week)
- Class / Teacher / Student
- Status filter

Views:
- **By Session** — list of sessions with attendance summary (e.g. "12/15 present")
- **By Student** — list of students with attendance rate
- **By Class** — class-level attendance rates

### Session Detail

Clicking a session shows the full attendance sheet with all student statuses. Admin can edit any record regardless of lock status.

### Attendance Rate Indicators

Color coded:
- 90%+ present: green
- 75–89%: amber
- Below 75%: red

---

## 8. Parent — Attendance History

On the parent portal, the student profile page includes an **"Attendance"** tab:

- List of all sessions for enrolled classes
- Date, class name, status badge
- Notes (if any)
- Attendance rate: "Your child has attended 18 of 20 sessions (90%)"

Parents can see status but cannot edit.

---

## 9. Overpayment Alert System

This is the cross-reference engine between timesheets and attendance. It runs as a background check when a timesheet entry is submitted or when an admin runs payroll.

### Alert Types

**Alert Type 1 — Session Not Found**

Triggered when:
- A teacher logs hours for a class on a specific date
- No session record exists for that teacher + class + date combination

Message: "No scheduled session found for [Class Name] on [Date]. Verify this class was held."

Severity: ⚠️ Warning

---

**Alert Type 2 — Session Cancelled**

Triggered when:
- A teacher logs hours for a class
- The session record for that date has `status = 'cancelled'`

Message: "[Class Name] on [Date] was marked as cancelled. Teacher logged [N] hours. Please verify."

Severity: 🔴 Flag — requires admin review before approving timesheet entry

---

**Alert Type 3 — Zero Attendance**

Triggered when:
- A teacher logs hours for a class
- The session has 0 students marked present (all absent or no attendance taken)

Message: "No students were marked present for [Class Name] on [Date]. Teacher logged [N] hours. Was this class held?"

Severity: ⚠️ Warning

---

**Alert Type 4 — Private Lesson — Student Absent**

Triggered when:
- A teacher logs Private hours and names a student
- That student has an `absent` attendance record for a private session on that date

Message: "[Student Name] was marked absent for their private lesson on [Date]. Teacher logged [N] hours."

Severity: 🔴 Flag

---

**Alert Type 5 — Hours Exceed Session Duration**

Triggered when:
- A teacher logs more hours than the scheduled session length
- e.g. logs 2.0 hours for a 45-minute class

Message: "Teacher logged [N] hours for [Class Name] on [Date]. Scheduled duration is [N] minutes. Please verify."

Severity: ⚠️ Warning

---

**Alert Type 6 — Duplicate Entry**

Triggered when:
- A teacher submits two timesheet entries for the same class on the same date

Message: "Duplicate entry detected: [Class Name] appears twice on [Date]."

Severity: 🔴 Flag — blocks submission until resolved

---

### Alert Display

Alerts appear:
1. **Inline on the timesheet entry** — a yellow or red banner below the flagged entry row
2. **On the payroll report** — flagged entries are highlighted with a tooltip explaining the alert
3. **On the admin timesheets overview** — a "Needs Review" count badge

Admins can:
- **Override** — mark the alert as reviewed and approve anyway (with a required note explaining why)
- **Return to teacher** — send the entry back to the teacher with a message
- **Delete the entry** — if it was clearly erroneous

---

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

CREATE INDEX idx_alerts_entry  ON timesheet_alerts(timesheet_entry_id);
CREATE INDEX idx_alerts_tenant ON timesheet_alerts(tenant_id);
```

---

## 10. Session Auto-Generation

Sessions are generated automatically each week from the class schedule. A daily cron job (Vercel Cron) runs at 12:00 AM Monday and creates session records for the coming week.

```
/api/cron/generate-sessions
```

Logic:
1. For each active class with a recurring schedule
2. Calculate next occurrence dates for the coming 7 days
3. Insert session records if they don't already exist
4. Skip cancelled classes or classes outside their date range

Cron schedule: `0 0 * * 1` (every Monday at midnight)

---

## 11. Analytics

### Studio-Level (Admin Dashboard)

- Overall attendance rate this month
- Classes with lowest attendance (bottom 5)
- Students with most absences (flagged for outreach)
- Busiest vs slowest days of the week

### Teacher-Level

- Attendance rate per class per teacher
- Classes where attendance was never taken (flag)

### Student-Level

- Per-student attendance rate per class
- Trend over time (improving / declining)
- Students at risk of losing spot if studio has attendance policies

---

## 12. API Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/attendance/sessions` | List sessions (filterable) | Teacher+ |
| GET | `/api/attendance/sessions/[id]` | Get session with attendance records | Teacher+ |
| POST | `/api/attendance/sessions/[id]/records` | Submit attendance for a session | Teacher+ |
| PATCH | `/api/attendance/records/[id]` | Update a single attendance record | Admin+ (or Teacher if unlocked) |
| GET | `/api/attendance/students/[id]` | Get attendance history for a student | Admin+ / Parent (own child) |
| GET | `/api/cron/generate-sessions` | Auto-generate upcoming sessions | Cron secret |

---

## 13. Build Notes for Claude Code

When building this module, reference these files first:

```
docs/claude/ATTENDANCE.md             ← this file
docs/claude/ROLES_AND_PERMISSIONS.md
docs/claude/SCHEDULING_AND_LMS.md
CLAUDE.md
```

Build order:
1. Migration — `sessions` and `attendance_records` tables
2. Session auto-generation cron job
3. Teacher attendance UI — today's sessions list + attendance sheet
4. Admin attendance overview page
5. Parent attendance history tab on student profile
6. Overpayment alert engine + `timesheet_alerts` table
7. Alert display on timesheet entries and payroll report
8. Analytics cards on admin dashboard

**Dependency note:** The overpayment alert system (Parts 6–7) requires both this module and the timesheet module to be fully built and populated with real data. Do not build the alert engine until session records and timesheet entries both exist.
