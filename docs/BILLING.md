# BILLING.md
# Ballet Academy and Movement — Billing Engine Spec
# Version: 1.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Created: March 2026

---

## 1. Overview

Billing at BAM is complex enough to require its own dedicated module.
It covers: registration fees, monthly tuition (with proration), class
packages, competition charges, costume charges, cash payment marking,
failed payment retry logic, credit management, and the data structures
needed to eventually feed a full P&L in the Finance module.

All payment processing routes through the pluggable payment adapter
(see INTEGRATIONS.md and SAAS.md). No direct Stripe calls — always
through `src/lib/payments/adapter.ts`.

Cross-references:
- INTEGRATIONS.md — Stripe/PayPal/Authorize.net adapter
- REGISTRATION_AND_ONBOARDING.md — registration fee, enrollment events
- SCHEDULING_AND_LMS.md — competition and costume billing triggers
- SAAS.md — multi-tenant payment config

---

## 2. Charge Types

| Charge Type | Trigger | Who Approves | Timing |
|---|---|---|---|
| Registration fee | Enrollment confirmation | Auto (or waived by Admin+) | At enrollment |
| Monthly tuition | School year enrollment | Auto | 15th of each month |
| Prorated tuition | Mid-month enrollment | Auto (method configurable) | At enrollment |
| Unlimited package | Season enrollment | Auto | 15th of each month |
| Competition fee | Amanda confirms student | Finance Admin queues | On Finance Admin trigger |
| Costume charge | Admin creates charge | Finance Admin queues | On Finance Admin trigger |
| Private lesson | Teacher confirms session | Finance Admin reviews | Batched with monthly billing |
| Credit adjustment | Admin applies credit | Finance Admin or above | Immediate |
| Cash payment record | Admin marks paid | Any Admin | Manual, immediate |

---

## 3. Registration Fee

- Due at enrollment confirmation
- Amount configured per class or globally in Admin Settings → Billing
- **Waiver:** Any Admin role can waive the registration fee
  - Waiver requires a reason (text field, logged)
  - Waiver is logged: waived_by, waived_at, reason
- **Earlybird discount:** configured in enrollment_windows (see REGISTRATION spec)
  - Applied automatically if enrollment is within earlybird window
- Registration fee is non-refundable unless overridden by Finance Admin+

```sql
registration_fees (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  class_id        uuid FK classes nullable,   -- null = global default
  amount          numeric(10,2) NOT NULL,
  is_active       boolean default true,
  created_at      timestamptz default now()
)
```

---

## 4. Monthly Tuition

### 4.1 Billing Cycle
- Tuition runs on the **15th of each month**
- Applies to all students with `enrollments.status = 'active'`
- Billing is per enrollment (one charge per class per student)
- Family account receives one consolidated invoice showing all
  enrolled students and classes

### 4.2 Proration — Mid-Month Enrollment

**Default method: Per-Class Rate**
- System counts remaining sessions in the current month from
  enrollment date to end of month
- Prorated amount = (remaining sessions ÷ total sessions in month)
  × monthly tuition
- Example: 3 remaining sessions out of 4 in the month = 75% of tuition

**Alternative methods available (Admin selects per enrollment):**
- **Daily rate:** (remaining days in month ÷ 30) × monthly tuition
- **Split rule:** enroll before 15th → full month; enroll on/after 15th
  → half month

**Override:** Finance Admin and above can manually enter a custom
prorated amount with a reason logged.

```sql
-- On the enrollment record:
proration_method    text CHECK IN ('per_class','daily','split','custom','none'),
prorated_amount     numeric(10,2) nullable,
proration_override  boolean default false,
proration_override_by uuid FK users nullable,
proration_override_reason text nullable,
```

### 4.3 Tuition Pricing Tiers

```sql
tuition_rates (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  class_id        uuid FK classes nullable,  -- null = applies to all
  rate_type       text CHECK IN (
                    'per_class_monthly',     -- standard monthly per class
                    'unlimited_season',      -- unlimited classes per season
                    'drop_in',              -- single session rate
                    'custom'
                  ),
  amount          numeric(10,2) NOT NULL,
  season          text nullable,             -- "Fall 2025", "Spring 2026"
  is_active       boolean default true,
  created_at      timestamptz default now()
)
```

### 4.4 Unlimited / Season Packages
- Priced per **season** (Fall, Spring, Summer), not monthly
- Billed on the 15th like standard tuition but at the season rate
- Continues unless cancelled with 30-day notice
- Family can hold unlimited package while having individual class
  enrollments simultaneously (Finance Admin manages)

---

## 5. Competition Charges

### 5.1 Workflow
1. Amanda (or Studio Admin) confirms a student for a competition entry
   in Admin → Competitions → [Competition] → Entries
2. Charge record is created with `status = 'pending_finance_review'`
3. Finance Admin (or Amanda) reviews the charge queue:
   Admin → Billing → Competition Charges
4. Finance Admin approves the charge for collection
5. **Batch notification:** Finance Admin selects approved charges and
   sends batch notification to affected families:
   - Message: "Your student [Name] has been confirmed for [Competition].
     A charge of $[X] will be applied to your account in 24 hours."
   - Delivered via: in-app notification + SMS (if enabled) + email
6. **24-hour window:**
   - If no response: charge fires automatically after 24 hours
   - If parent responds "Do not charge": charge is paused, a
     conversation is queued in Admin inbox tagged:
     `competition_charge_dispute`
7. **Dispute resolution:** Admin reviews the conversation and takes
   one of the following actions:
   - Approve charge anyway (with note)
   - Adjust charge amount
   - Remove student from competition entry
   - Switch payment method
   - Mark as cash/paid
   - Apply account credit
8. **Cash payments:** Finance Admin can mark any charge as
   `payment_method = 'cash'`, `status = 'paid'` — removes from
   outstanding balance, logs who marked it and when

### 5.2 Competition Charge Schema

```sql
competition_charges (
  id                    uuid PK,
  tenant_id             uuid FK tenants,
  competition_entry_id  uuid FK competition_entries,
  family_id             uuid FK families,
  student_id            uuid FK students,
  description           text,               -- "YAGP 2026 — Entry Fee: Solo Variation"
  amount                numeric(10,2),
  status                text CHECK IN (
                          'pending_finance_review',
                          'approved',
                          'notification_sent',
                          'charged',
                          'disputed',
                          'waived',
                          'paid_cash'
                        ),
  payment_method        text CHECK IN ('card','cash','credit','waived'),
  notification_sent_at  timestamptz,
  charge_after          timestamptz,        -- 24hrs after notification
  charged_at            timestamptz,
  transaction_id        text nullable,
  dispute_conversation_id uuid nullable,    -- FK to channel in COMMUNICATIONS
  marked_paid_by        uuid FK users nullable,
  marked_paid_at        timestamptz nullable,
  finance_approved_by   uuid FK users,
  finance_approved_at   timestamptz,
  notes                 text,
  created_by            uuid FK users,
  created_at            timestamptz default now()
)
```

---

## 6. Costume Charges

### 6.1 Billing Mode (Per Production)
Each production has a `costume_billing_mode`:
- `per_costume` — individual charge per costume item per student
- `flat_per_student` — one charge per student for the entire production

### 6.2 Per-Costume Mode
Each dance within a production has costume items linked to it.
Students assigned to that dance receive a charge per costume item.

```sql
costumes (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  production_id     uuid FK productions,
  dance_title       text,                  -- "Snow Scene", "Party Scene"
  item_name         text,                  -- "Snowflake Tutu", "Hair piece"
  description       text,
  studio_cost       numeric(10,2),         -- what BAM paid (for P&L)
  family_charge     numeric(10,2),         -- what family is billed
  student_ids       uuid[],               -- students who wear this costume
  notes             text,
  created_by        uuid FK users,
  created_at        timestamptz default now()
)

costume_charges (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  costume_id        uuid FK costumes nullable,
  production_id     uuid FK productions,
  family_id         uuid FK families,
  student_id        uuid FK students,
  description       text,                 -- shown on invoice
  amount            numeric(10,2),        -- family_charge or custom override
  amount_override   boolean default false,
  override_reason   text nullable,
  override_by       uuid FK users nullable,
  status            text CHECK IN (
                      'pending_finance_review',
                      'queued',
                      'notification_sent',
                      'charged',
                      'waived',
                      'paid_cash'
                    ),
  payment_method    text CHECK IN ('card','cash','credit','waived'),
  notification_sent_at timestamptz,
  charged_at        timestamptz,
  transaction_id    text nullable,
  marked_paid_by    uuid FK users nullable,
  marked_paid_at    timestamptz nullable,
  notes             text,
  created_by        uuid FK users,
  created_at        timestamptz default now()
)
```

### 6.3 Flat-Per-Student Mode
- Admin enters one amount for the production
- System generates one `costume_charge` per enrolled student
- Any Admin can override individual student amounts
  (for scholarships, adjustments, etc.) with reason logged
- Charges queue for Finance Admin to push

### 6.4 P&L Data
Finance module (future) will use:
- `costumes.studio_cost` — BAM's cost per item
- `costume_charges.amount` — what was charged to family
- Margin per item = `family_charge - studio_cost`
- Roll up per production for costume P&L

Finance Admin and above can view costume cost data.
Parents and teachers cannot see `studio_cost`.

### 6.5 Grouped View
Finance Admin sees costume charges grouped by production:

| Production | Dance | Costume | Studio Cost | Family Charge | Status |
|---|---|---|---|---|---|
| Nutcracker 2026 | Snow Scene | Snowflake Tutu | $65 | $120 | Charged |
| Nutcracker 2026 | Party Scene | Party Dress | $45 | $85 | Queued |

Total per production shows aggregate studio cost, revenue, and margin.

---

## 7. Failed Payment Handling

### 7.1 Retry Logic (Tuition — 15th of month)
1. **Day 0 (15th):** Initial charge attempt
2. **Day 0 fail:** Immediate internal flag to Finance Admin task queue
3. **Day 3:** Auto-retry charge
4. **Day 3 fail:** Email to parent:
   "Your payment of $[X] for [student] was unsuccessful. Please update
   your payment method within 7 days to avoid a disruption to classes."
   + in-app notification + SMS (if enabled)
5. **Day 3–10:** Task remains open in Finance Admin queue
6. **Day 10:** Escalation notification to Studio Admin + Super Admin
7. **Task stays open** until one of the following:
   - Payment succeeds (auto-retry or manual trigger)
   - Finance Admin marks as paid (cash)
   - Finance Admin applies account credit
   - Finance Admin suspends enrollment pending payment
   - Finance Admin writes off the charge (with reason)

### 7.2 Failed Payment Schema Additions
```sql
-- On billing_charges:
retry_count         integer default 0,
last_retry_at       timestamptz,
next_retry_at       timestamptz,
failure_reason      text,
escalated_at        timestamptz,
resolved_at         timestamptz,
resolved_by         uuid FK users,
resolution_method   text CHECK IN (
                      'payment_succeeded','cash_paid','credit_applied',
                      'written_off','enrollment_suspended'
                    ),
```

---

## 8. Account Credit

Families can hold a credit balance on their account.
Credits can be applied to any future charge.

Sources of credit:
- Finance Admin manually applies credit (scholarship, goodwill, etc.)
- Prorated refund in rare Admin-approved cases

```sql
account_credits (
  id              uuid PK,
  tenant_id       uuid FK tenants,
  family_id       uuid FK families,
  amount          numeric(10,2),
  reason          text,
  applied_to_charge_id uuid nullable,   -- if used against a specific charge
  created_by      uuid FK users,
  created_at      timestamptz default now()
)
```

---

## 9. Cash Payment Recording

Any charge (tuition, competition, costume, registration) can be
marked as paid by cash:
- **Who:** Any Admin role
- **Fields logged:** payment_method = 'cash', marked_paid_by, marked_paid_at
- **Effect:** Charge status → 'paid_cash'; removed from outstanding
  balance on family account; no card transaction attempted
- Parent portal shows charge as "Paid" with payment method "Cash"
- Finance Admin sees cash payments separately in billing reports

---

## 10. Billing Charge Master Table

All charge types flow into a single master charges table for
consolidated family account views and Finance reporting:

```sql
billing_charges (
  id                uuid PK,
  tenant_id         uuid FK tenants,
  family_id         uuid FK families,
  student_id        uuid FK students nullable,
  charge_type       text CHECK IN (
                      'registration_fee',
                      'tuition',
                      'tuition_prorated',
                      'unlimited_package',
                      'competition_fee',
                      'costume',
                      'private_lesson',
                      'drop_in',
                      'credit_adjustment',
                      'other'
                    ),
  description       text NOT NULL,
  amount            numeric(10,2) NOT NULL,
  due_date          date,
  billing_period    text nullable,           -- "2026-01" for January tuition
  status            text CHECK IN (
                      'pending',
                      'queued',
                      'notification_sent',
                      'charged',
                      'failed',
                      'paid_cash',
                      'waived',
                      'refunded',
                      'written_off'
                    ),
  payment_method    text CHECK IN ('card','cash','credit','waived') nullable,
  transaction_id    text nullable,
  stripe_payment_intent_id text nullable,
  charged_at        timestamptz nullable,
  retry_count       integer default 0,
  last_retry_at     timestamptz nullable,
  next_retry_at     timestamptz nullable,
  failure_reason    text nullable,
  waived_by         uuid FK users nullable,
  waived_reason     text nullable,
  marked_paid_by    uuid FK users nullable,
  marked_paid_at    timestamptz nullable,
  created_by        uuid FK users,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
)
```

---

## 11. Finance Views (Future P&L Foundation)

The following aggregate views are needed for the Finance module.
Finance Admin and above can access. Teachers and parents cannot.

- **Monthly revenue:** total tuition charged vs. collected by month
- **Outstanding balances:** per family, per class, studio-wide
- **Competition cost report:** entry fees charged vs. collected per competition
- **Costume P&L:** studio cost vs. family charge per production
- **Registration fee revenue:** per school year
- **Cash payment log:** all cash transactions by date
- **Written-off charges:** with reasons and approver

---

## 12. Phase Implementation Order

### Phase 1 — Core Billing
- [ ] billing_charges master table
- [ ] Registration fee charge on enrollment
- [ ] Tuition charge generation on 15th (manual trigger first, then cron)
- [ ] Proration calculation (default: per-class rate)
- [ ] Cash payment marking
- [ ] Family account view: charges, status, balance

### Phase 2 — Competition & Costume
- [ ] Competition charge workflow + 24hr notification
- [ ] Costume charge creation (per-costume and flat modes)
- [ ] Batch notification system for charge pushes
- [ ] Dispute → admin conversation queue

### Phase 3 — Failed Payment & Retry
- [ ] Auto-retry logic (Day 3)
- [ ] Parent email/SMS on failure
- [ ] Admin task queue escalation
- [ ] Finance Admin resolution workflow

### Phase 4 — Finance Reporting
- [ ] Monthly revenue dashboard
- [ ] Outstanding balances view
- [ ] Costume P&L report per production
- [ ] Competition cost report
- [ ] Cash payment audit log
