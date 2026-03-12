-- ============================================================
-- Migration 016: Seed BAM Schedule, Substitute System, Embeds
-- ============================================================


-- ── Part 1: Schema Changes ──────────────────────────────────

-- Seasons table: add columns that were added to migration 015's CREATE TABLE
-- after it was already applied to the remote DB
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'regular';
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS year INTEGER;

-- Add check constraints for period and program
DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'seasons_period_check'
  ) THEN
    ALTER TABLE seasons ADD CONSTRAINT seasons_period_check
      CHECK (period IN ('fall','winter','spring','summer'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'seasons_program_check'
  ) THEN
    ALTER TABLE seasons ADD CONSTRAINT seasons_program_check
      CHECK (program IN ('regular','performance','competition','summer_intensive','camp','workshop'));
  END IF;
END $chk$;

-- is_public as a generated column (must be added separately since IF NOT EXISTS
-- doesn't work for generated columns — guard with DO block)
DO $gen$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE seasons ADD COLUMN is_public BOOLEAN
      GENERATED ALWAYS AS (program IN ('regular','summer_intensive','camp','workshop')) STORED;
  END IF;
END $gen$;

-- Teachers table: add substitute/classification columns
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS substitute_session_count INT DEFAULT 0;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS substitute_session_threshold INT DEFAULT 3;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_sub_eligible BOOLEAN DEFAULT false;

-- Expand employment_type constraint to include new classification values
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_employment_type_check;
ALTER TABLE teachers ADD CONSTRAINT teachers_employment_type_check
  CHECK (employment_type IN (
    'full_time', 'part_time', 'contract',
    'employee', 'contractor_1099', 'pending_classification'
  ));

-- Add event_type to schedule_templates so templates can represent rehearsals
ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'class'
  CHECK (event_type IN (
    'class', 'trial_class', 'rehearsal', 'private_lesson',
    'performance', 'room_block', 'teacher_absence', 'studio_closure'
  ));


-- ── Part 2: Substitute System Tables ────────────────────────

CREATE TABLE IF NOT EXISTS substitute_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  authorized_for_levels TEXT[],
  authorized_for_types TEXT[],
  priority_order INT DEFAULT 1,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_auth_tenant ON substitute_authorizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_auth_teacher ON substitute_authorizations(teacher_id);

CREATE TABLE IF NOT EXISTS substitute_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES schedule_instances(id) ON DELETE CASCADE,
  requesting_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'filled', 'cancelled', 'unfilled')),
  filled_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_req_tenant_status ON substitute_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_req_instance ON substitute_requests(instance_id);

CREATE TABLE IF NOT EXISTS substitute_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES substitute_requests(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  alert_sent_at TIMESTAMPTZ DEFAULT now(),
  response TEXT CHECK (response IS NULL OR response IN ('accepted', 'declined', 'no_response')),
  responded_at TIMESTAMPTZ,
  alert_channel TEXT[] DEFAULT ARRAY['email', 'sms'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_alert_request ON substitute_alerts(request_id);
CREATE INDEX IF NOT EXISTS idx_sub_alert_teacher ON substitute_alerts(teacher_id);

-- Triggers
CREATE TRIGGER set_substitute_requests_updated_at
  BEFORE UPDATE ON substitute_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Part 3: RLS for Substitute Tables ───────────────────────

ALTER TABLE substitute_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_auth_all_admin" ON substitute_authorizations
  FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "sub_auth_select_teacher" ON substitute_authorizations
  FOR SELECT TO authenticated USING (
    public.is_teacher() AND teacher_id = auth.uid()
  );

ALTER TABLE substitute_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_req_all_admin" ON substitute_requests
  FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "sub_req_insert_teacher" ON substitute_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher() AND requesting_teacher_id = auth.uid());

CREATE POLICY "sub_req_select_teacher" ON substitute_requests
  FOR SELECT TO authenticated USING (
    public.is_teacher() AND (
      requesting_teacher_id = auth.uid()
      OR filled_by = auth.uid()
    )
  );

ALTER TABLE substitute_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_alert_all_admin" ON substitute_alerts
  FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "sub_alert_own" ON substitute_alerts
  FOR ALL TO authenticated USING (
    public.is_teacher() AND teacher_id = auth.uid()
  );


-- ── Part 4: Teacher Seed Helper ─────────────────────────────

CREATE OR REPLACE FUNCTION _seed_teacher(p_first TEXT, p_last TEXT, p_email TEXT)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  -- Check existing profile by name
  SELECT id INTO v_id FROM profiles
  WHERE first_name = p_first AND last_name = p_last LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO teachers (id, is_active)
    VALUES (v_id, true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
    RETURN v_id;
  END IF;

  -- Check existing auth user by email
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NOT NULL THEN
    INSERT INTO profiles (id, role, first_name, last_name, email)
    VALUES (v_id, 'teacher', p_first, p_last, p_email)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO teachers (id, employment_type, is_active)
    VALUES (v_id, 'employee', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
    RETURN v_id;
  END IF;

  -- Create new auth user (trigger handle_new_user auto-creates profile)
  v_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, aud, role
  ) VALUES (
    v_id, '00000000-0000-0000-0000-000000000000', p_email, '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"teacher"}', 'authenticated', 'authenticated'
  );
  -- Update the auto-created profile with name and teacher role
  UPDATE profiles
  SET role = 'teacher', first_name = p_first, last_name = p_last
  WHERE id = v_id;
  INSERT INTO teachers (id, employment_type, is_active)
  VALUES (v_id, 'employee', true);
  RETURN v_id;
END;
$$;


-- ── Part 5: Seed Data ───────────────────────────────────────

DO $$
DECLARE
  v_tenant_id uuid;
  v_season_id uuid;
  v_studio1 uuid;
  v_studio2 uuid;
  v_studio3 uuid;
  v_embed_token text;
BEGIN
  -- ── Tenant ──
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'bam';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "bam" not found — run migration 015 first.';
  END IF;

  -- ── Teachers ──
  PERFORM _seed_teacher('Amanda', 'Cobb', 'amanda.cobb@bamsocal.com');
  PERFORM _seed_teacher('Deborah', 'Fauerbach', 'deborah.fauerbach@bamsocal.com');
  PERFORM _seed_teacher('Paola', 'Gonzalez', 'paola.gonzalez@bamsocal.com');
  PERFORM _seed_teacher('Ally', 'Helmen', 'ally.helmen@bamsocal.com');
  PERFORM _seed_teacher('Samantha', 'Weeks', 'samantha.weeks@bamsocal.com');
  PERFORM _seed_teacher('Katherine', 'Thomas', 'katherine.thomas@bamsocal.com');
  PERFORM _seed_teacher('Campbell', 'Castner', 'campbell.castner@bamsocal.com');
  PERFORM _seed_teacher('Eliza', 'Johnson', 'eliza.johnson@bamsocal.com');
  PERFORM _seed_teacher('Lauryn', 'Rowe', 'lauryn.rowe@bamsocal.com');
  PERFORM _seed_teacher('Madelynn', 'Hampton', 'madelynn.hampton@bamsocal.com');
  PERFORM _seed_teacher('Kylie', 'Yamano', 'kylie.yamano@bamsocal.com');
  PERFORM _seed_teacher('Cara', 'Hansvick', 'cara.hansvick@bamsocal.com');
  PERFORM _seed_teacher('Kaitlan', 'Mills', 'kaitlan.mills@bamsocal.com');
  PERFORM _seed_teacher('Harper', 'Hottinger', 'harper.hottinger@bamsocal.com');

  -- ── Rooms (rename from migration 015 or create) ──
  UPDATE rooms SET name = 'Studio 1' WHERE tenant_id = v_tenant_id AND name = 'Studio A';
  UPDATE rooms SET name = 'Studio 2' WHERE tenant_id = v_tenant_id AND name = 'Studio B';
  UPDATE rooms SET name = 'Studio 3', capacity = 10, is_bookable = true
    WHERE tenant_id = v_tenant_id AND name = 'Waiting Area';

  INSERT INTO rooms (tenant_id, name, capacity, is_bookable)
  SELECT v_tenant_id, s.n, 10, true
  FROM (VALUES ('Studio 1'), ('Studio 2'), ('Studio 3')) AS s(n)
  WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE tenant_id = v_tenant_id AND name = s.n);

  SELECT id INTO v_studio1 FROM rooms WHERE tenant_id = v_tenant_id AND name = 'Studio 1';
  SELECT id INTO v_studio2 FROM rooms WHERE tenant_id = v_tenant_id AND name = 'Studio 2';
  SELECT id INTO v_studio3 FROM rooms WHERE tenant_id = v_tenant_id AND name = 'Studio 3';

  -- ── Season (update existing from migration 015) ──
  UPDATE seasons
  SET name = '2025/2026', period = 'fall', start_date = '2025-09-01', end_date = '2026-06-30'
  WHERE tenant_id = v_tenant_id AND is_active = true;

  SELECT id INTO v_season_id FROM seasons WHERE tenant_id = v_tenant_id AND is_active = true LIMIT 1;

  -- ── Schedule: temp table for batch insert ──
  CREATE TEMP TABLE _sched (
    cname TEXT, clevel TEXT, cstyle TEXT, cdiscipline TEXT,
    age_min INT, age_max INT, dow INT, st TIME, et TIME,
    room_name TEXT, teacher_first TEXT,
    cap INT, fee INT, is_rehearsal BOOLEAN, is_trial BOOLEAN
  );

  INSERT INTO _sched VALUES
  -- ══ MONDAY (dow=1) ══
  ('Level 1 - Mini Star Ballet','beginner','ballet','Ballet',5,9,1,'15:30','16:15','Studio 2','Deborah',10,12500,false,true),
  ('Petite - Princess Ballet','petite','ballet','Ballet',3,5,1,'15:30','16:15','Studio 1','Campbell',8,12500,false,true),
  ('Level 2B+/2C - Jazz','intermediate','jazz','Jazz',9,14,1,'15:30','16:00','Studio 3','Paola',10,12500,false,false),
  ('Jazz Comp Rehearsal - Diamonds','intermediate','jazz','Jazz',9,14,1,'16:00','16:30','Studio 3','Paola',10,0,true,false),
  ('Petite Princesses - Showcase Rehearsal','petite','ballet','Ballet',3,5,1,'16:15','16:30','Studio 1','Amanda',10,0,true,false),
  ('Cinderellas - Showcase Rehearsal','beginner','ballet','Ballet',5,9,1,'16:15','16:30','Studio 2','Amanda',10,0,true,false),
  ('Level 4B - Ballet','advanced','ballet','Ballet',12,99,1,'16:30','18:00','Studio 2','Amanda',14,15000,false,false),
  ('Pop Star Mini Jazz - Ages 5-7','beginner','jazz','Jazz',5,7,1,'16:30','17:15','Studio 3','Campbell',12,12500,false,false),
  ('Level 2B+/2C - Ballet','intermediate','ballet','Ballet',9,14,1,'16:30','17:30','Studio 1','Ally',12,12500,false,false),
  ('Level 3A - Beginner Ballet (Ages 9-14)','intermediate','ballet','Ballet',9,14,1,'17:30','18:30','Studio 3','Deborah',10,12500,false,false),
  ('Level 4C - Adv. Jazz, Stretching & Tricks','advanced','jazz','Jazz',12,99,1,'17:30','18:30','Studio 1','Paola',15,12500,false,false),
  ('Level 4B - Dryads/Water Nymphs Rehearsal','advanced','ballet','Ballet',12,99,1,'18:00','18:30','Studio 2','Amanda',14,0,true,false),
  ('Level 4C - Ballet','pre_professional','ballet','Ballet',12,99,1,'18:30','20:00','Studio 2','Katherine',15,15000,false,false),
  ('Level 4A (Teen/Adult) - Beginner Ballet','open','ballet','Ballet',14,99,1,'19:00','20:00','Studio 1','Deborah',17,12500,false,false),
  ('Level 4C - Pointe & Variations','pre_professional','pointe','Pointe',12,99,1,'20:00','20:30','Studio 2','Katherine',15,0,true,false),

  -- ══ TUESDAY (dow=2) ══
  ('2A/2B - Ballet & Broadway Combo','beginner','ballet','Ballet, Musical Theater',5,9,2,'15:30','16:45','Studio 3','Deborah',12,15000,false,true),
  ('2C+ - Advanced Ballet','intermediate','ballet','Ballet',9,14,2,'15:30','16:30','Studio 2','Amanda',11,12500,false,false),
  ('Petite - Tippy Toes & Twirls','petite','ballet','Ballet',3,5,2,'15:30','16:15','Studio 1','Amanda',12,12500,false,true),
  ('2C+ Unicorns - Rehearsal','intermediate','ballet','Ballet',9,14,2,'16:30','17:00','Studio 2','Amanda',11,0,true,false),
  ('Level 4B - Contemporary Rehearsal','advanced','contemporary','Contemporary',12,99,2,'16:30','17:00','Studio 1','Amanda',12,0,true,false),
  ('Level 3C/4B - Intermediate Ballet','intermediate','ballet','Ballet',9,14,2,'17:00','18:30','Studio 1','Amanda',12,15000,false,false),
  ('Level 4C - Ballet Full Company','pre_professional','ballet','Ballet',12,99,2,'17:00','18:30','Studio 2','Amanda',15,15000,false,false),
  ('Level 2C+ - Intermediate/Advanced Contemporary','intermediate','contemporary','Contemporary',9,14,2,'17:00','17:30','Studio 1','Amanda',10,12500,false,false),
  ('Level 4B - Contemporary','advanced','contemporary','Contemporary',12,99,2,'17:30','18:30','Studio 3','Amanda',12,12500,false,false),
  ('Level 4C - Advanced Pointe/Rehearsal','pre_professional','pointe','Pointe',12,99,2,'18:30','19:00','Studio 2','Amanda',15,0,true,false),
  ('Level 4B - Conditioning & Stretching','advanced','contemporary','Conditioning',12,99,2,'18:30','19:00','Studio 3','Amanda',12,12500,false,false),
  ('Level 4C - Contemporary','pre_professional','contemporary','Contemporary',12,99,2,'19:00','19:45','Studio 1','Amanda',15,12500,false,false),
  ('Level 4C - Contemporary Rehearsals','pre_professional','contemporary','Contemporary',12,99,2,'19:45','20:30','Studio 1','Amanda',15,0,true,false),

  -- ══ WEDNESDAY (dow=3) ══
  ('Level 2B+/2C - Ballet','intermediate','ballet','Ballet',9,14,3,'15:30','16:30','Studio 2','Deborah',10,12500,false,false),
  ('Level 1 - Sparkle & Shine Jazz','beginner','jazz','Jazz',5,9,3,'15:30','16:15','Studio 1','Amanda',10,12500,false,true),
  ('Level 2A - Beginner Jazz Pop Star (Ages 5-9)','beginner','jazz','Jazz',5,9,3,'15:30','16:15','Studio 3','Campbell',10,12500,false,true),
  ('Level 2B+/2C - Mermaids Rehearsal','intermediate','ballet','Ballet',9,14,3,'16:00','16:30','Studio 2','Deborah',10,0,true,false),
  ('Level 1 - Sparkle & Shine Stars Rehearsal','beginner','jazz','Jazz',5,9,3,'16:15','16:30','Studio 1','Amanda',10,0,true,false),
  ('Level 2B+/2C - Jazz/Stretching & Tricks','intermediate','jazz','Jazz',9,14,3,'16:30','17:30','Studio 1','Paola',10,12500,false,false),
  ('Level 4B - Ballet','advanced','ballet','Ballet',12,99,3,'16:30','18:00','Studio 1','Amanda',14,15000,false,false),
  ('Level 2A Beginner Ballet','beginner','ballet','Ballet',5,9,3,'16:30','17:15','Studio 2','Deborah',10,12500,false,true),
  ('Level 3B Jazz - Intermediate (Ages 9-18)','intermediate','jazz','Jazz',9,18,3,'17:30','18:15','Studio 3','Paola',12,12500,false,false),
  ('Level 4C Ballet','pre_professional','ballet','Ballet',12,99,3,'17:30','19:00','Studio 2','Cara',15,15000,false,false),
  ('Level 4B Jazz - Turns & Jumps (Ages 9-18)','advanced','jazz','Jazz',9,18,3,'18:30','19:30','Studio 1','Amanda',12,12500,false,false),
  ('Level 4C - Pointe','pre_professional','pointe','Pointe',12,99,3,'19:00','19:30','Studio 2','Amanda',15,12500,false,false),
  ('Level 4C Jazz - Jumps and Turns','pre_professional','jazz','Jazz',12,99,3,'19:30','20:15','Studio 1','Amanda',15,12500,false,false),

  -- ══ THURSDAY (dow=4) ══
  ('Princess Petites','petite','ballet','Ballet',3,5,4,'15:30','16:15','Studio 3','Eliza',10,12500,false,true),
  ('2C+ Ballet','intermediate','ballet','Ballet',9,14,4,'15:30','16:30','Studio 2','Amanda',11,12500,false,false),
  ('Level 2A - Beginner Contemporary Flow (Ages 5-9)','beginner','contemporary','Contemporary',5,9,4,'15:30','16:30','Studio 1','Samantha',10,12500,false,true),
  ('Level 1/2: K-pop & Mini Groovers Hip Hop (Ages 5-9)','beginner','jazz','Hip Hop',5,9,4,'16:30','17:30','Studio 3','Eliza',10,12500,false,false),
  ('Levels 3C/4B - Intermediate/Advanced Ballet','intermediate','ballet','Ballet',9,14,4,'17:00','18:30','Studio 2','Ally',12,15000,false,false),
  ('Level 2C+ Jazz','intermediate','jazz','Jazz',9,14,4,'17:00','17:30','Studio 1','Amanda',10,12500,false,false),
  ('Level 4B/4C - Advanced Contemporary','advanced','contemporary','Contemporary',12,99,4,'17:30','18:30','Studio 1','Amanda',12,12500,false,false),
  ('Pop Up Hip Hop - 9 Weeks (Ages 9+)','open','jazz','Hip Hop',9,99,4,'17:30','18:30','Studio 1','Lauryn',12,25000,false,false),
  ('Level 3C/4B - Intermediate Contemporary','intermediate','contemporary','Contemporary',9,14,4,'18:30','19:30','Studio 1','Samantha',12,12500,false,false),
  ('Level 4 - Hip Hop 12+','advanced','jazz','Hip Hop',12,99,4,'18:30','19:30','Studio 3','Amanda',12,12500,false,false),
  ('NEW (Teen/Adult) 4A Pre-Pointe & Variations','open','pointe','Pointe',14,99,4,'19:00','19:30','Studio 2','Ally',10,10000,false,false),
  ('Level 4A (Teen/Adult) - Intermediate Ballet','open','ballet','Ballet',14,99,4,'19:30','20:30','Studio 2','Ally',12,12500,false,false),

  -- ══ FRIDAY (dow=5) ══
  ('Petite - Tippy Toes & Twirls (Morning)','petite','ballet','Ballet',3,5,5,'10:00','10:45','Studio 3','Kaitlan',10,12500,false,true),
  ('NEW! Tiny Tutus & Twirls','petite','ballet','Ballet',3,5,5,'15:30','16:15','Studio 1','Kylie',10,12500,false,true),
  ('NEW! Mini Musical Theater','beginner','musical_theatre','Musical Theater',5,9,5,'16:30','17:15','Studio 1','Kylie',10,12500,false,false),

  -- ══ SATURDAY (dow=6) ══
  ('Level 2C & 2C+ & 3C - Pre-Pointe','intermediate','pointe','Pointe',9,14,6,'10:00','10:30','Studio 1','Katherine',12,12500,false,false),
  ('4B/4C Advanced Ballet','advanced','ballet','Ballet',12,99,6,'10:30','12:00','Studio 2','Amanda',14,15000,false,false),
  ('Level 2C, 2C+, & 3C - Jazz','intermediate','jazz','Jazz',9,14,6,'10:30','11:30','Studio 1','Lauryn',12,12500,false,false),
  ('Level 4 Conditioning & Tricks','advanced','contemporary','Conditioning',12,99,6,'11:30','12:15','Studio 3','Amanda',12,12500,false,false),
  ('Level 2C & 2C+ - Stretching & Tricks','intermediate','contemporary','Conditioning',9,14,6,'11:30','12:00','Studio 1','Lauryn',12,12500,false,false);

  -- ── Insert classes for entries that don't already exist ──
  INSERT INTO classes (name, level, style, discipline, age_min, age_max, day_of_week, start_time, end_time, max_students, is_active, fee_cents, season, status)
  SELECT s.cname, s.clevel, s.cstyle, s.cdiscipline, s.age_min, s.age_max, s.dow, s.st, s.et, s.cap, true, s.fee, '2025-2026', 'active'
  FROM _sched s
  WHERE NOT EXISTS (
    SELECT 1 FROM classes c
    WHERE c.name = s.cname AND c.day_of_week = s.dow AND c.start_time = s.st
  );

  -- ── Insert schedule_templates ──
  INSERT INTO schedule_templates (
    tenant_id, season_id, class_id, teacher_id, room_id,
    day_of_week, start_time, end_time,
    is_trial_eligible, max_capacity, is_active, event_type
  )
  SELECT
    v_tenant_id, v_season_id, c.id, p.id, r.id,
    s.dow, s.st, s.et,
    s.is_trial, s.cap, true,
    CASE WHEN s.is_rehearsal THEN 'rehearsal' ELSE 'class' END
  FROM _sched s
  JOIN classes c ON c.name = s.cname AND c.day_of_week = s.dow AND c.start_time = s.st
  LEFT JOIN profiles p ON p.first_name = s.teacher_first AND p.role = 'teacher'::user_role
  LEFT JOIN rooms r ON r.name = s.room_name AND r.tenant_id = v_tenant_id;

  -- ── Generate schedule_instances for current week (Mon Mar 9 – Sat Mar 14) ──
  INSERT INTO schedule_instances (
    tenant_id, template_id, class_id, teacher_id, room_id,
    event_type, event_date, start_time, end_time,
    status, approval_status, is_trial_eligible, ical_uid
  )
  SELECT
    st.tenant_id, st.id, st.class_id, st.teacher_id, st.room_id,
    COALESCE(st.event_type, 'class'),
    ('2026-03-09'::date + (st.day_of_week - 1))::date,
    st.start_time, st.end_time,
    'published', 'approved', st.is_trial_eligible,
    gen_random_uuid()::text
  FROM schedule_templates st
  WHERE st.season_id = v_season_id
    AND st.is_active = true
    AND st.day_of_week BETWEEN 1 AND 6;

  -- ── Default schedule embed ──
  v_embed_token := gen_random_uuid()::text;

  INSERT INTO schedule_embeds (
    tenant_id, name, embed_token, default_season_id,
    allow_filter_day, allow_filter_level, allow_filter_age,
    allow_filter_class_type, allow_filter_trial, allow_filter_rehearsal,
    allow_filter_season, allow_filter_teacher,
    display_mode, show_teacher, show_room
  ) VALUES (
    v_tenant_id, 'Homepage - Full Schedule', v_embed_token, v_season_id,
    true, true, true,
    true, true, false,
    false, false,
    'week', true, false
  );

  DROP TABLE _sched;
END $$;

-- ── Cleanup helper ──────────────────────────────────────────
DROP FUNCTION IF EXISTS _seed_teacher(TEXT, TEXT, TEXT);
