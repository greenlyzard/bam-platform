# BILLING_AND_CREDITS.md
# Ballet Academy and Movement — Billing & Credits Spec
# Status: Ready to build
# Related: RBAC_AND_PERMISSIONS.md, DATA_MIGRATION.md

---

## 1. Overview

The BAM Platform uses a unified credit-based billing system. Credits are the
universal currency for all class types — seasonal, ongoing, private, and group.
The studio sets a base credit rate (default $1 = 1 credit = 1 minute) which can
be overridden at the session, class, or student level.

Billing supports four models:
1. Credit-based (time × rate ÷ students)
2. Flat fee per student
3. Flat fee per session
4. Credit package purchases (prepaid, discountable)

---

## 2. Credit System

### 2.1 Credit Definition
- 1 credit = 1 minute at the studio's base rate
- Base rate is studio-configurable (default: $1.00 per credit)
- Billing minimum: 15-minute increments (15 credits at base rate)
- Credits are tenant-scoped — credits at one studio cannot be used at another

### 2.2 Credit Accounts
Every student has a credit account (credit_accounts table):
- Balance in credits (not dollars)
- Optional expiry date (null = indefinite)
- Linked to tenant + student

### 2.3 Credit Transactions
Every credit movement is logged:
- purchase (parent buys credits)
- charge (session deducted)
- refund (credits returned)
- adjustment (admin manual correction)
- expiry (credits expired)
- bonus (promotional credits added)

### 2.4 Credit Expiry
- Default: no expiry
- Studio can set global expiry policy (e.g. credits expire 12 months after purchase)
- Can be overridden per credit package or per student
- Expiry runs via nightly cron job
- Parents notified 30 days before expiry via Klaviyo

---

## 3. Database Schema

### 3.1 credit_accounts
```sql
CREATE TABLE credit_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  balance         numeric(10,2) NOT NULL DEFAULT 0,
  lifetime_earned numeric(10,2) NOT NULL DEFAULT 0,
  lifetime_spent  numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, student_id)
);
```

### 3.2 credit_transactions
```sql
CREATE TABLE credit_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  type            text NOT NULL CHECK (type IN (
                    'purchase', 'charge', 'refund', 
                    'adjustment', 'expiry', 'bonus'
                  )),
  credits         numeric(10,2) NOT NULL, -- positive = added, negative = deducted
  balance_after   numeric(10,2) NOT NULL,
  description     text,
  session_id      uuid REFERENCES sessions(id),
  package_id      uuid REFERENCES credit_packages(id),
  invoice_id      uuid REFERENCES invoices(id),
  expires_at      timestamptz,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);
```

### 3.3 credit_packages
```sql
CREATE TABLE credit_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,           -- e.g. "10-Hour Bundle"
  credits         numeric(10,2) NOT NULL,  -- credits included
  price           numeric(10,2) NOT NULL,  -- dollars charged
  discount_pct    numeric(5,2),            -- e.g. 10.00 = 10% off
  is_active       boolean DEFAULT true,
  is_promotion    boolean DEFAULT false,
  promotion_start timestamptz,
  promotion_end   timestamptz,
  expires_after_days integer,              -- null = no expiry
  max_purchases   integer,                 -- null = unlimited
  created_at      timestamptz DEFAULT now()
);
```

### 3.4 sessions
Sessions are the billable unit — one session = one class occurrence or private booking.

```sql
CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  class_id        uuid REFERENCES classes(id),
  session_date    date NOT NULL,
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  duration_minutes integer GENERATED ALWAYS AS (
                    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
                  ) STORED,
  location        text,
  billing_model   text NOT NULL CHECK (billing_model IN (
                    'credit', 'flat_per_student', 'flat_per_session', 'free'
                  )),
  -- Credit billing fields
  hourly_rate     numeric(10,2),           -- studio rate for this session
  credit_rate     numeric(10,2),           -- override credit value (null = use tenant default)
  -- Flat fee fields
  flat_fee        numeric(10,2),           -- used when billing_model = flat_per_student/session
  -- Calculated fields
  num_students    integer,                 -- populated after attendance
  cost_per_student numeric(10,2),          -- calculated
  credits_per_student numeric(10,2),       -- calculated
  notes           text,
  status          text DEFAULT 'scheduled' CHECK (status IN (
                    'scheduled', 'in_progress', 'completed', 'cancelled'
                  )),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### 3.5 session_teachers
Links teachers (including 1099s) to sessions with their rate.

```sql
CREATE TABLE session_teachers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES profiles(id),
  role            text DEFAULT 'primary' CHECK (role IN (
                    'primary', 'assistant', 'guest'
                  )),
  teacher_type    text DEFAULT 'employee' CHECK (teacher_type IN (
                    'employee', '1099'
                  )),
  hourly_rate     numeric(10,2),           -- their pay rate
  billing_target  text DEFAULT 'studio' CHECK (billing_target IN (
                    'studio',    -- studio absorbs cost
                    'session'    -- cost rolled into session total
                  )),
  total_pay       numeric(10,2),           -- calculated at session close
  created_at      timestamptz DEFAULT now()
);
```

### 3.6 session_enrollments
Students attending a session.

```sql
CREATE TABLE session_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES students(id),
  attendance      text DEFAULT 'enrolled' CHECK (attendance IN (
                    'enrolled', 'present', 'absent', 'late', 'excused'
                  )),
  credits_charged numeric(10,2),
  charged_at      timestamptz,
  override_rate   numeric(10,2),           -- per-student rate override
  override_reason text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);
```

### 3.7 invoices
```sql
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  parent_id       uuid NOT NULL REFERENCES profiles(id),
  amount          numeric(10,2) NOT NULL,
  credits_used    numeric(10,2) DEFAULT 0,
  status          text DEFAULT 'draft' CHECK (status IN (
                    'draft', 'sent', 'paid', 'overdue', 'void', 'refunded'
                  )),
  due_date        date,
  paid_at         timestamptz,
  stripe_invoice_id text,
  line_items      jsonb,                   -- array of {description, credits, amount}
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### 3.8 tenant_billing_settings
Studio-wide billing configuration.

```sql
CREATE TABLE tenant_billing_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) UNIQUE,
  credit_rate           numeric(10,2) NOT NULL DEFAULT 1.00, -- $ per credit
  billing_increment_min integer NOT NULL DEFAULT 15,          -- min billable increment
  default_expiry_days   integer,                              -- null = no expiry
  auto_charge           boolean DEFAULT false,                -- charge on session close
  grace_period_days     integer DEFAULT 3,                    -- days before overdue
  late_fee_pct          numeric(5,2),                         -- % late fee
  stripe_account_id     text,
  payment_processor     text DEFAULT 'stripe' CHECK (payment_processor IN (
                          'stripe', 'authorize_net', 'square', 'paypal'
                        )),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
```

---

## 4. Billing Models

### 4.1 Credit Billing (time-based)

**Formula:**
```
session_cost = (hourly_rate × duration_minutes / 60)
               + sum(teacher_costs where billing_target = 'session')

cost_per_student = session_cost / num_attending_students

credits_charged = CEIL(cost_per_student / credit_rate / 15) × 15
                  -- rounds UP to nearest 15-minute increment
```

**Example — private with guest teacher:**
```
Duration: 60 min
Hourly rate: $250
Guest teacher cost billed to session: $0 (billed to studio in this case)
Students: 4
credit_rate: $1.00

cost_per_student = $250 / 4 = $62.50
credits_charged = CEIL(62.50 / 1.00 / 15) × 15 = CEIL(4.167) × 15 = 75 credits
```

**Example — group class:**
```
Duration: 45 min
Hourly rate: $30/student
Students: 8
credit_rate: $1.00

cost_per_student = $30 × (45/60) = $22.50
credits_charged = CEIL(22.50 / 1.00 / 15) × 15 = CEIL(1.5) × 15 = 30 credits
```

### 4.2 Flat Fee Per Student
- Fixed dollar amount per student per session
- Converted to credits at the credit_rate
- Example: $25 flat → 25 credits at $1/credit

### 4.3 Flat Fee Per Session
- Fixed dollar amount for the entire session
- Divided equally by num_students
- Remainder credits distributed to first student or absorbed by studio

### 4.4 Free
- No credits charged
- Used for trial classes, make-up sessions, comped classes

---

## 5. Class Types & Billing Defaults

| Class Type | Default Billing | Season | Notes |
|------------|----------------|--------|-------|
| Seasonal group | credit or flat_per_student | required | Fall, Spring, Summer |
| Ongoing group | credit or flat_per_student | null | Ballet technique, pointe |
| Private | credit | null | One student, ad hoc |
| Semi-private | credit | null | 2–6 students |
| Pilates | credit or flat | null | Ongoing |
| Gyrotonic | credit or flat | null | Ongoing |
| Personal Training | credit or flat | null | Ongoing |
| Trial class | free | null | First visit |
| Make-up | free | null | Missed class |

Ongoing classes (season_id = null) bill month-to-month or per-session
depending on the billing_model set on the class.

---

## 6. 1099 Teacher Billing

Guest/1099 teachers have two billing targets:

**billing_target = 'studio'**
- Their cost is absorbed by the studio
- Does not affect what students are charged
- Tracked for studio payroll/accounting purposes

**billing_target = 'session'**
- Their hourly rate is added to the session total
- Increases cost_per_student proportionally
- Used when client is paying for specialist directly

Studio sets default billing_target per teacher in teacher settings.
Can be overridden per session.

---

## 7. Credit Packages & Promotions

### Package Purchase Flow
1. Parent sees available packages on /portal/billing
2. Selects package → Stripe checkout
3. On payment success: credit_transactions row inserted (type='purchase')
4. credit_accounts balance updated
5. Confirmation email via Resend
6. Klaviyo event fired for purchase tracking

### Promotion Rules
- Promotions have start/end dates
- Can set max_purchases limit (e.g. "first 20 buyers")
- Discount shown clearly: "Save 15% — Limited Time"
- Expired promotions auto-hide from portal

### Example Packages
| Name | Credits | Price | Discount |
|------|---------|-------|----------|
| Starter Pack | 300 | $285 | 5% |
| 10-Hour Bundle | 600 | $540 | 10% |
| 20-Hour Bundle | 1200 | $1,020 | 15% |
| Unlimited Month | 2000 | $199 | — |

---

## 8. Billing Workflow

### Session Billing Flow
1. Session is scheduled (status = 'scheduled')
2. Students enrolled via session_enrollments
3. Session occurs — attendance marked
4. Admin closes session (status = 'completed')
5. System calculates cost_per_student based on billing_model
6. For each present/late student:
   - Check credit_accounts balance
   - If sufficient: deduct credits, log transaction
   - If insufficient: create invoice for difference, notify parent
7. Session summary sent to admin
8. Optional: auto-charge if tenant setting auto_charge = true

### Insufficient Credits Flow
1. Student has 20 credits, session costs 30 credits
2. System deducts 20 (balance → 0)
3. Creates invoice for 10 credits ($10 at base rate)
4. Parent notified via email + Angelina chat
5. Invoice due in grace_period_days
6. If unpaid: status → 'overdue', optional late_fee applied

---

## 9. Admin Billing UI

### /admin/billing
- Overview: total outstanding, overdue count, credits sold this month
- Student billing table: name, balance, last charge, outstanding
- Quick actions: add credits, create invoice, mark paid

### /admin/billing/packages
- Manage credit packages
- Create/edit/deactivate packages
- Run promotions with date range

### /admin/billing/sessions/[id]
- Session billing detail
- Override individual student rates
- Apply comps or adjustments
- Close session and trigger billing

### /admin/billing/reports
- Revenue by month
- Credits sold vs redeemed
- Outstanding by parent
- 1099 teacher cost report
- Export to CSV

---

## 10. Parent Billing Portal

### /portal/billing
- Credit balance (prominent display)
- Buy credits → package selector → Stripe checkout
- Transaction history
- Outstanding invoices
- Upcoming session costs (estimated)
- Auto-pay toggle (charges saved card when balance runs low)

---

## 11. Rate Override Hierarchy

Rates are resolved in this priority order (highest wins):

1. session_enrollments.override_rate (per student per session)
2. sessions.credit_rate (per session override)
3. classes.default_credit_rate (per class default)
4. tenant_billing_settings.credit_rate (studio default)

---

## 12. Acceptance Criteria

1. Studio can set base credit rate and billing increment in settings
2. Session cost calculates correctly for all four billing models
3. 1099 teacher cost routes correctly to studio or session
4. Credits deduct from student account on session close
5. Insufficient balance creates invoice automatically
6. Parent can purchase credit package via Stripe
7. Promotions activate/deactivate by date automatically
8. Credit expiry cron runs nightly and notifies parents 30 days prior
9. Admin can override rate per student per session with reason
10. All transactions are logged with balance_after for audit trail
11. Multi-tenant: rates, packages, and settings are fully tenant-scoped
