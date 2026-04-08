# Contracts & Commitments — Spec

**Status:** Ready for implementation  
**Phase:** 2 — Registration & Enrollment  
**Related Modules:** ENROLLMENT_AND_PLACEMENT.md, PROGRAMS.md, STUDENT_PROFILE.md, SAAS.md  
**Decision Log Date:** April 7, 2026

---

## 1. Overview

Certain programs require students and guardians to formally acknowledge commitments and sign contracts before enrollment is complete. This module handles:

- Program-based contract assignment (not level-based)
- Modular contract builder (studios upload their own documents)
- In-platform digital signature collection
- PDF generation and storage in student files
- Commitment acknowledgment tracking

This module is fully white-label — every studio defines its own programs, commitment requirements, and contract documents.

---

## 2. Program-Based Contract Assignment

### 2.1 BAM Programs That Require Contracts

| Program | Contract Required | Commitments |
|---|---|---|
| Company | Yes | All performances, all competitions, full season |
| Junior Company | Yes | All performances, designated competitions, full season |
| Studio Company | Yes | Studio performances, optional competitions |
| Rec Performance Track | Yes (lighter) | Enrolled performance only |
| Standard Enrollment | No | None |

### 2.2 White-Label: Studio-Defined Programs

Any tenant can define their own programs and specify which ones require contracts. Examples from other studio types:

- Competition Team Level A / B / C (competition studio)
- Pre-Professional Division (conservatory)
- Competitive Hip Hop Squad (commercial studio)
- Show Choir Intensive (musical theatre studio)

Admin creates programs in **Settings → Programs** and flags which require contract signing at enrollment.

### 2.3 How Contract Assignment Works

When a student is enrolled in or placed into a class that belongs to a contract-required program:
1. System detects the program association at checkout
2. Contract step is inserted into the checkout flow
3. Student cannot complete enrollment without signing
4. If multiple contract types apply, they are stacked and signed sequentially

---

## 3. Contract Module Architecture

### 3.1 Design Principle: Modular and Upload-Based

Studios do not build contracts inside the platform. They upload their own PDF or Word documents, which the platform renders and collects signatures on. This keeps legal content under the studio's control while the platform handles delivery, signature, and storage.

### 3.2 Contract Types

Each contract document has a `contract_type` tag for organization and filtering:

| Type | Description |
|---|---|
| `studio_policies` | General studio rules, code of conduct |
| `photo_release` | Photography and video consent |
| `payment_terms` | Tuition, late fees, autopay authorization |
| `liability_waiver` | Injury, participation risk |
| `program_commitment` | Program-specific performance/competition commitments |
| `media_release` | Marketing use of student image/video |
| `custom` | Any other studio-defined document |

### 3.3 BAM-Specific Note

At BAM, photo and filming release is **mandatory for all students** — not just commitment programs. This should be collected at first enrollment for any new student and stored permanently. Re-signature is required only if terms change.

---

## 4. Database Schema

```sql
-- Contract template library (per tenant)
CREATE TABLE IF NOT EXISTS contract_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,          -- e.g. "Company Program Agreement 2026"
  contract_type   text NOT NULL
    CHECK (contract_type IN (
      'studio_policies','photo_release','payment_terms',
      'liability_waiver','program_commitment','media_release','custom'
    )),
  version         integer NOT NULL DEFAULT 1,
  file_url        text NOT NULL,          -- Supabase Storage path (PDF)
  file_size_bytes integer,
  is_active       boolean DEFAULT true,
  is_mandatory    boolean DEFAULT false,  -- true = required for ALL new enrollments (e.g. BAM photo release)
  effective_date  date,
  expiry_date     date,                   -- null = no expiry
  requires_guardian_signature boolean DEFAULT true,
  requires_student_signature  boolean DEFAULT false, -- true for students 18+
  uploaded_by     uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Which programs require which contracts
CREATE TABLE IF NOT EXISTS program_contract_requirements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  program_id          uuid NOT NULL REFERENCES tenant_program_types(id),
  contract_template_id uuid NOT NULL REFERENCES contract_templates(id),
  is_required         boolean DEFAULT true,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(program_id, contract_template_id)
);

-- Signed contract instances (one per student per contract version)
CREATE TABLE IF NOT EXISTS signed_contracts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  contract_template_id uuid NOT NULL REFERENCES contract_templates(id),
  student_id           uuid NOT NULL REFERENCES students(id),
  enrollment_id        uuid REFERENCES enrollments(id),
  season_id            uuid REFERENCES seasons(id),

  -- Guardian signature
  guardian_profile_id  uuid REFERENCES profiles(id),
  guardian_signed_at   timestamptz,
  guardian_signature   text,             -- base64 drawn signature or typed name
  guardian_ip_address  text,
  guardian_user_agent  text,

  -- Student signature (18+ only)
  student_signed_at    timestamptz,
  student_signature    text,
  student_ip_address   text,

  -- Output
  pdf_storage_path     text,             -- generated signed PDF in Supabase Storage
  pdf_generated_at     timestamptz,

  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','guardian_signed','fully_signed','voided')),

  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Commitment acknowledgments (separate from contract signature)
CREATE TABLE IF NOT EXISTS commitment_acknowledgments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  student_id      uuid NOT NULL REFERENCES students(id),
  program_id      uuid NOT NULL REFERENCES tenant_program_types(id),
  season_id       uuid NOT NULL REFERENCES seasons(id),
  acknowledged_by uuid NOT NULL REFERENCES profiles(id),  -- guardian or student 18+
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  commitments_text text NOT NULL,         -- snapshot of commitments at time of acknowledgment
  ip_address      text,
  UNIQUE(student_id, program_id, season_id)
);
```

---

## 5. Contract Signing UI — Checkout Step

### 5.1 Rendering

- Platform fetches the contract PDF from Supabase Storage
- Renders inline as a scrollable document (PDF.js viewer)
- Parent must scroll to the bottom before the signature area becomes active
- "You must read the full document before signing" enforced via scroll tracking

### 5.2 Signature Collection

Three signature method options (tenant-configurable):

| Method | Description | Legal Weight |
|---|---|---|
| **Typed name** | Parent types their full name | Standard — sufficient for most |
| **Drawn signature** | Touch/mouse signature pad | Stronger visual confirmation |
| **Checkbox + typed name** | "I agree" + name | Simplest, still binding |

BAM default: **typed name** (fastest in checkout flow, legally sufficient in California).

### 5.3 What Gets Captured with Each Signature

- Full name as typed
- Timestamp (UTC)
- IP address
- User agent
- Supabase user ID (tied to authenticated session)
- Contract template ID and version number

### 5.4 PDF Generation

After signature is captured:
1. Platform generates a signed PDF combining:
   - Original contract document
   - Signature block: name, date, IP, user ID
   - BAM header with studio logo and student name
2. PDF stored in `contracts/[tenant_id]/[student_id]/[contract_id].pdf`
3. Path saved to `signed_contracts.pdf_storage_path`

### 5.5 Multiple Contracts in One Checkout

If a program requires 3 contracts:
- Shown as a stepper: Contract 1 of 3, Contract 2 of 3, Contract 3 of 3
- Must complete each before proceeding
- Progress saved — parent can close and return (contracts signed so far are preserved)

---

## 6. Contract Visibility

| Role | Access |
|---|---|
| Super Admin / Admin | All signed contracts for all students |
| Teacher | None |
| Guardian | Their own student's signed contracts |
| Student (18+) | Their own signed contracts |
| Student (under 18) | None |

Contracts appear in:
- **Student profile → Documents tab** — for guardians and 18+ students
- **Admin → Student profile → Documents tab** — full access
- **Enrollment record** — linked to the specific enrollment that triggered signing

---

## 7. Admin Contract Management

### Settings → Programs → [Program Name] → Contracts

- List of contract templates assigned to this program
- Add/remove contract requirements
- Upload new contract version (creates new version, previous remains valid for existing signatures)
- Toggle: mandatory for all new enrollments vs. program-specific only

### Settings → Contracts → Template Library

- All uploaded contract templates
- Upload new template (PDF or DOCX — converted to PDF on upload)
- Version history per template
- Usage report: which students have signed which version

### Student Profile → Documents → Contracts

- All signed contracts for this student
- Download PDF
- Re-request signature (if contract version has changed)
- Void a contract (admin only, with reason)

---

## 8. Commitment Acknowledgment Flow

Commitment acknowledgment is a **separate step from contract signing** — it happens earlier in checkout and is lighter weight.

```
Cart Review
    ↓
[If program has commitments]
Commitment Confirmation Screen:
  "Sofia is being enrolled in Company Program.
   Company students are required to:
   ✓ Participate in all studio performances
   ✓ Participate in designated competitions
   ✓ Maintain full season enrollment

   □ I understand and agree to these commitments
   [Continue to Contract Signing →]"
    ↓
Contract Signing (full document)
    ↓
Payment
```

The commitment acknowledgment text is defined per program in Settings → Programs → Commitments. Admin writes the commitment bullet points. These are stored as a snapshot at time of acknowledgment so the record is accurate even if program requirements change later.

---

## 9. Mandatory Documents — New Student Onboarding

For BAM specifically, these documents are collected from ALL new students regardless of program:

| Document | When Collected | Re-signature Required |
|---|---|---|
| Photo & Filming Release | First enrollment | If terms change |
| Liability Waiver | First enrollment | Annually |
| Studio Policies | First enrollment | If terms change |
| Payment Terms | First enrollment + on autopay setup | If terms change |

These are configured as `is_mandatory = true` in the contract template library and are injected into the checkout flow for any first-time enrolling student.

---

## 10. Decisions Log

| # | Decision |
|---|---|
| 1 | Contracts are program-based, not level-based |
| 2 | BAM programs: Company, Junior Company, Studio Company, Rec Performance Track |
| 3 | White-label: any studio can define their own programs with their own contract requirements |
| 4 | Contract module is modular — studios upload their own documents, platform collects signatures |
| 5 | Signatures collected in-platform — no DocuSign/HelloSign dependency |
| 6 | Signed PDFs stored in Supabase Storage, linked to student file |
| 7 | Visible to: guardians + students 18+ only — teachers never see contracts |
| 8 | BAM photo/filming release is mandatory for ALL students, not just commitment programs |
| 9 | Commitment acknowledgment (checkbox) is separate from and precedes contract signature |
| 10 | Multiple contracts in one checkout shown as stepper — progress saved if session interrupted |
| 11 | Default signature method: typed name (legally sufficient in California, fastest UX) |
| 12 | New contract version upload preserves all existing signatures — doesn't invalidate them |
| 13 | Mandatory documents (liability waiver, photo release, etc.) injected for all first-time enrollees |
