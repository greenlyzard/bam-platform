# Student Profile Enhancement — Spec Addendum

**Status:** Ready for implementation  
**Appended:** April 9, 2026  
**Extends:** STUDENT_PROFILE.md  
**Decision Log Date:** April 9, 2026

---

## What This Covers

The existing STUDENT_PROFILE.md has excellent specs for the hero section, 
badges, photo gallery, evaluations, and documents. This addendum covers:

1. What still needs to be BUILT (vs. specced but not implemented)
2. Upsell opportunities section (new — not in original spec)
3. Casting integration on profile
4. Build priority order

---

## 1. Build Priority Order

### P0 — Must have for next season enrollment

1. **Photo upload** — admin uploads student headshot
2. **Document library tab** — shows signed contracts, waivers, outstanding items
3. **Skill badge progress** — current season skills as badge wall
4. **Upsell opportunities** — admin sees revenue opportunities per student

### P1 — Strong parent experience

5. **Assessments/Evaluations tab** — formal evaluation history
6. **Casting history** — what productions, what roles
7. **Performance history** — attendance at shows

### P2 — Delight features

8. **Shareable public profile** — vanity URL for grandparents
9. **Photo gallery** — Google Photos album link
10. **Progress bar** toward next level

---

## 2. Upsell Opportunities (NEW — not in original spec)

Every student profile shows an admin-facing "Opportunities" card that 
surfaces revenue and engagement opportunities Angelina or the system detects.

### Opportunity Types

| Type | Trigger | Suggested Action |
|---|---|---|
| `private_recommended` | Teacher flagged student as benefiting from privates | "Book a private with [Teacher]" |
| `bundle_upgrade` | Student enrolled in 2+ classes, Unlimited costs less | "Upgrade to Unlimited — saves $X/mo" |
| `class_gap` | Unlimited student has open schedule slots | "Sofia has room for [Class Name]" |
| `level_ready` | Student flagged ready to advance | "Schedule level evaluation" |
| `competition_eligible` | Student at level eligible for competition | "Competition season opens [date]" |
| `re_enrollment` | Season ending, student not yet re-enrolled | "Re-enroll for [Next Season]" |
| `trial_conversion` | Trial attended, no enrollment yet | "Convert trial to enrollment" |
| `attendance_drop` | Attendance rate dropped below 75% | "Check in with family" |
| `lapsed` | No classes in 30+ days | "Reach out — last seen [date]" |

### Display

Admin student profile → "Opportunities" card (right sidebar or tab):

```
💜 Opportunities

🎯 Private Recommended
   Ms. Lauryn thinks Sofia would benefit 
   from pointe privates
   [Book Private]

📈 Bundle Upgrade Available  
   Sofia takes 3 classes ($285/mo).
   Unlimited is $249/mo — save $36.
   [Upgrade to Unlimited]

⚠️ Re-enrollment Due
   Fall 2026 enrollment not yet confirmed.
   [Send Placement Reminder]
```

Each opportunity has a one-click action that either opens the relevant 
flow (book private, upgrade bundle, send email) or dismisses with a 
"Not now" option that snoozes for 30 days.

### DB

```sql
CREATE TABLE IF NOT EXISTS student_opportunities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  opportunity_type text NOT NULL,
  title           text NOT NULL,
  description     text,
  action_label    text,
  action_url      text,
  metadata        jsonb DEFAULT '{}',
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','dismissed','converted','snoozed')),
  snoozed_until   date,
  dismissed_at    timestamptz,
  dismissed_by    uuid REFERENCES profiles(id),
  converted_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  expires_at      date
);
```

---

## 3. Admin Student Profile Tab Structure

The admin view at `/admin/students/[id]` should have these tabs:

| Tab | Content | Status |
|---|---|---|
| Overview | Hero, current level, enrollment summary, opportunities | Build |
| Skills | Badge wall for current season, progress toward next level | Build |
| Documents | Family documents tab — signed contracts, outstanding items | Build |
| Evaluations | Formal evaluation history, add new evaluation | Build |
| Casting | Production history, roles, performance attendance | Build |
| Photos | Headshot upload, Google Photos album link, studio photos | Build |
| Attendance | Attendance history with absences, rate, notes | Exists (partial) |
| Billing | Invoices, payment history, credits | Future |
| Communications | Messages between this family and admin/teachers | Wire from comms hub |

---

## 4. Photo Upload Spec

### Headshot
- Admin uploads via file picker (JPEG/PNG, max 5MB)
- Stored in Supabase Storage: `avatars/student-photos/[student_id].jpg`
- Displayed in hero section of profile
- Also shown on attendance roster, casting panels, class lists

### Studio Photos (BAM-hosted)
- Admin can upload multiple photos per student (recital photos, comp photos)
- Stored in `student-photos/[student_id]/[timestamp]-[filename]`
- Shown in Photos tab as a grid
- Admin can caption each photo
- Parent can download but not delete

### Google Photos Album
- Admin pastes a Google Photos shared album URL
- Displayed as an embedded link/preview in Photos tab
- Not stored — just the URL is saved to `students.google_photos_album_url`

---

## 5. Casting Integration on Profile

The Casting tab on the student profile shows:

```
Productions
  🩰 The Nutcracker 2025
     Role: Clara's Friend (Corps)
     Performances: 3 of 3 attended
     [View Production →]

  🩰 Spring Showcase 2025
     Role: Ensemble — Level 3B
     Performances: 2 of 2 attended
```

Data pulled from existing casting/production tables.
If no casting history: "Sofia hasn't been cast in a production yet."

---

## 6. Skill Badge Wall Spec (from CURRICULUM_AND_PROGRESSION.md)

The Skills tab shows:

**Header:** "Fall 2026 Skills — Level 3B Ballet"

**Achieved badges** (full color, lavender background):
- Badge icon + skill name
- "Earned Oct 3" on hover/tap

**In Progress** (partial fill ring):
- Badge icon grayed + skill name
- Progress indicator if applicable

**Coming Up** (locked, grayed):
- Next 2-3 skills in sequence
- "Coming up" label

**Admin can:**
- Award a badge directly from this page
- View all seasons (toggle)
- See teacher notes on each skill record

**Parent sees** (from portal):
- Same display but only if `is_visible_to_parents = true` on season_curriculum

---

## 7. Decisions Log

| # | Decision |
|---|---|
| 1 | Student profile has 9 tabs — Overview, Skills, Documents, Evaluations, Casting, Photos, Attendance, Billing, Communications |
| 2 | Upsell opportunities are admin-facing only — parents never see them |
| 3 | Opportunities card is dismissable with 30-day snooze |
| 4 | Headshot stored in Supabase Storage, studio photos also hosted there |
| 5 | Google Photos albums linked by URL — not imported/copied |
| 6 | Casting tab pulls from existing production/casting tables |
| 7 | Skills badge wall matches CURRICULUM_AND_PROGRESSION.md spec exactly |
| 8 | Documents tab reuses the family_documents table filtered by student_id |
| 9 | Build priority: photos → documents → skills → upsell → evaluations → casting |
