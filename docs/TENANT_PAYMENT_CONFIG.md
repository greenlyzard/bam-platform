# TENANT_PAYMENT_CONFIG.md
# Ballet Academy and Movement — Platform Specification
# Tenant Payment Configuration Module

---

## 1. Purpose

The Tenant Payment Configuration module enables each studio tenant to connect their own payment processor account to the platform. This is a core requirement for white-label SaaS — every studio must collect payments into their own bank account, not the platform's.

This spec defines:
- The per-tenant payment config data model
- Supported processors and their credential fields
- The payment abstraction layer (`lib/payments/`)
- Admin UI for connecting and managing payment processors
- Security requirements for credential storage

---

## 2. Supported Payment Processors

| Processor | Status | Use Case |
|---|---|---|
| Stripe | ✅ Current | Primary — checkout sessions, webhooks |
| Square | 🔜 Planned | Alternative for studios already on Square |
| Authorize.net | 🔜 Planned | Legacy studios on Authorize.net |
| PayPal | 🔜 Planned | Optional secondary processor |

All processors must support:
- One-time payments (enrollment, tickets, merchandise)
- Refunds
- Webhook event delivery

Recurring billing (subscriptions) is future scope and will be handled per-processor.

---

## 3. Data Model

```sql
CREATE TABLE tenant_payment_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processor         TEXT NOT NULL DEFAULT 'stripe',
    CONSTRAINT valid_processor CHECK (processor IN ('stripe','square','authorize_net','paypal')),
  is_active         BOOLEAN NOT NULL DEFAULT false,
  is_test_mode      BOOLEAN NOT NULL DEFAULT true,

  -- Stripe
  stripe_publishable_key        TEXT,  -- pk_live_... or pk_test_...
  stripe_secret_key_encrypted   TEXT,  -- encrypted at rest, never returned to client
  stripe_webhook_secret_encrypted TEXT,
  stripe_account_id             TEXT,  -- for display/reference only

  -- Square (future)
  square_access_token_encrypted TEXT,
  square_location_id            TEXT,
  square_webhook_signature_key_encrypted TEXT,

  -- Authorize.net (future)
  authorize_net_login_id_encrypted        TEXT,
  authorize_net_transaction_key_encrypted TEXT,

  -- PayPal (future)
  paypal_client_id              TEXT,
  paypal_client_secret_encrypted TEXT,
  paypal_webhook_id             TEXT,

  -- Metadata
  connected_at    TIMESTAMPTZ,
  connected_by    UUID REFERENCES user_profiles(id),
  last_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, processor)
);

-- Index
CREATE INDEX idx_payment_configs_tenant ON tenant_payment_configs(tenant_id);
```

### Encryption

All `_encrypted` fields are encrypted using AES-256-GCM before storage. The encryption key is stored in the platform environment as `PAYMENT_ENCRYPTION_KEY` (never in the database). Decryption happens only server-side within the payment abstraction layer.

**Publishable keys** (Stripe `pk_live_...`, Square location ID, PayPal client ID) are NOT encrypted — they are safe to display in the admin UI.

**Secret keys, webhook secrets, and access tokens** are ALWAYS encrypted. They are:
- Never returned in API responses
- Never logged
- Never exposed to client-side code
- Decrypted only inside `lib/payments/` server functions

---

## 4. Payment Abstraction Layer

### File Structure

```
lib/payments/
  index.ts              — public entry point
  types.ts              — shared types and interfaces
  encrypt.ts            — credential encryption/decryption utilities
  getProcessor.ts       — loads tenant config and returns processor client
  processors/
    stripe.ts           — Stripe implementation
    square.ts           — Square implementation (stub)
    authorize_net.ts    — Authorize.net implementation (stub)
    paypal.ts           — PayPal implementation (stub)
```

### Core Interface

Every processor must implement `IPaymentProcessor`:

```typescript
interface IPaymentProcessor {
  // Create a checkout session and return a redirect URL
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;

  // Handle an inbound webhook event
  handleWebhook(rawBody: string, signature: string): Promise<WebhookEvent>;

  // Issue a refund
  refund(params: RefundParams): Promise<RefundResult>;

  // Verify credentials are valid (used during setup)
  verifyCredentials(): Promise<VerificationResult>;
}

interface CheckoutSessionParams {
  tenantId: string;
  lineItems: LineItem[];
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

interface CheckoutSessionResult {
  sessionId: string;
  redirectUrl: string;
}

interface WebhookEvent {
  type: 'payment.completed' | 'payment.expired' | 'payment.refunded';
  sessionId: string;
  metadata: Record<string, string>;
  amountCents: number;
}
```

### getProcessor()

```typescript
// Usage anywhere in the codebase:
const processor = await getProcessor(tenantId);
const session = await processor.createCheckoutSession({...});
```

Internally:
1. Loads `tenant_payment_configs` for the given `tenantId` where `is_active = true`
2. Decrypts the relevant credentials
3. Instantiates and returns the correct processor client
4. Throws `PaymentConfigError` if no active config exists for the tenant

### Webhook Routing

All webhooks are routed through a single endpoint:

```
POST /api/payments/webhook/[processor]
```

e.g. `/api/payments/webhook/stripe`, `/api/payments/webhook/square`

The webhook handler:
1. Identifies the tenant from the event metadata (`tenant_id`)
2. Loads that tenant's processor config
3. Verifies the webhook signature using the tenant's stored webhook secret
4. Calls the shared `handleWebhookEvent()` function which dispatches to enrollment, ticketing, etc.

This replaces the current `/api/enrollment/webhook` route. The enrollment webhook should be migrated to use this unified handler.

---

## 5. Admin UI — Payment Settings

Location: **Settings → Studio Settings → Billing & Payments**

### Connection Status Card

Shows the current processor and connection status:

- If no processor connected: "No payment processor connected" with a **Connect** button
- If connected: processor logo, account name, connection date, **Disconnect** and **Test Connection** buttons
- Test mode badge if `is_test_mode = true`

### Connect Flow

Clicking **Connect** opens a drawer:

**Step 1 — Choose Processor**
- Stripe (recommended)
- Square (coming soon — grayed out)
- Authorize.net (coming soon — grayed out)
- PayPal (coming soon — grayed out)

**Step 2 — Enter Credentials (Stripe)**

Fields:
- Publishable Key (`pk_live_...` or `pk_test_...`)
- Secret Key (`sk_live_...` or `sk_test_...`) — masked input
- Webhook Secret (`whsec_...`) — masked input, with helper text and a link to Stripe webhook setup docs

Below the form:
> "Your secret key and webhook secret are encrypted before storage and are never accessible after saving. To update them, disconnect and reconnect."

**Step 3 — Verify**

On save:
- Platform calls `processor.verifyCredentials()` — makes a test API call to confirm keys are valid
- If valid: saves encrypted credentials, sets `is_active = true`, shows success
- If invalid: shows specific error (invalid key format, authentication failed, etc.)

**Test Mode Detection:**
- If publishable key starts with `pk_test_` → automatically set `is_test_mode = true`, show amber "Test Mode" badge
- If publishable key starts with `pk_live_` → set `is_test_mode = false`, show green "Live" badge

### Disconnect

Clicking **Disconnect**:
- Confirmation: "Disconnecting will prevent new payments from being processed. Are you sure?"
- On confirm: sets `is_active = false`, clears all encrypted credential fields
- Credentials are permanently deleted — not recoverable

### Test Connection

Clicking **Test Connection**:
- Calls `processor.verifyCredentials()` live
- Shows "Connection verified ✓" or error message with timestamp

---

## 6. BAM Initial Setup

Ballet Academy and Movement's Stripe credentials are stored in `tenant_payment_configs` for tenant `84d98f72-c82f-414f-8b17-172b802f6993`.

**Migration path from env vars to DB:**

Currently `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are Vercel env vars. These should be migrated to the DB config table:

1. Build this module
2. Admin connects Stripe via the UI using Amanda's new keys
3. All payment code updated to use `getProcessor(tenantId)` instead of `process.env.STRIPE_SECRET_KEY`
4. Remove `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from Vercel env vars
5. Keep `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` as an env var temporarily (needed for client-side Stripe.js initialization) until a `/api/payments/config` endpoint is built to serve it dynamically

---

## 7. Permissions

| Action | Super Admin | Studio Owner | Admin | Manager | Teacher | Parent |
|---|---|---|---|---|---|---|
| View payment config | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Connect processor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Disconnect processor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View transaction history | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Issue refunds | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 8. Multi-Tenant Safety Rules

- A tenant's credentials are ONLY used for transactions initiated by that tenant
- `getProcessor(tenantId)` always scopes the DB query to the provided `tenantId` — no cross-tenant key access is possible
- Webhook events are always validated against the originating tenant's webhook secret before processing
- Super Admin cannot use one tenant's keys to process another tenant's transactions

---

## 9. Build Notes for Claude Code

When building this module, reference these files first:

```
docs/claude/TENANT_PAYMENT_CONFIG.md   ← this file
docs/claude/ROLES_AND_PERMISSIONS.md
CLAUDE.md
```

Build order:
1. Migration + encryption utilities (`lib/payments/encrypt.ts`)
2. Stripe processor implementation (`lib/payments/processors/stripe.ts`)
3. `getProcessor()` function
4. Unified webhook route (`/api/payments/webhook/[processor]`)
5. Admin UI (Settings → Billing & Payments)
6. Migrate existing enrollment checkout to use `getProcessor()`

Add `PAYMENT_ENCRYPTION_KEY` to required env vars. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.local` and Vercel before running the build.
