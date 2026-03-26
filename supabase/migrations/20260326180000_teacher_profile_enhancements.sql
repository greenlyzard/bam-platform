-- Icon database
CREATE TABLE IF NOT EXISTS public.icon_library (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('discipline','company','school','certification','award','intensive')),
  icon_url      TEXT,
  website_url   TEXT,
  is_global     BOOLEAN NOT NULL DEFAULT true,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slug)
);
ALTER TABLE public.icon_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view icons" ON public.icon_library FOR SELECT USING (true);
CREATE POLICY "Admins can manage icons" ON public.icon_library FOR ALL USING (is_admin());

-- Teacher affiliations (companies, schools, intensives they were associated with)
CREATE TABLE IF NOT EXISTS public.teacher_affiliations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  icon_id          UUID REFERENCES public.icon_library(id),
  name             TEXT NOT NULL,
  affiliation_type TEXT NOT NULL CHECK (affiliation_type IN ('company','school','certification','award','intensive')),
  role             TEXT,
  years            TEXT,
  location         TEXT,
  description      TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_affiliations_teacher ON public.teacher_affiliations(teacher_id);
ALTER TABLE public.teacher_affiliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage affiliations" ON public.teacher_affiliations FOR ALL USING (is_admin());
CREATE POLICY "Teachers can manage own affiliations" ON public.teacher_affiliations FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Public can view affiliations" ON public.teacher_affiliations FOR SELECT USING (true);

-- Teacher disciplines (what they teach, with icons)
CREATE TABLE IF NOT EXISTS public.teacher_disciplines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  icon_id       UUID REFERENCES public.icon_library(id),
  name          TEXT NOT NULL,
  is_certified  BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, name)
);
CREATE INDEX IF NOT EXISTS idx_teacher_disciplines_teacher ON public.teacher_disciplines(teacher_id);
ALTER TABLE public.teacher_disciplines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage disciplines" ON public.teacher_disciplines FOR ALL USING (is_admin());
CREATE POLICY "Teachers can manage own disciplines" ON public.teacher_disciplines FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Public can view disciplines" ON public.teacher_disciplines FOR SELECT USING (true);

-- Teacher photo gallery
CREATE TABLE IF NOT EXISTS public.teacher_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_photos_teacher ON public.teacher_photos(teacher_id);
ALTER TABLE public.teacher_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage photos" ON public.teacher_photos FOR ALL USING (is_admin());
CREATE POLICY "Public can view photos" ON public.teacher_photos FOR SELECT USING (true);

-- Add bio fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title            TEXT,
  ADD COLUMN IF NOT EXISTS bio_short        TEXT,
  ADD COLUMN IF NOT EXISTS bio_full         TEXT,
  ADD COLUMN IF NOT EXISTS years_experience INTEGER,
  ADD COLUMN IF NOT EXISTS education        TEXT,
  ADD COLUMN IF NOT EXISTS social_instagram TEXT,
  ADD COLUMN IF NOT EXISTS social_linkedin  TEXT;

-- Seed global icon library
INSERT INTO public.icon_library (name, slug, category, icon_url, website_url, is_global, sort_order) VALUES
  ('American Ballet Theatre','abt','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/12/BAM_Web_Icons__ABT.png','https://www.abt.org',true,1),
  ('Alvin Ailey','alvin-ailey','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM_Icons_Alvin-AIley.png','https://www.alvinailey.org',true,2),
  ('Washington Ballet','washington-ballet','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM_Icons_Washington-Ballet-2.png','https://www.washingtonballet.org',true,3),
  ('Ohio Ballet','ohio-ballet','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM_Icons_Ohio-Ballet.png',null,true,4),
  ('Ballet Tucson','ballet-tucson','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM_Icons_Ballet-Tuscon.png',null,true,5),
  ('Charlotte Ballet','charlotte-ballet','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2025/09/BAM-Icons_Charlotte-Ballet.png',null,true,6),
  ('American Contemporary Ballet','american-contemporary','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2025/09/BAM-Icons_American-Contemporary-Ballet.png',null,true,7),
  ('Ballet Project OC','ballet-project-oc','company','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2025/09/BAM-Icons_Ballet-Project-Orange-County.png',null,true,8),
  ('University of Arizona','u-of-arizona','school','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM_Icons_University-of-Arizona.png','https://www.arizona.edu',true,10),
  ('Chautauqua Institution','chautauqua','school','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2025/09/BAM-Icons_Chautauqua-Institution.png','https://www.chq.org',true,11),
  ('Royal Ballet','royal-ballet','intensive','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/12/BAM_Web_Icons__Royal-Ballet.png','https://www.roh.org.uk',true,20),
  ('Stuttgart Ballet','stuttgart-ballet','intensive','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/12/BAM_Web_Icons_Stuttgart-Ballet.png',null,true,21),
  ('Ballet West','ballet-west','intensive','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/12/BAM__Web_Icons__Ballet-West.png',null,true,22),
  ('Miami City Ballet','miami-city-ballet','intensive','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/12/BAM-Icons_Miami-City-Ballet.png',null,true,23),
  ('Ballet','ballet','discipline','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM-Icons-Ballet-Slippers1.png',null,true,30),
  ('Contemporary','contemporary','discipline','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM-Icons-Contemporary.png',null,true,31),
  ('Jazz','jazz','discipline',null,null,true,32),
  ('Hip Hop','hip-hop','discipline',null,null,true,33),
  ('Choreography','choreography','discipline','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2025/09/BAM_Icons_Choreography.png',null,true,34),
  ('Private Instruction','private-instruction','discipline','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2025/09/BAM-Icons_Private-Instruction.png',null,true,35),
  ('Pilates','pilates','certification','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM-Icons-Pilates.png',null,true,40),
  ('Gyrotonic','gyrotonic','certification','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/06/BAM-Icons-Gyrotonic.png',null,true,41),
  ('ABT Certified Teacher','abt-certified','certification','https://i0.wp.com/balletacademyandmovement.com/wp-content/uploads/2024/12/BAM_Web_Icons__ABT.png',null,true,42)
ON CONFLICT (slug) DO NOTHING;
