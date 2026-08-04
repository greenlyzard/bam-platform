# TICKETING.md
# Ballet Academy and Movement Platform — Ticketing Module

## Related Specs
- `PROGRAMS.md` — structured show program builder, data source for program delivery email
- `ROLES_AND_PERMISSIONS.md` — comp allocation permissions, door scanner activation
- `EMAIL_TEMPLATES.md` — ticket confirmation, comp claim, program delivery email templates
- `ANGELINA.md` — natural language comp allocation via Angelina

---

## 1. Overview

The Ticketing module manages ticket sales, complimentary ticket allocation, door scanning, and show-night communications for all studio productions. It supports both enrolled family purchases (portal account required) and anonymous outside buyer purchases (name and email only).

---

## 2. Purchase Flows

### 2.1 Enrolled Family Purchase (Portal Account)
- Buyer logs in to portal
- Selects show, quantity, and seat preference (if assigned seating)
- Completes checkout via saved payment method or new card
- Receives ticket confirmation email with QR codes, Apple Wallet, and Google Wallet links
- Tickets accessible in portal under "My Tickets"

### 2.2 Anonymous Outside Buyer Purchase
- No account required
- Buyer provides name and email only at checkout
- Completes purchase as guest
- Receives ticket confirmation email with QR codes, Apple Wallet, and Google Wallet links
- After purchase, system prompts buyer to create an account to manage tickets (view, transfer, add to wallet)
- Creating an account is optional — tickets are valid without an account

### 2.3 Gift / Comp Recipients (Claim Link)
- Recipient receives a claim link via email or SMS
- No account required to claim
- Recipient clicks link, enters name and email if not already known
- Ticket is issued immediately
- Claim link expires 24 hours after show end time

### 2.4 Multi-Ticket Purchase
- Buyers can purchase multiple tickets in a single transaction
- Each ticket in the order gets its own QR code
- All tickets delivered in a single confirmation email
- Each ticket can be transferred independently

---

## 3. Ticket Types

### 3.1 Paid Tickets
- Standard ticket sold through the portal or public purchase page
- Priced per show, configurable by Admin
- Supports GA (general admission) and assigned seating per show

### 3.2 Complimentary Tickets
- Manually allocated by Admin or above only
- No automatic comp grants per enrolled student
- Admin sets quantity and recipient — system generates claim link
- Angelina can allocate comps and send claim links via platform only
- Sponsor comps tracked separately from personal comps in all reporting

---

## 4. Capacity Management

### 4.1 Default: Strict Capacity
- Ticket sales stop automatically when maximum capacity is reached
- No oversell by default

### 4.2 Overbooking Buffer (Optional)
- Admin can enable an overbooking buffer per show
- Admin sets buffer quantity (e.g. allow 10 tickets over stated capacity)
- Buffer is not visible to buyers — show appears sold out to public when strict capacity is reached, but Admin can still issue comps into the buffer
- Default is strict — overbooking must be explicitly enabled per show

### 4.3 Waitlist
- When a show reaches strict capacity, waitlist option is presented to buyers
- Buyer provides name and email to join waitlist
- If a ticket becomes available (cancellation or transfer), next person on waitlist receives an offer email with a time-limited claim link
- Offer link expires in 24 hours — if not claimed, next person on waitlist is notified

---

## 5. Ticket Transfer

### 5.1 Default Behavior
- Tickets are transferable by default
- Ticket holder can transfer to another person — reassigns name and email on the ticket record
- Original buyer receives transfer confirmation email
- New holder receives ticket email with QR code, wallet links

### 5.2 Admin Disable
- Admin can disable transfers per-event
- When disabled, transfer option is hidden from ticket holder's portal view
- Tickets already transferred before the disable remain valid

---

## 6. Wallet Integration

### 6.1 Apple Wallet
- `.pkpass` file generated at purchase
- Available via confirmation email and portal "My Tickets" view
- Pass updates automatically if show details change (time, venue, etc.)

### 6.2 Google Wallet
- Google Wallet pass generated at purchase
- Available via confirmation email and portal "My Tickets" view
- Pass updates automatically if show details change

### 6.3 Pass Contents
- Studio logo and brand color
- Show title, date, time, venue
- QR code for door scanning
- Seat assignment (if applicable)

---

## 7. Comp Allocation

### 7.1 Manual Allocation
- All comps are manually created by Admin or above
- Admin selects show, quantity, recipient name, recipient email or phone
- System generates a unique claim link per comp block
- Admin can send claim link via:
  - Platform email
  - Platform SMS (via studio 229 number)
  - Never from Amanda's personal phone or personal accounts

### 7.2 Angelina Integration
- Angelina can allocate comps using natural language
- Example: "Give Amanda's family 4 comp tickets to the Saturday Nutcracker show"
- Angelina generates claim links and sends via platform only
- All Angelina comp actions are logged and auditable

### 7.3 Sponsor Comps
- Sponsor comps are tagged as `type: sponsor` in the database
- Personal comps are tagged as `type: personal`
- Reported separately in all show financial and attendance reports
- Sponsor comp allocation tracked against sponsor agreement records

---

## 8. Door Scanning Module

### 8.1 Scanner Access
- Mobile-first QR scanner — works in browser, no app install required
- Role-based access: Admin, Teacher, Parent Volunteer, General Volunteer
- Access is activated per-event by Admin — not on by default
- Admin grants scanner access to specific users for a specific show

### 8.2 Scan Behavior
- Scanner reads ticket QR code
- Instant feedback:
  - ✅ **Valid** — name, ticket type, seat (if assigned)
  - ⚠️ **Already Scanned** — shows time of first scan
  - ❌ **Invalid** — not a valid ticket for this show

### 8.3 Post-Scan Triggers
When a ticket is scanned for the first time:

**Push Notification** (to users with mobile app or web PWA installed)
- Sent to the ticket holder
- Message: welcome to the show, relevant show-night information

**Email to Ticket Holder**
- Triggered immediately on first scan
- Contains:
  - Show program (pulled from PROGRAMS.md structured builder)
  - Store/merch prompt (if store is active for that event — Admin configures per show)
  - Studio branding
- Uses the "Show Program Delivery" email template

---

## 9. Show-Night Notifications

### 9.1 Intermission Notification
- Sent by Admin or above manually during the show
- Push notification to all attendees who have app/PWA installed
- Preset option: "Intermission has begun" + custom message field
- Free-form push option also available

### 9.2 Show Resuming Notification
- Sent by Admin or above manually at end of intermission
- Preset option: "The show is resuming — please return to your seats" + custom message field
- Push notification to all attendees

### 9.3 General Announcement Push
- Admin can send any free-form push notification to all show attendees at any time
- Notifications sent via platform only — never from personal devices

### 9.4 Delivery Channels
- All show-night notifications go through the platform push notification system
- SMS fallback for attendees without app/PWA (using studio 229 number via Quo)
- Email fallback available for pre-show communications

---

## 10. Claim Link Behavior

- Unique URL generated per comp allocation
- URL format: `portal.{studio-domain}/claim/{token}`
- Token is cryptographically random, single-use
- Expiry: 24 hours after show end time
- After expiry: link shows a friendly expiry message, directs user to contact the studio
- Claimed tickets are immediately valid for door scanning
- Claim event is logged with timestamp and IP address

---

## 11. Reporting

### 11.1 Per-Show Reports
- Total tickets sold (paid)
- Total comps issued (personal vs sponsor, separately)
- Total claimed vs unclaimed comps
- Waitlist size
- Door scan count (total unique scans, duplicate scan attempts)
- Revenue breakdown

### 11.2 Season Reports
- Aggregate ticket revenue across all shows
- Comp allocation patterns (Admin, sponsor, per-show)
- Attendance trends

---

## 12. Database Schema

```sql
-- Shows (production events)
create table shows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  production_id uuid references productions(id),
  title text not null,
  show_date timestamptz not null,
  doors_open timestamptz,
  capacity integer not null,
  overbooking_buffer integer default 0,
  allow_transfers boolean default true,
  scanner_active boolean default false,
  store_active boolean default false,
  status text default 'on_sale',        -- on_sale, sold_out, cancelled, completed
  created_at timestamptz default now()
);

-- Tickets
create table tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  show_id uuid references shows(id) not null,
  order_id uuid references ticket_orders(id),
  holder_name text not null,
  holder_email text not null,
  holder_phone text,
  ticket_type text not null,            -- 'paid', 'comp_personal', 'comp_sponsor'
  seat_assignment text,
  qr_code text unique not null,
  status text default 'valid',          -- valid, scanned, transferred, cancelled
  scanned_at timestamptz,
  scanned_by uuid references auth.users(id),
  claim_token text unique,              -- for comp claim links
  claim_expires_at timestamptz,
  claimed_at timestamptz,
  transferred_from uuid references tickets(id),
  created_at timestamptz default now()
);

-- Ticket orders
create table ticket_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  show_id uuid references shows(id) not null,
  buyer_user_id uuid references auth.users(id),  -- null for anonymous
  buyer_name text not null,
  buyer_email text not null,
  quantity integer not null,
  total_amount integer not null,        -- in cents
  payment_intent_id text,
  status text default 'completed',
  created_at timestamptz default now()
);

-- Waitlist
create table ticket_waitlist (
  id uuid primary key default gen_random_uuid(),
  show_id uuid references shows(id) not null,
  name text not null,
  email text not null,
  position integer not null,
  offer_sent_at timestamptz,
  offer_expires_at timestamptz,
  status text default 'waiting',        -- waiting, offered, claimed, expired
  created_at timestamptz default now()
);

-- Comp allocations
create table comp_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  show_id uuid references shows(id) not null,
  allocated_by uuid references auth.users(id) not null,
  recipient_name text not null,
  recipient_email text,
  recipient_phone text,
  quantity integer not null,
  comp_type text not null,              -- 'personal', 'sponsor'
  sponsor_id uuid,                      -- if comp_type = 'sponsor'
  notes text,
  created_at timestamptz default now()
);

-- Scanner access grants
create table scanner_access (
  id uuid primary key default gen_random_uuid(),
  show_id uuid references shows(id) not null,
  user_id uuid references auth.users(id) not null,
  granted_by uuid references auth.users(id) not null,
  granted_at timestamptz default now()
);
```

---

## 13. Open Questions
- None — all decisions resolved in Session 6.

---

## Amendment — Transferable Comp Blocks, 2026-08-01

**Status:** Decided in conversation. Not specced beyond this section, not built.
**Amends:** §2.3 Gift / Comp Recipients.

### What §2.3 assumes, and why it is not enough

The existing comp flow assumes a **known recipient**: a claim link goes to a
person, they enter name and email, a ticket is issued to them. Identity is
collected at claim time, and every ticket traces to someone.

Amanda's actual practice does not work that way. She gives comps out constantly,
and a common case is a **block to an organisation** — ten tickets to a school,
which the school then splits among five families. The studio never learns who
sits in those seats, and does not need to.

That is not a comp with a missing name. It is a **bearer instrument that can be
subdivided**, and it needs three properties the current model does not have.

### 1. Custody without identity

A block can be held by the studio, by a named organisation, or by an admin, with
**no recipient identity at all**. It is not unallocated inventory — it is
committed to a purpose — but no person is attached.

States a block moves through:

| State | Meaning |
|---|---|
| `held` | Allocated to a purpose, no holder yet. Admin is sitting on it. |
| `assigned` | Given to a named holder — an organisation, a family, a person |
| `distributed` | The holder has passed some or all of it onward |
| `redeemed` | Scanned at the door |
| `expired` | Show ended, never scanned |
| `revoked` | Pulled back before use |

Identity may be attached at any point, or never.

### 2. Subdivision

A block of ten becomes two fives, or five twos, or ten ones. Each fragment must
be:

- independently claimable
- independently revocable
- traceable back to the block it came from

So a block is a tree, not a row. The parent has to know what became of its
children, or the reporting below cannot work.

### 3. Chain of custody

For each block, the studio needs to answer: how many were distributed, how many
were scanned, and how many were never used.

That is the whole point of tracking blocks at all. Without it there is no way to
tell a school placement that filled seats from one that filled none — which is
exactly the decision comps exist to inform next season.

### Delivery

A block or fragment can be sent by **SMS or email**, or held by an admin and
handed over physically. Delivery channel is a property of the transfer, not of
the ticket.

### The control consequence

**A subdividable bearer ticket is fundamentally harder to control than a claim
link, and the door scanner becomes the only enforcement point.**

A forwarded link can seat the wrong person. A block split arbitrarily has no
identity to check against. This is acceptable — it is how paper comps have always
worked — but the spec must say so plainly rather than implying that identity
collection provides control it does not provide.

Practical implications:

- Scan-once enforcement matters more here than on paid tickets
- Revocation must work at fragment level, not only at block level
- A block should carry a cap so a distribution error cannot exceed the house

### Attribution

`ANNOUNCEMENT_MODULE_SPEC.md` and the UTM work treat a comp as a tracked
marketing touch. Anonymous blocks weaken that: if a school distributes ten and
five families attend, the studio learns **the block converted** but not **who
converted**.

That is likely acceptable — channel-level attribution still tells you the school
placement worked — but it is a different answer than the named-comp case, and the
two should not be reported as though they carry the same confidence.

### Open

- Does a fragment inherit the parent's expiry, or carry its own?
- Can a holder subdivide, or only the studio? A school splitting ten into five is the motivating case, which implies holders can — but that means the studio is not the only party creating tickets.
- Does an anonymous redemption capture anything at the door — a name, a count, nothing?
- Are blocks per-performance or per-production? Ten tickets to a school is probably per-performance, since seats are dated.

- **Live stream tickets** are promised in the Nutcracker email sequence — "including live stream tickets for family who can't be there in person." Not modelled in §2. Depends on Cloudflare Stream, whose API token is still unfetched.
