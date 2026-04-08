# Enrollment & Placement — Spec

**Status:** Ready for implementation  
**Phase:** 2 — Registration & Enrollment  
**Related Modules:** REGISTRATION_AND_ONBOARDING.md, CONTRACTS_AND_COMMITMENTS.md, CURRICULUM_AND_PROGRESSION.md, BILLING_AND_CREDITS.md, ANGELINA_SPEC_V2.md  
**Decision Log Date:** April 7, 2026

---

## 1. Overview

Enrollment has two distinct flows that must be handled separately:

| Flow | Who | Trigger |
|---|---|---|
| **Admin Pre-Placement** | Existing students, season rollover | Admin stages recommendations, releases all at once |
| **New Student Self-Enrollment** | New families | Trial booking → recommendation → checkout |

Both flows share the same cart, checkout, bundle logic, and contract signing — only the entry point differs.

---

## 2. Admin Pre-Placement Flow

### 2.1 Concept

Before a new season opens, Amanda (or admin) reviews every active student and places them into recommended classes for the upcoming season. These are **staged** — no family is notified until admin deliberately releases all placements simultaneously. This prevents any family feeling they were placed after others.

### 2.2 Staging Workflow

```
Admin opens Season → Placement Manager
         ↓
For each student: admin assigns recommended classes
  - Pull from current level + teacher notes + flag history
  - Can assign multiple classes (bundle logic applies)
  - Can assign privates
  - Can flag commitment programs (Company, Junior Company, etc.)
         ↓
All placements sit in "staged" state — families see nothing
         ↓
Admin reviews staging summary:
  - X students placed
  - X awaiting placement
  - X bundle upsell opportunities flagged
         ↓
Admin clicks "Release All" (or schedules a release date/time)
         ↓
All families notified simultaneously via push + email:
  "Your recommended classes for [Season] are ready to review"
         ↓
Family logs into portal → sees recommended cart
```

### 2.3 Release Controls

- **Release All Now** — immediate simultaneous notification
- **Scheduled Release** — admin sets a date/time (e.g. "March 1 at 9am")
- **Staged release is never partial** — either all families are notified or none
- Admin can edit placements at any time before release without affecting notification
- After release: placements become visible to families but remain editable by admin until family checks out

### 2.4 Family Experience After Release

Family opens the portal and sees:

```
┌─────────────────────────────────────────────────┐
│  🩰 Your Fall 2026 Classes Are Ready to Review   │
│                                                   │
│  Miss Amanda has recommended these classes        │
│  for Sofia:                                       │
│                                                   │
│  ✓ Ballet Level 3B — Tues/Thurs 4:30pm    $185/mo│
│  ✓ Pointe Prep — Thurs 6:00pm              $95/mo│
│                                                   │
│  [+ Add a Class]  [Remove]                        │
│                                                   │
│  💜 Bundle Deal: 2 classes = $265/mo (save $15)  │
│                                                   │
│  [Review & Confirm →]                            │
└─────────────────────────────────────────────────┘
```

Family can:
- Accept all recommendations as-is
- Remove classes they don't want
- Add additional classes (from available catalog filtered to their level)
- See bundle/unlimited upsell prompts
- Respond to private lesson recommendations

### 2.5 Angelina's Role in Placement

Angelina does NOT auto-place students. She:
- Explains what each level involves and what competencies are expected
- Explains the placement process ("Miss Amanda will review your child's progress and recommend classes for next season")
- Explains commitment programs and what they involve
- Answers "why was my daughter placed in Level 3B vs 3C?"
- Does NOT modify cart or placements directly

---

## 3. Bundle & Unlimited Logic

### 3.1 Bundle Configuration (Studio-Defined)

Bundles are fully configurable per tenant. Admin can create any bundle structure. Examples:

| Bundle Type | Trigger | Discount |
|---|---|---|
| 2-class bundle | Student enrolls in 2+ classes | $15/mo off |
| 3-class bundle | Student enrolls in 3+ classes | $30/mo off |
| Hour threshold | Total class hours/week ≥ X | Custom discount |
| Unlimited | Crosses price threshold | Flat monthly rate |
| Custom deal | Admin defines | Admin defines |

### 3.2 Bundle Database Schema

```sql
CREATE TABLE IF NOT EXISTS bundle_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,          -- e.g. "2-Class Bundle", "Unlimited"
  description     text,
  trigger_type    text NOT NULL
    CHECK (trigger_type IN ('class_count','hour_threshold','price_threshold','manual')),
  trigger_value   numeric,                -- e.g. 2 (classes), 6.0 (hours), 300.00 (dollars)
  discount_type   text NOT NULL
    CHECK (discount_type IN ('flat_monthly','percentage','fixed_price','unlimited')),
  discount_value  numeric,                -- flat amount off, or percentage, or fixed total price
  is_unlimited    boolean DEFAULT false,  -- true = Unlimited tier (open schedule access)
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_bundles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  cart_id         uuid NOT NULL REFERENCES enrollment_carts(id),
  bundle_config_id uuid NOT NULL REFERENCES bundle_configs(id),
  applied_at      timestamptz DEFAULT now(),
  discount_amount_cents integer NOT NULL
);
```

### 3.3 Upsell Logic — Cart Calculation

On every cart update, run `computeCartBundles()`:

```typescript
function computeCartBundles(cart: Cart, bundles: BundleConfig[]): BundleResult {
  // 1. Sort bundles by trigger_value descending (apply best deal)
  // 2. Check each bundle trigger against cart contents
  //    - class_count: count distinct classes in cart
  //    - hour_threshold: sum weekly hours across all cart classes
  //    - price_threshold: sum undiscounted monthly total
  // 3. Apply highest qualifying bundle
  // 4. If is_unlimited = true: flag for unlimited upsell prompt
  // 5. Return: applied bundle, discount amount, upsell opportunities
}
```

### 3.4 Upsell Prompt Rules

**Bundle upsell** — shown inline in cart when adding one more class would qualify for a better bundle:
> "Add one more class and save $30/month with our 3-Class Bundle."

**Unlimited upsell** — shown when cart total exceeds Unlimited price:
> "You're paying $X/month for 3 classes. Unlimited classes is $Y/month — save $Z and add anything you want."

**Unlimited schedule gap alert** — for existing Unlimited students, shown in portal and Angelina admin card:
> "Sofia is on Unlimited but only attends 2 classes. 3 slots are open in classes that match her level."

Unlimited gap recommendations have three response options:
- **Add to Schedule** — enrolls immediately, no charge (they're Unlimited)
- **Decline** — dismisses this specific recommendation
- **Ask Me Later** — snoozes 14 days, then resurfaces

### 3.5 Private Lesson Recommendations

Same recommendation flow applies to privates:
- If student is in a program that benefits from privates (Company, intensive prep, competition) → system suggests
- Admin can configure which programs trigger private recommendations
- Response options same as above: Add / Decline / Ask Me Later
- Private recommendation triggers Angelina to surface availability from teacher rate cards

---

## 4. New Student Self-Enrollment Flow

### 4.1 Entry Points

- "Book a Trial" CTA on website (via Angelina or direct button)
- Schedule page "X spots left" link
- QR code at studio

### 4.2 7-Step Wizard

Covered fully in ENROLLMENT_FLOW_SPEC.md. Key additions from this decision log:

**Step 3 — Class Recommendation:**
- Shows the Girl Scout badge preview: "Sofia will start working toward these skills"
- Shows next 2–3 upcoming badges for the recommended level (grayed out, aspirational)
- Creates emotional investment before checkout

**Step 5 — Commitment Confirmation (if applicable):**
- If recommended class is in a commitment program → show commitment summary before payment
- Must acknowledge: "Company students participate in all performances and competitions"
- This is NOT a contract signature yet — that happens after enrollment at the contract step

**Step 6 — Bundle Prompt:**
- If enrolling in multiple classes → bundle upsell shown before payment
- If single class → shown as "families who take Ballet also take..." recommendation

### 4.3 Post-Trial Conversion

After trial attended:
- Admin marks trial complete
- Angelina surfaces the student in admin dashboard: "Sofia attended Pre-Ballet trial — ready to enroll"
- Parent receives: "Sofia loved her class! Here's how to secure her spot"
- Link goes directly to pre-filled cart (same class, no re-quiz needed)
- Trial student gets a 24-hour priority window before their spot opens to waitlist

---

## 5. Checkout Flow (Shared — Both Flows)

### 5.1 Steps

```
1. Cart Review
   - Class list with times, teachers, rooms
   - Bundle discount applied + displayed
   - Monthly total clearly shown
   - "Starting [Month 1]: $X/month"

2. Commitment Confirmation (if program requires)
   - Program commitments listed clearly
   - Checkbox: "I understand and agree to these commitments"
   - Cannot proceed without acknowledgment

3. Contract Signing (if program requires)
   - See CONTRACTS_AND_COMMITMENTS.md for full spec
   - Rendered in-platform, signed digitally
   - PDF saved to student file

4. Payment
   - Stripe Elements (inline, not redirect)
   - First payment = prorated for remainder of month
   - Autopay confirmation: "You'll be charged $X on the 1st of each month"
   - Save card for future payments

5. Confirmation
   - Summary of enrolled classes
   - What to bring / dress code
   - Add to Calendar button
   - Portal link
```

### 5.2 Proration Logic

- If enrolling before the 15th: charge full month
- If enrolling on/after the 15th: charge half month
- Admin can override proration per student
- Proration calculation shown clearly before payment: "First payment: $X (prorated for X days remaining in [Month])"

---

## 6. Pre-Placement Data Model

```sql
-- Staged placements before season release
CREATE TABLE IF NOT EXISTS season_placements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  season_id       uuid NOT NULL REFERENCES seasons(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  class_id        uuid NOT NULL REFERENCES classes(id),
  placed_by       uuid REFERENCES profiles(id),
  placement_type  text NOT NULL DEFAULT 'recommended'
    CHECK (placement_type IN ('recommended','required','optional')),
  placement_notes text,                   -- admin note visible to family
  status          text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged','released','accepted','declined','modified','expired')),
  released_at     timestamptz,            -- when family was notified
  responded_at    timestamptz,
  response_notes  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(season_id, student_id, class_id)
);

-- Season release events (one per season release action)
CREATE TABLE IF NOT EXISTS season_placement_releases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  season_id       uuid NOT NULL REFERENCES seasons(id),
  released_by     uuid REFERENCES profiles(id),
  scheduled_for   timestamptz,            -- null = immediate
  executed_at     timestamptz,
  families_notified integer DEFAULT 0,
  students_placed   integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Upsell/recommendation responses
CREATE TABLE IF NOT EXISTS enrollment_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  recommendation_type text NOT NULL
    CHECK (recommendation_type IN ('class','private','bundle_upsell','unlimited_upsell','schedule_gap')),
  class_id        uuid REFERENCES classes(id),
  bundle_config_id uuid REFERENCES bundle_configs(id),
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','snoozed')),
  snoozed_until   timestamptz,
  responded_at    timestamptz,
  responded_by    uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);
```

---

## 7. Decisions Log

| # | Decision |
|---|---|
| 1 | Pre-placement is admin-initiated only — Angelina explains but never places |
| 2 | All placements staged before any family is notified — simultaneous release |
| 3 | Release can be immediate or scheduled to a specific date/time |
| 4 | Family receives recommended cart — can add, remove, modify before checkout |
| 5 | Bundle configs are fully studio-defined: class count, hour threshold, price threshold, or manual |
| 6 | Unlimited is a bundle tier, not a separate product — configured same way |
| 7 | Upsell prompts: bundle gap, unlimited crossover, Unlimited schedule gap |
| 8 | Schedule gap recommendations: 3 options — Add / Decline / Ask Me Later (14-day snooze) |
| 9 | Same recommendation options apply to private lesson suggestions |
| 10 | Trial student gets 24-hour priority window before spot opens to waitlist |
| 11 | Proration: before 15th = full month, on/after 15th = half month, admin-overridable |
| 12 | Commitment acknowledgment is a checkbox in checkout — contract signature is separate |
| 13 | Angelina shows next 2–3 upcoming skill badges (grayed) on class recommendation cards |
