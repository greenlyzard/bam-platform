# Contact Aliases — Spec Addendum to CONTACT_CHANNELS.md

**Status:** Ready for implementation  
**Appended:** April 8, 2026  
**Extends:** CONTACT_CHANNELS.md (the contact_channels table already exists)  
**Decision Log Date:** April 8, 2026

---

## 1. The Problem

A parent may contact the studio from multiple email addresses or phone numbers:
- Personal Gmail (jennifer@gmail.com)
- Work email (jsmith@company.com)
- Spouse's phone number
- A secondary cell

Without alias linking, each contact creates a separate lead or thread. Amanda ends up with duplicate records and fragmented conversation history for the same family.

---

## 2. Solution — Contact Aliases via contact_channels

The `contact_channels` table already supports multiple emails and phones per profile. The missing pieces are:

1. **Inbound matching** — the classifier must check ALL contact_channels values when matching a sender, not just the primary email
2. **Admin UI** — ability to add/link/remove contact channels from a profile or lead
3. **Alias suggestion** — when a new inbound message arrives from an unknown address, if there's a fuzzy match to an existing family, surface the suggestion

---

## 3. Inbound Matching Update

When an inbound email or SMS arrives, the sender matching order should be:

```
1. contact_channels WHERE value = sender_email AND channel_type = 'email'
   → matches any email (primary OR secondary) linked to any profile
2. leads WHERE email = sender_email
3. families WHERE billing_email = sender_email
4. profiles WHERE email = sender_email (legacy — primary email on profile)
5. No match → create unmatched record
```

This means a parent who emails from their work address (linked as a secondary channel) is correctly matched to their existing family record.

**Same logic for SMS:**
```
1. contact_channels WHERE value = normalized_phone AND channel_type IN ('sms','phone')
2. leads WHERE phone = normalized_phone
3. profiles WHERE phone = normalized_phone
4. No match → unmatched_sms
```

---

## 4. Admin UI — Contact Channel Management

### 4.1 Where It Appears

- **Family profile** → Contact tab → "Email Addresses" and "Phone Numbers" sections
- **Lead drawer** → below Guardian section → "Additional Contact Methods"
- **Student profile** → Contact tab (for 18+ students)

### 4.2 Per-Profile Contact Section

```
Email Addresses
  ✉ jennifer@gmail.com          [Primary] [✓ Opted In]    [Make Primary] [Remove]
  ✉ jsmith@company.com          [Secondary]                [Make Primary] [Remove]
  [+ Add Email Address]

Phone Numbers
  📱 (949) 555-1234             [Primary] [✓ SMS Opted In] [Make Primary] [Remove]
  📱 (949) 555-5678             [Secondary — spouse]        [Make Primary] [Remove]
  [+ Add Phone Number]
```

### 4.3 Add Contact Channel Flow

Admin clicks "+ Add Email Address":
1. Input field appears: email address + label (optional: "work", "spouse", "backup")
2. Toggle: "Set as primary" (default: off)
3. Save → inserts into contact_channels with source='manual'
4. If set as primary: previous primary flipped to is_primary=false

Admin clicks "+ Add Phone Number":
1. Input field: phone number (auto-formatted to E.164)
2. Label field: optional ("cell", "spouse", "work")
3. SMS opt-in toggle: default off (must be explicitly opted in per TCPA)
4. Save → inserts into contact_channels

### 4.4 Make Primary

- Clicking "Make Primary" on a non-primary channel:
  1. Sets clicked channel is_primary=true
  2. Sets previous primary is_primary=false
  3. Updates profiles.email or profiles.phone to match (keeps them in sync)
  4. Triggers Klaviyo re-sync with new primary email

### 4.5 Remove Contact Channel

- Cannot remove the only channel of a type (must have at least one email)
- Cannot remove primary without designating a new primary first
- Soft-delete: set is_verified=false and add removed_at timestamp (don't delete — preserves message history)

---

## 5. Alias Suggestion in Unmatched Folder

When an unmatched inbound message arrives, the platform runs a fuzzy match:

**Email fuzzy match signals:**
- Same email domain as an existing family (e.g. @smithfamily.com)
- Name in email signature matches existing profile name (parsed from body)
- Reply-to address in email header matches existing profile

**SMS fuzzy match signals:**
- Area code matches existing family's area code
- Message mentions a student name that exists in the DB

If a fuzzy match is found (confidence > 0.7), the unmatched folder shows:

```
⚡ Possible match: This looks like it might be from Jennifer Smith (Smith Family)
   [Link to Jennifer Smith] [Not a match — create new lead]
```

If admin clicks "Link to Jennifer Smith":
- The sender email/phone is added to Jennifer's contact_channels as a secondary channel
- The message is moved to Jennifer's family thread
- Future messages from this address auto-match

---

## 6. Lead-to-Profile Alias Migration

When a lead is converted to an enrolled student (via "Create Student" in the pipeline):
- The lead's email is inserted into contact_channels for the new profile as primary email
- The lead's phone (if captured) is inserted as primary phone
- Any additional emails captured during lead lifecycle are inserted as secondary channels
- All historical threads linked to the lead are transferred to the new profile/family

---

## 7. DB Additions

```sql
-- Add label and removed_at to contact_channels
ALTER TABLE contact_channels
  ADD COLUMN IF NOT EXISTS label text,        -- 'work', 'spouse', 'personal', etc.
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,  -- soft delete
  ADD COLUMN IF NOT EXISTS removed_by uuid;   -- who removed it

-- Index for fast inbound matching across all channels
CREATE INDEX IF NOT EXISTS idx_contact_channels_value_type 
  ON contact_channels(value, channel_type) 
  WHERE removed_at IS NULL;

-- Index for tenant-scoped inbound matching
CREATE INDEX IF NOT EXISTS idx_contact_channels_tenant_value
  ON contact_channels(tenant_id, value)
  WHERE removed_at IS NULL;
```

---

## 8. Inbound Route Update Required

Update `app/api/communications/inbound/route.ts` sender matching:

```typescript
// Step 1: Check ALL contact channels (catches secondary emails)
const { data: channelMatch } = await supabaseAdmin
  .from('contact_channels')
  .select('profile_id, is_primary, channel_type')
  .eq('value', senderEmail.toLowerCase())
  .eq('channel_type', 'email')
  .eq('tenant_id', tenantId)
  .is('removed_at', null)
  .limit(1)
  .single()

if (channelMatch) {
  // match to profile → fetch family → attach to existing thread
}
// Step 2, 3, 4... (existing logic)
```

---

## 9. Decisions Log

| # | Decision |
|---|---|
| 1 | contact_channels table already exists — this spec adds UI and matching logic only |
| 2 | Inbound matching checks ALL contact_channels values (primary + secondary) before falling back to unmatched |
| 3 | Admin can add unlimited emails and phones to any profile or lead |
| 4 | Only one primary per channel type — making a new primary automatically demotes the old one |
| 5 | Cannot remove the last channel of a type, or remove primary without designating new primary |
| 6 | Removal is soft-delete — preserves message history linkage |
| 7 | Fuzzy match surfaced in unmatched folder when confidence > 0.7 |
| 8 | Admin can one-click link an unmatched sender to an existing profile |
| 9 | Linking adds the new address as secondary channel automatically |
| 10 | Lead conversion migrates all captured emails/phones to contact_channels |
| 11 | Label field added (work/spouse/personal/etc) — optional but useful for admin clarity |
