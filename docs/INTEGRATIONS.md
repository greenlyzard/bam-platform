# INTEGRATIONS.md
# Ballet Academy and Movement — Integrations Module Spec
# Version: 1.0 | Status: Draft | Owner: Derek Shaw (Green Lyzard)

---

## 1. Overview

The Integrations module is the single place where each tenant connects
their third-party service accounts to the BAM platform. It lives in
Admin Settings and follows the same pluggable adapter pattern used by
the payment processor layer (SAAS.md).

No integration credentials are ever hardcoded. Everything is tenant-scoped,
encrypted at rest, and swappable without a code deploy.

Cross-references:
- SAAS.md — adapter pattern, multi-tenant architecture
- COMMUNICATIONS.md — SMS adapter (Quo/Twilio), email adapter
- TEACHER_TIME_ATTENDANCE.md — payment adapter for private billing

---

## 2. Integration Categories

### 2.1 Phone & SMS
| Provider | Status | Notes |
|---|---|---|
| Quo (formerly OpenPhone) | ✅ Full | API key + phone number ID |
| Twilio | ✅ Full | Account SID + Auth Token + from number |

### 2.2 Email
| Provider | Status | Notes |
|---|---|---|
| Resend | ✅ Default | Platform default; tenant can override with own key |
| Custom SMTP | 🔜 Phase 2 | Host, port, username, password |

### 2.3 Payments
| Provider | Status | Notes |
|---|---|---|
| Stripe | ✅ Full | Publishable + secret key |
| PayPal | 🔜 Stub | Client ID + client secret |
| Authorize.net | 🔜 Stub | API login ID + transaction key |

### 2.4 Marketing & CRM
| Provider | Status | Notes |
|---|---|---|
| Klaviyo | ✅ Phase 2 | API key + list ID |
| Zapier | 🔜 Phase 3 | Outbound webhook URL |

### 2.5 Video
| Provider | Status | Notes |
|---|---|---|
| Cloudflare Stream | ✅ Phase 2 | API token + account ID |

### 2.6 Website / CMS
| Provider | Status | Notes |
|---|---|---|
| WordPress | 🔜 Phase 3 | Site URL + application password |

---

## 3. Data Model

```sql
tenant_integrations (
  id uuid PK,
  tenant_id uuid FK tenants NOT NULL,
  integration_type text NOT NULL,      -- see enum below
  is_active boolean default false,
  encrypted_credentials jsonb,         -- AES-256-GCM encrypted
  metadata jsonb,                      -- non-sensitive config
  last_verified_at timestamptz,
  verification_status enum('pending','verified','error') default 'pending',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(tenant_id, integration_type)
)

-- integration_type values:
-- 'sms_quo'
-- 'sms_twilio'
-- 'email_resend'
-- 'email_smtp'
-- 'payment_stripe'
-- 'payment_paypal'
-- 'payment_authorizenet'
-- 'marketing_klaviyo'
-- 'marketing_zapier'
-- 'video_cloudflare'
-- 'cms_wordpress'
```

### 3.1 Encrypted Credentials Shape (per provider)

**Quo:**
```json
{ "api_key": "...", "phone_number_id": "PNxxxxxxx" }
```

**Twilio:**
```json
{ "account_sid": "AC...", "auth_token": "...", "from_number": "+19495551234" }
```

**Stripe:**
```json
{ "publishable_key": "pk_live_...", "secret_key": "sk_live_...", "webhook_secret": "whsec_..." }
```

**Klaviyo:**
```json
{ "api_key": "...", "list_id": "..." }
```

**Cloudflare Stream:**
```json
{ "api_token": "...", "account_id": "..." }
```

---

## 4. Credential Encryption

All credentials are encrypted before writing to the database and
decrypted only server-side at adapter instantiation.

```typescript
// src/lib/integrations/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY!, 'hex')

export function encryptCredentials(data: object): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex')
  })
}

export function decryptCredentials(encrypted: string): object {
  const { iv, tag, data } = JSON.parse(encrypted)
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final()
  ])
  return JSON.parse(decrypted.toString('utf8'))
}
```

**Required Vercel env var:**
`INTEGRATION_ENCRYPTION_KEY` — 64 hex characters (32 bytes)
Generate with: `openssl rand -hex 32`

---

## 5. Integration Cards UI

Location: `/admin/settings/integrations`

### 5.1 Card Layout
Each integration displays as a card:
```
┌─────────────────────────────────────┐
│  [Logo]  Provider Name              │
│          Brief description          │
│                                     │
│  Status: ● Connected                │
│  Last verified: Mar 12, 2026        │
│                                     │
│  [Configure]  [Disconnect]          │
└─────────────────────────────────────┘
```

Status badges:
- ● Connected (green) — credentials verified
- ○ Not Connected (gray) — not set up
- ⚠ Error (red) — last verification failed

### 5.2 Connect Modal
Each provider has a dedicated connect modal with:
- Field labels and placeholders
- Link to where to find the credentials (e.g., "Find this in Quo → Settings → API")
- "Test Connection" button — validates before saving
- "Save" button — only enabled after successful test

### 5.3 Connection Test
Before saving any credentials, the platform makes a lightweight API call
to verify they work:
- **Quo:** `GET /v1/phone-numbers` → must return at least one number
- **Twilio:** `GET /Accounts/{SID}` → must return 200
- **Stripe:** `GET /v1/account` → must return account object
- **Klaviyo:** `GET /api/lists` → must return 200
- **Cloudflare Stream:** `GET /accounts/{id}/stream` → must return 200

---

## 6. Quo Setup Flow (Detailed)

1. Admin navigates to Settings → Integrations → Phone & SMS
2. Clicks **Connect** on Quo card
3. Modal opens:
   ```
   Connect Quo
   ─────────────────────────────────
   API Key
   [________________________]
   Find your API key at my.quo.com → Settings → API

   [Fetch Phone Numbers]
   ```
4. Admin pastes API key, clicks "Fetch Phone Numbers"
5. Platform calls `GET https://api.openphone.com/v1/phone-numbers`
   with `Authorization: {api_key}`
6. Returns list of numbers → admin selects studio number
   ```
   Select Phone Number
   ○ (949) 229-0846 — Use this Number Please!
   ○ (949) 736-5025 — Ballet Academy and Movement
   ```
7. Admin selects number, clicks "Save Connection"
8. Platform stores encrypted credentials + `phone_number_id` in metadata
9. Status → Connected ✅
10. Modal shows webhook URL:
    ```
    Webhook URL (add this in Quo → Settings → Webhooks):
    https://portal.balletacademyandmovement.com/api/webhooks/quo
    [Copy]
    ```

---

## 7. Webhook Configuration

Each SMS provider requires a webhook URL to be added in their dashboard
so inbound messages are forwarded to the portal.

### 7.1 Quo Webhook
- URL: `https://portal.[domain]/api/webhooks/quo`
- Events to subscribe: `message.received`
- Secret: stored as `QUO_WEBHOOK_SECRET` in Vercel env (per tenant eventually)

### 7.2 Twilio Webhook
- URL: `https://portal.[domain]/api/webhooks/twilio`
- Set in Twilio → Phone Numbers → Configure → Messaging Webhook

### 7.3 Stripe Webhook
- URL: `https://portal.[domain]/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `invoice.paid`, `customer.subscription.deleted`

---

## 8. Integration Status Dashboard

Super Admins can view a summary of all tenant integrations from the
platform admin view (multi-tenant overview):

```
Tenant                  SMS         Email      Payments    Video
────────────────────────────────────────────────────────────────
Ballet Academy (BAM)    Quo ✅      Resend ✅  Stripe ✅   CF ✅
Studio B (future)       Twilio ✅   SMTP ✅    PayPal ⚠    —
Studio C (future)       —           Resend ✅  Stripe ✅   —
```

---

## 9. Adding a New Integration (Developer Guide)

To add a new integration type to the platform:

1. Add the `integration_type` value to the enum in the DB schema
2. Create `src/lib/integrations/providers/[name].ts` implementing
   the relevant adapter interface
3. Add the provider to the adapter factory in `src/lib/integrations/factory.ts`
4. Add the UI card and connect modal in
   `app/(admin)/admin/settings/integrations/[name]/`
5. Add a connection test function
6. Update `INTEGRATIONS.md` with the new provider

---

## 10. Phase Implementation Order

### Phase 1 (current)
- [ ] `tenant_integrations` table migration
- [ ] Encryption utility (`INTEGRATION_ENCRYPTION_KEY` env var)
- [ ] Integrations page skeleton (cards, no logic)
- [ ] Quo adapter — send SMS
- [ ] Quo connect modal + phone number selection
- [ ] Add `QUO_API_KEY` + `QUO_PHONE_NUMBER_ID` to Vercel

### Phase 2
- [ ] Stripe connect modal (replaces hardcoded env var approach)
- [ ] Webhook handlers: Quo, Twilio, Stripe
- [ ] Klaviyo adapter
- [ ] Cloudflare Stream adapter
- [ ] Connection test for all Phase 2 providers

### Phase 3
- [ ] Twilio adapter (full)
- [ ] PayPal adapter (full)
- [ ] WordPress adapter
- [ ] Zapier outbound webhook
- [ ] Multi-tenant integration status dashboard

---

## 11. Open Questions

- Should Studio Admins be able to connect integrations, or Super Admin only?
- If a tenant doesn't connect any SMS provider, should class reminders
  fall back to email-only silently, or warn the admin?
- Should the platform support multiple SMS numbers per tenant
  (e.g., one for admin, one for marketing)?
- For Stripe: should we support Stripe Connect (tenants connect their
  own accounts via OAuth) instead of manual key entry? This would be
  cleaner for the white-label model.
- Should integration credentials have an expiry/rotation reminder?
