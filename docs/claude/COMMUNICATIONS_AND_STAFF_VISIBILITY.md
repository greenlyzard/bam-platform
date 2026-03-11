# Communications & Staff Visibility
## docs/claude/COMMUNICATIONS_AND_STAFF_VISIBILITY.md

---

## Guiding Principle

Every interaction a family has with BAM — chatbot conversation, trial booking, enrollment inquiry, contact form, email reply — is a business record. Staff need visibility into these records to do their jobs: follow up on leads, answer parent questions, prepare for new students, coordinate across roles.

But not all staff should see all records. The specific risk: teachers who have access to parent contact information can recruit students to private studios or competing programs. BAM protects against this by separating contact data from class/performance data at the role level.

**The rule:** Teachers see what they need to teach. They do not see how to reach the family outside of BAM.

---

## Staff Roles & Access Levels

| Role | Who | Access Level |
|------|-----|-------------|
| **Owner/Director** | Amanda Cobb | Full — all data, all correspondence, all financials |
| **Studio Manager** | Designated admin | Full minus financials unless granted |
| **Front Desk** | Reception/admin staff | Leads, inquiries, trial bookings, enrollment status. No financials. |
| **Teacher** | All teaching staff | Own class rosters, rehearsal schedules, student notes. No contact info, no financial data, no other teachers' students. |
| **Guest Teacher** | Substitutes, workshop leads | Assigned class roster only, for that session only. Auto-expires. |

---

## Correspondence Types & Who Sees What

### 1. Angelina Chat Logs

Every conversation Angelina has is logged: timestamp, session ID, visitor type (anonymous/authenticated), full transcript, and outcome (trial booked / enrolled / dropped off / handed to staff).

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Full transcript | ✅ | ✅ | ✅ | ❌ |
| Visitor name (if given) | ✅ | ✅ | ✅ | ❌ |
| Visitor email (if given) | ✅ | ✅ | ✅ | ❌ |
| Visitor phone (if given) | ✅ | ✅ | ✅ | ❌ |
| Class interest / child's age | ✅ | ✅ | ✅ | ❌ |
| Outcome / next step | ✅ | ✅ | ✅ | ❌ |
| Linked to enrolled student | ✅ | ✅ | ✅ | Own students only, no contact info |

**Why teachers don't see chat logs:** Chat logs contain parent contact details. Even if the log is "about" a student in their class, the teacher doesn't need the parent's email from a lead conversation — they communicate through the portal.

---

### 2. Trial Class Bookings

When a family books a free trial through Angelina or the enrollment form.

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Child's name | ✅ | ✅ | ✅ | ✅ (day of class) |
| Child's age / level | ✅ | ✅ | ✅ | ✅ |
| Which class / date | ✅ | ✅ | ✅ | ✅ |
| Parent name | ✅ | ✅ | ✅ | ❌ |
| Parent email | ✅ | ✅ | ✅ | ❌ |
| Parent phone | ✅ | ✅ | ✅ | ❌ |
| Referred by / source | ✅ | ✅ | ✅ | ❌ |
| Follow-up status | ✅ | ✅ | ✅ | ❌ |
| Teacher's observation notes | ✅ | ✅ | ✅ | Own notes only |

**Teacher view for trial day:** Teacher sees "Sofia, age 7, trial student today — no prior experience." That's it. Contact info and follow-up is handled by front desk.

---

### 3. Contact Form Submissions

Families filling out the "Contact Us" form on the website or through the portal.

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Full message | ✅ | ✅ | ✅ | ❌ |
| Contact name | ✅ | ✅ | ✅ | ❌ |
| Contact email | ✅ | ✅ | ✅ | ❌ |
| Contact phone | ✅ | ✅ | ✅ | ❌ |
| Subject / class of interest | ✅ | ✅ | ✅ | ❌ |

---

### 4. Enrollment Records

When a student completes the enrollment flow.

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Student name | ✅ | ✅ | ✅ | Own students only |
| Student DOB / age | ✅ | ✅ | ✅ | Own students only |
| Medical notes / allergies | ✅ | ✅ | ✅ | Own students only |
| Enrolled classes | ✅ | ✅ | ✅ | Own students only |
| Enrollment date | ✅ | ✅ | ✅ | ❌ |
| Parent name | ✅ | ✅ | ✅ | ❌ |
| Parent email | ✅ | ✅ | ✅ | ❌ |
| Parent phone | ✅ | ✅ | ✅ | ❌ |
| Payment method | ✅ | ✅ | ❌ | ❌ |
| Monthly fee / discounts | ✅ | ✅ | ❌ | ❌ |
| Billing history | ✅ | ✅ | ❌ | ❌ |

---

### 5. Email Correspondence (Inbound)

Emails sent to dance@bamsocal.com or captured via form.

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Full email content | ✅ | ✅ | ✅ | ❌ |
| Sender name | ✅ | ✅ | ✅ | ❌ |
| Sender email address | ✅ | ✅ | ✅ | ❌ |
| Subject / topic | ✅ | ✅ | ✅ | ❌ |
| Linked student (if known) | ✅ | ✅ | ✅ | ❌ |
| Response status | ✅ | ✅ | ✅ | ❌ |

**Why teachers don't see inbound emails:** Email is the primary vector for poaching. A teacher with access to parent email addresses has everything they need to reach out privately.

---

### 6. Portal Messages (In-App)

Messages sent through the portal's messaging feature.

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Messages in own thread | ✅ | ✅ | ✅ | Own threads only |
| All parent↔teacher messages | ✅ | ✅ | ✅ | ❌ |
| Parent's direct contact info | ✅ | ✅ | ✅ | ❌ |
| Class announcements they sent | ✅ | ✅ | ✅ | Own announcements |

Teachers can communicate with parents **through the portal only** — they cannot see the parent's underlying email address. The portal mediates all communication.

---

### 7. Announcement & Blast History

Studio-wide emails, class notices, and Klaviyo campaign results.

| Data Point | Owner | Studio Manager | Front Desk | Teacher |
|-----------|-------|----------------|------------|---------|
| Full recipient list | ✅ | ✅ | ❌ | ❌ |
| Open/click rates | ✅ | ✅ | ✅ | ❌ |
| Message content | ✅ | ✅ | ✅ | Own sends only |
| Unsubscribes | ✅ | ✅ | ✅ | ❌ |

---

## The Leads Pipeline

All new inquiries — regardless of source — flow into a unified leads view in the admin dashboard.

### Sources
- Angelina chat (public widget)
- Trial booking form
- Contact form (WordPress + portal)
- Direct email to dance@bamsocal.com
- Phone inquiry (manually logged by front desk)
- Referral (captured during enrollment)
- Walk-in (manually logged)

### Lead Record Fields
```
lead_id
source: 'angelina' | 'trial_form' | 'contact_form' | 'email' | 'phone' | 'referral' | 'walk_in'
status: 'new' | 'contacted' | 'trial_scheduled' | 'trial_completed' | 'enrolled' | 'lost'
created_at
child_name (optional)
child_age (optional)
child_experience (optional)
class_interest (optional)
parent_name
parent_email
parent_phone
preferred_days (optional)
notes (free text, staff-added)
assigned_to (staff member handling follow-up)
follow_up_date
angelina_session_id (if from chatbot)
enrolled_student_id (if converted)
referral_source (optional)
```

### Lead Pipeline View (Admin/Front Desk Only)
- Kanban board: New → Contacted → Trial Scheduled → Trial Complete → Enrolled / Lost
- Filter by source, assigned staff, date range
- Click any lead → full timeline: chat transcript, emails, trial notes, enrollment outcome
- Flag leads for follow-up with due dates
- Export to CSV for Klaviyo import

---

## Database Schema

### `leads` table
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- angelina | trial_form | contact_form | email | phone | referral | walk_in
  status TEXT NOT NULL DEFAULT 'new',
  child_name TEXT,
  child_age INTEGER,
  child_experience TEXT,
  class_interest TEXT,
  parent_first_name TEXT,
  parent_last_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  preferred_days TEXT[],
  notes TEXT,
  assigned_to UUID REFERENCES staff(id),
  follow_up_date TIMESTAMPTZ,
  angelina_session_id UUID REFERENCES chat_sessions(id),
  enrolled_student_id UUID REFERENCES students(id),
  referral_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `chat_sessions` table
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL DEFAULT 'public', -- public | portal | admin
  visitor_type TEXT DEFAULT 'anonymous', -- anonymous | authenticated
  user_id UUID REFERENCES auth.users(id), -- null if anonymous
  messages JSONB NOT NULL DEFAULT '[]',
  -- Each message: { role: 'user'|'assistant', content: string, timestamp: ISO }
  outcome TEXT, -- trial_booked | enrolled | dropped_off | handed_to_staff | null
  lead_id UUID REFERENCES leads(id),
  ip_hash TEXT, -- hashed for privacy
  started_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);
```

### `lead_activities` table (timeline)
```sql
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  -- 'chat' | 'email_in' | 'email_out' | 'phone_call' | 'trial' | 'note' | 'status_change'
  content TEXT,
  staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies
```sql
-- Leads: admin + front desk only
CREATE POLICY "leads_admin_frontdesk" ON leads
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('admin', 'studio_manager', 'front_desk')
  );

-- Chat sessions: admin + front desk only
CREATE POLICY "chat_sessions_admin_frontdesk" ON chat_sessions
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('admin', 'studio_manager', 'front_desk')
  );

-- Teachers: NO access to leads or chat_sessions (no policy = no access)
```

---

## Angelina Chat — What Gets Captured

Every public chat session automatically:
1. Creates a `chat_sessions` record with full message log
2. On any of these triggers, creates or updates a `leads` record:
   - Visitor provides name or email
   - Visitor asks about a specific child's age
   - Visitor expresses intent to enroll
   - Trial class is booked
   - Visitor asks for callback

### Auto-capture fields from Angelina
Angelina's API route parses each response for signals and extracts:
- Child's name (if mentioned)
- Child's age (if mentioned)
- Class interest (which discipline, day preference)
- Parent's name (if given)
- Contact info (if given)
- Outcome (trial booked → link to trial record)

These are written to the `leads` table automatically — no manual data entry by staff.

---

## Staff Notifications

| Event | Who Gets Notified | Channel |
|-------|------------------|---------|
| New lead from Angelina (contact info captured) | Front desk + owner | In-app + email |
| Trial class booked | Front desk + assigned teacher (name/age only) | In-app |
| Trial completed, no follow-up after 48h | Assigned staff | In-app reminder |
| Lead enrolled | Owner + studio manager | In-app |
| Lead marked lost | Owner | In-app weekly digest |
| Parent sends portal message | Assigned teacher | In-app |
| Parent sends email inquiry | Front desk | In-app + email |

---

## Claude Code Prompts

### Prompt 1: DB Migration — Leads + Chat Sessions

```
Read docs/claude/COMMUNICATIONS_AND_STAFF_VISIBILITY.md and docs/claude/STACK.md.

Create a Supabase migration that adds:
1. `leads` table with all fields from the spec
2. `chat_sessions` table to log all Angelina conversations
3. `lead_activities` table for the full activity timeline
4. RLS policies: admin/studio_manager/front_desk can read/write leads and chat_sessions.
   Teachers have NO access to leads or chat_sessions.
5. Trigger: updated_at auto-updates on leads

Also add a `staff` table if it doesn't exist:
  id, user_id (references auth.users), role (admin|studio_manager|front_desk|teacher|guest_teacher),
  first_name, last_name, email, is_active, created_at
```

### Prompt 2: Angelina Chat Logging

```
Read docs/claude/COMMUNICATIONS_AND_STAFF_VISIBILITY.md and docs/claude/ANGELINA_AND_CLAUDE_API.md.

Update app/api/chat/route.ts to:
1. Create a chat_sessions record at the start of each conversation
   (session_id passed from client on first message, created if not exists)
2. Append each message (user + assistant) to the session's messages JSONB field
3. Parse each assistant response for: child name/age mentions, class interest,
   parent contact info, trial booking outcomes
4. When contact info is detected, create or update a leads record linked to the session
5. On trial booking outcome, update lead.status to 'trial_scheduled'

The client (chatbot-widget.tsx) should generate a sessionId on first message
(uuid, stored in sessionStorage) and send it with every request.
```

### Prompt 3: Admin Leads Dashboard

```
Read docs/claude/COMMUNICATIONS_AND_STAFF_VISIBILITY.md and docs/claude/BRAND.md.

Create app/admin/leads/page.tsx — a leads pipeline dashboard that:
1. Shows all leads in a kanban board: New → Contacted → Trial Scheduled →
   Trial Complete → Enrolled / Lost
2. Each lead card shows: child name/age, class interest, source badge (Angelina/form/email),
   days since created, assigned staff
3. Click a lead → slide-out panel with full timeline:
   - Chat transcript (if from Angelina)
   - All lead_activities in chronological order
   - Parent contact info (with copy button)
   - Quick actions: change status, add note, assign staff, schedule follow-up
4. Filter bar: by source, status, assigned staff, date range
5. "New lead" badge on admin nav when unread leads exist
6. Access: admin, studio_manager, front_desk only — redirect others

Add the leads count badge to the admin sidebar nav item.
```

### Prompt 4: Teacher View (Safe Roster)

```
Read docs/claude/COMMUNICATIONS_AND_STAFF_VISIBILITY.md.

Ensure all teacher-facing pages in app/portal/teacher/ show ONLY:
- Student first name + last name
- Student age
- Medical notes / allergies
- Enrollment status in their class
- Teacher's own notes about the student

Confirm that NO teacher-facing page exposes:
- Parent name, email, or phone
- Billing data
- Other teachers' students
- Chat logs or lead records

Add a server-side check in all teacher route handlers that strips
contact fields before returning student data, even if the query
accidentally fetches them.
```

---

## Summary: The Contact Firewall

The core protection is architectural, not procedural:

1. **Parent contact info lives in the `leads` and `profiles` tables** — RLS blocks teacher role at the database level
2. **Teacher portal queries never join to `profiles.email` or `profiles.phone`** — enforced in query layer
3. **Portal messaging goes through BAM's system** — teachers never see the underlying email
4. **Chat logs are admin/front desk only** — teachers can't browse conversations
5. **Export/CSV functions are admin only** — no bulk data access

A teacher who tries to access parent contact info through the portal gets a 403 at the database level — not just a hidden UI element.

---

*Last updated: March 2026 | Ballet Academy and Movement*
