# Formal Invoice PDF Generation — Spec

**Status:** Ready for implementation  
**Phase:** 3 — Billing & Payments  
**Related Modules:** BILLING_AND_CREDITS.md, TENANT_PAYMENT_CONFIG.md, STUDENT_PROFILE.md  
**Source:** DMP competitive gap analysis, April 2026  
**Priority:** MEDIUM — directly supports target demographic (FSA/HSA reimbursement)

---

## 1. Why This Exists

Stripe generates payment **receipts** — confirming a charge was made. Families using Dependent Care FSAs, Health Savings Accounts (HSAs), or employer education benefits need formal **invoices** — itemized documents showing the studio as a vendor, the student's name, the service rendered, and the billing period. Stripe receipts are insufficient for most FSA administrators.

The target BAM demographic (upper-income South OC families) commonly uses dependent care FSAs. This is a revenue-relevant feature — families may not enroll if they cannot get reimbursable documentation.

---

## 2. Invoice vs. Receipt Distinction

| | Stripe Receipt | BAM Invoice PDF |
|---|---|---|
| Format | Email with payment confirmation | Branded PDF with line items |
| Studio branding | Minimal | Full — logo, address, colors |
| Student name | Not shown | Shown |
| Service description | Generic | "Pre-Ballet — March 2026" |
| Billing period | Not shown | Shown |
| Invoice number | Not shown | Sequential (INV-0001, INV-0002...) |
| Accepted by FSA admins | Usually not | Yes |
| Storage | Stripe dashboard | Supabase Storage + parent portal |

---

## 3. Invoice Data

Each invoice PDF includes:

**Header:**
- Studio logo
- Studio name, address, phone, email
- Invoice number (sequential per tenant)
- Invoice date
- Billing period (e.g. "March 1–31, 2026")

**Bill To:**
- Parent/guardian name
- Billing email address

**Student:**
- Student first and last name

**Line Items:**
- Class name
- Rate per month (or per session for privates)
- Quantity
- Amount

**Totals:**
- Subtotal
- Discount applied (if any)
- Amount paid
- Balance due

**Footer:**
- "Thank you for your continued support of [Studio Name]"
- Studio contact info
- Studio branding

---

## 4. Database Schema

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  invoice_number  text NOT NULL,     -- e.g. 'INV-0042', sequential per tenant
  family_id       uuid REFERENCES families(id),
  student_id      uuid REFERENCES students(id),
  billing_period_start date NOT NULL,
  billing_period_end   date NOT NULL,
  line_items      jsonb NOT NULL DEFAULT '[]',
                  -- [{ description, quantity, unit_price_cents, amount_cents }]
  subtotal_cents  integer NOT NULL DEFAULT 0,
  discount_cents  integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  balance_cents   integer NOT NULL DEFAULT 0,
  stripe_payment_intent_id text,     -- linked payment
  pdf_storage_path text,             -- Supabase Storage path once generated
  pdf_generated_at timestamptz,
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','paid','void')),
  issued_at       timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Sequential invoice number per tenant
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant  ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_family  ON invoices(family_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
```

---

## 5. PDF Generation

**Library:** `@react-pdf/renderer` (React PDF)

**Template:** Matches BAM brand exactly:
- Lavender header bar with studio logo
- Cream background
- Cormorant Garamond for display text
- Montserrat for body
- Gold accent on totals row

**Generation trigger options:**
1. **Manual** — Admin generates invoice on demand from family profile
2. **Auto** — Generated when a tuition payment is processed (future, once auto-pay is built)
3. **Scheduled** — Admin runs "Generate invoices for March" batch job

**Storage:** `invoices/[tenant_id]/[invoice_id].pdf` in Supabase Storage (private bucket)

**Delivery:**
- Downloadable from parent portal under `/portal/billing/invoices`
- Admin can email directly: one-click "Email to parent" sends via Resend with the PDF attached
- Signed URL valid for 24 hours (regenerated on each portal view)

---

## 6. Parent Portal UI

Location: `/portal/billing/invoices`

- List of all issued invoices for this family
- Per row: invoice number, student name, billing period, amount, status badge, Download PDF button
- Filter by student (for multi-student families)
- "Need an invoice for a different period? Contact us." — links to studio contact

---

## 7. Admin UI

Location: Family profile → Billing tab → Invoices section

- List of all invoices for this family
- "Generate Invoice" button → opens modal:
  - Select student
  - Set billing period (start + end date)
  - Line items (pre-filled from enrollments, editable)
  - Preview
  - Generate + store PDF
- "Email to Parent" button
- "Void" button (marks status as void, cannot delete)

---

## 8. Invoice Numbering

Sequential per tenant: `INV-0001`, `INV-0002`, etc.

```sql
-- Function to get next invoice number for a tenant
CREATE OR REPLACE FUNCTION next_invoice_number(p_tenant_id uuid)
RETURNS text AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE tenant_id = p_tenant_id;
  
  RETURN 'INV-' || LPAD(next_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 9. API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/invoices` | Admin+ | List invoices (filterable by family, student, period) |
| POST | `/api/invoices` | Admin+ | Create invoice |
| GET | `/api/invoices/[id]` | Admin+ / Parent (own) | Get invoice detail |
| POST | `/api/invoices/[id]/generate-pdf` | Admin+ | Generate/regenerate PDF |
| POST | `/api/invoices/[id]/email` | Admin+ | Email PDF to parent |
| PATCH | `/api/invoices/[id]/void` | Admin+ | Void invoice |
| GET | `/api/portal/invoices` | Parent | List own family's invoices |
| GET | `/api/portal/invoices/[id]/download` | Parent | Get signed PDF URL |

---

## 10. Build Notes for Claude Code

Build order:
1. Migration — `invoices` table + `next_invoice_number` function
2. PDF template — `components/invoices/InvoicePDF.tsx` using `@react-pdf/renderer`
3. PDF generation endpoint — `/api/invoices/[id]/generate-pdf`
4. Admin UI — family profile billing tab + generate invoice modal
5. Parent portal — `/portal/billing/invoices` list + download
6. Email delivery — one-click email via Resend with PDF attachment

**Note:** `@react-pdf/renderer` runs server-side only (no browser). Generate PDFs in API routes or Edge Functions, never in client components.
