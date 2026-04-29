---
> ⚠️ **DEPRECATED — DO NOT IMPLEMENT FROM THIS SPEC**
>
> This document references tables, columns, or architectural decisions that 
> conflict with the live database or current canonical specs. Last verified 
> against live DB on 2026-04-29.
>
> **Issue:** References `admin_tasks`, `student_class_approvals`, `promo_codes` — none exist in DB.
>
> **Canonical replacement:** Pending reconciliation
>
> See `docs/_AUDIT_2026_04_29.md` for full audit findings.
> See `docs/_INDEX.md` for the current canonical doc map.

---

Create docs/ENROLLMENT_POLICY.md with this content:

# Enrollment Policy Engine — BAM Platform Spec

## Overview
Rules that govern what classes a student can trial, 
request enrollment in, or be auto-enrolled into based 
on their profile, assessment status, and admin settings.

## Student States

### Unassessed (New)
- No current_level assigned by admin
- Can only trial classes marked trial_eligible = true
- Cannot request enrollment in advanced/pointe classes
- Must complete placement assessment first
- Assessment triggered by: contacting studio OR 
  requesting enrollment in any class

### Assessed / Level Assigned
- current_level set by admin after assessment
- Can trial and enroll in level-appropriate classes
- Level-appropriate = student level ± 1
- Advanced classes (Level 4+) still require admin approval

### Pre-Approved
- Admin has explicitly approved student for specific classes
- Stored in student_class_approvals table (to be created)
- Bypasses level restrictions for those classes
- Used for: re-enrollment, special placements, exceptions

## Trial Rules

### Who can trial
- Any student can request a trial
- Unassessed students: only trial_eligible classes
- Assessed students: level-appropriate classes only
- Each student gets ONE free trial per season
  (trial_used flag on students table)
- Second trial requires Super Admin approval

### Trial-eligible classes
- Set by admin via trial_eligible = true on classes
- Default: beginner and intro classes only
- Advanced/pointe: NOT trial-eligible by default
- Admin can override per class

### After trial request
1. Creates admin_tasks record (trial_request)
2. Sends email notification to studio (dance@bamsocal.com)
3. Shows confirmation to parent: 
   "Trial requested! We'll contact you within 24 hours 
    to confirm your trial class date."
4. Admin schedules trial → marks student as trial_scheduled
5. Student attends → admin marks trial_completed
6. Enrollment offered → parent can enroll via portal

## Registration Flow

### New Student Registration
1. Parent browses classes
2. Selects class → "Request Enrollment" or "Trial"
3. If "Request Enrollment" (skip trial):
   - Add to cart with one-time registration fee
   - Registration fee: set by admin (default $35)
   - Fee waived if parent enters valid promo code
   - Checkout via Stripe
   - Creates pending enrollment (status: pending_payment)
   - After payment: status → active, admin notified
4. If "Trial" first:
   - No payment yet
   - Trial scheduled by admin
   - After trial: parent offered enrollment with reg fee

### Registration Fee Rules
- One-time per student per season
- Set in studio_settings.registration_fee (default $35)
- Waivable via promo codes (stored in promo_codes table)
- Admin can manually waive for specific families
- Families with existing enrollments this season: 
  no additional registration fee

### Re-enrollment Flow (existing students)
- Admin marks season as re-enrollment open
- Existing students see their current classes
- "Re-enroll" button adds all to cart automatically
- No registration fee for re-enrolling students
- No trial needed
- Checkout via Stripe for tuition

## Admin Controls

### Per-class settings
- trial_eligible: boolean (can this class be trialed?)
- requires_assessment: boolean (assessment before enrollment?)
- max_trial_students: number (max trials per session)
- enrollment_requires_approval: boolean

### Per-student settings  
- trial_used: boolean (used free trial this season?)
- assessment_completed: boolean
- current_level: string (admin-assigned)
- pre_approved_class_ids: uuid[] (bypass level restrictions)

### Studio-wide settings (studio_settings)
- registration_fee: number (default 35)
- registration_fee_enabled: boolean
- trial_enabled: boolean
- re_enrollment_open: boolean
- re_enrollment_season_id: uuid

## Promo Codes
Table: promo_codes
- code: string (unique)
- discount_type: 'registration_waiver' | 'percent' | 'fixed'
- discount_value: number
- max_uses: number
- uses_count: number
- expires_at: timestamptz
- created_by: uuid (admin who created it)
- is_active: boolean

## Notifications (when trial requested)
- Email to: studio notification email (dance@bamsocal.com)
- Email content: 
  Student name, class requested, parent contact info
- In-app: admin_tasks entry (already implemented)
- Parent confirmation: success message in portal

## What's Built vs Needed

### Built
- trial_eligible on classes ✅
- trial_used on students ✅ (just added)
- admin_tasks for trial requests ✅
- enrollment request flow ✅
- Stripe checkout ✅

### Needs Building
- Email notification to studio on trial request
- Parent confirmation message improvement
- Promo codes table + UI
- Registration fee in checkout
- Re-enrollment flow
- assessment_completed flag on students
- pre_approved_class_ids on students
- Admin trial management UI (approve/schedule/complete)
- Studio-wide enrollment settings in studio_settings

## Priority Build Order
1. Email notification on trial request (quick win)
2. Parent confirmation message (quick win)  
3. Registration fee in checkout
4. Promo codes
5. Re-enrollment flow
6. Admin trial management UI
7. Assessment tracking

Save the file.