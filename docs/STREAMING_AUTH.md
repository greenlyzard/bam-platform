# BAM Platform — Streaming Authorization & Family Access

## Philosophy

Inspired by GameChanger's team admin model, but more nuanced.
Ballet performances involve grandparents, divorced families, and extended family
who may not be the primary account holder. The system must handle this gracefully
while keeping streams completely secure.

---

## Role Hierarchy for Streaming

```
Super Admin (Amanda/Derek)
  └── Studio Admin
        └── Teacher (stream initiator)
              └── Primary Parent (account holder)
                    └── Co-Parent (secondary linked account)
                          └── Guest Viewers (family tokens)
```

---

## Stream Types & Access Rules

### Type 1: Class Stream (weekly classes)
**Who can watch:** Primary parent + co-parent of enrolled student only
**Access method:** Automatic — no action needed if enrolled
**Shareable:** No — class streams are not shareable outside enrolled family
**Rationale:** Child safety — only verified parents of that student

### Type 2: Performance Stream (Nutcracker, recitals)
**Who can watch:** Purchased ticket holders + complimentary family links
**Access method:** Ticket purchase OR guest link from primary parent
**Shareable:** Yes — primary parent can share up to X guest links
**Paid or free:** Admin configures per performance

### Type 3: Recorded Class (post-session replay)
**Who can watch:** Same as Class Stream — enrolled family only
**Expires:** 7 days after class date (configurable by admin)

### Type 4: LMS Content (teacher-uploaded technique videos)
**Who can watch:** Enrolled students + their parents
**Access method:** Automatic via enrollment
**Shareable:** No

---

## Family Access Model (GameChanger-inspired)

### Primary Parent
- Creates the account
- Enrolls student(s)
- Automatically gets access to all streams for their enrolled children
- Can invite Co-Parent
- Can generate Guest Viewer links for performances

### Co-Parent
- Invited by Primary Parent via email
- Gets same stream access as Primary Parent
- Cannot invite additional co-parents (admin can override)
- Linked to same student(s) as Primary Parent
- Has own login — not shared credentials

```sql
create table family_members (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  profile_id uuid references profiles(id),
  role text not null, -- 'primary_parent' | 'co_parent' | 'guest'
  invited_by uuid references profiles(id),
  invited_at timestamptz,
  accepted_at timestamptz,
  status text default 'pending', -- 'pending' | 'active' | 'revoked'
  created_at timestamptz default now(),
  unique(student_id, profile_id)
);
```

### Guest Viewer (performance only)
- Primary parent generates a time-limited link
- No account required — token-based access
- Can watch only the specific performance they were granted
- Link expires when performance ends (+ 24hr grace for replay)
- Admin sets max guest links per family per performance (default: 4)

```sql
create table guest_stream_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references live_sessions(id),
  created_by uuid references profiles(id), -- primary parent
  token text unique not null default gen_random_uuid()::text,
  label text, -- "Grandma Carol", "Uncle Mike"
  email text, -- optional, for sending the link
  max_views int default 1, -- prevent sharing the same link
  view_count int default 0,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked boolean default false,
  created_at timestamptz default now()
);
```

---

## Studio Admin Controls (GameChanger Team Admin equivalent)

### Admin can:
- See all active streams in real time
- End any stream immediately
- Revoke any guest token
- Set max guest links per family per performance
- Set performance ticket price (or $0 for free)
- Enable/disable recording for any session
- Set recording expiry duration
- Add complimentary access for specific families (e.g., scholarship students)
- Export viewer report per performance

### Admin CANNOT delegate to:
- Parents (parents cannot manage other parents' access)
- Teachers (teachers initiate streams, not manage access)

---

## Authorization Flow — Step by Step

### Flow 1: Class Stream

```
1. Teacher taps "Go Live" in Teacher Portal
2. System checks: class has enrolled students
3. Stream starts on Cloudflare Stream
4. Supabase Realtime broadcasts event to all enrolled family_members
5. Push notification: "Ms. Amanda is live in Pre-Ballet!"
6. Parent taps notification → app checks:
   a. Is user authenticated? If not → login prompt
   b. Does user have family_member record for a student in this class?
   c. Is family_member.status = 'active'?
   d. All checks pass → issue Cloudflare Stream signed URL (expires 4hr)
7. Parent watches stream
8. Teacher ends stream → recording saved
9. Signed URLs invalidated automatically
```

### Flow 2: Performance Stream (Paid)

```
1. Admin creates live_session with is_paid=true, ticket_price_cents set
2. Admin publishes performance page with "Buy Ticket" CTA
3. Parent clicks Buy Ticket:
   a. Stripe Checkout opens
   b. Payment processed
   c. stream_access record created: {user_id, session_id, access_type: 'purchased'}
   d. Confirmation email sent via Resend with stream link
4. On performance day:
   a. Parent clicks link → auth check
   b. stream_access record verified
   c. Signed URL issued
5. Parent can share guest links:
   a. Taps "Share with Family"
   b. Sees list of their named guest slots (e.g., 4 available)
   c. Enters name + optional email for each guest
   d. guest_stream_token created with 48hr expiry
   e. Link sent to guest email OR copied to clipboard
6. Guest opens link:
   a. No login required
   b. Token validated: not expired, not revoked, view_count < max_views
   c. view_count incremented
   d. Cloudflare signed URL issued (expires when stream ends + 1hr)
```

### Flow 3: Free Performance Stream

```
Same as paid but:
- No Stripe step
- stream_access created automatically for all enrolled families
- Admin can also create bulk stream_access for all active students
```

---

## Security Controls

### Signed URLs (Critical)
Never expose raw Cloudflare Stream URLs. Always use signed tokens:

```typescript
// Server-side only — never in client code
async function getSignedStreamUrl(videoId: string, expiresIn: number) {
  const token = await cloudflare.stream.createSignedUrl(videoId, {
    expiresIn, // seconds
    allowedOrigins: ['portal.balletacademyandmovement.com'],
  })
  return `https://customer-${CF_CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`
}
```

### Rate Limiting
- Max 3 stream access attempts per IP per minute
- Max 10 guest token generations per family per performance
- Concurrent view limit: 2 devices per ticket (configurable)

### Audit Trail
```sql
create table stream_access_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references live_sessions(id),
  accessor_type text, -- 'authenticated_user' | 'guest_token'
  accessor_id text, -- user_id or guest_token_id
  ip_address text,
  user_agent text,
  event text, -- 'joined' | 'left' | 'token_rejected' | 'auth_failed'
  created_at timestamptz default now()
);
```

---

## Parent UX — Guest Link Management

```
┌─────────────────────────────────────┐
│  🎭 The Nutcracker — Dec 14, 7:00pm │
│  Live Stream Access                 │
├─────────────────────────────────────┤
│  ✅ Your ticket is confirmed         │
│                                     │
│  Share with family (4 links left)   │
│                                     │
│  [+ Add Grandma Carol]              │
│  [+ Add Uncle Mike]                 │
│  [+ Add Family Friend]              │
│                                     │
│  Sent links:                        │
│  👤 Grandma Carol  ✅ Opened         │
│  👤 Uncle Mike     📧 Sent           │
│                                     │
│  Links expire Dec 15 at midnight    │
└─────────────────────────────────────┘
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Divorced parents, custody dispute | Both get independent access — system is neutral |
| Parent shares guest link on social media | view_count limit prevents mass access |
| Student unenrolled mid-season | Access revoked at next stream; family notified |
| Teacher accidentally streams wrong class | Admin can end stream remotely in real-time |
| Guest link forwarded to third party | IP/device fingerprint logs anomaly; admin can revoke |
| Parent can't attend, wants recording | Recording auto-available for 7 days post-stream |
| Scholarship family, can't afford ticket | Admin grants complimentary access silently |
| Performance sells out of streams | Admin sets max_viewers cap; overflow sees "sold out" |

---

## COPPA / Child Safety Notes

- Stream thumbnails never show identifiable child faces
- Recording URLs are signed and not guessable
- Guest tokens never include student names
- Admin can see viewer list but parents cannot see who else is watching
- No public chat on any stream type
