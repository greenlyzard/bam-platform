# TICKETING.md
# Ballet Academy and Movement — Ticketing Module Spec
# Version: 1.0 | Status: Authoritative | Owner: Derek Shaw (Green Lyzard)
# Created: March 2026

---

## 1. Overview

The Ticketing module handles all aspects of performance ticket sales
and distribution for Ballet Academy and Movement productions. It supports
general admission and reserved seating, public ticket sales, complimentary
ticket allocation, seat holds, and SMS/portal delivery of tickets to
recipients.

A key design principle: Admin (and especially Amanda) should be able to
allocate and deliver complimentary tickets as naturally as giving an
instruction to a person. Angelina is the primary interface for this —
Amanda should be able to say "Give me 10 tickets together on any show,
any day, as close to the front as possible" and receive a shareable link
immediately.

Cross-references:
- PROGRAMS.md — show dates, venue, production data
- SCHEDULING_AND_LMS.md — productions, class_sessions (shows)
- COMMUNICATIONS.md — SMS/email delivery of ticket links
- BILLING.md — ticket revenue, complimentary tracking
- ANGELINA.md — natural language ticket allocation interface
- SAAS.md — per-tenant ticketing configuration

---

## 2. Ticket Types

| Type | Description | Price |
|---|---|---|
| General Admission | No assigned seat; first come first served | Set by Admin |
| Reserved — Standard | Assigned seat in standard section | Set by Admin |
| Reserved — Premium | Assigned seat in premium/front section | Set by Admin |
| Complimentary | Free ticket issued by Admin; tracked separately | $0 |
| Staff/Teacher Comp | Free ticket issued to staff | $0 |
| Press/Sponsor Comp | Free ticket issued to press or sponsor | $0 |

---

## 3. Venue Configuration

Each production/show is configured with a venue. Venues support both
general admission and reserved seating layouts.

```sql
venues (
  id              uuid PK DEFAULT gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  name            text NOT NULL,
  address         text,
  total_capacity  integer NOT NULL,
  seating_type    text DEFAULT 'general_admission',
    -- 'general_admission' | 'reserved' | 'mixed'
  seat_map_json   jsonb,
    -- null for GA; full seat map for reserved
  created_at      timestamptz DEFAULT now()
)
```

### 3.1 Seat Map Structure (Reserved Seating)

```json
{
  "sections": [
    {
      "id": "orchestra",
      "label": "Orchestra",
      "priority": 1,
      "rows": [
        {
          "id": "A",
          "seats": [
            { "id": "A1", "label": "A1", "status": "available" },
            { "id": "A2", "label": "A2", "status": "available" }
          ]
        }
      ]
    },
    {
      "id": "mezzanine",
      "label": "Mezzanine",
      "priority": 2,
      "rows": [...]
    }
  ]
}
```

Priority field is used by Angelina when Admin requests seats
"as close to the front as possible."

---

## 4. Show Configuration

Each class_session that is a performance type (`class_type = 'performance'`)
can have a ticketing configuration attached.

```sql
show_ticketing (
  id                  uuid PK DEFAULT gen_random_uuid(),
  tenant_id           uuid FK tenants NOT NULL,
  session_id          uuid FK class_sessions NOT NULL UNIQUE,
  venue_id            uuid FK venues NOT NULL,
  total_capacity      integer NOT NULL,
  ga_capacity         integer,         -- for mixed seating
  reserved_capacity   integer,         -- for mixed seating
  tickets_on_sale     boolean DEFAULT false,
  sale_opens_at       timestamptz,
  sale_closes_at      timestamptz,
  ga_price_cents      integer,         -- in cents
  reserved_price_cents integer,
  premium_price_cents integer,
  comp_ticket_pool    integer DEFAULT 0,
    -- total complimentary tickets allocated for this show
  comp_tickets_used   integer DEFAULT 0,
  max_tickets_per_order integer DEFAULT 8,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
)
```

---

## 5. Ticket Database Schema

```sql
tickets (
  id                uuid PK DEFAULT gen_random_uuid(),
  tenant_id         uuid FK tenants NOT NULL,
  session_id        uuid FK class_sessions NOT NULL,
  show_ticketing_id uuid FK show_ticketing NOT NULL,
  order_id          uuid FK ticket_orders nullable,
    -- null for individually issued comps
  ticket_type       text NOT NULL,
    -- 'general_admission' | 'reserved' | 'premium' |
    -- 'complimentary' | 'staff_comp' | 'press_comp'
  seat_id           text,
    -- null for GA; seat identifier for reserved (e.g. "A1")
  section_id        text,
    -- null for GA; section identifier
  holder_name       text,
  holder_email      text,
  holder_phone      text,
  status            text DEFAULT 'issued',
    -- 'reserved' | 'issued' | 'delivered' | 'checked_in' |
    -- 'cancelled' | 'voided'
  ticket_code       text UNIQUE NOT NULL,
    -- unique scannable code (UUID-based, used for QR)
  issued_by         uuid FK profiles nullable,
    -- who issued it (for comps)
  issued_to_note    text,
    -- internal note: "Spring gala sponsor", "Mayor's office"
  delivery_method   text,
    -- 'sms' | 'email' | 'portal' | 'manual'
  delivered_at      timestamptz,
  checked_in_at     timestamptz,
  checked_in_by     uuid FK profiles nullable,
  price_cents       integer DEFAULT 0,
  created_at        timestamptz DEFAULT now()
)

ticket_orders (
  id                uuid PK DEFAULT gen_random_uuid(),
  tenant_id         uuid FK tenants NOT NULL,
  session_id        uuid FK class_sessions NOT NULL,
  family_id         uuid FK families nullable,
    -- null for anonymous public purchase
  buyer_name        text NOT NULL,
  buyer_email       text NOT NULL,
  buyer_phone       text,
  ticket_count      integer NOT NULL,
  subtotal_cents    integer NOT NULL,
  fee_cents         integer DEFAULT 0,
  total_cents       integer NOT NULL,
  payment_status    text DEFAULT 'pending',
    -- 'pending' | 'paid' | 'refunded' | 'partially_refunded'
  payment_intent_id text,              -- Stripe payment intent
  order_token       text UNIQUE NOT NULL,
    -- public token for order lookup without login
  created_at        timestamptz DEFAULT now()
)

-- Seat holds: temporary reservation before payment
seat_holds (
  id              uuid PK DEFAULT gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  session_id      uuid FK class_sessions NOT NULL,
  seat_ids        text[] NOT NULL,
  hold_token      text UNIQUE NOT NULL,
  expires_at      timestamptz NOT NULL,
    -- typically now() + 10 minutes
  created_at      timestamptz DEFAULT now()
)

-- Complimentary ticket blocks
comp_blocks (
  id              uuid PK DEFAULT gen_random_uuid(),
  tenant_id       uuid FK tenants NOT NULL,
  session_id      uuid FK class_sessions nullable,
    -- null = applies to any show in the production
  production_id   uuid FK productions nullable,
  quantity        integer NOT NULL,
  seats_requested text,
    -- 'together' | 'front' | 'any' | specific section name
  preferred_section text,
  ticket_ids      uuid[],
    -- populated after seats are assigned
  recipient_name  text,
  recipient_phone text,
  recipient_email text,
  delivery_method text DEFAULT 'sms',
  claim_link      text,
    -- public URL for recipient to view/claim their tickets
  claim_token     text UNIQUE,
  status          text DEFAULT 'pending',
    -- 'pending' | 'assigned' | 'delivered' | 'claimed' | 'voided'
  note            text,
    -- internal note from issuer
  issued_by       uuid FK profiles NOT NULL,
  created_at      timestamptz DEFAULT now()
)
```

---

## 6. Complimentary Ticket System

This is the highest-priority feature of the Ticketing module.
Amanda must be able to allocate and deliver comp tickets as
quickly and naturally as possible.

### 6.1 The Angelina Interface

Amanda can ask Angelina in plain language:

**Example 1 — Block of seats, any show:**
> "I need 10 tickets together on any day, any performance,
> as close to the front as possible, to give away."

Angelina's response:
1. Queries all shows for the current production with available
   capacity in front sections
2. Finds the best available block of 10 contiguous seats
   in the highest-priority section
3. Presents options: "I found 10 seats together in Row B
   (Orchestra) for the Friday evening show, and 10 seats
   together in Row A (Orchestra) for the Saturday matinee.
   Which would you prefer?"
4. On confirmation: creates a comp_block, reserves the seats,
   generates a claim link
5. Returns: "Done — I've held 10 seats in Row A, Orchestra
   for Saturday matinee. Here's the claim link: [URL].
   Should I text this to someone?"

**Example 2 — Specific show, close to front:**
> "I need 5 tickets for Friday night as close to
> the front as possible."

Angelina:
1. Finds best 5 contiguous seats in front section, Friday show
2. Reserves them
3. Returns claim link + option to deliver via SMS

**Example 3 — With immediate delivery:**
> "I need 5 tickets for Saturday for the Martinez family.
> Text them to Maria at (949) 555-1234."

Angelina:
1. Finds 5 seats
2. Creates comp_block with recipient details
3. Sends SMS to (949) 555-1234 with claim link
4. Confirms: "Done — 5 tickets for Saturday reserved for
   the Martinez family and texted to Maria at (949) 555-1234."

### 6.2 Admin UI for Comp Blocks

Available at `/admin/tickets/comps`:
- List of all comp blocks with status
- Create new comp block (manual, non-Angelina)
- View claim link for any block
- Resend delivery (SMS/email)
- Void a comp block (releases seats back to inventory)
- Filter by show, status, issued by

### 6.3 Recipient Claim Flow

When recipient opens the claim link:
1. Page shows their reserved seats with show details
2. No login required
3. They enter their name (pre-filled if provided)
4. Click "Claim My Tickets"
5. Receive digital tickets (QR codes) via the same page
6. Option to add to Apple Wallet / Google Wallet (future)
7. Ticket status updates to 'claimed'

### 6.4 Seat Selection Algorithm for Comp Blocks

When Angelina or Admin requests a block of seats:

```typescript
async function findBestCompBlock(
  sessionId: string,
  quantity: number,
  preference: 'front' | 'together' | 'any',
  preferredSection?: string
): Promise<SeatBlock[]> {

  // 1. Get available seats, ordered by section priority then row
  const availableSeats = await getAvailableSeats(sessionId)

  // 2. Group by section, then by row
  const grouped = groupBySection(availableSeats)

  // 3. For each row, find contiguous blocks of `quantity`
  const blocks = findContiguousBlocks(grouped, quantity)

  // 4. Sort by preference:
  //    'front' → sort by section priority ASC, row ASC
  //    'together' → sort by block size DESC (largest contiguous)
  //    'any' → sort by section priority ASC

  // 5. If preferredSection specified, filter to that section first
  //    Fall back to all sections if not enough seats

  // 6. Return top 3 options for Angelina to present
  return blocks.slice(0, 3)
}
```

---

## 7. Public Ticket Sales

### 7.1 Public Ticket Page

Publicly accessible at:
```
portal.balletacademyandmovement.com/tickets/[production-slug]
```

Page shows:
- Production name, dates, venue
- Show selector (Friday evening / Saturday matinee / etc.)
- Ticket type selector (GA / Reserved / Premium)
- Quantity selector
- Seat map (for reserved shows — interactive SVG)
- Total price
- Checkout button

### 7.2 Checkout Flow

1. Customer selects show + quantity + seats
2. System creates seat_hold (10 minute timer visible to customer)
3. Customer enters name, email, phone
4. Payment via Stripe (payment adapter)
5. On success: tickets issued, order confirmed
6. Confirmation email + SMS sent with ticket links
7. Seat hold released on success or expiration

### 7.3 Seat Hold Timer

- Seats are held for 10 minutes during checkout
- Visual countdown timer shown to customer
- If timer expires, hold is released and customer is notified
- Customer must restart selection

### 7.4 Per-Family Ticket Limits

`show_ticketing.max_tickets_per_order` — enforced at checkout.
Default: 8 tickets per order. Families of enrolled students can
request additional tickets via Admin.

---

## 8. Door Check-In

At the door, staff can check in ticket holders using:

### 8.1 QR Scan
- Each ticket has a unique QR code
- Staff opens `/admin/tickets/checkin/[session-id]` on tablet/phone
- Camera scans QR → instant green/red confirmation
- Shows: seat number, ticket type, holder name

### 8.2 Name Lookup
- Staff can search by holder name or email
- Check in manually from search result

### 8.3 Check-In Dashboard
- Real-time count: tickets issued vs. checked in
- Alert if capacity nearing

---

## 9. Ticket Delivery Methods

| Method | When Used | Details |
|---|---|---|
| SMS | Comp blocks with phone number | Twilio via Communications module |
| Email | Public purchases; comp blocks with email | Resend via Communications module |
| Portal | Enrolled families | Available in parent portal under My Tickets |
| Claim Link | All comp blocks | Universal — works without login |
| Apple/Google Wallet | Future Phase | Pass generation via Wallet APIs |

### 9.1 SMS Message Format
```
Your [X] tickets for [Production Name] — [Show Date/Time]
at [Venue] are ready. View your tickets here: [claim link]

Tap to add to your phone's wallet (coming soon).

Questions? (949) 229-0846
```

### 9.2 Email Format
Branded email via Resend:
- Subject: "Your tickets for [Production Name]"
- QR code(s) displayed prominently
- Show date, time, venue, seat info
- Add to calendar link

---

## 10. Revenue and Reporting

### 10.1 Ticket Revenue Summary

Available at `/admin/tickets/reports`:
- Revenue by show (gross, net of fees)
- Tickets sold vs. capacity per show
- Comp tickets issued (count + notional value)
- Check-in rate per show
- Payment method breakdown

### 10.2 Comp Ticket Tracking

Every complimentary ticket is tracked:
- Who issued it (Admin name)
- Recipient (if known)
- Reason/note
- Whether it was claimed
- Notional value (face value of equivalent paid ticket)

This feeds into the production P&L in the Finance module.

### 10.3 Integration with BILLING.md

Ticket revenue is recorded as `billing_charges` entries with
`charge_type = 'ticket_sale'` for financial reporting.
Comp tickets are recorded as `charge_type = 'comp_ticket'`
with `amount = 0` and `notional_value` for P&L purposes.

---

## 11. Admin Interface Summary

| Route | Purpose | Access |
|---|---|---|
| /admin/tickets | Ticketing overview dashboard | Studio Admin+ |
| /admin/tickets/shows | Configure show ticketing | Studio Admin+ |
| /admin/tickets/comps | Comp block management | Studio Admin+ |
| /admin/tickets/checkin/[id] | Door check-in (mobile-optimized) | All staff |
| /admin/tickets/orders | All orders and ticket lookup | Finance Admin+ |
| /admin/tickets/reports | Revenue and attendance reports | Finance Admin+ |

---

## 12. Angelina Ticketing Commands

Angelina understands natural language ticketing requests
from Studio Admin and Super Admin. Supported intents:

| Intent | Example Phrase |
|---|---|
| Find and reserve comp block | "I need 10 tickets together, any show" |
| Reserve for specific show | "5 tickets Friday night, front row if possible" |
| Reserve and deliver | "10 tickets Saturday, text them to [name] at [phone]" |
| Check availability | "How many seats are left for Friday?" |
| Check comp usage | "How many comp tickets have we given out?" |
| Void a comp block | "Cancel the tickets I reserved for the Martinez family" |
| Check-in status | "How many people have checked in for tonight's show?" |

Angelina does NOT process paid ticket sales — those go through
the public ticket page and Stripe checkout.

---

## 13. SaaS Considerations

- All ticket data scoped to tenant_id
- Venue seat maps are per-tenant
- Ticket revenue routes through tenant's configured payment adapter
- Public ticket page URL: `/tickets/[tenant-slug]/[production-slug]`
  (for BAM on dedicated domain: `/tickets/[production-slug]`)
- Comp ticket tracking and reporting available to all plans
- Reserved seating seat map builder: Growth plan and above
- Door check-in app: all plans

---

## 14. Implementation Phases

### Phase 1 — Comp Tickets + GA (Target: Spring 2026)
- [ ] venues table
- [ ] show_ticketing table
- [ ] tickets table
- [ ] comp_blocks table
- [ ] Angelina comp ticket intent handlers
- [ ] Comp block claim page (public, no login)
- [ ] SMS delivery via Twilio
- [ ] Admin comp management at /admin/tickets/comps
- [ ] Basic GA public ticket page
- [ ] Stripe checkout for GA tickets
- [ ] Ticket email/SMS delivery for paid tickets
- [ ] Door check-in (QR scan + name lookup)

### Phase 2 — Reserved Seating (Target: Summer 2026)
- [ ] Seat map builder in Admin
- [ ] Interactive seat map on public ticket page
- [ ] seat_holds with timer
- [ ] Reserved and premium ticket types
- [ ] Comp block seat selection algorithm
- [ ] Apple/Google Wallet pass generation

### Phase 3 — Reporting + Finance Integration (Post-Summer)
- [ ] Revenue reports at /admin/tickets/reports
- [ ] Comp ticket P&L tracking → BILLING.md
- [ ] Ticket revenue → billing_charges

---

## 15. Open Questions

- Should ticket sales go through the portal (requires account)
  or be fully anonymous (name + email only)?
- Should enrolled families receive any complimentary tickets
  automatically (e.g. 2 per student), or is all comp allocation manual?
- Should there be a waitlist for sold-out shows?
- For GA shows: should we track capacity strictly (stop sales at max)
  or allow slight oversell with an overbooking buffer?
- Should sponsor comp allocations be tracked separately from
  personal comps for reporting purposes?
- Should Angelina be able to send comp links directly via iMessage
  from Amanda's phone, or only via the platform SMS system?
- For the claim link: should it expire? If so, when?
  (Suggested: expires 24 hours after show end time)

---

*This file is part of the BAM Platform specification library.*
*All modules are documented before implementation begins.*
*See CLAUDE.md for the full module cross-reference index.*
