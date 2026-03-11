# SECURITY.md — BAM Platform Security & Compliance

> Security policies, RLS code, COPPA compliance, mandated reporter workflows,
> payment security, and API auth patterns for the BAM Platform.

---

## 1. Supabase Row-Level Security (RLS) — Complete Policy Code

RLS is enabled on **every table**. No table is accessible without a matching policy.

### Helper Functions

```sql
-- ============================================================
-- Auth helper functions (created once, used by all policies)
-- ============================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is teacher
CREATE OR REPLACE FUNCTION auth.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get student IDs belonging to current parent
CREATE OR REPLACE FUNCTION auth.my_student_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(ARRAY_AGG(id), '{}')
  FROM public.students
  WHERE parent_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get class IDs taught by current teacher
CREATE OR REPLACE FUNCTION auth.my_class_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(ARRAY_AGG(c.id), '{}')
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  WHERE t.profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get teacher record ID for current user
CREATE OR REPLACE FUNCTION auth.my_teacher_id()
RETURNS UUID AS $$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Users read own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- SELECT: Admins read all
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (auth.is_admin());

-- SELECT: Teachers read profiles of students in their classes
CREATE POLICY "profiles_select_teacher_class"
  ON profiles FOR SELECT
  USING (
    auth.is_teacher()
    AND id IN (
      SELECT s.parent_id FROM students s
      JOIN enrollments e ON e.student_id = s.id
      WHERE e.class_id = ANY(auth.my_class_ids())
    )
  );

-- UPDATE: Users update own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    -- Cannot change own role
  );

-- UPDATE: Admins update any
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (auth.is_admin());

-- INSERT: Via auth trigger only (handled by Supabase Auth)
CREATE POLICY "profiles_insert_self"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
```

### students

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see own children
CREATE POLICY "students_select_parent"
  ON students FOR SELECT
  USING (parent_id = auth.uid());

-- SELECT: Teachers see students in their classes
CREATE POLICY "students_select_teacher"
  ON students FOR SELECT
  USING (
    auth.is_teacher()
    AND id IN (
      SELECT e.student_id FROM enrollments e
      WHERE e.class_id = ANY(auth.my_class_ids())
    )
  );

-- SELECT: Admins see all
CREATE POLICY "students_select_admin"
  ON students FOR ALL
  USING (auth.is_admin());

-- INSERT: Parents add own children
CREATE POLICY "students_insert_parent"
  ON students FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- UPDATE: Parents update own children
CREATE POLICY "students_update_parent"
  ON students FOR UPDATE
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- DELETE: Admins only (soft delete preferred — set active=false)
CREATE POLICY "students_delete_admin"
  ON students FOR DELETE
  USING (auth.is_admin());
```

### seasons

```sql
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read seasons
CREATE POLICY "seasons_select_authenticated"
  ON seasons FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "seasons_manage_admin"
  ON seasons FOR ALL
  USING (auth.is_admin());
```

### classes

```sql
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read active classes
CREATE POLICY "classes_select_authenticated"
  ON classes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "classes_manage_admin"
  ON classes FOR ALL
  USING (auth.is_admin());
```

### enrollments

```sql
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see own children's enrollments
CREATE POLICY "enrollments_select_parent"
  ON enrollments FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- SELECT: Teachers see enrollments in their classes
CREATE POLICY "enrollments_select_teacher"
  ON enrollments FOR SELECT
  USING (class_id = ANY(auth.my_class_ids()));

-- ALL: Admins
CREATE POLICY "enrollments_manage_admin"
  ON enrollments FOR ALL
  USING (auth.is_admin());

-- INSERT: Parents can enroll own children (with capacity check in app layer)
CREATE POLICY "enrollments_insert_parent"
  ON enrollments FOR INSERT
  WITH CHECK (student_id = ANY(auth.my_student_ids()));
```

### attendance

```sql
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see own children's attendance
CREATE POLICY "attendance_select_parent"
  ON attendance FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- ALL: Teachers manage attendance for their classes
CREATE POLICY "attendance_manage_teacher"
  ON attendance FOR ALL
  USING (class_id = ANY(auth.my_class_ids()));

-- ALL: Admins
CREATE POLICY "attendance_manage_admin"
  ON attendance FOR ALL
  USING (auth.is_admin());
```

### teachers

```sql
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- SELECT: Teachers read own record
CREATE POLICY "teachers_select_own"
  ON teachers FOR SELECT
  USING (profile_id = auth.uid());

-- UPDATE: Teachers update own non-sensitive fields
CREATE POLICY "teachers_update_own"
  ON teachers FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    -- Cannot modify pay rates or compliance fields
    AND class_rate_cents = (SELECT class_rate_cents FROM teachers WHERE profile_id = auth.uid())
    AND private_rate_cents = (SELECT private_rate_cents FROM teachers WHERE profile_id = auth.uid())
    AND can_be_scheduled = (SELECT can_be_scheduled FROM teachers WHERE profile_id = auth.uid())
  );

-- ALL: Admins
CREATE POLICY "teachers_manage_admin"
  ON teachers FOR ALL
  USING (auth.is_admin());
```

### badges

```sql
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read badge definitions
CREATE POLICY "badges_select_authenticated"
  ON badges FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

-- ALL: Admins manage badge catalog
CREATE POLICY "badges_manage_admin"
  ON badges FOR ALL
  USING (auth.is_admin());
```

### student_badges

```sql
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see own children's badges
CREATE POLICY "student_badges_select_parent"
  ON student_badges FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- SELECT: Students see own badges (if they have direct login)
CREATE POLICY "student_badges_select_student"
  ON student_badges FOR SELECT
  USING (
    auth.user_role() = 'student'
    AND student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  );

-- INSERT: Teachers can award badges
CREATE POLICY "student_badges_insert_teacher"
  ON student_badges FOR INSERT
  WITH CHECK (
    auth.is_teacher()
    AND awarded_by = (SELECT id FROM profiles WHERE id = auth.uid())
  );

-- ALL: Admins
CREATE POLICY "student_badges_manage_admin"
  ON student_badges FOR ALL
  USING (auth.is_admin());
```

### skill_assessments

```sql
ALTER TABLE skill_assessments ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see visible assessments for their children
CREATE POLICY "assessments_select_parent"
  ON skill_assessments FOR SELECT
  USING (
    student_id = ANY(auth.my_student_ids())
    AND visible_to_parent = TRUE
  );

-- ALL: Teachers manage assessments they created
CREATE POLICY "assessments_manage_teacher"
  ON skill_assessments FOR ALL
  USING (teacher_id = auth.my_teacher_id());

-- ALL: Admins
CREATE POLICY "assessments_manage_admin"
  ON skill_assessments FOR ALL
  USING (auth.is_admin());
```

### lms_content

```sql
ALTER TABLE lms_content ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated read published content
CREATE POLICY "lms_content_select_published"
  ON lms_content FOR SELECT
  USING (auth.uid() IS NOT NULL AND published = TRUE);

-- SELECT: Teachers and admins read all (including unpublished)
CREATE POLICY "lms_content_select_staff"
  ON lms_content FOR SELECT
  USING (auth.is_teacher() OR auth.is_admin());

-- INSERT: Teachers can create content
CREATE POLICY "lms_content_insert_teacher"
  ON lms_content FOR INSERT
  WITH CHECK (auth.is_teacher() AND teacher_id = auth.my_teacher_id());

-- UPDATE: Teachers update own content
CREATE POLICY "lms_content_update_teacher"
  ON lms_content FOR UPDATE
  USING (auth.is_teacher() AND teacher_id = auth.my_teacher_id());

-- ALL: Admins
CREATE POLICY "lms_content_manage_admin"
  ON lms_content FOR ALL
  USING (auth.is_admin());
```

### student_content_progress

```sql
ALTER TABLE student_content_progress ENABLE ROW LEVEL SECURITY;

-- SELECT: Parents see own children's progress
CREATE POLICY "progress_select_parent"
  ON student_content_progress FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- INSERT/UPDATE: Parents can track progress for their children
CREATE POLICY "progress_upsert_parent"
  ON student_content_progress FOR INSERT
  WITH CHECK (student_id = ANY(auth.my_student_ids()));

CREATE POLICY "progress_update_parent"
  ON student_content_progress FOR UPDATE
  USING (student_id = ANY(auth.my_student_ids()));

-- SELECT: Teachers see progress for students in their classes
CREATE POLICY "progress_select_teacher"
  ON student_content_progress FOR SELECT
  USING (
    auth.is_teacher()
    AND student_id IN (
      SELECT e.student_id FROM enrollments e
      WHERE e.class_id = ANY(auth.my_class_ids())
    )
  );

-- ALL: Admins
CREATE POLICY "progress_manage_admin"
  ON student_content_progress FOR ALL
  USING (auth.is_admin());
```

### live_sessions

```sql
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated see scheduled/live sessions
CREATE POLICY "live_sessions_select_public"
  ON live_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL AND status IN ('scheduled', 'live'));

-- SELECT: Staff see all sessions (including ended)
CREATE POLICY "live_sessions_select_staff"
  ON live_sessions FOR SELECT
  USING (auth.is_teacher() OR auth.is_admin());

-- INSERT/UPDATE: Teachers can create and manage sessions
CREATE POLICY "live_sessions_manage_teacher"
  ON live_sessions FOR INSERT
  WITH CHECK (auth.is_teacher() AND created_by = auth.uid());

CREATE POLICY "live_sessions_update_teacher"
  ON live_sessions FOR UPDATE
  USING (auth.is_teacher() AND created_by = auth.uid());

-- ALL: Admins
CREATE POLICY "live_sessions_manage_admin"
  ON live_sessions FOR ALL
  USING (auth.is_admin());
```

### stream_access

```sql
ALTER TABLE stream_access ENABLE ROW LEVEL SECURITY;

-- SELECT: Users see own access
CREATE POLICY "stream_access_select_own"
  ON stream_access FOR SELECT
  USING (profile_id = auth.uid());

-- ALL: Admins
CREATE POLICY "stream_access_manage_admin"
  ON stream_access FOR ALL
  USING (auth.is_admin());
```

### shop_configs / products / shop_orders

```sql
ALTER TABLE shop_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- SELECT: Everyone reads active shops and products
CREATE POLICY "shop_configs_select_active"
  ON shop_configs FOR SELECT
  USING (active = TRUE);

CREATE POLICY "products_select_active"
  ON products FOR SELECT
  USING (active = TRUE);

-- SELECT: Users see own orders
CREATE POLICY "orders_select_own"
  ON shop_orders FOR SELECT
  USING (profile_id = auth.uid());

-- INSERT: Authenticated users create orders
CREATE POLICY "orders_insert_authenticated"
  ON shop_orders FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- ALL: Admins manage everything
CREATE POLICY "shop_configs_manage_admin"
  ON shop_configs FOR ALL USING (auth.is_admin());

CREATE POLICY "products_manage_admin"
  ON products FOR ALL USING (auth.is_admin());

CREATE POLICY "orders_manage_admin"
  ON shop_orders FOR ALL USING (auth.is_admin());
```

### performances / acts / roles / castings / rehearsals

```sql
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read performance data
CREATE POLICY "performances_select_auth" ON performances FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "acts_select_auth" ON acts FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_select_auth" ON roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- SELECT: Parents see castings for their children only
CREATE POLICY "castings_select_parent" ON castings FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- SELECT: Teachers see all castings (need for rehearsal planning)
CREATE POLICY "castings_select_teacher" ON castings FOR SELECT
  USING (auth.is_teacher());

-- SELECT: Rehearsals visible to all authenticated
CREATE POLICY "rehearsals_select_auth" ON rehearsals FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ALL: Admins manage all performance tables
CREATE POLICY "performances_manage_admin" ON performances FOR ALL
  USING (auth.is_admin());
CREATE POLICY "acts_manage_admin" ON acts FOR ALL
  USING (auth.is_admin());
CREATE POLICY "roles_manage_admin" ON roles FOR ALL
  USING (auth.is_admin());
CREATE POLICY "castings_manage_admin" ON castings FOR ALL
  USING (auth.is_admin());
CREATE POLICY "rehearsals_manage_admin" ON rehearsals FOR ALL
  USING (auth.is_admin());
```

### competitor_studios / expansion_markets

```sql
ALTER TABLE competitor_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_markets ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "competitors_admin_only" ON competitor_studios FOR ALL
  USING (auth.is_admin());
CREATE POLICY "expansion_admin_only" ON expansion_markets FOR ALL
  USING (auth.is_admin());
```

---

## 2. COPPA Compliance — Protecting Minors' Data

BAM serves children ages 3–18. COPPA (Children's Online Privacy Protection Act) applies to children under 13.

### Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Verifiable parental consent** | All student accounts are created by parents. Students under 13 never create accounts directly. |
| **No direct data collection from children under 13** | Student login (ages 10+) is set up by parent through their own authenticated session. |
| **Parent access to child's data** | Parent portal shows all data collected about their children. |
| **Parent right to delete** | Admin can delete student records on parent request. Cascade deletes all associated data. |
| **Minimal data collection** | Only collect data necessary for studio operations. No tracking pixels, no third-party analytics on child-facing pages. |
| **No behavioral advertising** | No ad networks, no data selling, no profiling children for marketing. |
| **Data retention limits** | Inactive student records archived after 2 years, deleted after 5 years. |

### Technical Implementation

```typescript
// lib/auth/guards.ts

// Student accounts (ages 10+) are always linked to a parent
export async function createStudentLogin(parentId: string, studentId: string) {
  // Verify the parent owns this student
  const student = await getStudent(studentId)
  if (student.parent_id !== parentId) {
    throw new AuthError('Unauthorized: not your child')
  }

  // Verify student is 10 or older
  const age = calculateAge(student.date_of_birth)
  if (age < 10) {
    throw new AuthError('Students must be 10 or older for direct login')
  }

  // Create limited student account linked to parent
  // Student role has restricted permissions via RLS
}
```

### Data Handling Rules

- **Never store** child photos in public buckets — use signed URLs with expiry
- **Never expose** student data in URLs (use UUIDs, not names)
- **Never send** marketing emails to student email addresses
- **LMS content progress** and **badge data** are associated with student records owned by parents
- **Facial recognition (M13)** requires explicit biometric consent under California CPPA — blocked until consent obtained
- **Analytics:** Use privacy-respecting analytics only (Plausible or similar). No Google Analytics on child-facing pages.

---

## 3. California Mandated Reporter Workflow

All BAM teachers are mandated reporters under California law (Penal Code sections 11164–11174.3, AB 1432).

### Compliance Requirements

| Requirement | Platform Implementation |
|-------------|------------------------|
| Acknowledgment | Teacher cannot be scheduled until mandated_reporter_acknowledged = TRUE |
| Certification | AB 1432 online training certificate uploaded, expiry tracked (2-year renewal) |
| Reporting mechanism | In-app incident form accessible from teacher portal |
| Documentation | All incidents logged with timestamp, never editable after submission |
| Notification | Admin notified immediately upon incident report submission |
| Hotline numbers | Always visible in teacher portal |

### Incident Report Form

**Route:** `/teacher/report-concern` (also accessible from `/admin/compliance/incidents`)

```typescript
// Zod schema for mandated reporter incident form
const incidentReportSchema = z.object({
  // Reporter info (auto-filled from auth)
  reporter_id: z.string().uuid(),
  reporter_name: z.string(),

  // Child info
  student_id: z.string().uuid().optional(),
  child_name: z.string().min(1),
  child_age: z.number().int().min(0).max(18),

  // Incident details
  incident_date: z.string().date(),
  incident_time: z.string().optional(),
  incident_type: z.enum([
    'physical_abuse',
    'emotional_abuse',
    'sexual_abuse',
    'neglect',
    'exploitation',
    'other',
  ]),
  description: z.string().min(10).max(5000),

  // Observations
  physical_indicators: z.string().optional(),
  behavioral_indicators: z.string().optional(),
  child_statements: z.string().optional(),

  // Actions taken
  reported_to_authorities: z.boolean(),
  authority_report_number: z.string().optional(),
  reported_to_admin: z.boolean(),

  // Acknowledgment
  declaration: z.literal(true),
  // "I declare under penalty of perjury that this report is true and correct"
})
```

### Incident Report Database Table

```sql
CREATE TABLE mandated_reporter_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  student_id UUID REFERENCES students(id),
  child_name TEXT NOT NULL,
  child_age INTEGER NOT NULL,
  incident_date DATE NOT NULL,
  incident_time TEXT,
  incident_type TEXT NOT NULL,
  description TEXT NOT NULL,
  physical_indicators TEXT,
  behavioral_indicators TEXT,
  child_statements TEXT,
  reported_to_authorities BOOLEAN NOT NULL DEFAULT FALSE,
  authority_report_number TEXT,
  reported_to_admin BOOLEAN NOT NULL DEFAULT TRUE,
  declaration BOOLEAN NOT NULL DEFAULT TRUE,
  -- Immutable after creation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- No updated_at — incidents cannot be modified
  CONSTRAINT valid_declaration CHECK (declaration = TRUE)
);

-- RLS: Only the reporter and admins can read
ALTER TABLE mandated_reporter_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_insert_teacher"
  ON mandated_reporter_incidents FOR INSERT
  WITH CHECK (auth.is_teacher() AND reporter_id = auth.uid());

CREATE POLICY "incidents_select_reporter"
  ON mandated_reporter_incidents FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "incidents_select_admin"
  ON mandated_reporter_incidents FOR SELECT
  USING (auth.is_admin());

-- NO UPDATE OR DELETE POLICIES — incidents are immutable
```

### Admin Notification Flow

```typescript
// Triggered after incident report is saved
async function notifyAdminOfIncident(incident: IncidentReport) {
  // 1. In-app notification (real-time via Supabase)
  await supabase.from('notifications').insert({
    profile_id: ADMIN_PROFILE_ID, // Amanda
    type: 'mandated_reporter_incident',
    title: 'Mandated Reporter Incident Filed',
    body: `${incident.reporter_name} filed a report regarding ${incident.child_name}`,
    severity: 'critical',
    action_url: `/admin/compliance/incidents/${incident.id}`,
  })

  // 2. Email notification (Resend — immediate)
  await sendEmail({
    to: 'dance@bamsocal.com',
    subject: 'URGENT: Mandated Reporter Incident Filed',
    template: 'mandated-reporter-alert',
    data: {
      reporterName: incident.reporter_name,
      childName: incident.child_name,
      incidentDate: incident.incident_date,
      incidentType: incident.incident_type,
    },
  })

  // 3. SMS notification (Twilio — immediate)
  await sendSMS({
    to: ADMIN_PHONE, // Amanda's phone
    body: `URGENT: Mandated reporter incident filed by ${incident.reporter_name}. Check platform immediately.`,
  })
}
```

### California Reporting Hotlines — Always Visible in Teacher Portal

```typescript
const CALIFORNIA_REPORTING_RESOURCES = {
  childProtectiveServices: {
    name: 'Orange County Child Protective Services',
    phone: '(714) 940-1000',
    available: '24/7',
  },
  childAbuseHotline: {
    name: 'Childhelp National Child Abuse Hotline',
    phone: '1-800-422-4453',
    available: '24/7',
  },
  lawEnforcement: {
    name: 'San Clemente Police Department',
    phone: '(949) 770-6011',
    available: '24/7',
  },
  onlineReport: {
    name: 'California DOJ CARES Reporter',
    url: 'https://mandatedreporterca.com/',
    note: 'Online reporting — still must call within 36 hours',
  },
} as const
```

### Teacher Portal — Compliance Banner

If a teacher's mandated reporter certification is expiring within 60 days or expired:

```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Your mandated reporter certification expires    │
│  in 23 days. Complete renewal training to continue   │
│  being scheduled for classes.                        │
│                                                      │
│  [Renew Now →]                 [Dismiss for 7 days]  │
└─────────────────────────────────────────────────────┘
```

---

## 4. Payment Security

### Principles

1. **Stripe handles all payment processing** — we never see, store, or transmit raw card data
2. **PCI DSS compliance** achieved through Stripe Elements (SAQ A)
3. **No card numbers in our database** — only Stripe customer IDs, payment intent IDs, and charge IDs
4. **No card numbers in logs** — server logs must never contain payment details

### Implementation

```typescript
// lib/stripe/client.ts
import Stripe from 'stripe'

// Server-side only — never import this in client components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})
```

```typescript
// Client-side: Use Stripe Elements for payment collection
// NEVER collect card details in our own form fields

// app/(shop)/shop/[shop-slug]/checkout/page.tsx
'use client'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function CheckoutPage() {
  return (
    <Elements stripe={stripePromise} options={{ /* ... */ }}>
      <PaymentForm />
    </Elements>
  )
}
```

### Webhook Security

```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed')
    return new Response('Invalid signature', { status: 400 })
  }

  // Process verified event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object)
      break
    // ... other events
  }

  return new Response('OK', { status: 200 })
}
```

### Financial Data Rules

- All monetary values stored as **integers in cents** (e.g., `$125.00` = `12500`)
- Display: always format as dollars with 2 decimal places
- Every transaction must have a **category tag** (tuition, costume, ticket, merch, fee)
- Refunds processed through Stripe — never manually adjust balances
- Stripe Customer Portal for parents to manage their own payment methods

---

## 5. API Authentication Patterns

### Supabase Auth Middleware

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Route protection
  const path = request.nextUrl.pathname

  if (!user && isProtectedRoute(path)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const role = await getUserRole(supabase, user.id)

    // Role-based route guards
    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url))
    }
    if (path.startsWith('/teacher') && role !== 'teacher' && role !== 'admin') {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url))
    }
  }

  return response
}

function isProtectedRoute(path: string): boolean {
  const protectedPrefixes = ['/portal', '/teacher', '/admin', '/learn']
  return protectedPrefixes.some(prefix => path.startsWith(prefix))
}
```

### API Route Auth Pattern

```typescript
// Standard pattern for all API routes
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()

  // 1. Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check role if needed
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. RLS handles data filtering automatically
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 24) // Paginate — never unbounded

  if (error) {
    console.error('Database error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
```

### Server Action Auth Pattern

```typescript
// Preferred for form submissions
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
})

export async function addStudent(formData: FormData) {
  const supabase = await createServerClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Validate
  const parsed = schema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Insert (RLS enforces parent_id = auth.uid())
  const { error } = await supabase.from('students').insert({
    parent_id: user.id,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
  })

  if (error) {
    return { error: 'Failed to add student' }
  }

  revalidatePath('/portal/children')
  return { success: true }
}
```

---

## 6. Environment Variable Security

### Rules

| Rule | Detail |
|------|--------|
| **Never commit secrets** | `.env.local` is in `.gitignore` — verify before every commit |
| **`NEXT_PUBLIC_` prefix** | Only for values safe to expose in browser (Supabase anon key, Stripe publishable key, app URL) |
| **Server-only secrets** | All API keys, service role keys, webhook secrets — no `NEXT_PUBLIC_` prefix |
| **Vercel env vars** | Set in Vercel dashboard per environment (production, preview, development) |
| **Rotation** | Rotate Stripe and Supabase service role keys quarterly |
| **Access logging** | Supabase service role key usage logged automatically |

### Validation at Startup

```typescript
// lib/utils/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Public (validated but safe to expose)
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),

  // Server-only
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
})

export const env = envSchema.parse(process.env)
```

### Secret Detection

- Pre-commit hook: scan staged files for patterns matching API keys
- Patterns to detect:
  - `sk_live_`, `sk_test_` (Stripe secret keys)
  - `sk-ant-` (Anthropic keys)
  - `whsec_` (Stripe webhook secrets)
  - `eyJ` (JWTs / Supabase keys — check if in server-only context)
  - `re_` (Resend keys)

---

## 7. Additional Security Measures

### Rate Limiting

```typescript
// Apply to public API routes and auth endpoints
// Use Vercel Edge Middleware or upstash/ratelimit

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
  analytics: true,
})

// In API route:
const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
const { success } = await ratelimit.limit(ip)
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
```

### Content Security Policy

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://*.supabase.co",
      "media-src 'self' https://*.cloudflarestream.com https://customer-*.cloudflarestream.com",
      "frame-src https://js.stripe.com https://customer-*.cloudflarestream.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com",
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]
```

### Input Sanitization

- All user inputs validated with Zod before database operations
- HTML content (announcements, descriptions) sanitized with DOMPurify before rendering
- File uploads: validate MIME type server-side, max size 10MB, store in Supabase Storage with signed URLs
- Search inputs: parameterized queries via Supabase client (no raw SQL concatenation)

### Session Security

- Supabase Auth handles session tokens automatically
- JWT expiry: 1 hour (Supabase default), refresh token: 7 days
- Session invalidated on password change
- Max concurrent sessions: unlimited (Supabase default — acceptable for family accounts)

---

*Last updated: March 2026*
