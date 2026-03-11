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

  // 3. Seed default data (class levels, badge templates, email templates)
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
  slug text unique not null,           -- 'bam', 'pacific-ballet', etc.
  name text not null,                   -- "Ballet Academy and Movement"
  display_name text not null,           -- May differ for white-label
  subdomain text unique,                -- portal.balletacademyandmovement.com
  custom_domain text,                   -- If they have own domain
  
  -- Database connection
  supabase_project_id text,
  supabase_url text,
  supabase_anon_key text,
  supabase_service_role_key text,       -- Encrypted at rest
  
  -- Brand
  primary_color text default '#9C8BBF', -- Lavender (BAM default)
  secondary_color text default '#C9A84C',
  logo_url text,
  favicon_url text,
  
  -- Plan
  plan text default 'studio',           -- 'studio' | 'academy' | 'conservatory' | 'enterprise'
  max_students int default 75,
  
  -- Integrations (nullable = not configured)
  stripe_account_id text,               -- Their Stripe Connect account
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
  
  -- Status
  status text default 'provisioning',   -- 'provisioning' | 'active' | 'suspended' | 'cancelled'
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
// Stripe adapter (default, BAM uses this)
class StripeAdapter implements PaymentService {
  constructor(private apiKey: string) {}
  // ... Stripe-specific implementation
}

// Square adapter
class SquareAdapter implements PaymentService {
  constructor(private accessToken: string) {}
  // ... Square-specific implementation
}

// Authorize.net adapter
class AuthorizeNetAdapter implements PaymentService {
  constructor(private apiLoginId: string, private transactionKey: string) {}
  // ... Authorize.net-specific implementation
}
```

### Factory (Tenant-Aware)

```typescript
function getPaymentService(tenantConfig: TenantConfig): PaymentService {
  switch (tenantConfig.payment_processor) {
    case 'stripe':
      return new StripeAdapter(tenantConfig.stripe_secret_key)
    case 'square':
      return new SquareAdapter(tenantConfig.square_access_token)
    case 'authorize_net':
      return new AuthorizeNetAdapter(
        tenantConfig.authorize_net_login_id,
        tenantConfig.authorize_net_transaction_key
      )
    default:
      throw new Error(`Unknown payment processor: ${tenantConfig.payment_processor}`)
  }
}

// Usage in any API route — never import Stripe directly
const payments = getPaymentService(tenantConfig)
const result = await payments.processPayment({ amount: 19900, currency: 'usd' })
```

---

## Tenant Resolution (Request Routing)

Every request must resolve to the correct tenant's database.

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  
  // Resolve tenant from hostname
  const tenant = await resolveTenant(hostname)
  
  if (!tenant) {
    return NextResponse.redirect('https://balletplatform.com') // SaaS marketing site
  }
  
  // Inject tenant context into request headers
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenant.id)
  response.headers.set('x-tenant-slug', tenant.slug)
  return response
}

async function resolveTenant(hostname: string): Promise<Tenant | null> {
  // portal.balletacademyandmovement.com → slug: 'bam'
  // portal.pacificballet.com → slug: 'pacific-ballet'
  // pacific-ballet.bamplatform.com → slug: 'pacific-ballet'
  
  const tenant = await masterDb.studios.findByDomain(hostname)
  return tenant
}
```

---

## Integration Testing Pipeline

### GitHub Actions — Daily Synthetic Monitor

```yaml
# .github/workflows/integration-tests.yml
name: Integration Health Check
on:
  schedule:
    - cron: '0 6 * * *' # 6am UTC daily
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
        run: |
          npm run test:integration
      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text":"⚠️ BAM Platform integration tests failed — check GitHub Actions"}'
          webhook: ${{ secrets.SLACK_WEBHOOK }}
```

### Integration Test Scenarios

```typescript
// tests/integration/stripe.test.ts
describe('Stripe Integration', () => {
  it('creates a customer successfully', async () => { ... })
  it('processes a test payment', async () => { ... })
  it('handles declined card gracefully', async () => { ... })
  it('issues refund correctly', async () => { ... })
})

// tests/integration/klaviyo.test.ts
describe('Klaviyo Integration', () => {
  it('creates/updates a profile', async () => { ... })
  it('triggers welcome sequence', async () => { ... })
  it('unsubscribes on request', async () => { ... })
})

// tests/integration/cloudflare-stream.test.ts
describe('Cloudflare Stream Integration', () => {
  it('generates signed URL', async () => { ... })
  it('signed URL expires correctly', async () => { ... })
  it('creates live input', async () => { ... })
})

// tests/integration/supabase.test.ts
describe('Supabase Integration', () => {
  it('RLS blocks cross-role access', async () => { ... })
  it('magic link auth flow works', async () => { ... })
  it('enrollments respect class capacity', async () => { ... })
})
```

---

## White-Label Studio Onboarding Wizard

### 5-Step Wizard Flow

**Step 1: Studio Basics**
- Studio name
- Address
- Phone / email
- Primary contact (owner)

**Step 2: Brand**
- Logo upload
- Primary color picker
- Subdomain choice: `[slug].bamplatform.com` or custom domain

**Step 3: Programs**
- Select which programs they offer (pre-filled defaults)
- Add custom program names
- Set age ranges per level

**Step 4: Integrations**
- Stripe: Connect account button (OAuth)
- Klaviyo: Paste API key
- Google Analytics: Paste GA4 ID
- Cloudflare: Optional

**Step 5: Launch**
- Review summary
- "Provision Studio" button
- Shows provisioning progress (Supabase → migrations → seed → DNS → email config)
- Done: "Your portal is live at [url]"

---

## SaaS Roadmap (Post-BAM Launch)

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| 0 | Now | BAM internal platform fully live |
| 1 | Month 6 | SaaS infrastructure + tenant provisioning |
| 2 | Month 9 | Onboarding wizard + first external beta studio |
| 3 | Month 12 | 5 paying studios, pricing validated |
| 4 | Month 18 | 20+ studios, support team, status page |
| 5 | Month 24 | Mobile app (React Native) |
| 6 | Month 30 | Enterprise tier (multi-location chains) |
