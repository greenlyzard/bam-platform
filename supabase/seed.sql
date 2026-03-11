-- ============================================================
-- BAM Platform — Seed Data for Local Development
-- Run with: npx supabase db reset (applies migrations + seed)
-- ============================================================
-- NOTE: Profile inserts depend on auth.users existing.
-- In local dev, create users via Supabase Dashboard or Auth API first,
-- then the on_auth_user_created trigger will create profiles.
-- The data below seeds non-auth tables.

-- ============================================================
-- Classes
-- ============================================================
insert into classes (id, name, style, level, age_min, age_max, max_students, day_of_week, start_time, end_time, room, description) values
  ('11111111-1111-1111-1111-111111111101', 'Creative Movement', 'ballet', 'pre_ballet', 3, 4, 10, 2, '09:30', '10:15', 'Studio A', 'Introduction to ballet for our youngest dancers. Imagination, rhythm, and joy.'),
  ('11111111-1111-1111-1111-111111111102', 'Pre-Ballet', 'ballet', 'pre_ballet', 4, 5, 10, 2, '10:30', '11:15', 'Studio A', 'Building coordination, listening skills, and basic ballet vocabulary.'),
  ('11111111-1111-1111-1111-111111111103', 'Ballet Level 1', 'ballet', 'level_1', 6, 8, 10, 1, '16:00', '17:00', 'Studio A', 'Barre fundamentals, center work, and beginning across-the-floor combinations.'),
  ('11111111-1111-1111-1111-111111111104', 'Ballet Level 2', 'ballet', 'level_2', 7, 9, 10, 3, '16:00', '17:00', 'Studio A', 'Advancing technique, musicality, and classical vocabulary.'),
  ('11111111-1111-1111-1111-111111111105', 'Ballet Level 3', 'ballet', 'level_3', 9, 12, 10, 1, '17:00', '18:15', 'Studio A', 'Intermediate technique with emphasis on artistry and performance quality.'),
  ('11111111-1111-1111-1111-111111111106', 'Jazz Level 1', 'jazz', 'level_1', 7, 10, 10, 4, '16:30', '17:30', 'Studio A', 'Introduction to jazz technique, rhythm, and expression.'),
  ('11111111-1111-1111-1111-111111111107', 'Contemporary', 'contemporary', 'level_2', 10, 14, 10, 5, '16:00', '17:15', 'Studio A', 'Modern movement, floor work, and creative expression.'),
  ('11111111-1111-1111-1111-111111111108', 'Musical Theatre', 'musical_theatre', 'level_1', 8, 12, 10, 6, '10:00', '11:00', 'Studio A', 'Singing, acting, and dancing — triple threat training.');

-- ============================================================
-- Badges
-- ============================================================
insert into badges (name, slug, description, category, tier, auto_award, criteria) values
  ('First Class', 'first-class', 'Attended your very first class at Ballet Academy and Movement', 'milestone', 'bronze', true, '{"type": "attendance_count", "threshold": 1}'),
  ('10 Class Streak', '10-class-streak', 'Attended 10 consecutive classes without absence', 'attendance', 'silver', true, '{"type": "attendance_streak", "threshold": 10}'),
  ('Perfect Month', 'perfect-month', 'No absences for an entire calendar month', 'attendance', 'gold', true, '{"type": "perfect_month"}'),
  ('Clean Pirouette', 'clean-pirouette', 'Demonstrated a clean, controlled single pirouette', 'skill', 'bronze', false, null),
  ('Pointe Ready', 'pointe-ready', 'Teacher has assessed readiness to begin pointe work', 'skill', 'gold', false, null),
  ('Musicality Star', 'musicality-star', 'Exceptional musical phrasing and expression', 'skill', 'silver', false, null),
  ('Grand Allegro', 'grand-allegro', 'Mastered grand allegro combinations with height and control', 'skill', 'gold', false, null),
  ('Stage Presence', 'stage-presence', 'Captivating presence during performance', 'performance', 'silver', false, null),
  ('Nutcracker Cast', 'nutcracker-cast', 'Cast in The Nutcracker production', 'milestone', 'gold', true, '{"type": "cast_in_performance", "performance": "nutcracker"}'),
  ('One Year at BAM', 'one-year', 'Celebrating one full year at Ballet Academy and Movement', 'milestone', 'gold', true, '{"type": "enrollment_duration_days", "threshold": 365}'),
  ('Summer Intensive', 'summer-intensive', 'Completed the BAM Summer Intensive program', 'special', 'silver', true, '{"type": "program_complete", "program": "summer_intensive"}'),
  ('Class Helper', 'class-helper', 'Helped younger students and demonstrated leadership', 'leadership', 'bronze', false, null);

-- ============================================================
-- Shop config (Sugar Plum Shop)
-- ============================================================
insert into shop_configs (name, slug, primary_color, secondary_color, is_active, event_name) values
  ('BAM Studio Shop', 'bam-studio-shop', '#9C8BBF', '#C9A84C', true, null),
  ('Sugar Plum Shop', 'sugar-plum-shop', '#9C8BBF', '#C9A84C', false, 'The Nutcracker 2026');

-- ============================================================
-- Competitor studios (from COMPETITIVE_ANALYSIS.md)
-- ============================================================
insert into competitor_studios (name, city, segment, threat_level, programs, notes) values
  ('San Clemente Dance Academy', 'San Clemente', 'competition', 'high', '{"ballet", "jazz", "tap", "hip_hop", "contemporary"}', 'Same city — direct competitor for recreational and competition students'),
  ('Southland Ballet Academy', 'Mission Viejo', 'classical_ballet', 'medium', '{"ballet", "pointe", "contemporary"}', 'Classical focus, 15-min drive'),
  ('Pacific Ballet Conservatory', 'Laguna Niguel', 'classical_ballet', 'medium', '{"ballet", "pointe"}', 'Pre-professional track'),
  ('Capistrano Academy of Dance', 'San Juan Capistrano', 'recreational', 'medium', '{"ballet", "jazz", "tap", "contemporary"}', 'Multi-style, 15-min drive'),
  ('South Coast Conservatory', 'Costa Mesa', 'conservatory', 'low', '{"ballet", "contemporary", "modern"}', 'Premium, further away'),
  ('Tutu School', 'Various', 'franchise', 'medium', '{"pre_ballet", "creative_movement"}', 'Franchise, ages 2-8 only'),
  ('Moxie Dance', 'Ladera Ranch', 'commercial', 'low', '{"jazz", "hip_hop", "contemporary"}', 'Competition/commercial focus, different market'),
  ('Variant Dance', 'Mission Viejo', 'commercial', 'low', '{"jazz", "contemporary", "hip_hop"}', 'Competition studio, different market');

-- ============================================================
-- Expansion markets
-- ============================================================
insert into expansion_markets (city, state, region, population, median_household_income, competitor_count, readiness_score, status, pros, cons) values
  ('Ladera Ranch', 'CA', 'South Orange County', 30000, 165000, 2, 78, 'evaluating',
   '{"High income families", "Young families with children", "Limited ballet-specific competition", "15 min from HQ"}',
   '{"Smaller population", "Need to find retail space", "HOA restrictions"}'),
  ('Rancho Mission Viejo', 'CA', 'South Orange County', 18000, 155000, 1, 72, 'research',
   '{"New development — growing population", "Affluent families", "Very few competitors"}',
   '{"Still building out", "No established commercial areas yet", "20 min from HQ"}'),
  ('San Juan Capistrano', 'CA', 'South Orange County', 36000, 105000, 3, 65, 'research',
   '{"Larger population", "Historic downtown with retail space", "Equestrian culture aligns with arts"}',
   '{"Lower median income", "More competitors", "Traffic during rush hour"}');
