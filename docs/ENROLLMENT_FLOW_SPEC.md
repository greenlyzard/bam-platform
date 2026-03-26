# ENROLLMENT_FLOW_SPEC.md
# Ballet Academy and Movement — New Student Enrollment Flow
# Version: 1.0 | Based on: Tutu School competitive analysis + BAM brand standards
# Created: March 2026

---

## 1. Design Philosophy

BAM's enrollment should feel like booking a place at a premier private arts school —
not signing up for a rec center class. Every screen should reinforce:

- Professional ballet pedagogy (not generic dance)
- Amanda Cobb's credentials and the studio's reputation
- Warmth and personal attention — small class sizes matter
- A sense that getting in is special

Tutu School's flow is good for a franchise model. BAM's flow should feel more
curated and personal — like the studio is choosing you as much as you're choosing them.

---

## 2. Entry Points

Multiple entry points all lead to the same flow:

- "Register" button on balletacademyandmovement.com
- "Schedule a Free Trial" button (primary CTA on homepage)
- "Sign Up" / "X spots left!" on individual class cards on schedule page
- Angelina chatbot capture → "Ready to register?"
- QR code at studio front desk

---

## 3. The 7-Step Flow

### STEP 0 — Entry Choice (Pre-flow)
Before the wizard starts, show a clean two-option card:

**Option A: Free Trial Class**
- "Try one class free — no commitment"
- Recommended for: First time at our studio
- CTA: "Schedule My Free Trial →"

**Option B: Enroll Now**  
- "Join Ballet Academy and Movement"
- Recommended for: Ready to start
- CTA: "Enroll Now →"

Design notes:
- Two large cards side by side (stacked on mobile)
- Lavender accent on "Free Trial" card (lower commitment = lead capture priority)
- Subtle "Already a member? Log in" link below cards
- No nav, no distractions — full screen focus

---

### STEP 1 — Account Creation / Login
Simple, fast. Don't ask for too much.

**New parent:**
- First name, Last name
- Email address
- Password (with strength indicator)
- OR: "Continue with Google" (one tap — highly recommended for mobile)

**Returning parent:**
- Email + password
- OR: Google
- "Forgot password?" link

Design notes:
- Progress indicator at top: 7 dots or a subtle progress bar
- Step label: "Create Your Account"
- No phone number here — collect later in contact step
- On submit: create profile + log in, advance to step 2

---

### STEP 2 — Your Dancer
Add the child's information. Keep it minimal — 3 fields only like Tutu.

**Fields:**
- First name (required)
- Last name (required)
- Date of birth (required — date picker, mobile-friendly)

That's it. No gender, no notes — those come later in contact step.

If returning parent with existing students:
- Show existing student cards with large tap targets
- "Add another dancer" option below
- Each student shows name + age

Design notes:
- Step label: "Tell Us About Your Dancer"
- Warm subtext: "We use your child's age to recommend the perfect class."
- On save: insert student record, auto-calculate age for class filtering

---

### STEP 3 — Class Recommendation (BAM DIFFERENTIATOR)
This is where BAM beats Tutu completely. Instead of showing all classes and
making the parent figure it out, we show RECOMMENDED classes based on age.

**Layout:**
- Heading: "Perfect classes for [child's name]" (personalized)
- Based on DOB entered in step 2, calculate age → filter classes

**Class cards (full width on mobile):**
- Class name (e.g. "Petites Ballet" or "Level 1 Ballet")
- Age range badge
- Description (2-3 sentences — what they'll learn)
- Duration
- Available days/times (listed as chips: "Mon 4:30pm", "Wed 5:15pm")
- Spots remaining badge ("3 spots left" in amber, "WAITLIST" in gray, "OPEN" in lavender)
- Pricing shown clearly
- "Select This Class →" button

**If multiple times available:**
- Expand to show time selector within the card
- Don't navigate away — expand inline

**Scarcity/urgency elements (matching Tutu's best feature):**
- "Only 2 spots left!" shown in amber
- "WAITLIST — join the list" shown when full
- Promotions shown inline: "50% off first month" badge when applicable
- "Invite Only" for advanced levels — creates aspiration

**If free trial selected in Step 0:**
- Show same class cards but CTA becomes "Schedule Trial →"
- Available trial dates shown per class (next 2-3 available)

Design notes:
- If no classes match age exactly: show closest match with note
- If child is too advanced for standard recommendation: show "Contact Us" card
  with Amanda's photo and phone — preserve personal feel

---

### STEP 4 — Contact & Family Information
Collect remaining details. Group logically.

**Section: Your Contact Info**
- Mobile phone (required — this becomes primary SMS)
- SMS opt-in checkbox: "Text me class reminders and updates"
  - Legal text: "Message and data rates may apply. Reply STOP to unsubscribe."
- Home address (street, city, state, zip)

**Section: About Your Dancer**
- Is there anything we should know? (textarea — optional)
  - Placeholder: "Allergies, injuries, special considerations, prior dance experience..."

**Section: Emergency Contact**
- Contact name (required)
- Contact phone (required)

**Section: How Did You Hear About Us?**
- Single select: Google Search / Instagram / Facebook / TikTok / Referred by a friend / 
  Walked/drove by / Performance or event / Other
- If "Referred by a friend": show referral name field

Design notes:
- Step label: "A Little More About You"
- Address is required (helps with geographic targeting and communications)
- Keep emergency contact to 1 contact — Tutu asks for one, that's fine

---

### STEP 5 — Terms of Service
Clean presentation of legal requirements.

**Show:**
- Class selected + price summary at top
- First payment amount (prorated if mid-month, explained clearly)
- Monthly recurring amount after that

**Legal text sections (collapsible on mobile):**
- Participation & Liability Waiver
- Photo & Video Release (with opt-out note)
- Auto-Renewal Disclosure (very clear — monthly subscription, cancel anytime)
- Cancellation Policy (30 days notice, no mid-month cancellations)
- Makeup Class Policy

**Single checkbox:**
"I have read and agree to the Ballet Academy and Movement Terms of Service and
enrollment policies."

**For free trial:**
- Shorter terms — no payment agreement
- Photo release still applies
- "No credit card required for your free trial"

Design notes:
- Step label: "Review & Agree"
- Don't hide the auto-renewal. Tutu is very upfront about it — BAM should be too.
- Show Amanda's photo with a personal note: "We're so excited to have [child's name]
  join us. See you in class! — Amanda"

---

### STEP 6 — Payment
Clean, fast, secure.

**For full enrollment:**
- Show order summary: class, price, first payment amount
- Payment options:
  - Credit/debit card (Stripe Elements — inline, not redirect)
  - "I have a gift card" — reveal gift card field
  - Promo code field (collapsed by default, "Have a promo code?" link)
- First payment explanation: "Your first payment of $[X] will be prorated
  for the remainder of [Month]. Starting [Next Month 1st], you'll be charged
  $[full amount] monthly."
- Submit button: "Complete Enrollment →"

**For free trial:**
- No payment required
- Optional: "Save a card on file to make enrollment easier later"
- Submit button: "Schedule My Free Trial →"

**For waitlist:**
- No payment required
- Collect card optionally ("Save card to enroll quickly when a spot opens")
- Submit button: "Join the Waitlist →"

Design notes:
- Never show raw Stripe form — use Stripe Elements for card entry
- Show security badges (SSL, Stripe)
- Show what happens next clearly

---

### STEP 7 — Confirmation
Warm, on-brand, clear next steps.

**Header:** "You're In! 🩰" (or "Your Trial is Scheduled!" / "You're on the Waitlist!")

**Content:**
- Confirmation of: child's name, class, day/time, studio address
- Add to Calendar button (generates .ics)
- "What to bring" section:
  - What to wear (link to dress code)
  - Arrival instructions ("Arrive 5 minutes early")
  - Parking info
- "Download Our App" banner (when app is live)
- "Follow Us" social links (Instagram, TikTok)

**Email confirmation:**
- Triggers immediately via Resend
- Template: warm, branded, includes all class details + what to bring
- From: amanda@balletacademyandmovement.com feel (even if sent via Resend)

**Klaviyo trigger:**
- Tag new enrollment or trial in Klaviyo
- Start welcome email sequence

---

## 4. Three Entry Paths (from REGISTRATION_AND_ONBOARDING.md v3.0)

The 7-step wizard above is **Path C — Straight Registration**. BAM has three paths:

### Path A — Angelina Chat-Guided (default for website visitors)
1. Angelina greets visitor, asks about child (age, experience, goals, schedule)
2. Angelina recommends 1–3 classes based on responses
3. For trial-eligible: "Would you like to book a free trial?"
4. For beginner/non-level: "Ready to register now?" — can bypass trial
5. Parent enters contact info → lead record created
6. Flows into the 7-step wizard at Step 2 (student info pre-filled)

### Path B — Enrollment Quiz → AI Recommendation → Trial/Register
Self-service alternative to chat:
1. Who are you enrolling? — Myself / My child / Multiple children
2. Branch A (adult): experience level → interest (Ballet/Jazz/Pilates/Gyrotonic) → availability
   - Pilates/Gyrotonic → flags for admin follow-up, NOT self-service enrollment
3. Branch B (one child): DOB → experience → availability → recommended classes
4. Branch C (multiple children): collect each child's DOB → recommend per child
5. AI returns recommended class cards with "Book Trial" or "Register Now" CTA

### Path C — Straight Registration (the 7-step wizard above)
For parents who already know what class they want. Entry from:
- "Sign Up" on a specific class card
- "X spots left!" urgency link on schedule page
- Angelina handoff after recommendation

---

## 5. Trial Class Rules (Critical — enforced at system level)

- **One free trial per student** — enforced by DOB + email match at booking
- **Second trial requires Super Admin approval** (Amanda reviews and confirms)
- Trial student appears on roster tagged [TRIAL]
- Trial session is never charged
- Registration fee is NOT due at trial — only due at full enrollment
- If `trial_requires_approval = true` on the class: admin reviews before confirmation email goes out
- After trial: Angelina sends post-trial follow-up sequence automatically

**Post-trial follow-up sequence (Angelina/Klaviyo):**
| Timing | Action |
|---|---|
| Same day after class | "How did [child] enjoy her class today?" warm check-in |
| Day 3 | Class recommendation + enrollment link |
| Day 7 | Final nudge with Amanda personal note |

---

## 6. Admin Front Desk Entry (Suppression Mode)

When admin enters a student on behalf of a family (transcribing paper forms, phone enrollments):
- `front_desk_entry = true` flag suppresses all welcome emails
- Admin manually sends welcome when appropriate
- Klaviyo tags still apply for reporting purposes
- Trial abuse check still runs — admin sees warning but can override

---

## 7. Mobile UX Requirements

All screens must pass these mobile standards:

- **Touch targets:** minimum 48px height for all tappable elements
- **No horizontal scroll** at any viewport
- **Date picker:** native mobile date input (not a custom calendar)
- **Progress indicator:** visible on every step — parent knows how far they are
- **Back button:** always available, never loses entered data
- **Auto-advance:** after selecting a class time, advance to next step automatically
- **Keyboard handling:** form scrolls above keyboard, no fields hidden behind it
- **Loading states:** every async action shows a spinner — never a frozen screen
- **Error states:** inline, red, specific — "Please enter a valid phone number"

---

## 5. Key Differentiators vs Tutu School

| Feature | Tutu School | BAM |
|---|---|---|
| Entry CTA | Free Trial or Enroll | Same |
| Student creation | 3 fields | 3 fields (same — don't add more) |
| Class recommendation | Parent figures it out | Age-based auto-recommendation |
| Scarcity indicators | "X spots left!" | "X spots left!" + waitlist |
| Payment | ClassBug (3rd party) | Stripe native (our brand) |
| Confirmation | Generic | Personalized — Amanda's voice |
| Post-enrollment | Pirouette Portal | BAM Portal (far superior) |
| Brand feel | Playful franchise | Elevated professional ballet |
| Mobile quality | Functional | Best-in-class |

---

## 6. Conversion Optimization

Implement these to maximize conversion:

**Abandon recovery:**
- If parent creates account but doesn't complete: email after 1 hour
- "You're so close! [Child's name] has a spot waiting."
- Link back to the exact step they left on

**Waitlist nurture:**
- Waitlisted families get email when spot opens
- 24-hour hold on the spot before offering to next person
- SMS alert if opted in

**Trial conversion:**
- After free trial: email sequence to convert to enrollment
- Day 1 after trial: "How was [child's name]'s class?"
- Day 3: Class recommendation + enrollment link
- Day 7: Final nudge with Amanda personal note

**Referral capture:**
- "Referred by a friend" → capture referrer name → admin sees in dashboard
- Future: referral program with credits

---

## 7. Admin View

After enrollment, admin dashboard shows:
- New enrollment notification
- Student profile auto-created with all collected data
- Class roster updated
- First payment processed (or trial scheduled)
- Klaviyo tag applied
- How-did-you-hear data captured for marketing attribution

---

## 8. Build Priority

Phase 1 (NOW — before Fall 2026):
- Step 0: Entry choice screen
- Step 1: Account creation with Google OAuth
- Step 2: Dancer info (3 fields)
- Step 3: Age-based class recommendation with scarcity indicators
- Step 6: Stripe payment (already partially built)
- Step 7: Confirmation with "add to calendar"

Phase 2:
- Step 4: Full contact form with SMS opt-in
- Step 5: Terms of service with collapsible sections
- Abandon recovery emails via Klaviyo
- Waitlist nurture sequence

Phase 3:
- Referral tracking
- Trial conversion email sequence
- App download prompt on confirmation screen
