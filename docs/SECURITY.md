# BAM Platform — Security & Compliance

## Authentication Rules

- **Magic link** email login for parents (lowest friction, no password to forget)
- **Email + password** for teachers and admins (more frequent login)
- **Google OAuth** available for all roles
- **Session duration:** 7 days for parents, 8 hours for teachers/admins
- **MFA:** Required for admin and super_admin roles
- **Never** auto-login users after password reset — require explicit re-auth

---

## Row Level Security (RLS) — Critical

**Every Supabase table must have RLS enabled. No exceptions.**

### RLS Policy Templates

```sql
-- Parents can only see their own children
create policy "parent_students_isolation" on students
  for all to authenticated
  using (parent_id = auth.uid());

-- Teachers can only see students enrolled in their classes
create policy "teacher_student_access" on students
  for select to authenticated
  using (
    id in (
      select e.student_id from enrollments e
      join classes c on e.class_id = c.id
      where c.teacher_id = auth.uid()
    )
  );

-- Teachers can only modify attendance for their own classes
create policy "teacher_attendance_write" on attendance
  for insert to authenticated
  with check (
    class_id in (
      select id from classes where teacher_id = auth.uid()
    )
  );

-- Admins have full access
create policy "admin_full_access" on students
  for all to authenticated
  using (
    (select role from profiles where id = auth.uid())
    in ('admin', 'super_admin')
  );

-- Students can only see their own LMS progress
create policy "student_own_progress" on student_content_progress
  for all to authenticated
  using (
    student_id in (
      select id from students where parent_id = auth.uid()
    )
  );
```

---

## Data Privacy

### Children's Data (COPPA Compliance)
- Students are minors — **never** expose student data to non-authorized parties
- Parent must provide consent before student appears in any content
- `photo_consent` field on students table must be `true` before student appears in LMS content
- Student names never exposed in public-facing content without consent
- Medical notes: accessible to teachers (need-to-know) and admin only
- Medical notes: never logged, never sent via email in plaintext

### FERPA-Adjacent Best Practices
(Not legally required for dance studio, but follow principles)
- Student records accessible only to enrolled parents and assigned teachers
- Admin access logged (audit trail for sensitive record access)
- Parents can request data deletion — implement soft delete with 90-day purge

### California Privacy (CCPA)
- Provide data export on request
- Privacy policy must be linked in portal footer
- Cookie consent banner on public-facing pages

---

## Mandated Reporter Compliance

California law requires dance instructors to report suspected child abuse,
neglect, bullying, and self-harm to the appropriate authorities.

### Incident Reporting Workflow

**In the platform:**
1. Teacher sees concern → taps "Report Concern" in student profile
2. Fills out incident form:
   - Date/time observed
   - Description (structured fields + free text)
   - Concern type: Abuse / Neglect / Bullying / Self-harm / Other
   - Action taken
3. Report immediately:
   - Creates record in `mandated_reporter_incidents` table
   - Flags as `pending_review`
   - Sends immediate notification to admin + super_admin
   - Auto-generates reminder if not acknowledged within 2 hours

### Required Fields on Incident Report
```sql
create table mandated_reporter_incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id),
  student_id uuid references students(id),
  observed_at timestamptz not null,
  concern_type text not null,
  description text not null,
  action_taken text,
  reported_to_authorities boolean default false,
  reported_to_authorities_at timestamptz,
  authority_name text,
  report_number text,
  admin_acknowledged_by uuid references profiles(id),
  admin_acknowledged_at timestamptz,
  status text default 'pending_review',
  created_at timestamptz default now()
);
```

### California Reporting Numbers (display in UI)
- **Child Abuse Hotline:** 1-800-540-4000 (Los Angeles / Orange County)
- **Orange County Social Services:** (714) 940-1000
- **Emergency:** 911
- **Non-emergency Police:** (949) 770-6011 (San Clemente)

### UI Requirement
- Report button always visible in student profile for teachers
- Never bury this feature
- Reporting form: simple, fast, clear
- After submission: "Your report has been filed and Amanda has been notified immediately."

### Certification Tracking
- Teachers must upload mandated reporter training certificate
- System tracks expiration date
- Admin alerted 30 days before expiration
- Teachers cannot be assigned to classes with expired certification (soft block, admin override)

---

## Payment Security

- **Never store credit card numbers** in Supabase or any custom table
- All card processing via Stripe — use Stripe Elements only
- PCI compliance handled entirely by Stripe
- Store only: `stripe_customer_id`, `stripe_payment_method_id` (tokenized)
- Zelle/Venmo payments: record amount, payer, date only — no account numbers

---

## API Security

```typescript
// Every API route must:
// 1. Validate auth
const supabase = createServerClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (!user || error) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// 2. Check role for sensitive operations
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (!['admin', 'super_admin'].includes(profile.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// 3. Validate input with Zod before any DB operation
const result = InputSchema.safeParse(await request.json())
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 })
}
```

---

## Live Stream Security

- Class streams: accessible only to parents of enrolled students
- Validate enrollment server-side before issuing stream token
- Stream tokens expire after 4 hours (max class duration)
- Performance streams: ticket purchase creates stream_access record
- Never expose Cloudflare Stream API tokens to client

---

## Environment Security

- `.env.local` in `.gitignore` — never commit
- `SUPABASE_SERVICE_ROLE_KEY` only in server-side code
- `CLOUDFLARE_STREAM_API_TOKEN` only in server-side code
- `STRIPE_SECRET_KEY` only in server-side code
- `RESEND_API_KEY` only in server-side code
- Only `NEXT_PUBLIC_*` variables are safe for client
