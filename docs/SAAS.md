# BAM Platform — SaaS Architecture & White-Label System

## Vision

BAM Platform begins as the internal operating system for Ballet Academy and Movement.
Once stable, it becomes a licensable SaaS product for serious classical dance studios nationwide.

**Target SaaS customer:** Boutique classical ballet schools (20–200 students)
who are outgrowing Dance Studio Pro / Jackrabbit but don't want enterprise pricing.

**Pricing model (estimated):**
| Tier | Students | Monthly | Annual |
|------|----------|---------|--------|
| Studio | 0–75 | $149 | $1,490 |
| Academy | 76–150 | $249 | $2,490 |
| Conservatory | 151–300 | $399 | $3,990 |
| Enterprise | 300+ | Custom | Custom |

BAM itself will be on the Conservatory tier (internal).

---

## Multi-Tenant Architecture

### Model: Database Silo (One Supabase Project Per Studio)

Each studio client gets their own isolated Supabase project.
No data ever crosses tenant boundaries.

```
bam-platform-prod-bam          ← Ballet Academy and Movement (tenant 1)
bam-platform-prod-[studio2]    ← Future tenant
bam-platform-prod-[studio3]    ← Future tenant
```

### Why Silo (Not Schema or Row-Level)
- Full data isolation — no risk of cross-tenant data leaks
- Easier GDPR/COPPA compliance per tenant
- Each studio can be on different Supabase compute tier
- Supabase Management API supports programmatic provisioning
- Simpler RLS — no tenant_id column everywhere

### Provisioning Flow (New Studio Onboarding)

```typescript
// Called from /api/admin/provision-tenant
async function provisionTenant(studio: NewStudioInput) {
  // 1. Create Supabase project via Management API
  const project = await supabaseManagement.createProject({
    name: `bam-platform-prod-${studio.slug}`,
    region: 'us-west-1',
    plan: 'free', // upgrade later
    db_pass: generateSecurePassword(),
  })

  // 2. Run migrations against new project
  await runMigrations(project.db_url, './supabase/migrations')

  // 3. Seed default data (class levels, badge templates, email templates, staff library folders)
  await seedDefaults(project.db_url, studio)

  // 4. Store connection string + project ID in master registry
  await masterDb.studios.create({
    slug: studio.slug,
    supabase_project_id: project.id,
    supabase_url: project.url,
    supabase_anon_key: project.anon_key,
    supabase_service_role_key: project.service_role_key, // encrypted
    created_at: new Date(),
    plan: 'studio',
    status: 'provisioning',
  })

  // 5. Set up custom domain (optional — Vercel API)
  if (studio.custom_domain) {
    await vercel.addDomain(`portal.${studio.custom_domain}`)
  }

  // 6. Configure Resend sending domain
  await resend.domains.create({ name: studio.email_domain })

  // 7. Send onboarding email to studio owner
  await sendOnboardingEmail(studio)

  // 8. Mark provisioning complete
  await masterDb.studios.update(studio.slug, { status: 'active' })
}
```

---

## Tenant Configuration Schema

Each studio has a config stored in master DB (not per-tenant DB):

```sql
create table studios (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  display_name text not null,
  subdomain text unique,
  custom_domain text,
  
  -- Database connection
  supabase_project_id text,
  supabase_url text,
  supabase_anon_key text,
  supabase_service_role_key text,       -- Encrypted at rest
  
  -- Brand
  primary_color text default '#9C8BBF',
  secondary_color text default '#C9A84C',
  logo_url text,
  favicon_url text,
  
  -- Plan
  plan text default 'studio',
  max_students int default 75,
  
  -- Integrations (nullable = not configured)
  stripe_account_id text,
  klaviyo_api_key text,
  resend_api_key text,
  cloudflare_account_id text,
  cloudflare_stream_token text,
  google_analytics_id text,
  
  -- Features (per-tenant feature flags)
  feature_lms boolean default true,
  feature_streaming boolean default true,
  feature_shop boolean default true,
  feature_competitions boolean default false,
  feature_multi_location boolean default false,
  feature_lobby_display boolean default true,    -- /display/schedule route
  feature_staff_library boolean default true,    -- Staff Resource Library
  
  -- Status
  status text default 'provisioning',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## Payment Processor Plugin Architecture

### Abstract Interface

```typescript
interface PaymentService {
  createCustomer(params: CreateCustomerParams): Promise<Customer>
  createSubscription(params: SubscriptionParams): Promise<Subscription>
  processPayment(params: PaymentParams): Promise<PaymentResult>
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>
  getPaymentHistory(customerId: string): Promise<Payment[]>
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>
}
```

### Adapter Implementations

```typescript
class StripeAdapter implements PaymentService { ... }
class SquareAdapter implements PaymentService { ... }
class AuthorizeNetAdapter implements PaymentService { ... }
```

### Factory (Tenant-Aware)

```typescript
function getPaymentService(tenantConfig: TenantConfig): PaymentService {
  switch (tenantConfig.payment_processor) {
    case 'stripe': return new StripeAdapter(tenantConfig.stripe_secret_key)
    case 'square': return new SquareAdapter(tenantConfig.square_access_token)
    case 'authorize_net': return new AuthorizeNetAdapter(...)
    default: throw new Error(`Unknown processor: ${tenantConfig.payment_processor}`)
  }
}
```

---

## Tenant Resolution (Request Routing)

Every request must resolve to the correct tenant's database.

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const tenant = await resolveTenant(hostname)
  if (!tenant) return NextResponse.redirect('https://balletplatform.com')
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenant.id)
  response.headers.set('x-tenant-slug', tenant.slug)
  return response
}
```

---

## Concierge Onboarding / Import Wizard ← NEW

**Why this matters:** Dance Master Pro's strongest competitive differentiator in the onboarding category is their concierge setup service — clients email their Excel files and DMP configures the entire platform for them. Studios will not manually re-enter years of student, enrollment, and class data. This is a prerequisite for BAM Platform to acquire and retain SaaS tenants at scale.

### Two-Tier Approach

**Tier 1 — Self-Service Import Wizard (Phase 2)**
A guided import UI that accepts common export formats and maps them to BAM's schema with intelligent column matching.

**Tier 2 — White-Glove Concierge Service (Phase 3+)**
Green Lyzard staff (or an outsourced ops team) handles the full data migration on behalf of the new studio. Same approach as DMP. Studio emails their files → we configure everything → studio launches.

### Self-Service Import Wizard — Supported Sources

| Source | Format | Coverage |
|---|---|---|
| Dance Studio Pro (Studio Pro) | CSV export | Students, families, enrollments, class schedule |
| Jackrabbit | CSV export | Students, families, enrollments |
| The Studio Director | CSV export | Students, classes |
| Generic Excel | .xlsx | Any flat table with column mapping |

### Import Flow (Self-Service)

```
Step 1 — Upload
Admin uploads CSV or Excel from their current system.
Supported: .csv, .xlsx, .xls

Step 2 — Source Detection
System auto-detects the source (Dance Studio Pro has a known column structure).
If unrecognized: manual column mapping UI.

Step 3 — Column Mapping
Side-by-side preview: source columns on left, BAM schema fields on right.
AI suggests mappings (confidence score shown).
Admin confirms or adjusts.

Step 4 — Data Preview & Validation
First 20 rows shown with validation errors highlighted.
Errors: missing required fields, duplicate students, invalid date formats.
Admin fixes errors or marks rows to skip.

Step 5 — Import Options
□ Import students and families
□ Import class schedule
□ Import enrollments
□ Import attendance history (if available)
□ Send welcome emails after import (default: off — admin triggers manually)

Step 6 — Execute
Background job runs import.
Progress bar with row count.
Error log downloadable at completion.

Step 7 — Review
Summary: X students imported, X families created, X enrollments added, X errors skipped.
Link to review imported students in admin directory.
```

### Dance Studio Pro Import — Specific Mapping

DSP exports are the most common migration source (BAM is replacing DSP internally). Known column mappings:

| DSP Column | BAM Field | Table |
|---|---|---|
| First Name | first_name | students |
| Last Name | last_name | students |
| Birth Date | date_of_birth | students |
| Parent First Name | first_name | profiles |
| Parent Last Name | last_name | profiles |
| Parent Email | email | profiles |
| Parent Phone | phone | profiles |
| Class Name | name | classes |
| Class Day | day_of_week | classes |
| Class Time | start_time | classes |
| Enrollment Status | status | enrollments |

### Database Schema — Import Jobs

```sql
CREATE TABLE IF NOT EXISTS import_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  source          text NOT NULL CHECK (source IN ('dance_studio_pro','jackrabbit','studio_director','generic')),
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','complete','failed')),
  file_url        text NOT NULL,      -- uploaded file in Supabase Storage
  column_mapping  jsonb,              -- confirmed mapping from step 3
  import_options  jsonb,              -- step 5 selections
  stats           jsonb DEFAULT '{}', -- rows imported, errors, skipped
  error_log_url   text,               -- downloadable error CSV
  started_at      timestamptz,
  completed_at    timestamptz,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);
```

### Phase Schedule

| Phase | Item | Priority |
|---|---|---|
| P3 | Dance Studio Pro CSV import (students + families + enrollments) | HIGH for BAM internally |
| P3 | Generic Excel import with column mapping | HIGH for SaaS launch |
| P4 | Jackrabbit + Studio Director import | MEDIUM |
| P4 | Concierge service offering (ops workflow + pricing) | HIGH for SaaS growth |

---

## Integration Testing Pipeline

### GitHub Actions — Daily Synthetic Monitor

```yaml
name: Integration Health Check
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  test-bam:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests against BAM staging
        env:
          TEST_TENANT: bam
          TEST_BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_STRIPE_KEY: ${{ secrets.STRIPE_TEST_KEY }}
          TEST_KLAVIYO_KEY: ${{ secrets.KLAVIYO_TEST_KEY }}
        run: npm run test:integration
      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text":"⚠️ BAM Platform integration tests failed"}'
          webhook: ${{ secrets.SLACK_WEBHOOK }}
```

---

## White-Label Studio Onboarding Wizard

### 5-Step Wizard Flow

**Step 1:** Studio Basics (name, address, phone, email, primary contact)

**Step 2:** Brand (logo, primary color, subdomain or custom domain)

**Step 3:** Programs (disciplines offered, age ranges per level — defaults seeded from BAM curriculum)

**Step 4:** Integrations (Stripe Connect, Klaviyo API key, Google Analytics, Cloudflare)

**Step 5:** Launch + optional data import (links to Import Wizard if migrating from another system)

---

## SaaS Roadmap (Post-BAM Launch)

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| 0 | Now | BAM internal platform fully live |
| 1 | Month 6 | SaaS infrastructure + tenant provisioning |
| 2 | Month 9 | Onboarding wizard + DSP import wizard + first external beta studio |
| 3 | Month 12 | 5 paying studios, pricing validated, concierge import service live |
| 4 | Month 18 | 20+ studios, support team, status page |
| 5 | Month 24 | Mobile app (React Native) |
| 6 | Month 30 | Enterprise tier (multi-location chains) |
