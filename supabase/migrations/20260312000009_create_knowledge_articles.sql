-- Knowledge Articles for Angelina AI chatbot
-- Stores studio knowledge that Angelina can reference when answering questions

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             text NOT NULL,
  content           text NOT NULL,
  category          text NOT NULL DEFAULT 'faq'
    CHECK (category IN ('policy', 'faq', 'curriculum', 'studio', 'ballet_terminology', 'staff', 'production')),
  audience          text[] NOT NULL DEFAULT '{all}',
  is_active         boolean NOT NULL DEFAULT true,
  last_reviewed_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_knowledge_articles_tenant ON knowledge_articles(tenant_id);
CREATE INDEX idx_knowledge_articles_category ON knowledge_articles(tenant_id, category);
CREATE INDEX idx_knowledge_articles_active ON knowledge_articles(tenant_id, is_active) WHERE is_active = true;

-- Full-text search index
ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX idx_knowledge_articles_search ON knowledge_articles USING GIN(search_vector);

-- Updated_at trigger
CREATE TRIGGER set_knowledge_articles_updated_at
  BEFORE UPDATE ON knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to knowledge_articles"
  ON knowledge_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Authenticated users can read active knowledge_articles"
  ON knowledge_articles FOR SELECT
  USING (
    is_active = true
    AND auth.uid() IS NOT NULL
  );

-- ── Seed 10 starter articles for BAM ──

INSERT INTO knowledge_articles (tenant_id, title, content, category, audience) VALUES

-- 1. Dress Code
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'What to Wear to Class (Dress Code)',
  'For Pre-Ballet and early levels, students need:
- A leotard (any color for recreational; black for Performance and Competition Company)
- Ballet tights (pink or skin-tone)
- Ballet slippers (pink leather or canvas)
- Hair pulled back neatly in a bun

No jewelry, no loose clothing, and no street shoes in the studio. Pointe shoes are never worn until a student has been assessed and cleared by their instructor — this is a safety requirement based on bone maturity and ankle/foot strength.

For Jazz classes: form-fitting dance attire and jazz shoes.
For Contemporary: leotard and tights or fitted dance clothing; bare feet or foot undies.',
  'policy',
  '{parent, all}'
),

-- 2. Class Cancellation Policy
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'Class Cancellation and Withdrawal Policy',
  'To withdraw from a class or cancel enrollment, families must provide 30 days'' written notice. Key details:

- No mid-month refunds unless approved by the studio director
- Future credit may be issued at the studio''s discretion
- The cancellation notice date is logged and the system calculates your final billing date
- Registration fees are non-refundable

For class cancellations by the studio (weather, emergency, etc.):
- Parents and students are notified immediately via email and SMS
- Makeup classes or credits are provided when possible
- If a substitute teacher is not available, a credit is issued automatically',
  'policy',
  '{parent, all}'
),

-- 3. Trial Class
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'What Happens at a Trial Class',
  'Every new student is welcome to attend one free trial class — no commitment, no pressure!

What to expect:
- Your child will join the age-appropriate class and participate alongside enrolled students
- The teacher will help them feel welcome and guide them through the basics
- Trial students appear on the class roster tagged as [TRIAL]
- No registration fee is required for a trial — the fee is only due upon full enrollment

After the trial:
- Same day: We''ll send a friendly follow-up asking how your child enjoyed class
- Within a few days: You''ll receive information about our programs and Amanda''s teaching philosophy
- We''ll let you know about available spots so you can secure your child''s place

A second trial class requires approval from Amanda (our studio director). Just ask!

To book a trial: contact us at dance@bamsocal.com or (949) 229-0846, or chat with Angelina right here.',
  'faq',
  '{parent, all}'
),

-- 4. How to Enroll
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'How to Enroll at Ballet Academy and Movement',
  'There are several ways to get started:

Option 1 — Chat with Angelina (that''s me!):
Tell me your child''s age, experience level, and schedule preferences. I''ll recommend 1-3 classes and help you book a free trial or register directly.

Option 2 — Intake Survey:
Fill out our online intake form with your child''s information. Our system will analyze the best class fit and present personalized recommendations.

Option 3 — Direct Registration:
Browse our class schedule, filter by age and day/time, and select a class. The enrollment wizard walks you through:
1. Student information (name, DOB, health notes)
2. Parent/guardian details
3. Emergency contacts
4. Registration fee payment
5. Enrollment confirmation

For returning students, re-enrollment is streamlined — your child continues at their current level unless a placement change is recommended by their teacher.

Class sizes are capped at 10 students to ensure personalized attention.',
  'faq',
  '{parent, all}'
),

-- 5. Nutcracker
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'The Nutcracker at Ballet Academy and Movement',
  'Our annual production of The Nutcracker is one of the highlights of the year! This is a full-length classical ballet production held every November–December.

What makes our Nutcracker special:
- It''s a REAL full-length production with professional-quality sets, costumes, and music
- Students earn roles through their seasonal training — it''s not audition-only for younger levels
- Roles range from Party Scene children and Snowflakes to Clara and the Sugar Plum Fairy
- No other studio in San Clemente produces a full Nutcracker
- Students who perform earn the coveted "Nutcracker" achievement badge

Rehearsals begin in early fall and performances are typically in December. Cast lists are announced by Amanda based on each student''s level, dedication, and readiness.

This production is a magical experience for students and families alike — many of our families say it''s their favorite holiday tradition!',
  'production',
  '{parent, all}'
),

-- 6. About Amanda Cobb
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'About Amanda Cobb — Founder and Artistic Director',
  'Amanda Cobb is the founder, artistic director, and lead instructor of Ballet Academy and Movement. She is a former professional ballerina who brings world-class training and genuine warmth to every class she teaches.

Amanda''s vision:
- High-level classical ballet training in a nurturing, supportive environment
- Every student — from age 3 to adult — receives professional-caliber instruction
- The focus is on building strong foundations, artistry, and confidence

Under Amanda''s leadership:
- Ballet Academy and Movement has been named Best Dance School in San Clemente three times
- The studio received San Clemente Hall of Fame recognition
- Students have been accepted to intensives at the Royal Ballet School (London), American Ballet Theatre (NYC), and Stuttgart Ballet (Germany)
- The studio produces a full-length Nutcracker annually

Amanda teaches all levels and personally oversees curriculum development, class placement decisions, and the artistic direction of all productions. She knows every student by name.

Contact Amanda: dance@bamsocal.com',
  'staff',
  '{parent, all}'
),

-- 7. About the Studio
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'About Ballet Academy and Movement',
  'Ballet Academy and Movement is a classical ballet studio in San Clemente, California, founded by former professional ballerina Amanda Cobb.

Our mission: Real ballet training in a nurturing environment.

What sets us apart:
- Professional ballet pedagogy — not a recreational-only or competition factory
- Small class sizes (maximum 10 students per class) for personalized attention
- Three-time Best Dance School in San Clemente
- San Clemente Hall of Fame recognition
- Students accepted to Royal Ballet, ABT, and Stuttgart Ballet intensives
- Full-length Nutcracker production annually
- A culture that prioritizes technique, artistry, and joy over trophies

Programs:
- Recreational Program: Open enrollment for all ages. Focus on fundamentals, musicality, and love of dance
- Performance Company: Teacher-selected students who demonstrate dedication and skill. Productions include The Nutcracker and Spring Showcase
- Competition Company: Auditioned placement for students pursuing competitive opportunities (YAGP, regional, and national events)

A single student can participate in any or all three programs simultaneously.

We also offer Jazz, Contemporary, and Musical Theatre classes, all rooted in classical ballet technique.

Location: 400-C Camino De Estrella, San Clemente, CA 92672
Phone: (949) 229-0846
Email: dance@bamsocal.com
Website: balletacademyandmovement.com',
  'studio',
  '{parent, all}'
),

-- 8. Ballet Levels
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'Ballet Levels Explained — Pre-Ballet through Advanced',
  'Our class levels are designed to meet each student exactly where they are:

Pre-Ballet / Creative Movement (Ages 3–5)
- 45-minute classes focused on rhythm, coordination, body awareness, and imagination
- No pressure to perform technique perfectly — it''s about building a foundation and a love for movement
- Key skills: pliés, relevés, jumps, pointing toes, "ballet feet"

Ballet Level 1 (Ages 5–7)
- 45–60 minute classes introducing barre fundamentals and basic center work
- Students learn the five positions of feet, plié, tendu, dégagé, relevé, and arabesque
- Prerequisite: 1 year of Pre-Ballet or teacher assessment

Ballet Level 2 (Ages 6–9)
- 60-minute classes building barre proficiency, center combinations, and introduction to allegro
- Key skills: battement, fondu, frappé, adagio, petit allegro, port de bras
- Prerequisite: Level 1 completion or placement class

Ballet Level 3 (Ages 8–12)
- 75–90 minute classes covering the full classical syllabus and pointe preparation
- Key skills: grand battement, développé, pirouette prep, variations
- Prerequisite: Level 2 + teacher recommendation

Pre-Pointe (Ages 10+)
- Foot and ankle strengthening, alignment work, Thera-band exercises
- Requires teacher assessment of bone maturity — we never rush students to pointe

Pointe (Ages 11+ with teacher clearance)
- 30–45 minute add-on to regular Level 3+ class
- Barre and center pointe work, variations on pointe

Progress in classical ballet is measured in years, not weeks. What you''ll notice first: improved posture, body awareness, musicality, and confidence. Technical milestones come later and are deeply individual.

Unsure which level is right? We offer free assessment classes — just ask!',
  'curriculum',
  '{parent, all}'
),

-- 9. Performance and Recital Info
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'Performance and Recital Information',
  'Ballet Academy and Movement offers two major performance opportunities each year:

The Nutcracker (November–December)
- Full-length classical ballet production — the only one in San Clemente
- Students earn roles through seasonal training and dedication
- Roles for every level, from Party Scene children to Sugar Plum Fairy
- Professional-quality sets, costumes, and music
- A beloved annual tradition for our studio families

Spring Showcase (May–June)
- End-of-year performance showcasing every class level
- Accessible to ALL enrolled students — everyone gets to perform
- Demonstrates a full year of growth and progress to families
- A celebration of each dancer''s journey

Additional opportunities:
- BAM Performance Company students participate in studio performances throughout the year
- BAM Competition Company students compete at YAGP, regional, and national events
- Summer intensives and workshops provide additional performance experience

Our students have been accepted to prestigious intensives at:
- Royal Ballet School (London)
- American Ballet Theatre (NYC)
- Stuttgart Ballet (Germany)

For performance questions, costume requirements, or rehearsal schedules, contact us at dance@bamsocal.com.',
  'production',
  '{parent, all}'
),

-- 10. Contact and Location
(
  (SELECT id FROM tenants WHERE slug = 'bam'),
  'Contact and Location Information',
  'Ballet Academy and Movement
400-C Camino De Estrella
San Clemente, CA 92672

Phone: (949) 229-0846
Email: dance@bamsocal.com
Website: balletacademyandmovement.com

We also hold classes at:
- City of San Clemente Community Center
- San Juan Hills High School — Dance Studio

Office Hours: Please contact us by email or phone for the most current office hours.

For enrollment questions, trial class bookings, or general inquiries, you can:
1. Chat with Angelina (our AI assistant) right here on the website
2. Email us at dance@bamsocal.com
3. Call (949) 229-0846
4. Visit us in person at our San Clemente studio

We typically respond to emails and messages within 24 hours during the school year.',
  'studio',
  '{parent, all}'
);
