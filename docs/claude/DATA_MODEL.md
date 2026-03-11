# DATA_MODEL.md — BAM Platform Database Schema

> Complete Supabase PostgreSQL schema with RLS policies for the BAM Platform.
> This is the source of truth for all data modeling decisions.

---

## 1. Schema Overview

```
profiles ─────────┐
                   ├── students ──── enrollments ──── classes ──── seasons
                   │       │
                   │       ├── attendance
                   │       ├── student_badges ──── badges
                   │       ├── skill_assessments
                   │       ├── student_content_progress ──── lms_content
                   │       └── stream_access ──── live_sessions
                   │
                   ├── teachers
                   │
                   ├── shop_orders ──── products ──── shop_configs
                   │
                   └── (admin-only)
                        ├── competitor_studios
                        └── expansion_markets
```

---

## 2. Core Tables

### profiles

The base user table — extends Supabase `auth.users`. Every authenticated user has one profile.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('parent', 'teacher', 'admin', 'student')),
  avatar_url TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT DEFAULT 'San Clemente',
  state TEXT DEFAULT 'CA',
  zip TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  sms_opt_in BOOLEAN DEFAULT FALSE,
  klaviyo_synced_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);
```

### students

A child enrolled at the studio. Belongs to a parent profile (family).

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say')),
  school_name TEXT,
  grade TEXT,
  experience_level TEXT NOT NULL DEFAULT 'beginner'
    CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'pre_professional')),
  medical_notes TEXT,
  allergies TEXT,
  photo_url TEXT,
  sub_brand TEXT[] DEFAULT '{}',
  -- sub_brand values: 'recreational', 'performance', 'competition'
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_parent ON students(parent_id);
CREATE INDEX idx_students_active ON students(active);
CREATE INDEX idx_students_level ON students(experience_level);
CREATE INDEX idx_students_dob ON students(date_of_birth);
```

### seasons

A named time period (e.g., Fall 2026) containing classes.

```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'registration_open', 'active', 'completed', 'archived')),
  tuition_policy TEXT,
  refund_policy TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_seasons_status ON seasons(status);
CREATE INDEX idx_seasons_dates ON seasons(start_date, end_date);
```

### classes

A specific class offering within a season.

```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  style TEXT NOT NULL
    CHECK (style IN ('ballet', 'pointe', 'jazz', 'contemporary', 'musical_theatre', 'lyrical', 'creative_movement', 'pre_ballet')),
  level TEXT NOT NULL
    CHECK (level IN ('petite', 'beginner', 'intermediate', 'advanced', 'pre_professional', 'open')),
  sub_brand TEXT
    CHECK (sub_brand IN ('recreational', 'performance', 'competition')),
  age_min INTEGER NOT NULL CHECK (age_min >= 2),
  age_max INTEGER NOT NULL CHECK (age_max <= 19),
  capacity INTEGER NOT NULL DEFAULT 10 CHECK (capacity > 0),
  enrolled_count INTEGER NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  waitlist_count INTEGER NOT NULL DEFAULT 0 CHECK (waitlist_count >= 0),
  day_of_week TEXT NOT NULL
    CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT DEFAULT 'Studio A',
  tuition_amount_cents INTEGER NOT NULL CHECK (tuition_amount_cents >= 0),
  tuition_frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (tuition_frequency IN ('monthly', 'per_class', 'per_season', 'drop_in')),
  requires_audition BOOLEAN DEFAULT FALSE,
  beginner_friendly BOOLEAN DEFAULT TRUE,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_times CHECK (end_time > start_time),
  CONSTRAINT valid_ages CHECK (age_max >= age_min),
  CONSTRAINT valid_capacity CHECK (enrolled_count <= capacity),
  UNIQUE(season_id, slug)
);

CREATE INDEX idx_classes_season ON classes(season_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_style ON classes(style);
CREATE INDEX idx_classes_level ON classes(level);
CREATE INDEX idx_classes_day ON classes(day_of_week);
CREATE INDEX idx_classes_active ON classes(active);
```

### enrollments

Join table: student ↔ class within a season.

```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'waitlisted', 'dropped', 'completed', 'transferred')),
  waitlist_position INTEGER,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  dropped_at TIMESTAMPTZ,
  drop_reason TEXT,
  tuition_override_cents INTEGER,
  scholarship_applied BOOLEAN DEFAULT FALSE,
  discount_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
```

### attendance

Per-class-session attendance records.

```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enrollment_id, session_date)
);

CREATE INDEX idx_attendance_class_date ON attendance(class_id, session_date);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(session_date);
```

---

## 3. Teacher Management

### teachers

Extended profile for instructors.

```sql
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  specialties TEXT[] DEFAULT '{}',
  -- e.g., ['ballet', 'pointe', 'creative_movement']
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'onboarding', 'substitute')),

  -- Pay rates (cents per hour)
  class_rate_cents INTEGER CHECK (class_rate_cents >= 0),
  private_rate_cents INTEGER CHECK (private_rate_cents >= 0),
  competition_rehearsal_rate_cents INTEGER CHECK (competition_rehearsal_rate_cents >= 0),
  performance_rehearsal_rate_cents INTEGER CHECK (performance_rehearsal_rate_cents >= 0),
  competition_coaching_rate_cents INTEGER CHECK (competition_coaching_rate_cents >= 0),
  admin_rate_cents INTEGER CHECK (admin_rate_cents >= 0),
  masterclass_rate_cents INTEGER CHECK (masterclass_rate_cents >= 0),
  sub_rate_cents INTEGER CHECK (sub_rate_cents >= 0),
  travel_rate_cents INTEGER CHECK (travel_rate_cents >= 0),

  -- Compliance
  w9_on_file BOOLEAN DEFAULT FALSE,
  w9_submitted_at TIMESTAMPTZ,
  mandated_reporter_acknowledged BOOLEAN DEFAULT FALSE,
  mandated_reporter_acknowledged_at TIMESTAMPTZ,
  mandated_reporter_cert_expires_at TIMESTAMPTZ,
  background_check_complete BOOLEAN DEFAULT FALSE,
  background_check_expires_at TIMESTAMPTZ,
  contractor_agreement_signed BOOLEAN DEFAULT FALSE,
  studio_policy_acknowledged BOOLEAN DEFAULT FALSE,
  can_be_scheduled BOOLEAN DEFAULT FALSE,
  -- FALSE if critical docs missing

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teachers_profile ON teachers(profile_id);
CREATE INDEX idx_teachers_status ON teachers(status);
CREATE INDEX idx_teachers_schedulable ON teachers(can_be_scheduled);
```

---

## 4. LMS / Learning Studio

### lms_content

Learning content: video lessons, technique breakdowns, exercises.

```sql
CREATE TABLE lms_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('video', 'article', 'quiz', 'exercise', 'combo')),
  video_url TEXT,
  -- Cloudflare Stream URL
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  style TEXT
    CHECK (style IN ('ballet', 'pointe', 'jazz', 'contemporary', 'musical_theatre', 'lyrical', 'creative_movement', 'conditioning')),
  level TEXT
    CHECK (level IN ('petite', 'beginner', 'intermediate', 'advanced', 'pre_professional', 'all')),
  age_min INTEGER CHECK (age_min >= 2),
  age_max INTEGER CHECK (age_max <= 19),
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lms_content_style ON lms_content(style);
CREATE INDEX idx_lms_content_level ON lms_content(level);
CREATE INDEX idx_lms_content_published ON lms_content(published);
CREATE INDEX idx_lms_content_type ON lms_content(content_type);
CREATE INDEX idx_lms_content_sort ON lms_content(sort_order);
```

### student_content_progress

Tracks which content a student has viewed/completed.

```sql
CREATE TABLE student_content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES lms_content(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  watch_time_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  liked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, content_id)
);

CREATE INDEX idx_scp_student ON student_content_progress(student_id);
CREATE INDEX idx_scp_content ON student_content_progress(content_id);
CREATE INDEX idx_scp_status ON student_content_progress(status);
```

---

## 5. Badges and Assessments

### badges

Badge definitions — the catalog of all earnable badges.

```sql
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN (
      'technique', 'milestone', 'attendance', 'musicality',
      'leadership', 'competition', 'special_program'
    )),
  sub_brand TEXT
    CHECK (sub_brand IN ('recreational', 'performance', 'competition')),
  icon_url TEXT,
  patch_design_url TEXT,
  -- Physical patch artwork for vendor ordering
  color_hex TEXT DEFAULT '#9C8BBF',
  tier TEXT DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  auto_award BOOLEAN DEFAULT FALSE,
  -- TRUE = system awards automatically based on criteria
  auto_criteria JSONB,
  -- e.g., {"type": "attendance_streak", "threshold": 20}
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_badges_category ON badges(category);
CREATE INDEX idx_badges_sub_brand ON badges(sub_brand);
CREATE INDEX idx_badges_tier ON badges(tier);
CREATE INDEX idx_badges_active ON badges(active);
```

### student_badges

Badges earned by students.

```sql
CREATE TABLE student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_by UUID REFERENCES profiles(id),
  -- NULL if auto-awarded
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  award_reason TEXT,
  -- Physical patch fulfillment
  patch_status TEXT DEFAULT 'pending'
    CHECK (patch_status IN ('pending', 'ordered', 'received', 'distributed')),
  patch_ordered_at TIMESTAMPTZ,
  patch_distributed_at TIMESTAMPTZ,
  notified_parent BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, badge_id)
);

CREATE INDEX idx_student_badges_student ON student_badges(student_id);
CREATE INDEX idx_student_badges_badge ON student_badges(badge_id);
CREATE INDEX idx_student_badges_patch ON student_badges(patch_status);
```

### skill_assessments

Teacher assessments of student skills — subjective evaluations.

```sql
CREATE TABLE skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL
    CHECK (category IN (
      'technique', 'musicality', 'artistry', 'effort',
      'teamwork', 'stage_presence', 'flexibility', 'strength'
    )),
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  -- 1=developing, 2=emerging, 3=proficient, 4=strong, 5=exceptional
  notes TEXT,
  visible_to_parent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_student ON skill_assessments(student_id);
CREATE INDEX idx_assessments_teacher ON skill_assessments(teacher_id);
CREATE INDEX idx_assessments_date ON skill_assessments(assessment_date);
CREATE INDEX idx_assessments_category ON skill_assessments(category);
```

---

## 6. Live Sessions and Streaming

### live_sessions

Live stream events — performances, master classes, parent viewing.

```sql
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL
    CHECK (session_type IN ('performance', 'masterclass', 'parent_viewing', 'competition')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  stream_key TEXT,
  -- Cloudflare Stream live input key
  stream_url TEXT,
  -- Cloudflare Stream playback URL
  recording_url TEXT,
  -- Post-stream recording
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  is_ticketed BOOLEAN DEFAULT FALSE,
  ticket_price_cents INTEGER DEFAULT 0,
  max_viewers INTEGER,
  actual_viewers INTEGER DEFAULT 0,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_sessions_type ON live_sessions(session_type);
CREATE INDEX idx_live_sessions_scheduled ON live_sessions(scheduled_at);
CREATE INDEX idx_live_sessions_status ON live_sessions(status);
```

### stream_access

Who can view a live stream — derived from enrollment or ticket purchase.

```sql
CREATE TABLE stream_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL
    CHECK (access_type IN ('enrolled_parent', 'ticket_holder', 'teacher', 'admin', 'complimentary')),
  stripe_payment_intent_id TEXT,
  ticket_price_cents INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(live_session_id, profile_id)
);

CREATE INDEX idx_stream_access_session ON stream_access(live_session_id);
CREATE INDEX idx_stream_access_profile ON stream_access(profile_id);
```

---

## 7. Studio Shop

### shop_configs

White-label shop configuration — one per event or permanent studio shop.

```sql
CREATE TABLE shop_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- e.g., "Sugar Plum Shop", "BAM Studio Shop"
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  theme_color_hex TEXT DEFAULT '#9C8BBF',
  is_event_shop BOOLEAN DEFAULT FALSE,
  -- TRUE for Nutcracker pop-up, etc.
  event_name TEXT,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  stripe_account_id TEXT,
  -- For future multi-tenant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shop_configs_active ON shop_configs(active);
CREATE INDEX idx_shop_configs_slug ON shop_configs(slug);
```

### products

Items for sale in any shop.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_config_id UUID NOT NULL REFERENCES shop_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL
    CHECK (category IN (
      'badge_jacket', 'patch', 'costume', 'leotard', 'tights',
      'shoes', 'accessories', 'merchandise', 'concession', 'ticket', 'other'
    )),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents INTEGER,
  -- For showing original price on sale items
  images TEXT[] DEFAULT '{}',
  sizes TEXT[] DEFAULT '{}',
  -- e.g., ['YS', 'YM', 'YL', 'AS', 'AM', 'AL']
  colors TEXT[] DEFAULT '{}',
  inventory_count INTEGER DEFAULT 0,
  track_inventory BOOLEAN DEFAULT TRUE,
  max_per_order INTEGER,
  stripe_price_id TEXT,
  sub_brand TEXT
    CHECK (sub_brand IN ('recreational', 'performance', 'competition')),
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_config_id, slug)
);

CREATE INDEX idx_products_shop ON products(shop_config_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);
```

### shop_orders

Purchase records.

```sql
CREATE TABLE shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  -- e.g., BAM-2026-00042
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shop_config_id UUID NOT NULL REFERENCES shop_configs(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  -- Which child is this for (costumes, jackets)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled', 'refunded')),
  items JSONB NOT NULL DEFAULT '[]',
  -- [{product_id, name, size, color, quantity, price_cents}]
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  discount_code TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  fulfillment_type TEXT DEFAULT 'pickup'
    CHECK (fulfillment_type IN ('pickup', 'shipping', 'digital')),
  shipping_address JSONB,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_profile ON shop_orders(profile_id);
CREATE INDEX idx_orders_shop ON shop_orders(shop_config_id);
CREATE INDEX idx_orders_status ON shop_orders(status);
CREATE INDEX idx_orders_number ON shop_orders(order_number);
CREATE INDEX idx_orders_student ON shop_orders(student_id);
```

---

## 8. Expansion Intelligence (Admin-Only)

### competitor_studios

Tracked competitor studios.

```sql
CREATE TABLE competitor_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT DEFAULT 'CA',
  address TEXT,
  website TEXT,
  phone TEXT,
  segment TEXT NOT NULL
    CHECK (segment IN ('classical_ballet', 'competition', 'recreational', 'conservatory', 'franchise', 'commercial')),
  threat_level TEXT DEFAULT 'medium'
    CHECK (threat_level IN ('low', 'medium', 'high')),
  student_count_estimate INTEGER,
  price_range TEXT,
  -- e.g., "$120-180/mo"
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  google_rating DECIMAL(2,1),
  google_review_count INTEGER,
  yelp_rating DECIMAL(2,1),
  yelp_review_count INTEGER,
  notes TEXT,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitors_city ON competitor_studios(city);
CREATE INDEX idx_competitors_segment ON competitor_studios(segment);
CREATE INDEX idx_competitors_threat ON competitor_studios(threat_level);
```

### expansion_markets

Potential new studio locations being evaluated.

```sql
CREATE TABLE expansion_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT DEFAULT 'CA',
  region TEXT,
  -- e.g., "South Orange County"
  population INTEGER,
  median_household_income INTEGER,
  families_with_children_pct DECIMAL(4,1),
  competitor_count INTEGER DEFAULT 0,
  drive_time_from_hq_minutes INTEGER,
  commercial_rent_per_sqft DECIMAL(6,2),
  target_sqft INTEGER DEFAULT 2500,
  readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100),
  status TEXT DEFAULT 'researching'
    CHECK (status IN ('researching', 'evaluating', 'shortlisted', 'committed', 'passed')),
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expansion_status ON expansion_markets(status);
CREATE INDEX idx_expansion_score ON expansion_markets(readiness_score);
```

---

## 9. Performances (Phase 1 Priority)

### performances

```sql
CREATE TABLE performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  description TEXT,
  venue TEXT DEFAULT '400-C Camino De Estrella, San Clemente, CA',
  show_dates TIMESTAMPTZ[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'casting', 'rehearsing', 'tech_week', 'performing', 'completed', 'archived')),
  quick_change_buffer_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_performances_season ON performances(season_id);
CREATE INDEX idx_performances_status ON performances(status);
```

### acts

```sql
CREATE TABLE acts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID NOT NULL REFERENCES performances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  act_number INTEGER NOT NULL,
  description TEXT,
  estimated_duration_minutes INTEGER,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(performance_id, act_number)
);

CREATE INDEX idx_acts_performance ON acts(performance_id);
```

### roles

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id UUID NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_lead BOOLEAN DEFAULT FALSE,
  costume_notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roles_act ON roles(act_id);
```

### castings

```sql
CREATE TABLE castings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cast_type TEXT DEFAULT 'primary'
    CHECK (cast_type IN ('primary', 'understudy', 'alternate')),
  quick_change_conflict BOOLEAN DEFAULT FALSE,
  conflict_details TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, student_id)
);

CREATE INDEX idx_castings_role ON castings(role_id);
CREATE INDEX idx_castings_student ON castings(student_id);
CREATE INDEX idx_castings_conflict ON castings(quick_change_conflict);
```

### rehearsals

```sql
CREATE TABLE rehearsals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID NOT NULL REFERENCES performances(id) ON DELETE CASCADE,
  act_ids UUID[] NOT NULL DEFAULT '{}',
  -- Which acts are being rehearsed
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  room TEXT DEFAULT 'Studio A',
  notes TEXT,
  status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rehearsals_performance ON rehearsals(performance_id);
CREATE INDEX idx_rehearsals_scheduled ON rehearsals(scheduled_at);
CREATE INDEX idx_rehearsals_status ON rehearsals(status);
```

---

## 10. Row-Level Security (RLS) Policies

All tables have RLS enabled. Policies follow the principle of least privilege.

### Helper Function

```sql
-- Get the current user's role from profiles
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'admin' FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is teacher
CREATE OR REPLACE FUNCTION auth.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT role = 'teacher' FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get student IDs belonging to current parent
CREATE OR REPLACE FUNCTION auth.my_student_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(id) FROM students WHERE parent_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Policy Templates by Table

#### profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (auth.is_admin());

-- Teachers can read parent/student profiles for their classes
CREATE POLICY "Teachers read class profiles"
  ON profiles FOR SELECT
  USING (
    auth.is_teacher()
    AND id IN (
      SELECT s.parent_id FROM students s
      JOIN enrollments e ON e.student_id = s.id
      JOIN classes c ON c.id = e.class_id
      JOIN teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "Admins update all profiles"
  ON profiles FOR UPDATE
  USING (auth.is_admin());
```

#### students

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Parents see only their own children
CREATE POLICY "Parents read own students"
  ON students FOR SELECT
  USING (parent_id = auth.uid());

-- Parents can insert their own children
CREATE POLICY "Parents insert own students"
  ON students FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Parents can update their own children
CREATE POLICY "Parents update own students"
  ON students FOR UPDATE
  USING (parent_id = auth.uid());

-- Teachers see students in their classes
CREATE POLICY "Teachers read class students"
  ON students FOR SELECT
  USING (
    auth.is_teacher()
    AND id IN (
      SELECT e.student_id FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      JOIN teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins full access students"
  ON students FOR ALL
  USING (auth.is_admin());
```

#### enrollments

```sql
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Parents see enrollments for their children
CREATE POLICY "Parents read own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- Teachers see enrollments for their classes
CREATE POLICY "Teachers read class enrollments"
  ON enrollments FOR SELECT
  USING (
    auth.is_teacher()
    AND class_id IN (
      SELECT c.id FROM classes c
      JOIN teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins full access enrollments"
  ON enrollments FOR ALL
  USING (auth.is_admin());
```

#### attendance

```sql
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Parents see attendance for their children
CREATE POLICY "Parents read own attendance"
  ON attendance FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- Teachers can read/write attendance for their classes
CREATE POLICY "Teachers manage class attendance"
  ON attendance FOR ALL
  USING (
    auth.is_teacher()
    AND class_id IN (
      SELECT c.id FROM classes c
      JOIN teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins full access attendance"
  ON attendance FOR ALL
  USING (auth.is_admin());
```

#### teachers

```sql
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own record
CREATE POLICY "Teachers read own record"
  ON teachers FOR SELECT
  USING (profile_id = auth.uid());

-- Admins have full access
CREATE POLICY "Admins full access teachers"
  ON teachers FOR ALL
  USING (auth.is_admin());
```

#### badges / student_badges

```sql
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;

-- Everyone can read badge definitions
CREATE POLICY "All authenticated read badges"
  ON badges FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Parents see their children's earned badges
CREATE POLICY "Parents read own student badges"
  ON student_badges FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- Teachers can award badges (insert)
CREATE POLICY "Teachers award badges"
  ON student_badges FOR INSERT
  WITH CHECK (auth.is_teacher());

-- Admins have full access
CREATE POLICY "Admins full access badges"
  ON badges FOR ALL
  USING (auth.is_admin());

CREATE POLICY "Admins full access student_badges"
  ON student_badges FOR ALL
  USING (auth.is_admin());
```

#### skill_assessments

```sql
ALTER TABLE skill_assessments ENABLE ROW LEVEL SECURITY;

-- Parents see visible assessments for their children
CREATE POLICY "Parents read visible assessments"
  ON skill_assessments FOR SELECT
  USING (
    student_id = ANY(auth.my_student_ids())
    AND visible_to_parent = TRUE
  );

-- Teachers manage assessments they created
CREATE POLICY "Teachers manage own assessments"
  ON skill_assessments FOR ALL
  USING (
    auth.is_teacher()
    AND teacher_id IN (
      SELECT id FROM teachers WHERE profile_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins full access assessments"
  ON skill_assessments FOR ALL
  USING (auth.is_admin());
```

#### lms_content / student_content_progress

```sql
ALTER TABLE lms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_content_progress ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published content
CREATE POLICY "All read published content"
  ON lms_content FOR SELECT
  USING (auth.uid() IS NOT NULL AND published = TRUE);

-- Teachers and admins can read all content
CREATE POLICY "Staff read all content"
  ON lms_content FOR SELECT
  USING (auth.is_teacher() OR auth.is_admin());

-- Admins can manage content
CREATE POLICY "Admins manage content"
  ON lms_content FOR ALL
  USING (auth.is_admin());

-- Parents see their children's progress
CREATE POLICY "Parents read own progress"
  ON student_content_progress FOR SELECT
  USING (student_id = ANY(auth.my_student_ids()));

-- Students can update their own progress
CREATE POLICY "Students update own progress"
  ON student_content_progress FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
    OR auth.user_role() = 'student'
  );

-- Admins have full access
CREATE POLICY "Admins full access progress"
  ON student_content_progress FOR ALL
  USING (auth.is_admin());
```

#### shop tables

```sql
ALTER TABLE shop_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- Everyone can read active shop configs and products
CREATE POLICY "All read active shops"
  ON shop_configs FOR SELECT
  USING (active = TRUE);

CREATE POLICY "All read active products"
  ON products FOR SELECT
  USING (active = TRUE);

-- Users see only their own orders
CREATE POLICY "Users read own orders"
  ON shop_orders FOR SELECT
  USING (profile_id = auth.uid());

-- Users can create orders
CREATE POLICY "Users create orders"
  ON shop_orders FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Admins have full access to all shop tables
CREATE POLICY "Admins full access shop_configs"
  ON shop_configs FOR ALL
  USING (auth.is_admin());

CREATE POLICY "Admins full access products"
  ON products FOR ALL
  USING (auth.is_admin());

CREATE POLICY "Admins full access orders"
  ON shop_orders FOR ALL
  USING (auth.is_admin());
```

#### competitor_studios / expansion_markets (Admin-Only)

```sql
ALTER TABLE competitor_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_markets ENABLE ROW LEVEL SECURITY;

-- Only admins can access these tables
CREATE POLICY "Admins only competitor_studios"
  ON competitor_studios FOR ALL
  USING (auth.is_admin());

CREATE POLICY "Admins only expansion_markets"
  ON expansion_markets FOR ALL
  USING (auth.is_admin());
```

#### live_sessions / stream_access

```sql
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_access ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see scheduled/live sessions
CREATE POLICY "All read live sessions"
  ON live_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL AND status IN ('scheduled', 'live'));

-- Users see their own stream access
CREATE POLICY "Users read own stream access"
  ON stream_access FOR SELECT
  USING (profile_id = auth.uid());

-- Admins and teachers manage sessions
CREATE POLICY "Staff manage live sessions"
  ON live_sessions FOR ALL
  USING (auth.is_admin() OR auth.is_teacher());

-- Admins manage access
CREATE POLICY "Admins manage stream access"
  ON stream_access FOR ALL
  USING (auth.is_admin());
```

---

## 11. Database Functions

### Auto-update timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lms_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON student_content_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON live_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shop_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shop_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON performances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rehearsals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON competitor_studios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON expansion_markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Enrollment count sync

```sql
CREATE OR REPLACE FUNCTION sync_class_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE classes SET
    enrolled_count = (
      SELECT COUNT(*) FROM enrollments
      WHERE class_id = COALESCE(NEW.class_id, OLD.class_id)
      AND status = 'enrolled'
    ),
    waitlist_count = (
      SELECT COUNT(*) FROM enrollments
      WHERE class_id = COALESCE(NEW.class_id, OLD.class_id)
      AND status = 'waitlisted'
    )
  WHERE id = COALESCE(NEW.class_id, OLD.class_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_enrollment_count
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION sync_class_enrollment_count();
```

---

*Last updated: March 2026*
