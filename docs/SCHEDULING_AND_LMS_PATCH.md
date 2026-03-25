# SCHEDULING_AND_LMS_PATCH.md
# Patch notes for SCHEDULING_AND_LMS.md — March 2026
# Apply these changes to the existing file

---

## Change 1 — Add `point_cost` to classes table (Section 2.2)

Add the following column to the `classes` table schema in Section 2.2,
after the `is_open_enrollment` field:

```sql
-- Credit/billing
point_cost          integer NOT NULL DEFAULT 1,
-- Number of credits deducted per enrollment in this class.
-- Default: 1 (standard group class)
-- Pilates: 2 (configurable)
-- Private with standard teacher: 2 (configurable)
-- Private with senior/specialist teacher: 3 (configurable)
-- Trial class point_cost is always 0 regardless of this value.
-- See BILLING_AND_CREDITS.md Layer 1 for full billing plan check logic.
```

---

## Change 2 — Update Section 13 (Trial Class Eligibility) — add cross-reference

Add to the end of Section 13.2 (Trial Rules):

```
Cross-reference: REGISTRATION_AND_ONBOARDING.md Section 4 for the full
trial system spec including: trial abuse detection, front-desk enrollment
suppression, outcome tracking, Super Admin override for second trials,
and the Angelina post-trial follow-up sequence.
```

---

## Change 3 — Update Section 4.5 (Private Lesson) — add point_cost note

Add to the end of the Private Lesson section (4.5):

```
Private lessons have a configurable point_cost set on the class record.
Standard privates default to 2 points; senior teacher privates default to 3.
Admin sets point_cost per private class in class settings.
See BILLING_AND_CREDITS.md Section 2.1 for the full point cost system.
```

---

## How to apply

In Claude Code, open docs/SCHEDULING_AND_LMS.md and make the three
targeted edits above using str_replace. Do not rewrite the whole file.
