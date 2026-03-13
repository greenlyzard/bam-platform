# EMAIL_TEMPLATES.md
# Ballet Academy and Movement Platform — Email Templates Module

## Related Specs
- `SAAS.md` — tenant provisioning, white-label architecture
- `ROLES_AND_PERMISSIONS.md` — permission tiers
- `TICKETING.md` — ticket confirmation, comp claim, program delivery emails
- `REGISTRATION_AND_ONBOARDING.md` — enrollment confirmation, trial class emails
- `COMMUNICATIONS_INBOX.md` — two-way reply capture (planned)

---

## 1. Overview

The Email Templates module provides a block-based email editor that allows platform Super Admins to manage baseline defaults and Studio Admins to customize per-tenant branded emails.

All transactional and communication emails sent by the platform are template-driven. No email is hardcoded. Every template supports dynamic variable injection, tenant branding, and mobile-first preview.

The model follows a **fork versioning system** — baseline templates are owned by the platform, studio customizations are independent copies that are never disrupted by baseline updates.

---

## 2. Design Principles

- **Mobile-first** — all previews default to mobile view with desktop toggle
- **Baseline-first** — every template works out of the box with zero configuration required
- **Shopify-style defaults** — functional, accurate, and on-brand from day one
- **Progressive customization** — studios can customize as much or as little as they want
- **No disruption** — baseline updates never overwrite studio-customized templates
- **Two-way capture** — all replies to studio emails are logged in the platform (see COMMUNICATIONS_INBOX.md)

---

## 3. Template Types

### 3.1 Auth Templates
| Template | Trigger | Key Variables |
|---|---|---|
| Magic Link / Sign In | User requests magic link | `{{first_name}}`, `{{sign_in_link}}`, `{{expiry_minutes}}` |
| Welcome — New Account | Account created | `{{first_name}}`, `{{studio_name}}`, `{{portal_link}}` |
| Password Reset | User requests reset | `{{first_name}}`, `{{reset_link}}`, `{{expiry_minutes}}` |

### 3.2 Registration Templates
| Template | Trigger | Key Variables |
|---|---|---|
| Enrollment Confirmation | Student enrolled in class | `{{first_name}}`, `{{student_name}}`, `{{class_name}}`, `{{class_time}}`, `{{teacher_name}}`, `{{start_date}}` |
| Trial Class Confirmation | Trial class booked | `{{first_name}}`, `{{student_name}}`, `{{class_name}}`, `{{class_date}}`, `{{class_time}}`, `{{studio_address}}` |
| Waitlist Confirmation | Added to waitlist | `{{first_name}}`, `{{student_name}}`, `{{class_name}}`, `{{waitlist_position}}` |
| Waitlist — Spot Available | Spot opens up | `{{first_name}}`, `{{student_name}}`, `{{class_name}}`, `{{enroll_link}}`, `{{expiry_hours}}` |
| Class Reminder | 24hr before class | `{{first_name}}`, `{{student_name}}`, `{{class_name}}`, `{{class_time}}`, `{{teacher_name}}` |

### 3.3 Ticketing Templates
| Template | Trigger | Key Variables |
|---|---|---|
| Ticket Purchase Confirmation | Purchase complete | `{{first_name}}`, `{{show_title}}`, `{{show_date}}`, `{{show_time}}`, `{{venue}}`, `{{ticket_count}}`, `{{ticket_qr}}`, `{{apple_wallet_link}}`, `{{google_wallet_link}}` |
| Comp Claim Link | Admin sends comp | `{{first_name}}`, `{{show_title}}`, `{{show_date}}`, `{{claim_link}}`, `{{expiry_time}}` |
| Ticket Transfer Notification | Ticket transferred | `{{first_name}}`, `{{show_title}}`, `{{show_date}}`, `{{ticket_link}}` |
| Show Program Delivery | Ticket scanned at door | `{{first_name}}`, `{{show_title}}`, `{{program_link}}`, `{{store_link}}` |

### 3.4 Billing Templates
| Template | Trigger | Key Variables |
|---|---|---|
| Payment Receipt | Payment successful | `{{first_name}}`, `{{amount}}`, `{{date}}`, `{{description}}`, `{{invoice_link}}` |
| Payment Failed | Payment fails | `{{first_name}}`, `{{amount}}`, `{{retry_link}}` |
| Upcoming Payment Reminder | 3 days before autopay | `{{first_name}}`, `{{amount}}`, `{{due_date}}`, `{{payment_method}}` |

### 3.5 Communication Templates
| Template | Trigger | Key Variables |
|---|---|---|
| Announcement | Admin sends manually | `{{first_name}}`, `{{studio_name}}`, free-form content blocks |
| Intermission Notification | Admin triggers during show | `{{first_name}}`, `{{show_title}}`, `{{custom_message}}` |
| Show Resuming Notification | Admin triggers at intermission end | `{{first_name}}`, `{{show_title}}`, `{{custom_message}}` |

---

## 4. Tenant Brand Settings

Configured once per tenant. All emails inherit these automatically.

```typescript
interface TenantEmailBranding {
  logo_url: string;           // PNG/SVG, transparent background preferred
  brand_color: string;        // Hex, e.g. "#9C8BBF" — used for header bar
  button_color: string;       // Hex, inherits brand_color by default
  sender_name: string;        // e.g. "Ballet Academy and Movement"
  sender_email: string;       // e.g. "hello@balletacademyandmovement.com"
  reply_to_email: string;     // e.g. "dance@bamsocal.com"
  studio_name: string;        // pulled from studio profile
  studio_address: string;     // pulled from studio profile
  studio_phone: string;       // pulled from studio profile
  studio_website: string;     // pulled from studio profile
}
```

### Button Color Override
- All CTA buttons inherit `button_color` from tenant brand settings by default
- Per-email override available — any individual email template can set a different button color
- Override is stored on the template version, not on the brand settings

---

## 5. Block-Based Editor

### 5.1 Fixed Zones (locked, not editable by studio)
- **Header block** — tenant logo + brand color bar (always first)
- **Footer block** — studio name, address, phone, website, unsubscribe link (always last)

### 5.2 Available Content Blocks

**Layout Blocks**
- Divider — horizontal rule
- Spacer — adjustable vertical space

**Content Blocks**
- Rich Text — bold, italic, underline, font size, color, links, bullet lists
- Image — upload directly or select from studio media library
- Button — label, URL, color (inherits brand color, overridable)

**Dynamic Blocks**
- Recipient Info Card — displays `{{first_name}}`, role, relevant profile info
- Ticket Block — show details, QR code, Apple Wallet button, Google Wallet button
- Class Details Block — class name, time, teacher name, room/location
- Payment Summary Block — line items, subtotal, total, payment method, date

**Social Block**
- Social media links — Instagram, TikTok, Facebook icons with URLs from studio profile

### 5.3 Block Behavior
- Blocks are drag-and-drop reorderable
- Each block has show/hide toggle for mobile vs desktop
- Minimum template: Header + at least one content block + Footer
- Header and Footer cannot be removed or reordered

---

## 6. Image Handling

Admins can insert images into email templates via two methods:

**Direct Upload**
- Upload from local device within the email editor
- Stored in tenant media library automatically

**Media Library**
- Browse and select from previously uploaded studio assets
- Shared across email templates and other platform modules

Image requirements:
- Max file size: 2MB
- Accepted formats: JPG, PNG, GIF, WebP
- Recommended width: 600px for full-width email images
- Platform auto-optimizes images for email delivery

---

## 7. Dynamic Variables

### 7.1 Universal Variables (available in all templates)
```
{{first_name}}         — recipient first name
{{studio_name}}        — tenant studio name
{{studio_phone}}       — tenant phone number
{{studio_address}}     — tenant full address
{{studio_website}}     — tenant website URL
{{current_year}}       — for footer copyright line
{{unsubscribe_link}}   — required in all marketing emails
```

### 7.2 Template-Specific Variables
Each template type exposes its own variable set (see Template Types table above).

### 7.3 Variable Insertion
- Admin clicks a `{{}}` button in the rich text editor toolbar to insert variables
- Dropdown shows available variables for that template type
- Variables render as preview values in the editor (e.g. `{{first_name}}` shows as "Sarah")
- Invalid or missing variables render as empty string, never as raw `{{variable_name}}`

---

## 8. Preview and Testing

### 8.1 Preview
- Default view: **mobile (375px wide)**
- Toggle to desktop (600px wide)
- Preview uses sample data — realistic fake values for all variables
- Preview renders in real-time as blocks are edited

### 8.2 Send Test
- Admin can send a test email to themselves or any email address
- Test email includes a banner: *"This is a test email sent from the BAM Platform"*
- Test sends are not logged in the communications inbox

### 8.3 Mobile-First Platform Principle
The mobile-first preview default is a platform-wide design principle. All previews across the platform (email, program, announcements) default to mobile view with desktop toggle available.

---

## 9. Versioning Model

### 9.1 Baseline Templates
- Owned and managed by Platform Super Admin (Green Lyzard)
- Applied automatically to all new tenants on onboarding
- New tenants always receive the latest baseline version

### 9.2 Studio Custom Templates (Fork Model)
- When a studio edits a baseline template, a **studio copy** is created
- The studio copy and baseline are now independent versions
- Baseline updates **never** overwrite or disrupt studio copies
- Studio copies persist indefinitely until the studio manually updates them

### 9.3 Baseline Update Notification
When Super Admin publishes a new baseline version:
- Studios with custom copies receive an in-app notification: *"A new default version of [Template Name] is available. Preview and apply if you'd like."*
- Studios can preview the new baseline side-by-side with their current version
- Applying the new baseline creates a new studio copy from the latest baseline
- Studios that have not customized a template automatically receive the latest baseline

### 9.4 Version History
- All template versions (baseline and studio) are stored with timestamps
- Studios can roll back to any previous version of their custom templates
- Super Admin can view version history across all tenants for audit purposes

---

## 10. Permissions

| Role | Capabilities |
|---|---|
| Platform Super Admin | Create/edit/publish baseline templates, view all tenant templates, push baseline updates |
| Studio Owner / Admin | Edit any studio template, send test emails, preview, reset to baseline |
| Studio Manager | Edit Announcement and Communication templates only — cannot edit transactional templates (auth, billing, tickets) |
| Teacher and below | No access |

---

## 11. Two-Way Reply Capture

All outbound studio emails set `Reply-To` to the studio's configured reply-to address (e.g. `dance@bamsocal.com`). Inbound replies are routed into the platform Communications Inbox and attached to the relevant family or lead profile.

**Requirements:**
- Every reply is captured and logged — nothing is lost in a personal inbox
- Full thread (outbound + inbound) visible on the family/lead profile
- Admins notified of new replies in-platform
- Reply capture is mandatory — studios cannot disable it

See `COMMUNICATIONS_INBOX.md` for full spec on the inbox module.

---

## 12. Database Schema

```sql
-- Baseline templates (platform-level)
create table email_template_baselines (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,          -- e.g. 'magic_link', 'enrollment_confirmation'
  version integer not null default 1,
  subject text not null,
  blocks jsonb not null,                -- ordered array of block configs
  variables jsonb not null,             -- available variables for this template type
  is_latest boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  published_at timestamptz
);

-- Studio template copies (tenant-level)
create table email_template_studio_copies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  template_type text not null,
  baseline_version integer,             -- which baseline version this was forked from
  subject text not null,
  blocks jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- Template send log
create table email_send_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  template_type text not null,
  recipient_email text not null,
  recipient_user_id uuid references auth.users(id),
  subject text not null,
  resend_message_id text,               -- for delivery tracking
  status text default 'sent',           -- sent, delivered, bounced, failed
  sent_at timestamptz default now()
);
```

---

## 13. API Routes

```
GET    /api/email-templates                    — list all templates for tenant
GET    /api/email-templates/:type              — get active template for type
PUT    /api/email-templates/:type              — save studio custom version
POST   /api/email-templates/:type/preview      — render preview with sample data
POST   /api/email-templates/:type/test         — send test email
POST   /api/email-templates/:type/reset        — reset to latest baseline
GET    /api/email-templates/baselines          — Super Admin: list all baselines
PUT    /api/email-templates/baselines/:type    — Super Admin: publish new baseline
```

---

## 14. Implementation Notes

- Email rendering uses **react-email** for template compilation
- Compiled HTML is stored on save to avoid re-rendering on every send
- Resend is the delivery provider — all sends go through the platform Resend account
- Each tenant's `sender_email` must be on a verified Resend domain
- Domain verification is handled during tenant onboarding (see SAAS.md)
- All emails are responsive by default — single-column layout on mobile
- Unsubscribe link is required in all announcement/communication emails (CAN-SPAM compliance)
- Transactional emails (auth, billing, tickets) do not require unsubscribe link

---

## 15. Open Questions
- None — all decisions resolved in Session 6.
