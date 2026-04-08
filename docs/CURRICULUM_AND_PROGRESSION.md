# Curriculum & Progression — Spec

**Status:** Ready for implementation  
**Phase:** 3 — Student Experience  
**Related Modules:** STUDENT_PROFILE.md, ATTENDANCE.md, LEVEL_SYSTEM.md, BALLET_DOMAIN.md, ENROLLMENT_AND_PLACEMENT.md  
**Decision Log Date:** April 7, 2026

---

## 1. Overview

This module covers three interconnected systems:

1. **Curriculum Builder** — Amanda structures skills and learning objectives by level/program
2. **Skill Badge System** — Skills are awarded like Girl Scout badges; parents see achieved + next few upcoming
3. **Evaluation & Progression** — How students advance levels, including skill completion tracking and admin approval

The curriculum does not currently exist in written form anywhere. This platform is where Amanda will build and maintain it for the first time. The system must be flexible enough to accommodate ballet's nuanced progression structure while being simple enough for Amanda to actually maintain it.

---

## 2. Curriculum Builder

### 2.1 Structure

```
Curriculum
  └── Program (e.g. Ballet, Jazz, Contemporary)
        └── Level (e.g. Level 3B)
              └── Season Curriculum (e.g. Fall 2026)
                    └── Skill Category (e.g. Barre, Centre, Allegro, Artistry)
                          └── Skills (e.g. "Grand battement — front and side")
```

### 2.2 Skills as Badges

Skills work exactly like Girl Scout badges:
- Each skill is a discrete, achievable milestone
- Skills have a visual badge icon (thin outline style, BAM brand)
- Skills belong to a category within a level
- Skills are sequenced — there is a natural order within each category
- Completing all skills in a level = ready for level advancement review

### 2.3 Season Curriculum

The curriculum is organized by season, not just by level. This means:
- A Level 3B student in Fall 2026 has a specific set of skills they're working on this season
- The same level in Spring 2027 may have different or additional skills
- Skills can repeat across seasons (ongoing mastery) or be level-specific (one-time achievement)

This is the unit of visibility for parents — they see the **season curriculum** for their child's current level, not the entire multi-year progression map.

---

## 3. Database Schema

```sql
-- Skill categories (groupings within a level)
CREATE TABLE IF NOT EXISTS curriculum_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,          -- e.g. "Barre Work", "Centre", "Allegro", "Artistry"
  discipline      text,                   -- e.g. "ballet" — null = applies to all
  sort_order      integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Individual skills (the "badges")
CREATE TABLE IF NOT EXISTS curriculum_skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  category_id     uuid NOT NULL REFERENCES curriculum_categories(id),
  name            text NOT NULL,          -- e.g. "Grand battement — front and side"
  description     text,                   -- what mastery looks like
  assessment_criteria text,              -- how teacher evaluates this skill
  badge_icon_url  text,                  -- thin outline icon
  badge_color_hex text DEFAULT '#9C8BBF',
  skill_type      text NOT NULL DEFAULT 'achievement'
    CHECK (skill_type IN (
      'achievement',      -- earned once (e.g. "First Recital")
      'progressive',      -- rated on a scale (e.g. arabesque quality 1-5)
      'seasonal'          -- worked on each season, re-assessed
    )),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Season curriculum: which skills are in focus for which level this season
CREATE TABLE IF NOT EXISTS season_curriculum (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  season_id       uuid NOT NULL REFERENCES seasons(id),
  level_tag       text NOT NULL,          -- e.g. "Level 3B", "Petites", "Company"
  skill_id        uuid NOT NULL REFERENCES curriculum_skills(id),
  sort_order      integer DEFAULT 0,      -- order within the season
  is_visible_to_parents boolean DEFAULT false,  -- Super Admin controls per season
  is_primary      boolean DEFAULT true,   -- primary focus vs supplemental
  created_at      timestamptz DEFAULT now(),
  UNIQUE(season_id, level_tag, skill_id)
);

-- Student skill records (the earned badges)
CREATE TABLE IF NOT EXISTS student_skill_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  skill_id        uuid NOT NULL REFERENCES curriculum_skills(id),
  status          text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','achieved','mastered')),
  rating          integer CHECK (rating BETWEEN 1 AND 5),  -- for progressive skills
  awarded_by      uuid REFERENCES profiles(id),            -- teacher or admin
  awarded_at      timestamptz,
  season_id       uuid REFERENCES seasons(id),             -- which season it was earned
  class_id        uuid REFERENCES classes(id),             -- which class context
  notes           text,                                    -- teacher note on achievement
  visible_to_parent boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(student_id, skill_id, season_id)  -- one record per student per skill per season
);
```

---

## 4. Parent-Facing Skill View

### 4.1 What Parents See

Parents see a curated view of their child's skill progress for the **current season**. Not the full multi-year curriculum map — just what's in focus now.

**Display rules:**
- **Achieved badges** — full color, icon visible, date earned shown on tap
- **In progress** — partial fill on badge (progress ring)
- **Next 2–3 upcoming** — grayed out with lock icon, skill name visible but grayed
- **Future skills** — not shown (avoid overwhelming)

This creates the Girl Scout badge wall effect — parents feel the momentum of earned badges and anticipation of upcoming ones without seeing an overwhelming list.

```
Sofia's Fall 2026 Progress — Level 3B Ballet

[EARNED]
🏅 Dégagé Combination  ✓ Oct 3
🏅 Frappé Series       ✓ Oct 17
🏅 Port de Bras I      ✓ Nov 2

[IN PROGRESS]
◐  Grand Battement (front) — working on it

[COMING UP]
🔒 Grand Battement (side)
🔒 Attitude Derrière
```

### 4.2 Visibility Toggle

- Super Admin controls `is_visible_to_parents` per `season_curriculum` entry
- Can toggle all skills in a season on/off at once
- Or toggle individual skills (e.g. keep some skills internal)
- Default: off (internal only) — admin must explicitly make visible

### 4.3 What Parents Do NOT See

- Skills from other levels
- Internal assessment criteria text
- Teacher notes on skill records (those stay in admin/teacher view)
- Rating scores (shown as in-progress or achieved, not the 1-5 number)

---

## 5. Teacher Skill Awarding

### 5.1 From Attendance Sheet

When taking attendance, teacher sees the "in progress" skills for each student. After marking attendance, optional: award a skill by tapping the badge icon next to the student name.

Fast path — no separate navigation required:
```
Sofia M.    [✓ Present]    [+ Award Badge] →  shows this season's pending skills
```

### 5.2 From Student Roster

Teacher opens a student's profile from their class roster → Skills tab → awards or updates status on any skill in the current season curriculum for that student's level.

### 5.3 Bulk Award

For skills earned by a whole class on the same day (e.g. everyone mastered the same combination):
- Teacher selects skill → "Award to multiple students"
- Shows class roster with checkboxes
- Award fires for all selected students simultaneously
- Each award gets the same timestamp and teacher attribution

### 5.4 What Happens When a Skill Is Awarded

1. `student_skill_records` record updated to `achieved` with timestamp
2. Parent receives push notification: "Sofia earned a new badge in ballet!"
3. Badge animation plays on student profile next time parent opens the app
4. Admin notified if skill is a `ready_to_advance` indicator

---

## 6. Evaluation System

### 6.1 Evaluation Types

| Type | Frequency | Trigger | Parent Visibility |
|---|---|---|---|
| **Formal Evaluation** | Annual (or per season once curriculum exists) | Admin-scheduled | Admin-controlled |
| **Progress Note** | On-demand | Teacher or admin | Admin-controlled |
| **Skill Assessment** | Ongoing | Per skill award | Yes (badge only, not score) |
| **Level Advancement Review** | When triggered | Teacher `ready_to_advance` flag | No — internal only |

### 6.2 Formal Evaluation — Structured Assessment

Uses evaluation templates (already specced in existing schema: `evaluation_templates`, `evaluation_template_sections`, `evaluation_template_questions`).

Curriculum integration:
- Evaluation template for Level 3B automatically pulls in the skills from the current season's `season_curriculum` for that level
- Teacher rates each skill: N (Not Yet) / S (Sometimes) / E (Exceeds)
- Ratings sync back to `student_skill_records`
- Overall evaluation summary written by teacher, reviewed by admin before release to parent

### 6.3 Level Advancement Flow

```
Teacher marks student as 'ready_to_advance' on attendance record
         ↓
Admin receives in-app notification:
  "Ms. Lauryn has flagged Sofia (Level 3B) as ready for advancement review"
         ↓
Admin opens Level Advancement Review for Sofia:
  - Current level: 3B
  - Skill completion: 8/10 skills achieved this season
  - Attendance rate: 92%
  - Teacher flag note (from progress_flag field)
  - Formal evaluation (if completed)
         ↓
Admin decision:
  ✓ Approve advancement → student.current_level updated to "Level 3C"
                        → parent notified: "Sofia has been advanced to Level 3C"
                        → badge awarded: "Level Up" milestone badge
                        → next season placement recommends Level 3C classes
  
  ✗ Defer → note added, teacher notified, skill gaps highlighted
  
  ? Request evaluation first → admin creates evaluation task for teacher
```

### 6.4 Advancement Requirements (Studio-Configurable)

Admin can set minimum requirements for advancement approval in Settings → Curriculum → Advancement Rules:

| Requirement | BAM Default | Admin-Adjustable |
|---|---|---|
| Minimum skill completion % | 80% | Yes |
| Minimum attendance rate | 75% | Yes |
| Teacher recommendation required | Yes | Yes |
| Admin approval required | Yes (always) | No — always required |
| Formal evaluation required | No (optional) | Yes |

Even if all minimums are met, admin approval is always required. This is not an auto-advance system.

---

## 7. Curriculum Builder — Admin UI

### 7.1 Settings → Curriculum

**Skill Library tab:**
- All skills across all categories and levels
- Filter by discipline, level, category
- Create / edit / archive skills
- Upload badge icon per skill

**Season Curriculum tab:**
- Select a season
- For each level: drag skills from the library into the season curriculum
- Set sort order (learning sequence)
- Toggle parent visibility per skill or for the whole level
- "Clone from previous season" — copies last season's curriculum as a starting point

**Advancement Rules tab:**
- Set minimum % skill completion for each level
- Set minimum attendance rate
- Toggle evaluation requirement

### 7.2 Import / Seed

Since BAM's curriculum doesn't exist in writing yet, Amanda will build it in the platform. The UI needs to be fast enough for her to add 50–100 skills across all levels in a reasonable session. Provide:
- Bulk skill entry (multi-line text input: one skill per line → creates multiple skill records)
- Drag-to-reorder within a category
- Clone a skill to another level (skills that appear at multiple levels)

---

## 8. Enrollment Integration

When a student's recommended classes are shown in the enrollment flow (both admin pre-placement and self-service), the class card shows:

**Skill preview (parent-facing):**
```
Level 3B Ballet — Tues/Thurs 4:30pm

This season, Sofia will work toward:
[badge] Grand Battement    [badge] Attitude    [🔒] Pirouette Prep

"Building the technical foundation for the company track"
```

This creates emotional investment before checkout — parents see the learning journey, not just the schedule.

The next 2–3 upcoming skills shown are the first `is_visible_to_parents = true` skills in the season curriculum for that level that the student has NOT yet achieved.

---

## 9. Decisions Log

| # | Decision |
|---|---|
| 1 | Curriculum structure: Program → Level → Season → Category → Skill |
| 2 | Skills work like Girl Scout badges — discrete, achievable, visual |
| 3 | Parent view: current season skills only — achieved (full), in-progress (partial), next 2–3 (grayed), rest hidden |
| 4 | Parent visibility is per-skill toggleable by Super Admin — default OFF |
| 5 | Skill types: achievement (once), progressive (rated 1–5), seasonal (re-assessed each season) |
| 6 | Rating scores are NOT shown to parents — they see badge status only |
| 7 | Bulk award: teacher can award one skill to multiple students simultaneously |
| 8 | Level advancement: teacher flag → admin review → approval required — never automatic |
| 9 | Advancement requirements are studio-configurable (skill %, attendance %) except admin approval (always required) |
| 10 | Formal evaluations pull current season curriculum skills as the template |
| 11 | Curriculum does not exist in writing — Amanda builds it in the platform for the first time |
| 12 | Season curriculum can be cloned from previous season as a starting point |
| 13 | Enrollment flow shows next 2–3 upcoming badges on class recommendation cards |
| 14 | Evaluation ratings (N/S/E) sync back to student_skill_records |
| 15 | Annual formal evaluation cadence — more frequent once curriculum is established |
