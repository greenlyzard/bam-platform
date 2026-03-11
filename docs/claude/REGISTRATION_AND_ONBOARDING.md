# Registration & Onboarding Module

**Ballet Academy and Movement — Platform Module Specification**

- **Module status:** Phase 2 build target
- **Depends on:** Core data model (families, students, seasons, classes), Scheduling module, Billing module
- **Feeds into:** Parent portal, LMS (initial level placement), Communications module, Admin dashboard
- **Last updated:** March 2026
- **Owner:** Ballet Academy and Movement platform team
- **Related files:** `CLAUDE.md`, `SCHEDULING_AND_LMS.md`, `CASTING_AND_REHEARSAL.md`, `COMMUNICATIONS.md`

---

## Guiding Principle

Registration must feel simpler than a typical e-commerce checkout. A parent who finds BAM through Google, Instagram, or word of mouth should be able to go from landing on the site to fully enrolled in under five minutes — on a phone, without confusion, without calling the studio.

Every screen in this flow should reduce friction. If a parent has to stop and think, the flow has failed.

This module serves two distinct user journeys that share underlying infrastructure but have different experiences:

- **New families** — have never registered with BAM before
- **Returning families** — re-enrolling for a new season, or adding a second child

Both journeys must be handled gracefully. A returning family should never feel like a stranger.

---

## Part 1: New Family Onboarding

### 1.1 Entry Points

All entry points must land in the correct context:

| Entry Point | Where They Land |
|---|---|
| Website "Enroll Now" button | Class recommendation quiz (Step 1) |
| Direct class link (from SEO landing page) | That specific class detail page with Enroll CTA |
| QR code from flyer or performance program | Mobile-optimized registration start |
| Referral link from another parent | Registration start, referral source logged |
| "Free Trial Class" offer | Trial class booking flow (separate, simplified — see Part 4) |
| Email campaign link | Season-specific class catalog |

No matter the entry point, a parent should never arrive at a blank form asking for information before they understand what they're signing up for.

### 1.2 Class Recommendation Quiz

Before any account creation, new parents complete a short quiz that outputs a personalized class recommendation. This replaces the need for a phone call or email inquiry for the majority of families.

**Quiz questions (3–4 maximum):**
1. How old is your child? (age selector — not a text field)
2. Has your child taken dance classes before? (Never / A little / Yes, for a year or more)
3. What is your child most interested in? (Ballet / Jazz / Contemporary / Musical Theatre / Not sure yet)
4. Are you looking for classes on a specific day? (Optional — show available days as buttons)

**Output:**
The quiz produces 1–3 recommended classes, displayed as cards showing:
- Class name and level
- Age range
- Day, time, and duration
- Instructor name and short bio
- Spots remaining (or Waitlist if full)
- Brief description of what students learn in this class
- "Enroll in This Class" CTA

If no classes match exactly (e.g., age gap, program not currently offered), the system shows the closest option and surfaces a "Join the Waitlist" or "Notify Me When Available" option instead of a dead end.

> **Why this comes first:** Most parents don't know the difference between Pre-Ballet I and Primary II. Asking them to choose from a catalog before they understand what they're looking at creates anxiety and abandonment. The quiz does the work for them and builds confidence that they're making the right choice.

### 1.3 Account Creation

After a parent selects a recommended class, they create a family account. This is the first point of data collection.

**Fields — kept to the minimum required:**
- Parent/guardian first and last name
- Email address
- Phone number (mobile preferred — used for SMS notifications if opted in)
- Password (or magic link option — no password required)
- How did you hear about us? (dropdown — Google, Instagram, friend referral, saw a performance, Yelp, other)
- Social login (Google, Apple) — offered to reduce friction

No address, no payment info, no emergency contacts at this step. The goal of account creation is to get an identity established so the parent can continue.

### 1.4 Student Profile

**Required fields:**
- Child's first and last name
- Date of birth (used to verify age eligibility for selected class)
- Gender (optional — used for costume sizing and role assignments)
- Any relevant health or physical considerations the instructor should know (free text, optional)

**Multiple children:** After completing the first student profile, the parent is offered "Add another child" before proceeding. This should not require re-entering parent/account information.

### 1.5 Enrollment Confirmation and Class Details

The parent sees a clear summary of what they're enrolling in before payment:
- Child name
- Class name, level, day, time, instructor
- Season dates (start and end)
- Tuition amount and payment schedule
- What to bring to the first class (dress code, shoes, hair)
- Studio address and parking notes
- Cancellation and refund policy (brief, plain language)

This page is designed to answer every practical question a parent might have before they hand over payment information. It is the last page before the payment step.

### 1.6 Payment

Payments are processed via **Stripe**. The payment step is a single screen:
- Tuition summary (monthly, per-semester, or annual — depending on studio policy)
- Registration fee (if applicable)
- Payment method: credit/debit card, or ACH (bank transfer)
- Auto-pay enrollment (on by default with clear opt-out)
- Promo code / scholarship code field (collapsed by default, expandable)

**On successful payment:**
- Confirmation screen with all class details
- Confirmation email sent immediately (see Communications section)
- Student appears in the class roster in the instructor portal
- Admin receives a new enrollment notification

### 1.7 Post-Enrollment Welcome Sequence

After enrollment is confirmed, an automated welcome sequence begins. Handled by **Klaviyo**, triggered via platform webhook:

| Email | Timing | Subject / Content |
|---|---|---|
| Email 1 | Immediate | **You're enrolled!** Class details, dress code, what to bring, studio address, instructor intro, contact info |
| Email 2 | Day 3 | **Culture and Story** — Amanda's background and teaching philosophy, what makes BAM different, what a typical class looks like |
| Email 3 | Day 7 | **Community** — Nutcracker and performance opportunities, how parents can stay involved, social links |
| Email 4 | 2 days before first class | **Reminder** — Class time, room, what to wear, where to park, what happens on the first day |

> This sequence is paused if the parent completes an action that makes the next email redundant (e.g., if they open and click the dress code link in Email 1, the dress code reminder in Email 4 is shortened).

---

## Part 2: Returning Family Re-Enrollment

### 2.1 Seasonal Re-Enrollment Flow

Returning families re-enroll at the start of each new season. Their history, payment methods, and child profiles are preserved.

**Re-enrollment opens in two phases:**
- **Priority window:** Existing families get early access before classes open to the public. This is a retention tool — families should feel valued, not rushed to compete with newcomers for spots.
- **Open enrollment:** All remaining spots open to the public.

When a returning family logs in during the enrollment window, they see:
- Their children's current enrollment from last season
- A prompt: "Re-enroll [Child's Name] for [Season Name]?"
- Recommended classes for each child based on their current level (pulled from LMS progress data)
- Level advancements since last season highlighted: "[Child's Name] has advanced to Ballet II!"

The goal is to make re-enrollment a single-tap confirmation for the majority of families, not a full repeat of the new family flow.

### 2.2 Adding a Sibling

When a returning parent adds a second child, they follow the new student quiz flow (Part 1.2) but with their account already established. They skip account creation and go directly to the student profile step.

### 2.3 Handling Program Changes

If a child wants to switch from ballet to jazz, or add a second class in a different style, the returning flow surfaces this option after confirming their primary class: "Would [Child's Name] like to add another class this season?" with filtered recommendations based on schedule availability.

---

## Part 3: Class Catalog and Placement Logic

### 3.1 Class Catalog

The public-facing class catalog is browsable without an account. It displays:
- All classes offered in the current season
- Filters: program (ballet, jazz, contemporary, musical theatre), age range, day of week, level
- Each class card: name, level, instructor, day/time, duration, age range, open spots, brief description
- Tapping a class shows the full detail page with instructor bio, what students learn, and the Enroll CTA

**Waitlist:** When a class is full, the Enroll CTA becomes "Join Waitlist." Waitlist position is shown. When a spot opens, the next family on the waitlist receives an email with 48 hours to claim it before it moves to the next person.

### 3.2 Age and Prerequisite Validation

The system enforces age eligibility at the enrollment step:
- If a child's age falls outside the class's defined range, the system surfaces a warning: "This class is for ages [X–Y]. Based on [Child's Name]'s age, we'd recommend [Class Name] instead."
- The warning does **not** hard-block enrollment — admin can override for exceptional cases (e.g., a mature 4-year-old in a 5–6 class with instructor approval)
- Prerequisite levels (e.g., Ballet III requires Ballet II completion or instructor approval) trigger a soft block: "This class typically requires prior ballet training. If [Child's Name] has dance experience from another studio, our director will be in touch to schedule a brief evaluation."

### 3.3 Placement Evaluations

For students transferring from another studio or whose prior experience is unclear:
1. Parent selects "My child has previous dance experience" during the quiz
2. System offers a short evaluation session with Amanda or a senior instructor (scheduled as a private lesson entry in the scheduling module)
3. After the evaluation, the instructor sets the student's initial level in the LMS
4. The student is directed to the appropriate class with a personal recommendation note

This replaces the informal "call and ask" process with a defined, bookable workflow.

---

## Part 4: Free Trial Class Flow

BAM may offer trial classes as a lead capture tool. The trial class flow is a simplified version of the full registration flow:

1. Parent fills in child's name, age, and email (3 fields only)
2. System shows available trial slots (limited per class, admin-controlled)
3. Parent selects a slot and confirms — no payment required
4. Confirmation email sent with class details and dress code
5. After the trial class, an automated follow-up email is sent within 24 hours: "How did [Child's Name] enjoy her class?" with a direct Enroll CTA
6. If no response after 3 days, a second follow-up is sent
7. If no enrollment after 7 days, the lead is added to a nurture sequence in Klaviyo

Trial class contacts who do not convert are tracked as leads in the platform's CRM layer and surfaced to admin with a "last contact" date.

---

## Part 5: Admin Registration Tools

### 5.1 Admin Enrollment Dashboard

Surfaces:
- Total enrolled students by class for the current season
- Classes approaching capacity (flagged at 80% and 100%)
- Waitlist counts per class
- New enrollments in the last 7 days
- Pending placement evaluations
- Incomplete registrations (started but not completed — these are warm leads)

### 5.2 Manual Enrollment

Admin can enroll a student directly (for in-person signups, phone registrations, or scholarship students):
1. Search for existing family or create new family record
2. Select class
3. Set payment terms (standard, scholarship, payment plan, comp)
4. Generate invoice or mark as paid
5. Student appears in roster immediately

### 5.3 Incomplete Registration Recovery

When a parent starts the registration flow but does not complete it, the system logs the incomplete registration with whatever data was captured (email, child name, class interest).

Admin sees these in a "Warm Leads" panel and can:
- Trigger a personal follow-up email from Amanda
- Assign a staff member to call the family
- Mark as "contacted" or "not interested" to clean up the list

An automated email is sent 24 hours after an incomplete registration: "Did you have questions? We'd love to help [Child's Name] get started."

### 5.4 Scholarship and Discount Management

| Type | Description |
|---|---|
| Promo codes | Percentage or fixed-dollar discount on tuition or registration fee, with expiration date and usage limit |
| Scholarships | Per-student designation that sets a custom tuition amount, tracked separately in financial reporting |
| Sibling discount | Configurable percentage reduction automatically applied when a second (or third) child from the same family enrolls |
| Early-bird pricing | Reduced rate for enrollments before a specified date, auto-expires |

All discounts are logged to the financial record with the code or designation used, so they appear correctly in accounting exports.

---

## Part 6: Data Captured at Registration

### Family Record
- Parent/guardian name(s)
- Email address
- Phone number
- SMS opt-in status
- Referral source
- Account creation date

### Student Record
- Full name
- Date of birth
- Age (calculated)
- Gender (optional)
- Health / physical considerations
- Prior dance experience (none / some / yes)
- Prior studio name (if applicable)
- Initial level placement (set by quiz output or evaluation)

### Enrollment Record
- Season
- Class selected
- Enrollment date
- Entry path (quiz, direct class link, trial conversion, manual admin, referral)
- Discount or scholarship code applied
- Payment plan selected
- Auto-pay status

### Emergency Contact
Collected post-enrollment, before first class. Requiring it during checkout adds friction and is not needed to complete the transaction. After enrollment is confirmed, the platform prompts the family to complete their emergency contact information before their first class date. Admin is flagged if emergency contacts are not completed 48 hours before the first class.

---

## Part 7: Integration Points

| This module | Connects to | How |
|---|---|---|
| Registration | Scheduling module | Enrolled students appear on class roster and session attendee lists |
| Registration | LMS | Initial level placement populates student's LMS profile |
| Registration | Billing module | Enrollment triggers invoice generation and Stripe recurring charge |
| Registration | Communications module | Triggers welcome sequence via Klaviyo |
| Registration | Admin dashboard | New enrollments, waitlists, and incomplete registrations surfaced |
| Trial class flow | CRM / lead tracking | Non-converting trials enter nurture sequence |
| Scholarship module | Financial reporting | Discounts tracked separately in accounting exports |

---

## Part 8: Out of Scope for Initial Build

- Online recital costume ordering (Phase 4 — tied to performance/casting module)
- Group class gifting or gift cards
- Sibling group classes (e.g., parent-and-child classes) — architecture supports it but not in Phase 2
- Student self-registration (all registration is parent-initiated)
- Multilingual registration flow
