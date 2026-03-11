-- ============================================================
-- Add catalog columns to classes table and seed 2025–2026 schedule
-- ============================================================

-- Add missing columns
alter table public.classes add column if not exists discipline text;
alter table public.classes add column if not exists fee_cents integer;
alter table public.classes add column if not exists season text;
alter table public.classes add column if not exists notes text;
alter table public.classes add column if not exists enrolled_count integer not null default 0;
alter table public.classes add column if not exists status text not null default 'active'
  check (status in ('active', 'waitlist', 'full', 'cancelled', 'archived'));

-- Back-fill discipline from style for any existing rows
update public.classes set discipline = style where discipline is null;

-- Index on season and status
create index if not exists idx_classes_season on classes(season);
create index if not exists idx_classes_status on classes(status);

-- ============================================================
-- Anon read access for public class catalog
-- ============================================================
create policy "classes_select_anon_active" on classes
  for select to anon
  using (is_active = true and status = 'active');

-- ============================================================
-- Seed: 2025–2026 Full Class Schedule (from CLASSES.md)
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
-- ============================================================

-- ── MONDAY (day_of_week = 1) ─────────────────────────────────
insert into public.classes (name, level, style, discipline, age_min, age_max, day_of_week, start_time, end_time, fee_cents, season, status, notes, max_students) values
('Princess Ballet — Ballet & Movement Combo', 'petite', 'ballet', 'Ballet, Combo', 3, 5, 1, '15:30', '16:15', 12500, '2025-2026', 'active', null, 10),
('Mini Star Ballet', 'beginner', 'ballet', 'Ballet', 5, 9, 1, '15:30', '16:15', 12500, '2025-2026', 'active', null, 10),
('Level 2B+/2C Jazz', 'intermediate', 'jazz', 'Jazz', 9, 14, 1, '15:30', '16:00', 12500, '2025-2026', 'active', null, 10),
('Pop Star Mini Jazz (Ages 5-7)', 'beginner', 'jazz', 'Jazz', 5, 9, 1, '16:30', '17:15', 12500, '2025-2026', 'full', 'Waitlist', 10),
('Level 2B+/2C Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 1, '16:30', '17:30', 12500, '2025-2026', 'active', null, 10),
('Level 4B Ballet', 'advanced', 'ballet', 'Ballet', 12, 99, 1, '16:30', '18:00', 15000, '2025-2026', 'active', null, 10),
('Level 3A Beginner Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 1, '17:30', '18:30', 12500, '2025-2026', 'active', null, 10),
('Level 4C Jazz, Stretching & Tricks', 'advanced', 'jazz', 'Jazz, Conditioning', 12, 99, 1, '17:30', '18:30', 12500, '2025-2026', 'active', null, 10),
('Level 4C Ballet', 'pre_professional', 'ballet', 'Ballet', 12, 99, 1, '18:30', '20:00', 15000, '2025-2026', 'active', null, 10),
('Teen/Adult Beginner Ballet', 'open', 'ballet', 'Ballet', 14, 99, 1, '19:00', '20:00', 12500, '2025-2026', 'active', null, 10),

-- ── TUESDAY (day_of_week = 2) ────────────────────────────────
('Tippy Toes & Twirls — Ballet & Movement', 'petite', 'ballet', 'Ballet, Combo', 3, 5, 2, '15:30', '16:15', 12500, '2025-2026', 'active', null, 10),
('2C+ Advanced Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 2, '15:30', '16:30', 12500, '2025-2026', 'full', 'Full', 10),
('Ballet & Broadway Combo', 'beginner', 'ballet', 'Ballet, Musical Theater, Combo', 5, 9, 2, '15:30', '16:45', 15000, '2025-2026', 'active', null, 10),
('Level 2C+ Intermediate Contemporary', 'intermediate', 'contemporary', 'Contemporary', 9, 14, 2, '17:00', '17:30', 12500, '2025-2026', 'active', null, 10),
('Level 3C/4B Intermediate Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 2, '17:00', '18:30', 15000, '2025-2026', 'active', 'Over cap', 10),
('Level 4C Ballet Full Company', 'pre_professional', 'ballet', 'Ballet', 12, 99, 2, '17:00', '18:30', 15000, '2025-2026', 'active', null, 10),
('Level 4B Contemporary', 'advanced', 'contemporary', 'Contemporary', 12, 99, 2, '17:30', '18:30', 12500, '2025-2026', 'active', null, 10),
('Level 4B Conditioning & Stretching', 'advanced', 'contemporary', 'Conditioning', 12, 99, 2, '18:30', '19:00', 12500, '2025-2026', 'active', null, 10),
('Level 4C Contemporary', 'pre_professional', 'contemporary', 'Contemporary', 12, 99, 2, '19:00', '19:45', 12500, '2025-2026', 'full', 'Full', 10),

-- ── WEDNESDAY (day_of_week = 3) ──────────────────────────────
('Level 2B+/2C Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 3, '15:30', '16:30', 12500, '2025-2026', 'active', null, 10),
('Sparkle & Shine Jazz', 'beginner', 'jazz', 'Jazz', 5, 9, 3, '15:30', '16:15', 12500, '2025-2026', 'active', null, 10),
('POP Star Jazz! (Ages 5-9)', 'beginner', 'jazz', 'Jazz', 5, 9, 3, '15:30', '16:15', 12500, '2025-2026', 'active', null, 10),
('Level 2A Beginner Ballet', 'beginner', 'ballet', 'Ballet', 5, 9, 3, '16:30', '17:15', 12500, '2025-2026', 'active', null, 10),
('Level 2B+/2C Jazz & Tricks', 'intermediate', 'jazz', 'Jazz, Conditioning', 9, 14, 3, '16:30', '17:30', 12500, '2025-2026', 'active', null, 10),
('Level 4B Ballet', 'advanced', 'ballet', 'Ballet', 12, 99, 3, '16:30', '18:00', 15000, '2025-2026', 'active', null, 10),
('Level 3B Intermediate Jazz', 'intermediate', 'jazz', 'Jazz', 9, 14, 3, '17:30', '18:15', 12500, '2025-2026', 'full', 'Full', 10),
('Level 4C Ballet', 'pre_professional', 'ballet', 'Ballet', 12, 99, 3, '17:30', '19:00', 15000, '2025-2026', 'active', null, 10),
('4B Pointe & Pilates', 'advanced', 'pointe', 'Pointe, Conditioning', 12, 99, 3, '18:00', '18:30', 12500, '2025-2026', 'active', null, 10),
('Level 4B Jazz — Turns & Jumps', 'advanced', 'jazz', 'Jazz', 12, 99, 3, '18:30', '19:30', 12500, '2025-2026', 'active', null, 10),
('Level 4C Pointe', 'pre_professional', 'pointe', 'Pointe', 12, 99, 3, '19:00', '19:30', 12500, '2025-2026', 'active', null, 10),
('Level 4C Jazz — Jumps and Turns', 'pre_professional', 'jazz', 'Jazz', 12, 99, 3, '19:30', '20:15', 12500, '2025-2026', 'active', null, 10),

-- ── THURSDAY (day_of_week = 4) ───────────────────────────────
('Princess Petites', 'petite', 'ballet', 'Ballet', 3, 5, 4, '15:30', '16:15', 12500, '2025-2026', 'active', null, 10),
('Level 2A Contemporary Flow', 'beginner', 'contemporary', 'Contemporary', 5, 9, 4, '15:30', '16:30', 12500, '2025-2026', 'active', null, 10),
('2C+ Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 4, '15:30', '16:30', 12500, '2025-2026', 'active', null, 10),
('K-pop & Mini Groovers Hip Hop', 'beginner', 'jazz', 'Hip Hop', 5, 9, 4, '16:30', '17:30', 12500, '2025-2026', 'active', null, 10),
('Level 2C+ Jazz', 'intermediate', 'jazz', 'Jazz', 9, 14, 4, '17:00', '17:30', 12500, '2025-2026', 'active', null, 10),
('Levels 3C/4B Intermediate Ballet', 'intermediate', 'ballet', 'Ballet', 9, 14, 4, '17:00', '18:30', 15000, '2025-2026', 'active', null, 10),
('Level 4B/4C Advanced Contemporary', 'advanced', 'contemporary', 'Contemporary', 12, 99, 4, '17:30', '18:30', 12500, '2025-2026', 'active', null, 10),
('Pop-Up Hip Hop — 9 Weeks!', 'open', 'jazz', 'Hip Hop', 5, 14, 4, '17:30', '18:30', 25000, '2025-2026', 'active', 'Limited session', 10),
('Level 3C/4B Intermediate Contemporary', 'intermediate', 'contemporary', 'Contemporary', 9, 14, 4, '18:30', '19:30', 12500, '2025-2026', 'active', 'Over cap', 10),
('Level 4 Hip Hop (Ages 12+)', 'advanced', 'jazz', 'Hip Hop', 12, 99, 4, '18:30', '19:30', 12500, '2025-2026', 'active', null, 10),
('Teen/Adult Pre-Pointe & Variations', 'open', 'pointe', 'Pointe', 14, 99, 4, '19:00', '19:30', 10000, '2025-2026', 'active', 'New class', 10),
('Teen/Adult Intermediate Ballet', 'open', 'ballet', 'Ballet', 14, 99, 4, '19:30', '20:30', 12500, '2025-2026', 'active', null, 10),

-- ── FRIDAY (day_of_week = 5) ─────────────────────────────────
('Tippy Toes & Twirls — Ballet & Movement', 'petite', 'ballet', 'Ballet, Combo', 3, 5, 5, '10:00', '10:45', 12500, '2025-2026', 'active', null, 10),
('Tiny Tutus & Twirls', 'petite', 'ballet', 'Ballet', 3, 5, 5, '15:30', '16:15', 12500, '2025-2026', 'full', 'Waitlist', 10),
('Mini Musical Theater', 'beginner', 'musical_theatre', 'Musical Theater', 5, 9, 5, '16:30', '17:15', 12500, '2025-2026', 'full', 'Waitlist', 10),

-- ── SATURDAY (day_of_week = 6) ───────────────────────────────
('Level 2C/2C+/3C Pre-Pointe', 'intermediate', 'pointe', 'Pointe', 9, 14, 6, '10:00', '10:30', 12500, '2025-2026', 'full', 'Full', 10),
('4B/4C Advanced Ballet', 'advanced', 'ballet', 'Ballet', 12, 99, 6, '10:30', '12:00', 15000, '2025-2026', 'active', null, 10),
('Level 2C/2C+/3C Jazz', 'intermediate', 'jazz', 'Jazz', 9, 14, 6, '10:30', '11:30', 12500, '2025-2026', 'active', null, 10),
('Level 4 Conditioning & Tricks', 'advanced', 'contemporary', 'Conditioning', 12, 99, 6, '11:30', '12:15', 12500, '2025-2026', 'active', null, 10),
('Level 2C/2C+/3C Stretching & Tricks', 'intermediate', 'contemporary', 'Conditioning', 9, 14, 6, '11:30', '12:00', 12500, '2025-2026', 'full', 'Full', 10);
