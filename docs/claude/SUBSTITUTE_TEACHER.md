# SUBSTITUTE_TEACHER.md
# Ballet Academy and Movement — Teacher Onboarding & Substitute System Spec
# Module: Teacher Onboarding, Classification, and Substitute Management

> Related modules: CALENDAR_AND_SCHEDULING.md · COMMUNICATIONS_AND_STAFF_VISIBILITY.md · LEVEL_SYSTEM.md

---

## 1. Overview

All teaching staff at Ballet Academy and Movement — whether permanent employees or substitute
consultants — must complete a structured onboarding sequence before being authorized to lead a class.
No teacher may be assigned to a schedule_instance until their onboarding checklist is 100% complete
and their account is approved by Amanda Cobb or a super_admin.

The onboarding system is split into two tracks based on employment classification:

| Track | Employment Type | Tax Form | Platform Status |
|---|---|---|---|
| Employee | W-2 | W-4 | `employee` |
| Substitute Consultant | 1099-NEC | W-9 | `contractor_1099` |
| Pending Review | Threshold crossed | — | `pending_classification` |

Both tracks go through the same policy, safety, and culture acknowledgment steps.
Tax and HR steps differ between tracks.

---

## 2. Employment Classification

### 2.1 Initial Classification

When a new teacher account is created, Amanda or a super_admin assigns:
- `employment_type`: `employee` | `contractor_1099`
- `is_sub_eligible`: true/false (can they be alerted for substitute requests)
- `substitute_session_threshold`: default 3 (configurable per teacher)

### 2.2 California AB5 Compliance

California AB5 (Assembly Bill 5) applies strict criteria to independent contractor classification.
Dance instructors who regularly substitute may need to be reclassified as W-2 employees.

The platform tracks:
- `substitute_session_count` — lifetime count of completed substitute sessions
- `substitute_session_threshold` — configurable per teacher, default 3
- When count reaches threshold AND teacher is classified as `contractor_1099`:
  - `employment_type` → `pending_classification`
  - HR review approval_task created for Amanda/Cara
  - Flag is permanent until manually cleared by super_admin with a logged reason

**IMPORTANT:** This is a compliance flag only. The platform does NOT automatically reclassify.
Amanda must consult her HR/legal advisor before changing the classification.
The platform provides the data; the human makes the decision.

### 2.3 Reclassification Flow (1099 → W-2)

When Amanda decides to reclassify a substitute consultant to employee:
1. Super_admin opens teacher profile → Employment tab
2. Clicks "Begin Reclassification"
3. System creates new onboarding checklist items specific to W-2 employees:
   - W-4 federal tax withholding form
   - State DE-4 (California)
   - Updated employment agreement
   - Benefits acknowledgment (if applicable)
4. Teacher receives email: "Your employment status is being updated. Please complete the following steps."
5. Once all W-2 items complete: `employment_type` → `employee`, `pending_classification` cleared
6. Reclassification event logged with timestamp, initiating admin, and reason (free text)

---

## 3. Onboarding Checklist Architecture

### 3.1 Database Schema

```sql
-- Onboarding checklist templates (reusable, version-controlled)
CREATE TABLE onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,                     -- e.g. "Employee Onboarding v2", "Sub Consultant Onboarding v1"
  employment_type TEXT NOT NULL,          -- 'employee' | 'contractor_1099' | 'both'
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual checklist items within a template
CREATE TABLE onboarding_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES onboarding_templates(id),
  category TEXT NOT NULL,                 -- see categories below
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL,                -- 'acknowledgment' | 'document_upload' | 'form_fill' | 'video_watch' | 'quiz' | 'e_signature'
  is_required BOOLEAN DEFAULT true,
  display_order INT NOT NULL,
  content_url TEXT,                       -- link to document, video, form
  content_body TEXT,                      -- inline policy text (markdown)
  requires_counter_signature BOOLEAN DEFAULT false, -- Amanda must co-sign
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-teacher onboarding progress
CREATE TABLE teacher_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  template_id UUID NOT NULL REFERENCES onboarding_templates(id),
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('not_started','in_progress','pending_review','approved','rejected')),
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  completed_percent INT DEFAULT 0,
  UNIQUE (teacher_id, template_id)
);

-- Per-item completion records
CREATE TABLE onboarding_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  onboarding_id UUID NOT NULL REFERENCES teacher_onboarding(id),
  item_id UUID NOT NULL REFERENCES onboarding_items(id),
  completed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  signature_data TEXT,                    -- base64 drawn signature if e_signature type
  upload_path TEXT,                       -- Supabase storage path if document_upload type
  quiz_score INT,                         -- if quiz type
  counter_signed_by UUID REFERENCES profiles(id),
  counter_signed_at TIMESTAMPTZ,
  UNIQUE (onboarding_id, item_id)
);
```

All tables: RLS enabled, tenant_id isolation, teacher sees only own records,
admin/super_admin sees all within tenant.

### 3.2 Onboarding Categories

Items are grouped into these categories (displayed as collapsible sections in the UI):

1. `account_setup` — Profile, photo, bio, emergency contact
2. `tax_and_payroll` — W-4/W-9, direct deposit or payment method
3. `legal_agreements` — Employment/contractor agreement, liability waiver, NDA
4. `policies` — Studio-specific written policies (see Section 4)
5. `safety_training` — Mandated reporting, injury, emergency, child safety
6. `culture_and_philosophy` — BAM teaching philosophy, culture standards
7. `curriculum_training` — Level system, class structure, music selection
8. `operations_training` — Studio procedures, hour logging, communication protocols
9. `final_acknowledgment` — Master sign-off that all above are understood and agreed to

---

## 4. Complete Onboarding Item List

### 4.1 ACCOUNT SETUP (both tracks)

**AS-01** — Profile Photo Upload
- Type: `document_upload`
- Professional photo, white or neutral background
- Used on teacher portal and parent-facing class pages
- Required before account goes active

**AS-02** — Personal Bio
- Type: `form_fill`
- Fields: training background, professional experience, teaching style, fun fact
- Used on website teacher page (with teacher's permission)

**AS-03** — Emergency Contact
- Type: `form_fill`
- Name, relationship, phone, alternate phone

**AS-04** — Contact Preferences
- Type: `form_fill`
- Preferred method for sub alerts: email | SMS | both
- Phone number for SMS
- Best hours to contact

---

### 4.2 TAX AND PAYROLL

**For Employee (W-2) track:**

**TP-E01** — W-4 Federal Tax Withholding
- Type: `document_upload` + `e_signature`
- Link to IRS W-4 PDF with instructions
- Teacher completes, signs, and uploads

**TP-E02** — California DE-4 State Withholding
- Type: `document_upload` + `e_signature`
- Link to EDD DE-4 form
- Teacher completes, signs, and uploads

**TP-E03** — Direct Deposit Authorization
- Type: `form_fill` + `e_signature`
- Bank name, routing number, account number, account type
- Voided check upload option
- Content note: "Your banking information is encrypted and stored securely. It is never visible to other teachers or staff."

**TP-E04** — I-9 Employment Eligibility Verification
- Type: `document_upload`
- Teacher uploads acceptable identity documents (List A, or List B + C)
- Admin must physically verify originals within 3 business days of first day
- Platform creates approval_task for admin to confirm physical verification

---

**For Substitute Consultant (1099) track:**

**TP-C01** — W-9 Request for Taxpayer Identification Number
- Type: `document_upload` + `e_signature`
- Link to IRS W-9 PDF with instructions
- Teacher completes, signs, and uploads
- Platform note: "A 1099-NEC will be issued to you if your total compensation exceeds $600 in a calendar year."

**TP-C02** — Payment Method Setup
- Type: `form_fill`
- Options: direct deposit (Zelle/ACH), check
- Payment schedule acknowledgment: "Substitute compensation is processed within 5 business days of completed session."

**TP-C03** — Independent Contractor Agreement
- Type: `e_signature`
- content_body: Full contractor agreement text (Amanda to draft with legal advisor)
- Key provisions: independent contractor status, no guaranteed hours, no employee benefits,
  right to control teaching method within BAM curriculum framework,
  AB5 awareness clause, non-solicitation (see Section 4.4)
- requires_counter_signature: true (Amanda signs)

---

### 4.3 LEGAL AGREEMENTS (both tracks)

**LA-01** — Employment Agreement (Employee) / Contractor Agreement (1099)
- Type: `e_signature`
- requires_counter_signature: true
- Different content_body per employment_type (linked from TP-E series or TP-C series above)

**LA-02** — Liability Waiver and Assumption of Risk
- Type: `e_signature`
- Covers: physical injury during class or rehearsal, claims arising from teaching activities,
  confirmation of current fitness and ability to demonstrate ballet technique safely
- requires_counter_signature: false (unilateral)

**LA-03** — Media and Photography Release
- Type: `acknowledgment` + `e_signature`
- Covers permission to use teacher's image in studio marketing, social media, website
- Option: full consent | consent with exclusions | no consent
- Exclusion field: "Please describe any restrictions."

**LA-04** — Confidentiality and Non-Disclosure Agreement
- Type: `e_signature`
- Covers: student roster, family information, business financials, other teachers' compensation,
  proprietary curriculum materials, platform technology
- requires_counter_signature: false

**LA-05** — Background Check Authorization
- Type: `e_signature` + admin action
- California law requires background checks for anyone who works with minors
- Teacher authorizes background check via integrated screening service
- Platform creates approval_task: "Initiate background check for [Teacher]"
- Teacher account cannot advance to `approved` until background check returns clear
- Clear result: admin marks item complete | Concern: flagged for Amanda review

---

### 4.4 POLICIES

**PL-01** — Student Non-Solicitation Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > You may not solicit Ballet Academy and Movement students or families to enroll
  > in classes at any competing studio, private instruction outside of BAM-approved
  > private lessons, or any other dance program not offered by Ballet Academy and
  > Movement. This policy applies during employment/engagement and for 12 months
  > following separation. Violation may result in immediate termination and legal action.
- Note: "Poaching students is the most serious policy violation at our studio. This
  protects the relationships you help us build."

**PL-02** — Personal Conduct and Professionalism Policy
- Type: `acknowledgment` + `e_signature`
- Covers:
  - Respectful communication with students, parents, and colleagues at all times
  - No romantic or personal relationships with students' parents that could create conflicts
  - No discussion of other teachers' performance, compensation, or personal matters with parents
  - No disparagement of competing studios or other instructors in any form
  - Social media: do not post identifiable student content without written parent consent
  - Social media: do not post BAM-branded content without Amanda's approval

**PL-03** — Dress Code and Personal Appearance Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > **Required:**
  > - Ballet attire appropriate to class type (dancewear, leotard, tights, or fitted activewear)
  > - Ballet shoes or appropriate footwear for the class style being taught
  > - Hair neatly secured away from face — bun or professional updo strongly preferred
  > - Minimal, tasteful jewelry only — no dangling earrings, rings that could catch on a student
  >
  > **Not permitted:**
  > - Casual street clothing (jeans, t-shirts, hoodies) while teaching
  > - Strong perfume or scented products (allergy and sensory sensitivity policy)
  > - Visible body art that may be distracting or inappropriate for a children's environment
  > - Nails longer than ¼ inch or nail decorations that could scratch or injure a student
  >
  > **Rationale:** Our dress code reflects the professional standard we hold our students to.
  > When teachers model what it looks like to dress for ballet, students understand
  > that this is a serious, beautiful art form.

**PL-04** — Parent Communication Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > **Approved communication channels:**
  > - In-person conversations before/after class (keep brief — next class may be waiting)
  > - Messages sent through the Ballet Academy and Movement parent portal
  > - Email to the studio (dance@bamsocal.com) — do not use personal email with parents
  >
  > **Not permitted:**
  > - Exchanging personal phone numbers with parents
  > - Communicating with parents via personal social media accounts
  > - Making class placement recommendations to parents outside of Amanda's curriculum decisions
  > - Discussing another student's progress, behavior, or placement with any parent
  >
  > **Why this matters:** Clear professional boundaries protect you, the studio, and our families.
  > If a parent asks about another child, say: "That's a conversation for Amanda."
  > If a parent asks for your personal contact, say: "Please reach me through the studio."

**PL-05** — Late Pickup and Unattended Minor Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > **If a parent has not arrived to pick up a student within 15 minutes of class end:**
  >
  > 1. Keep the student with you inside the studio — do not leave the child unattended
  > 2. Check the student's parent contact info in the portal and call the primary contact
  > 3. If no answer, call the emergency contact on file
  > 4. If no answer within 30 minutes of class end, call the studio director (Amanda)
  > 5. Under no circumstances leave a child alone, release a child to an unauthorized adult,
  >    or transport a child in your personal vehicle
  > 6. Document the incident in the platform (Incident Report) regardless of outcome
  >
  > **Repeated late pickups:** Alert Amanda after the second occurrence so she can
  > communicate with the family.

**PL-06** — Social Media Content Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > - Do not post video or photos of students on personal social accounts without
  >   written consent (parents sign a media release at enrollment — check the portal before posting)
  > - Do not create or post BAM-branded content without Amanda's written approval
  > - Do not discuss studio business, other staff, or student matters on personal accounts
  > - Positive personal posts about your work at Ballet Academy and Movement are welcome —
  >   tag @balletacademyandmovement on Instagram if you wish to share

**PL-07** — Intellectual Property Policy
- Type: `acknowledgment` + `e_signature`
- Covers: choreography created for BAM productions belongs to BAM,
  curriculum materials and class plans created for BAM classes belong to BAM,
  teacher may reference personal training background and methodology in other contexts

---

### 4.5 SAFETY TRAINING

**ST-01** — Mandated Reporter Training (California)
- Type: `video_watch` + `quiz` + `e_signature`
- Links to California Department of Education mandated reporter training
- Quiz: minimum 80% pass score
- content_body:
  > California law requires ALL adults who work with minors to report
  > reasonable suspicion of child abuse, neglect, or exploitation to:
  > - Los Angeles/Orange County Child Protective Services: 1-800-540-4000
  > - Or any local police department
  >
  > **You do not need proof — reasonable suspicion is the standard.**
  > **You cannot be fired for making a good-faith report.**
  >
  > At Ballet Academy and Movement, we take this seriously.
  > If you observe anything concerning, tell Amanda and file a report.
  > You will be supported completely.
- requires_counter_signature: false
- Recertification required: annually (platform auto-creates renewal task each year)

**ST-02** — Recognizing Signs of Abuse, Neglect, and Self-Harm
- Type: `video_watch` + `acknowledgment`
- Content covers: unexplained bruises or injuries, sudden behavioral changes,
  signs of eating disorders, self-harm indicators, disclosure by a child
- Dance teachers are uniquely positioned — we see children's bodies, emotions, and
  family dynamics repeatedly over time

**ST-03** — Bullying Recognition and Response Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > Ballet Academy and Movement has a zero-tolerance policy for bullying among students.
  > Teachers are responsible for:
  > - Observing dynamics between students before and after class
  > - Addressing unkind behavior immediately and firmly in the moment
  > - Reporting any pattern of bullying to Amanda — do not manage it silently
  > - Never using embarrassment, comparison, or body shaming as a teaching tool
  >   ("Why can't you do it like Sarah?" is never acceptable here)

**ST-04** — Injury Response Protocol
- Type: `acknowledgment` + `e_signature`
- content_body:
  > **Minor injury (scrapes, bruises, rolled ankles):**
  > 1. Stop the class briefly, attend to the student calmly
  > 2. First aid kit is located [room location — admin to fill in]
  > 3. Notify parent at pickup — describe exactly what happened
  > 4. Log an Incident Report in the platform before you leave the building
  >
  > **Serious injury (suspected fracture, head injury, loss of consciousness,
  > severe pain that prevents weight bearing):**
  > 1. Do not move the student unless in immediate danger
  > 2. Call 911 immediately
  > 3. Call Amanda: (949) 229-0846
  > 4. Stay with the student until EMS arrives
  > 5. Contact parent — if 911 was called, call parent before EMS arrives if possible
  > 6. Do not give medical advice or speculate about the injury to the parent
  > 7. Document everything in an Incident Report
  >
  > **After any incident:** Amanda will follow up within 24 hours.
  > An incident report is mandatory for every event — no exceptions.

**ST-05** — Emergency Procedures
- Type: `acknowledgment` + `e_signature`
- Covers:
  - Fire evacuation routes and assembly point (admin to specify per studio)
  - Earthquake (drop, cover, hold — do not evacuate during shaking)
  - Active threat / lockdown procedure
  - Utility shutoffs location
  - AED location (if applicable)
  - Who to call: Amanda first, then 911 for life safety

**ST-06** — Safe Touch Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > Hands-on correction is a standard and accepted part of ballet training.
  > At Ballet Academy and Movement, teachers follow these guidelines:
  >
  > - Announce before touching: "I'm going to adjust your arm" / "May I fix your posture?"
  > - Touch only shoulders, arms, hands, back, hips, and legs in a professional, clinical manner
  > - Never touch the chest, buttocks, or face
  > - Never touch a child who has said "no" or pulled away — respect the boundary and
  >   use verbal correction instead
  > - If a student seems uncomfortable with touch, use demonstration and verbal cues only
  > - Never be alone with a single student in a closed room — leave the studio door open
  >   or ensure another adult is present
  >
  > These guidelines protect students and protect you.

**ST-07** — Authorized Pickup Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > Students may only be released to:
  > - Adults listed on their Authorized Pickup list in the parent portal
  > - A parent calling ahead to authorize a different adult (verify verbally + note in portal)
  >
  > If an unknown adult arrives to pick up a child:
  > 1. Ask for ID — this is not rude, it is required
  > 2. Check the portal authorized pickup list
  > 3. If not on the list, do not release the child
  > 4. Call the primary parent contact immediately
  > 5. If the situation feels unsafe, call 911
  >
  > You are never required to explain or apologize for following this policy.

---

### 4.6 CULTURE AND PHILOSOPHY

**CP-01** — Ballet Academy and Movement Teaching Philosophy
- Type: `video_watch` (Amanda records a personal welcome/philosophy video) + `acknowledgment`
- content_body:
  > Our teaching philosophy rests on three principles:
  >
  > **Excellence without pressure.** We hold high standards because we respect our students.
  > We never shame, compare, or belittle. We correct with precision and warmth.
  >
  > **Classical foundations first.** Before style, before performance, before anything —
  > placement, alignment, musicality, and strength. A student with correct foundations
  > can go anywhere. A student without them has a ceiling.
  >
  > **The whole child.** Ballet builds courage, discipline, and poise. Those qualities matter
  > more than whether a child goes professional. We are developing humans through dance.
  >
  > Amanda Cobb's training at [professional company/school] informs everything we teach.
  > Our methods are classical, our culture is nurturing. Both must coexist.

**CP-02** — Culture Standards: What We Say and Don't Say
- Type: `acknowledgment` + `e_signature`
- content_body:
  > **We never say:**
  > - "You look like a dancer" (implies appearance-based worth)
  > - "You're so flexible!" as a primary compliment (flexibility ≠ technique)
  > - "She's the best in the class" in earshot of other students
  > - "Try not to eat too much before class" or any diet-related comment
  > - "When I was your age I could already..."
  > - Any comment about a student's body shape, size, or weight
  >
  > **We do say:**
  > - "Your arabesque is getting stronger every week."
  > - "I can see you've been practicing — it shows."
  > - "That was a really brave try. Let's refine it."
  > - "Your musicality in that combination was beautiful."
  >
  > Body-neutral, progress-focused, specific praise. Always.

**CP-03** — Handling Student Frustration and Discouragement
- Type: `acknowledgment`
- content_body:
  > Ballet is hard. Students will get frustrated, cry, and want to quit.
  > How a teacher responds in that moment defines the student's relationship with dance.
  >
  > **When a student is frustrated:**
  > - Acknowledge it: "This is hard. That's exactly why we practice."
  > - Give them a small win: adjust the exercise so they can succeed, then build back up
  > - Never dismiss the emotion: "Don't cry, it's fine" teaches suppression, not resilience
  > - Never give up on them in the moment: check in after class, not during in front of peers
  >
  > **When to tell Amanda:** Any student showing consistent distress, withdrawal from class,
  > or signs that something is wrong beyond normal struggle.

**CP-04** — Parent Interaction Philosophy
- Type: `acknowledgment`
- content_body:
  > Parents are our partners — and sometimes our most challenging classroom.
  > Our approach:
  >
  > - Greet parents warmly. They are why the studio exists.
  > - Don't give unsolicited progress assessments at pickup — redirect to Amanda or the portal
  > - If a parent challenges your teaching decision, stay calm: "That's a great question for Amanda."
  > - Never argue or become defensive — escalate to Amanda always
  > - If a parent makes you uncomfortable, document it and tell Amanda the same day
  >
  > You are not alone in navigating difficult family dynamics. Amanda is your support.

---

### 4.7 CURRICULUM TRAINING

**CU-01** — Level System Overview
- Type: `video_watch` + `quiz`
- Covers the level system as documented in LEVEL_SYSTEM.md:
  Petite, Pre-Ballet, Beginner, Beginner-Intermediate, Intermediate, Advanced, Open/Adult
- Quiz: correct age ranges, appropriate skills per level, min pass score 80%

**CU-02** — Class Structure and Pacing
- Type: `acknowledgment`
- content_body:
  > Each class follows this general structure:
  > 1. Welcome and attendance (2 min)
  > 2. Warm-up at barre (varies by level, 10–20 min)
  > 3. Center work: tendus, dégagés, petit battement, etc.
  > 4. Across the floor combinations
  > 5. Cool-down and reverence
  >
  > Timing adjustments for:
  > - Petite (45 min): fewer barre exercises, more imagination and games
  > - Rehearsal classes: structure is modified per production needs
  > - Trial classes: extra welcome time, name learning, simplified exercises

**CU-03** — Music Selection Standards
- Type: `acknowledgment`
- content_body:
  > Music sets the tone for classical training. Our standards:
  > - Classical piano for barre work (preferred), classical orchestral acceptable
  > - Counts must be clear and appropriate for the combination
  > - No contemporary pop music for classical ballet classes
  > - Contemporary, jazz, and musical theatre classes have different standards — see Amanda
  > - No songs with explicit lyrics, mature themes, or inappropriate content for the age group
  > - If uncertain, ask Amanda before using new music in class

**CU-04** — Corrections and Demonstrations
- Type: `acknowledgment`
- How to structure verbal corrections, how to use demonstrations appropriately,
  when to use student demonstrations (always ask first, never single out negatively),
  documentation of student corrections not required but encouraged for progress tracking

**CU-05** — Recital and Performance Protocol
- Type: `acknowledgment`
- Covers casting procedures (see CASTING_AND_REHEARSAL.md), rehearsal attendance expectations,
  costume responsibilities, performance day procedures,
  teacher role during performances vs. class time

---

### 4.8 OPERATIONS TRAINING

**OP-01** — Hour Logging Policy
- Type: `acknowledgment` + `e_signature`
- content_body:
  > **All teaching hours must be logged in the platform within 24 hours of class completion.**
  >
  > How to log hours:
  > 1. Open the teacher portal → My Hours
  > 2. Your scheduled classes are pre-populated — tap to confirm attendance
  > 3. Add any additional time (rehearsal extensions, pre-class setup, parent meetings)
  > 4. Add notes for overtime or irregular hours
  >
  > **Why this matters:**
  > - Employee payroll is processed from logged hours — unlogged hours delay your payment
  > - Substitute consultants are paid based on confirmed session completion
  > - Accurate logs protect you in any compensation dispute
  >
  > **Corrections:** If you made an error, do not just re-log. Use the "Request Correction"
  > button — all corrections are reviewed by Amanda or Cara for audit integrity.

**OP-02** — Studio Opening Procedures
- Type: `acknowledgment`
- content_body:
  > If you are the first teacher on-site:
  >
  > 1. Unlock the front door — key code is [ADMIN: insert code] — do not share with students
  > 2. Disarm the security system: panel is located [ADMIN: insert location]
  > 3. Turn on lights: main switch in [location], studio lights in Studio A, B, and C independently
  > 4. Check your assigned studio: floor is clear, barres are properly positioned, mirrors are clean
  > 5. Turn on the sound system: [instructions per studio — A, B, C each have separate systems]
  > 6. Check the first aid kit — if any supplies are low, text Amanda or Cara
  > 7. Confirm your class roster in the portal before students arrive
  >
  > Note: Do not admit any student before the listed class start time.
  > If a parent drops a child early, they must remain with the child until class begins.

**OP-03** — Studio Closing Procedures
- Type: `acknowledgment`
- content_body:
  > If you are the last teacher to leave:
  >
  > 1. Confirm all students have been picked up (see Late Pickup Policy)
  > 2. Return barres to standard positions
  > 3. Sweep the floor if needed — brooms are in [location]
  > 4. Turn off all sound systems
  > 5. Turn off all lights — check all three studios
  > 6. Lock the front door — test the handle
  > 7. Arm the security system: [code and instructions]
  > 8. If anything seems wrong (unlocked door, something missing, suspicious),
  >    call Amanda before leaving and do not re-enter alone
  >
  > Note: If you cannot close properly due to an emergency, call Amanda immediately.
  > Do not leave the building unsecured without notifying her.

**OP-04** — Attendance Taking
- Type: `acknowledgment`
- content_body:
  > Attendance must be taken at the start of every class using the teacher portal app.
  > This is not optional — attendance records are used for:
  > - Safety (knowing who is in the building)
  > - Parent billing verification
  > - Casting eligibility (rehearsal attendance requirements)
  > - Performance role eligibility
  >
  > If a student arrives after you've taken attendance, mark them as late-arrived,
  > not absent. Do not retroactively change to present if they have not arrived.

**OP-05** — Student Illness Protocol
- Type: `acknowledgment`
- content_body:
  > If a student arrives visibly ill (fever, vomiting, active cough):
  > 1. Contact the front desk or Amanda immediately
  > 2. The student should be isolated from other students until a parent arrives
  > 3. You may not diagnose or advise on the illness
  > 4. Be kind and non-dramatic — the child is not in trouble
  > 5. Log the incident in the portal
  >
  > Do not attempt to teach a student who is ill out of courtesy to the parent.
  > Other students and families depend on us maintaining health standards.

**OP-06** — Visitor and Access Policy
- Type: `acknowledgment`
- content_body:
  > Only enrolled students and their authorized adults are permitted in the studio.
  >
  > - Observers/parents: viewing window only — not inside the studio during class
  > - Exceptions (photographers, videographers, production guests): must be pre-approved
  >   by Amanda and announced to parents in advance
  > - No unannounced visitors may enter the studio space without Amanda's approval
  > - If someone you don't recognize is in the building, ask who they are.
  >   This is expected and normal — our families feel safer because of it.

**OP-07** — Platform and Technology Use
- Type: `acknowledgment`
- content_body:
  > The Ballet Academy and Movement platform is provided for professional studio use only.
  > Your teacher account includes access to:
  > - Your schedule and class rosters
  > - Student progress notes (view only unless you are primary teacher)
  > - Hour logging
  > - Substitute request tools
  > - Parent communications (through the studio messaging system only)
  >
  > Do not attempt to access administrative areas of the platform not assigned to your role.
  > Do not share your login credentials with anyone.
  > Report any technical issues or suspicious activity to Amanda or Cara immediately.

---

### 4.9 FINAL ACKNOWLEDGMENT

**FA-01** — Master Acknowledgment and Agreement
- Type: `e_signature`
- requires_counter_signature: true (Amanda signs)
- content_body:
  > By signing below, I confirm that I have:
  > - Read, understood, and agreed to all policies in my onboarding checklist
  > - Completed all required training modules
  > - Submitted all required tax and legal documents
  > - Asked questions about anything I did not understand
  >
  > I understand that Ballet Academy and Movement maintains high standards for safety,
  > professionalism, and culture — and that these standards are what make this studio
  > exceptional. I am proud to uphold them.
  >
  > I understand that material violations of these policies may result in
  > immediate removal from the teaching schedule and termination of my engagement.
  >
  > [Teacher Signature] [Date]
  > [Amanda Cobb / Director Signature] [Date]

---

## 5. Onboarding Item Differences by Track

| Item | Employee | Sub Consultant |
|---|---|---|
| W-4 Federal | ✅ Required | ❌ |
| CA DE-4 | ✅ Required | ❌ |
| Direct Deposit | ✅ Required | Optional |
| I-9 Verification | ✅ Required | ❌ |
| W-9 | ❌ | ✅ Required |
| Independent Contractor Agreement | ❌ | ✅ Required |
| Employment Agreement | ✅ Required | ❌ |
| Background Check | ✅ Required | ✅ Required |
| All Safety Items | ✅ Required | ✅ Required |
| All Culture Items | ✅ Required | ✅ Required |
| All Operations Items | ✅ Required | ✅ Required (abbreviated) |
| Final Acknowledgment | ✅ Required | ✅ Required |

---

## 6. UI and UX Specification

### 6.1 Teacher Onboarding Portal

**Route: /app/(teacher)/teacher/onboarding/page.tsx**

Landing state (not started or in progress):
- Header: "Welcome to Ballet Academy and Movement"
- Subhead: Amanda's name and a warm welcome sentence
- Progress bar: "X of Y items complete"
- Category sections: collapsible, each shows item count + completion count
- Each item: title, description, type badge, status indicator
- "Continue Onboarding" CTA → opens first incomplete item

Item completion modal:
- For `acknowledgment`: display policy text (markdown rendered), checkbox "I have read and understand this policy", Sign button
- For `document_upload`: drag-and-drop or file picker, preview after upload
- For `e_signature`: drawn signature pad (touch/mouse), type-name fallback, "Sign" button
- For `video_watch`: embedded video (Cloudflare Stream), track completion, unlock acknowledgment only after video ends
- For `quiz`: one question at a time, immediate feedback per question, score at end, retry if below threshold
- For `form_fill`: inline form within modal

Completion celebration:
- On 100% complete: full-page modal "Onboarding Complete 🩰"
  "Your information has been submitted to Amanda for final review.
  You'll receive an email when your account is fully activated."
- Confetti optional (tasteful — one burst, not chaos)

### 6.2 Admin Onboarding Dashboard

**Route: /app/(admin)/admin/teachers/onboarding/page.tsx**

Shows:
- All teachers grouped by onboarding status
- `not_started` | `in_progress` | `pending_review` | `approved` | `rejected`
- Filter by status, employment_type
- Each teacher card: name, photo, status, percent complete, days since started

**Route: /app/(admin)/admin/teachers/[id]/onboarding/page.tsx**

Per-teacher:
- Full checklist view with all item statuses
- Items requiring counter-signature: prominent "Sign" button for Amanda
- Items pending admin action (background check, I-9 physical verification): action buttons
- "Approve Onboarding" button → sends activation email to teacher
- "Reject / Request Changes" → text field for reason → sends email to teacher

### 6.3 Onboarding Email Sequence

**Email 1 — Invitation (sent when admin creates teacher account)**
Subject: "Welcome to Ballet Academy and Movement — Complete Your Onboarding"
From: Amanda Cobb (via platform)
Content: Personal welcome, link to onboarding portal, deadline to complete

**Email 2 — Reminder (sent if no activity after 48 hours)**
Subject: "Your onboarding is waiting — quick reminder"
Content: Progress summary, link to continue, offer to answer questions

**Email 3 — Item-specific nudge (sent for counter-signature items)**
Subject: "[Teacher Name] is ready for your signature"
To: Amanda
Content: Which items need her signature, direct link

**Email 4 — Approved**
Subject: "You're officially part of the team 🩰"
Content: Confirmation, first day info, portal access confirmed, intro to key contacts

**Email 5 — Rejected / Changes Needed**
Subject: "Action needed: Your onboarding has a few items to address"
Content: Specific items to fix, deadline, contact for questions

---

## 7. Annual Recertification

Some items require annual renewal. The platform auto-schedules recertification:

| Item | Renewal Interval |
|---|---|
| Mandated Reporter Training (ST-01) | Annual (every 12 months from completion) |
| Background Check (LA-05) | Annual or per California law |
| Safe Touch Policy (ST-06) | Annual acknowledgment |
| Non-Solicitation Policy (PL-01) | Annual acknowledgment |
| Emergency Procedures (ST-05) | Annual — update if studio layout changes |
| Final Acknowledgment (FA-01) | Annual |

Platform behavior on renewal:
- 30 days before expiry: teacher receives email notification
- 14 days before: second reminder
- On expiry: admin receives alert that teacher certification has lapsed
- Teacher can still view schedule but is flagged for admin review
- Admin can grant 7-day grace period with logged reason

---

## 8. Cross-Module References

- **Substitute requests** → substitute_requests table, see Phase 2 prompt Part 6
- **Employment type / AB5 tracking** → teachers table, substitute_session_count
- **Approval workflow** → approval_tasks table (from Calendar module)
- **Communications** → email sequences use Resend + template system
- **Hour logging** → teacher_hours table (from M4 spec)
- **Incident reports** → to be built as part of Safety module (future spec)
- **Background check integration** → third-party service TBD (Checkr recommended)
- **E-signature storage** → Supabase Storage bucket: `onboarding-signatures` (private)
- **Document storage** → Supabase Storage bucket: `onboarding-documents` (private, admin-only access)

---

## 9. Notes for White-Label Deployment

This module is designed for white-label deployment with per-tenant customization:

- `onboarding_templates` and `onboarding_items` are fully tenant-scoped
- Policy content_body fields are editable by each tenant's super_admin
- Video content (Amanda's philosophy video) is per-tenant Cloudflare Stream asset
- Studio-specific operational details (key codes, first aid locations, etc.)
  are admin-editable fields, not hardcoded
- Employment law references are California-specific by default;
  white-label tenants in other states will need to update TP items for their jurisdiction

---

*Last updated: March 2026 — Derek Shaw / Green Lyzard*
*This spec is a living document. All policy text marked [ADMIN: ...] requires Amanda's review before going live.*
