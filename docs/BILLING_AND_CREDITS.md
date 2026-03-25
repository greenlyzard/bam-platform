# BILLING_AND_CREDITS.md
# Ballet Academy and Movement — Billing Engine & Credits Spec
# Version: 2.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Updated: March 2026 — merged BILLING.md + BILLING_AND_CREDITS.md

---

## 1. Overview

Billing at BAM operates in two complementary layers:

**Layer 1 — Credit/Point System**
Handles per-class, drop-in, bundle, private, and Pilates billing. Credits
are the universal currency. Each class has a configurable point cost.
Bundles are punch cards denominated in points. Monthly subscriptions
(unlimited plans) are also tracked here.

**Layer 2 — Billing Charges Master Table**
Handles tuition (monthly recurring), registration fees, competition
charges, and costume charges. These are dollar-denominated charges
that flow through Stripe (or the configured payment adapter).

Both layers coexist. A student can simultaneously have:
- A bundle credit balance (Layer 1) for Pilates/privates
- A monthly tuition charge (Layer 2) for a seasonal class
- A competition charge pending (Layer 2)

All payment processing routes through the pluggable payment adapter
(`src/lib/payments/adapter.ts`). No direct Stripe calls anywhere.

Cross-references:
- INTEGRATIONS.md — Stripe/PayPal/Authorize.net adapter
- REGISTRATION_AND_ONBOARDING.md — registration fee, enrollment events
- SCHEDULING_AND_LMS.md — class point_cost, trial eligibility, bundles
- SAAS.md — multi-tenant payment config

---

## 2. Layer 1 — Credit / Point System

### 2.1 Credit Definition
- 1 credit = 1 point at the studio's base rate (default $1.00 per credit)
- Base rate is studio-configurable in Admin Settings → Billing
- Each class has a `point_cost` field (default: 1)
  - Standard group class: 1 point
  - Pilates: 2 points (configurable)
  - Private with standard teacher: 2 points (configurable)
  - Private with senior/specialist teacher: 3 points (configurable)
- Billing minimum: 15-minute increments for private/time-based billing
- Credits are tenant-scoped — credits at one studio cannot be used at another

### 2.2 Billing Plan Types

| Plan Type | Description | Upgrade Path |
|---|---|---|
| `per_class` | Drop-in; charged per enrollment at class point_cost | Can upgrade to bundle or unlimited |
| `bundle` | Pre-purchased point pack (punch card); deducts points per enrollment | Can upgrade to unlimited |
| `unlimited` | Monthly subscription; covers unlimited classes in scope | — |
| `comp` | No charge; admin-granted | — |
| `staff` | No charge; teacher/staff enrollment | — |

**Upgrade path:** A student can start per_class, purchase a bundle,
and later upgrade to unlimited — all mid-season. The system tracks
which plan covers each enrollment. Admin manages upgrades.

### 2.3 Unlimited Plan Scope
The unlimited plan covers classes within a configurable scope:
- `all` — all classes at the studio
- `discipline` — e.g., all ballet classes only
- `level_range` — e.g., Level 2A through Level 4C

Scope is set per plan when Admin assigns it to a student.
A student on unlimited for ballet still pays per_class for Pilates
unless their plan scope includes Pilates.

### 2.4 Credit Accounts
Every student has a credit account:

```sql
CREATE TABLE credit_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  balance         NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_spent  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, student_id)
);
```

### 2.5 Credit Transactions
Every credit movement is logged with full audit trail:

```sql
CREATE TABLE credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  type            TEXT NOT NULL CHECK (type IN (
                    'purchase',     -- parent buys a bundle/pack
                    'charge',       -- enrollment deducts points
                    'refund',       -- points returned on drop/cancel
                    'adjustment',   -- admin manual correction
                    'expiry',       -- points expired by cron
                    'bonus'         -- promotional points added
                  )),
  credits         NUMERIC(10,2) NOT NULL, -- positive = added, negative = deducted
  balance_after   NUMERIC(10,2) NOT NULL,
  description     TEXT,
  enrollment_id   UUID REFERENCES enrollments(id),
  package_id      UUID REFERENCES credit_packages(id),
  invoice_id      UUID REFERENCES invoices(id),
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 2.6 Credit Packages (Bundles / Punch Cards)
Admin creates packages with a point balance and a price:

```sql
CREATE TABLE credit_packages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  name                TEXT NOT NULL,           -- e.g. "10-Class Pilates Pack"
  credits             NUMERIC(10,2) NOT NULL,  -- points included
  price               NUMERIC(10,2) NOT NULL,  -- dollars charged
  discount_pct        NUMERIC(5,2),            -- e.g. 10.00 = 10% off
  applicable_to       TEXT DEFAULT 'all' CHECK (applicable_to IN (
                        'all', 'pilates', 'privates', 'specific_classes'
                      )),
  applicable_class_ids UUID[],                 -- if applicable_to = specific_classes
  is_active           BOOLEAN DEFAULT true,
  is_promotion        BOOLEAN DEFAULT false,
  promotion_start     TIMESTAMPTZ,
  promotion_end       TIMESTAMPTZ,
  expires_after_days  INTEGER,                 -- null = no expiry
  max_purchases       INTEGER,                 -- null = unlimited
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

**Example packages:**
| Name | Points | Price | Point Cost Per Use |
|---|---|---|---|
| Pilates 5-Pack | 10 | $95 | 2 pts per Pilates session |
| Pilates 10-Pack | 20 | $180 | 2 pts per Pilates session |
| Private 5-Pack | 10 | $250 | 2 pts standard / 3 pts senior |
| Sampler Bundle | 6 | $60 | 1 pt per class |

### 2.7 Unlimited Plans (Subscription)

```sql
CREATE TABLE unlimited_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  plan_name       TEXT NOT NULL,               -- "Unlimited Ballet Monthly"
  scope           TEXT NOT NULL DEFAULT 'all' CHECK (scope IN (
                    'all', 'discipline', 'level_range'
                  )),
  scope_discipline TEXT,                        -- if scope = discipline
  scope_level_min  TEXT,                        -- if scope = level_range
  scope_level_max  TEXT,                        -- if scope = level_range
  monthly_price   NUMERIC(10,2) NOT NULL,
  billing_day     INTEGER DEFAULT 15,           -- day of month to charge
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'paused', 'cancelled'
                  )),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 2.8 Billing Plan Check (Enrollment Flow)
When enrolling a student (admin or parent portal), the system checks in order:

1. Does student have an active `unlimited_plan` that covers this class? → Enroll, no charge
2. Does student have a `credit_account` balance ≥ class `point_cost`? → Deduct credits, enroll
3. Otherwise → require payment (Stripe checkout or admin override)

### 2.9 Insufficient Credits Flow
1. Student has 1 credit, class costs 2 credits
2. System shows: "Insufficient credits. Purchase a pack or pay per class."
3. Options shown: buy a bundle pack | pay per-class rate | admin override (admin only)
4. If admin overrides: enrollment created, invoice generated for difference
5. Parent notified via email + Angelina

### 2.10 Credit Expiry
- Default: no expiry
- Studio can set global expiry policy (e.g. expire 12 months after purchase)
- Override per package or per student
- Expiry runs via nightly cron
- Parents notified 30 days before expiry via Klaviyo

---

## 3. Layer 2 — Billing Charges Master Table

All dollar-denominated charges (tuition, registration, competition, costume)
flow into a single master charges table for consolidated family account views
and Finance reporting.

### 3.1 Charge Types

| Charge Type | Trigger | Who Approves | Timing |
|---|---|---|---|
| Registration fee | Enrollment confirmation | Auto (or waived by Admin+) | At enrollment |
| Monthly tuition | Active enrollment | Auto | 15th of each month |
| Prorated tuition | Mid-month enrollment | Auto (method configurable) | At enrollment |
| Unlimited plan | Active subscription | Auto | 15th of each month |
| Competition fee | Amanda confirms student | Finance Admin queues | On Finance Admin trigger |
| Costume charge | Admin creates charge | Finance Admin queues | On Finance Admin trigger |
| Private lesson (flat) | Teacher confirms session | Finance Admin reviews | Batched monthly |
| Credit adjustment | Admin applies credit | Finance Admin or above | Immediate |
| Cash payment record | Admin marks paid | Any Admin | Manual, immediate |

### 3.2 Master Charges Table

```sql
CREATE TABLE billing_charges (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  family_id                 UUID NOT NULL REFERENCES families(id),
  student_id                UUID REFERENCES students(id),
  charge_type               TEXT NOT NULL CHECK (charge_type IN (
                              'registration_fee',
                              'tuition',
                              'tuition_prorated',
                              'unlimited_plan',
                              'competition_fee',
                              'costume',
                              'private_lesson',
                              'drop_in',
                              'credit_adjustment',
                              'other'
                            )),
  description               TEXT NOT NULL,
  amount                    NUMERIC(10,2) NOT NULL,
  due_date                  DATE,
  billing_period            TEXT,              -- "2026-01" for January tuition
  status                    TEXT NOT NULL CHECK (status IN (
                              'pending',
                              'queued',
                              'notification_sent',
                              'charged',
                              'failed',
                              'paid_cash',
                              'waived',
                              'refunded',
                              'written_off'
                            )),
  payment_method            TEXT CHECK (payment_method IN (
                              'card', 'cash', 'credit', 'waived'
                            )),
  transaction_id            TEXT,
  stripe_payment_intent_id  TEXT,
  charged_at                TIMESTAMPTZ,
  retry_count               INTEGER DEFAULT 0,
  last_retry_at             TIMESTAMPTZ,
  next_retry_at             TIMESTAMPTZ,
  failure_reason            TEXT,
  escalated_at              TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,
  resolved_by               UUID REFERENCES profiles(id),
  resolution_method         TEXT CHECK (resolution_method IN (
                              'payment_succeeded', 'cash_paid', 'credit_applied',
                              'written_off', 'enrollment_suspended'
                            )),
  waived_by                 UUID REFERENCES profiles(id),
  waived_reason             TEXT,
  marked_paid_by            UUID REFERENCES profiles(id),
  marked_paid_at            TIMESTAMPTZ,
  created_by                UUID REFERENCES profiles(id),
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Registration Fee

- Due at enrollment confirmation
- Amount configured per class or globally in Admin Settings → Billing
- **Waiver:** Any Admin role can waive with a required reason (logged)
- **Earlybird discount:** applied automatically if within earlybird window
- Registration fee is non-refundable unless overridden by Finance Admin+

```sql
CREATE TABLE registration_fees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  class_id    UUID REFERENCES classes(id),   -- null = global default
  amount      NUMERIC(10,2) NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Monthly Tuition

### 5.1 Billing Cycle
- Runs on the **15th of each month**
- Applies to all students with `enrollments.status = 'active'`
- One charge per class per student
- Family account receives one consolidated invoice

### 5.2 Proration Methods

| Method | Description |
|---|---|
| `per_class` (default) | Remaining sessions ÷ total sessions × monthly tuition |
| `daily` | Remaining days ÷ 30 × monthly tuition |
| `split` | Before 15th = full month; on/after 15th = half month |
| `custom` | Finance Admin enters amount manually with reason |
| `none` | No proration — full month charged regardless |

Finance Admin and above can manually override prorated amount with reason logged.

```sql
-- Additional columns on enrollments table:
proration_method      TEXT CHECK (proration_method IN (
                        'per_class', 'daily', 'split', 'custom', 'none'
                      )),
prorated_amount       NUMERIC(10,2),
proration_override    BOOLEAN DEFAULT false,
proration_override_by UUID REFERENCES profiles(id),
proration_override_reason TEXT,
```

### 5.3 Tuition Rates

```sql
CREATE TABLE tuition_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  class_id    UUID REFERENCES classes(id),   -- null = applies to all
  rate_type   TEXT NOT NULL CHECK (rate_type IN (
                'per_class_monthly',
                'unlimited_season',
                'drop_in',
                'custom'
              )),
  amount      NUMERIC(10,2) NOT NULL,
  season      TEXT,                           -- "Fall 2025", "Spring 2026"
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Competition Charges

### 6.1 Workflow
1. Amanda confirms a student for a competition entry
2. Charge created with `status = 'pending_finance_review'`
3. Finance Admin reviews in Admin → Billing → Competition Charges
4. Finance Admin approves and sends batch notification to families
5. **24-hour window:** parent can respond "Do not charge"
6. If no response: charge fires automatically after 24 hours
7. Dispute → conversation queued in Admin inbox tagged `competition_charge_dispute`
8. Admin resolves: approve / adjust / remove student / switch payment / cash / credit

### 6.2 Competition Charge Schema

```sql
CREATE TABLE competition_charges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id),
  competition_entry_id    UUID REFERENCES competition_entries(id),
  family_id               UUID NOT NULL REFERENCES families(id),
  student_id              UUID NOT NULL REFERENCES students(id),
  description             TEXT,
  amount                  NUMERIC(10,2),
  status                  TEXT NOT NULL CHECK (status IN (
                            'pending_finance_review', 'approved',
                            'notification_sent', 'charged',
                            'disputed', 'waived', 'paid_cash'
                          )),
  payment_method          TEXT CHECK (payment_method IN (
                            'card', 'cash', 'credit', 'waived'
                          )),
  notification_sent_at    TIMESTAMPTZ,
  charge_after            TIMESTAMPTZ,   -- 24hrs after notification
  charged_at              TIMESTAMPTZ,
  transaction_id          TEXT,
  dispute_conversation_id UUID,
  marked_paid_by          UUID REFERENCES profiles(id),
  marked_paid_at          TIMESTAMPTZ,
  finance_approved_by     UUID REFERENCES profiles(id),
  finance_approved_at     TIMESTAMPTZ,
  notes                   TEXT,
  created_by              UUID REFERENCES profiles(id),
  created_at              TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. Costume Charges

### 7.1 Billing Modes (Per Production)
- `per_costume` — individual charge per costume item per student
- `flat_per_student` — one charge per student for the entire production

### 7.2 Schema

```sql
CREATE TABLE costumes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  production_id   UUID NOT NULL REFERENCES productions(id),
  dance_title     TEXT,
  item_name       TEXT NOT NULL,
  description     TEXT,
  studio_cost     NUMERIC(10,2),    -- BAM's cost (for P&L, hidden from parents)
  family_charge   NUMERIC(10,2),    -- amount billed to family
  student_ids     UUID[],
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE costume_charges (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  costume_id          UUID REFERENCES costumes(id),
  production_id       UUID NOT NULL REFERENCES productions(id),
  family_id           UUID NOT NULL REFERENCES families(id),
  student_id          UUID NOT NULL REFERENCES students(id),
  description         TEXT,
  amount              NUMERIC(10,2),
  amount_override     BOOLEAN DEFAULT false,
  override_reason     TEXT,
  override_by         UUID REFERENCES profiles(id),
  status              TEXT NOT NULL CHECK (status IN (
                        'pending_finance_review', 'queued',
                        'notification_sent', 'charged', 'waived', 'paid_cash'
                      )),
  payment_method      TEXT CHECK (payment_method IN (
                        'card', 'cash', 'credit', 'waived'
                      )),
  notification_sent_at TIMESTAMPTZ,
  charged_at          TIMESTAMPTZ,
  transaction_id      TEXT,
  marked_paid_by      UUID REFERENCES profiles(id),
  marked_paid_at      TIMESTAMPTZ,
  notes               TEXT,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

### 7.3 P&L Data
Finance Admin and above can see `studio_cost` vs `family_charge` per costume.
Parents and teachers cannot see `studio_cost`.

---

## 8. Failed Payment Handling

### 8.1 Retry Logic (Tuition — 15th of month)

| Day | Action |
|---|---|
| Day 0 (15th) | Initial charge attempt |
| Day 0 fail | Internal flag to Finance Admin task queue |
| Day 3 | Auto-retry charge |
| Day 3 fail | Email + SMS to parent; task stays open |
| Day 10 | Escalation to Studio Admin + Super Admin |

Task stays open until: payment succeeds / cash marked / credit applied / enrollment suspended / written off.

### 8.2 Admin Resolution Options
- Payment succeeded (auto or manual retry)
- Mark as paid (cash)
- Apply account credit
- Suspend enrollment pending payment
- Write off (with required reason)

---

## 9. Account Credit

```sql
CREATE TABLE account_credits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  family_id             UUID NOT NULL REFERENCES families(id),
  amount                NUMERIC(10,2) NOT NULL,
  reason                TEXT,
  applied_to_charge_id  UUID REFERENCES billing_charges(id),
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

Sources: Finance Admin manual credit, prorated refund (Finance Admin approved), promotional credits.

---

## 10. Cash Payment Recording

Any charge can be marked as paid by cash:
- **Who:** Any Admin role
- **Fields:** `payment_method = 'cash'`, `marked_paid_by`, `marked_paid_at`
- **Effect:** Charge status → `paid_cash`; removed from outstanding balance
- Parent portal shows "Paid — Cash"
- Finance Admin sees cash payments separately in billing reports

---

## 11. Invoices

```sql
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  student_id        UUID NOT NULL REFERENCES students(id),
  family_id         UUID NOT NULL REFERENCES families(id),
  amount            NUMERIC(10,2) NOT NULL,
  credits_used      NUMERIC(10,2) DEFAULT 0,
  status            TEXT DEFAULT 'draft' CHECK (status IN (
                      'draft', 'sent', 'paid', 'overdue', 'void', 'refunded'
                    )),
  due_date          DATE,
  paid_at           TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  line_items        JSONB,   -- [{description, credits, amount}]
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## 12. Tenant Billing Settings

```sql
CREATE TABLE tenant_billing_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  credit_rate           NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  billing_increment_min INTEGER NOT NULL DEFAULT 15,
  default_expiry_days   INTEGER,              -- null = no expiry
  auto_charge           BOOLEAN DEFAULT false,
  grace_period_days     INTEGER DEFAULT 3,
  late_fee_pct          NUMERIC(5,2),
  stripe_account_id     TEXT,
  payment_processor     TEXT DEFAULT 'stripe' CHECK (payment_processor IN (
                          'stripe', 'authorize_net', 'square', 'paypal'
                        )),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

---

## 13. Rate Override Hierarchy (Credit Billing)

Rates are resolved in this priority order (highest wins):

1. Per-student per-session override (admin manual)
2. Per-class `point_cost` override (admin per-class setting)
3. Tenant default `credit_rate` (studio-wide)

---

## 14. Admin Billing UI

### /admin/billing
- Overview: total outstanding, overdue count, credits sold this month
- Student billing table: name, balance, last charge, outstanding
- Quick actions: add credits, create invoice, mark paid

### /admin/billing/packages
- Manage credit packages
- Create/edit/deactivate packages
- Run promotions with date range and max redemptions

### /admin/billing/unlimited
- Manage unlimited plan subscriptions per student
- Assign, pause, cancel plans
- View scope per plan

### /admin/billing/competition-charges
- Review queue of pending competition charges
- Batch approve and send notifications
- Dispute resolution queue

### /admin/billing/costume-charges
- Costume charge management per production
- P&L view (studio cost vs family charge) — Finance Admin only

### /admin/billing/reports
- Monthly revenue by charge type
- Credits sold vs redeemed
- Outstanding balances by family
- Cash payment audit log
- Written-off charges with reasons and approver
- Export to CSV

---

## 15. Parent Billing Portal

### /portal/billing
- Credit balance (prominent)
- Available bundle packages → Stripe checkout
- Transaction history (credits and dollar charges)
- Outstanding invoices
- Auto-pay toggle
- Unlimited plan status (if active)

---

## 16. Finance Views (P&L Foundation)

Finance Admin and above only:
- Monthly revenue: charged vs collected by charge type
- Outstanding balances: per family, per class, studio-wide
- Competition P&L: fees charged vs collected per competition
- Costume P&L: studio cost vs family charge per production
- Registration fee revenue: per school year
- Cash payment log by date
- Written-off charges with reasons

---

## 17. Phase Implementation Order

### Phase 1 — Core Billing (Build now)
- [ ] billing_charges master table
- [ ] credit_accounts and credit_transactions tables
- [ ] credit_packages table
- [ ] Registration fee charge on enrollment
- [ ] Admin "Add to Class" flow with billing plan check
- [ ] Cash payment marking
- [ ] Family account view: charges, credits, balance

### Phase 2 — Bundles & Unlimited
- [ ] unlimited_plans table and assignment UI
- [ ] Billing plan check at enrollment (Layer 1 priority)
- [ ] Bundle purchase flow via Stripe
- [ ] Auto-deduct credits on enrollment
- [ ] Insufficient credits flow → invoice

### Phase 3 — Tuition & Proration
- [ ] Monthly tuition charge generation on 15th (manual first, then cron)
- [ ] Proration calculation (default: per-class rate)
- [ ] Failed payment retry logic + admin task queue

### Phase 4 — Competition & Costume
- [ ] Competition charge workflow + 24hr notification
- [ ] Costume charge creation (per-costume and flat modes)
- [ ] Batch notification system
- [ ] Dispute → admin inbox queue

### Phase 5 — Finance Reporting
- [ ] P&L dashboard
- [ ] Outstanding balances view
- [ ] Costume P&L per production
- [ ] Cash and write-off audit logs
