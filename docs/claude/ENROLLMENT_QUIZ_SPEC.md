# Enrollment Quiz — Branching Logic Spec
## For: app/(public)/enroll — EnrollmentWizard component

---

## Step 1: Who are you enrolling?

**Question:** "Who are you looking to enroll?"

**Options:**
- 🩰 Myself — I want to take classes
- 👧 My child — I'm enrolling my son or daughter
- 👨‍👧‍👦 Multiple children — I have more than one child to enroll

This is the branch point. Everything downstream changes based on this answer.

---

## Branch A: Enrolling Yourself (Adult)

Follow-up questions:
1. "How would you describe your dance experience?"
   - Complete beginner — never taken a formal class
   - Some experience — took classes years ago or casually
   - Intermediate — fairly consistent training
   - Advanced — serious training background

2. "What are you most interested in?" (multi-select)
   - Ballet
   - Jazz
   - Contemporary
   - Hip Hop
   - Pilates (mat or reformer)
   - Gyrotonic
   - Not sure — help me decide

3. "What days work best for you?" (multi-select)
   - Monday, Tuesday, Wednesday, Thursday, Friday, Saturday

**Recommendation logic:**
- Ballet beginner/some experience → Teen/Adult Beginner Ballet
- Ballet intermediate/advanced → Teen/Adult Intermediate or Level 4 (teacher eval)
- Pilates or Gyrotonic selected → flag for admin follow-up ("We'll have someone reach out about our Pilates and Gyrotonic offerings — these are scheduled privately")
- Multiple interests → show all matching classes

**Key note:** Pilates and Gyrotonic are not in the standard class catalog. When selected, Angelina captures the interest and flags it for admin to follow up with scheduling options. Do not show these as self-service enrollments.

---

## Branch B: Enrolling One Child

Follow-up questions:
1. "How old is your child?"
   - Age selector: 3 to 18+
   - If 3: → Petites recommendation
   - If 4-5: → Petites recommendation
   - If 6-7: → Level 1 recommendation
   - If 8-9: → Level 2A (beginner) or Level 2B/2C (with experience)
   - If 10-12: → Level 3A (beginner) or 3B/3C (with experience)
   - If 13-15: → Level 4 or Teen classes depending on experience
   - If 16-18: → Level 4 classes (company track) — note these students train alongside younger Level 4 students; this is normal and expected
   - If 18+: → Adult classes or Level 4 if advanced

2. "Has [child's name] danced before?"
   - Never — this will be their first class
   - A little — some classes but nothing formal
   - Yes, at another studio — we'd like to find the right level
   - Yes, here at BAM — returning student

3. "What disciplines interest you?" (multi-select, show only age-appropriate options)

4. "What days work best?" (multi-select)

**Age 16-18 handling:**
Students 16-18 with serious training should be directed to Level 4B or 4C. The quiz should not assume they belong in "Teen/Adult" just because of age — experience determines this. If they have 3+ years of training, recommend Level 4 assessment. If beginner, recommend Teen/Adult Beginner.

---

## Branch C: Multiple Children

For each child, collect:
- Child's name (first name only for display)
- Age
- Dance experience (same options as Branch B)
- Discipline interest

The quiz iterates: "Tell us about your first child... now tell us about your second child..." etc.

Maximum 4 children in one session. More than 4 → "Please contact us directly at (949) 229-0846 — we'd love to help you find the right classes for everyone."

After collecting all children's info, show recommendations for each child on a single results screen with separate "Enroll" CTAs per child.

---

## Results Page

Show:
- For each enrollee: 2-3 recommended classes with day/time/level/fee
- "Free Trial" badge on each — first class always free
- "Join Waitlist" if class is full
- For Pilates/Gyrotonic: "We'll contact you about scheduling" card instead of enroll button

Also show:
- "Not sure this is right?" → triggers Angelina chat, pre-loaded with everything collected so far

---

## Angelina Integration — Admin Rescue

When a user gets stuck, clicks help, or abandons mid-quiz, Angelina receives the collected context and can continue the conversation.

**Context injected into Angelina's system prompt:**
```
ENROLLMENT QUIZ CONTEXT:
Enrolling: [myself / child name age X / multiple children: name age, name age]
Experience: [beginner/intermediate/etc]
Interests: [disciplines selected]
Preferred days: [days selected]
Quiz step abandoned: [step name]
```

With this context, Angelina can say:
"I see you were looking at classes for Sofia (age 9) who has some prior ballet experience and prefers Thursdays — want me to help you find the right fit?"

This context is also visible to admin in the leads dashboard so staff can follow up knowledgeably without the family having to repeat themselves.

---

## Admin Flag: Pilates / Gyrotonic Interest

When a user selects Pilates or Gyrotonic:
- Create a lead record with source: 'angelina', interest: 'pilates' or 'gyrotonic'
- Status: 'new', assigned to front desk
- Notification sent to admin: "New Pilates/Gyrotonic inquiry from [name]"
- Response to user: "We offer Pilates and Gyrotonic by appointment — we'll reach out within 24 hours to schedule a session."

These are not in the class catalog and should never appear as self-service options.
