-- =============================================================================
-- Seed teacher_rates from BAM_Teacher_Pay_Rates.xlsx, returned by Amanda 2026-07-28.
--
-- Data only. Schema is 20260728000001_teacher_rates.sql.
--
-- Studio defaults, applied where a teacher had no override:
--   class_lead 35 · class_assistant 20 · private 45 · rehearsal 35
--   performance_event 20 · competition 20 · training 20 · admin 20 · substitute 50
--
-- 'bonus' is deliberately NOT seeded. It is rate_type 'flat' with a
-- per-engagement amount; a seeded value would be wrong every time. A bonus
-- entry carries its amount explicitly.
--
-- Derek Shaw is excluded — he is not a teacher. His teachers row and 'teacher'
-- role are separate cleanup.
--
-- valid_from is the Fall 2026/27 start date, not the migration date: these are
-- the rates in effect for the season the hours will be logged against.
-- =============================================================================

do $$
declare
  v_tenant uuid := '84d98f72-c82f-414f-8b17-172b802f6993';
  v_missing text;
begin
  if not exists (select 1 from tenants where id = v_tenant) then
    raise exception 'Pre-flight failed: BAM tenant % not found', v_tenant;
  end if;

  -- Every seeded email must resolve to exactly one active teacher. The source
  -- workbook carries display names with known drift (Cambell/Campbell,
  -- Moorea/Morea, Cara Hansvick as a former name), so matching is by email.
  select string_agg(e.email, ', ') into v_missing
  from (values
  ('ccastner717@gmail.com'),
  ('amandacobb@bamsocal.com'),
  ('aleahdoone@gmail.com'),
  ('4forfauer@gmail.com'),
  ('cgalpin.cjb@gmail.com'),
  ('paola.gonzalez9798@gmail.com'),
  ('hamptonmadelynn@gmail.com'),
  ('allyhelman@icloud.com'),
  ('eliza.johnson@bamsocal.com'),
  ('kaileyluebrecht@gmail.com'),
  ('cara@bamsocal.com'),
  ('leilameghdadi47@gmail.com'),
  ('kaitlan.mills@bamsocal.com'),
  ('mooreapike@gmail.com'),
  ('laurynrowe19@gmail.com'),
  ('twinkletoesmel@yahoo.com'),
  ('kcrthomas@gmail.com'),
  ('samweeks16@gmail.com'),
  ('kylieyamano@gmail.com')
  ) as e(email)
  where not exists (
    select 1 from profiles p join teachers t on t.id = p.id
    where lower(p.email) = lower(e.email) and t.is_active = true
  );

  if v_missing is not null then
    raise exception 'Pre-flight failed: no active teacher for %', v_missing;
  end if;
end $$;

insert into public.teacher_rates
  (tenant_id, teacher_id, rate_key, rate_type, amount_cents, valid_from, note)
select
  '84d98f72-c82f-414f-8b17-172b802f6993'::uuid,
  p.id,
  v.rate_key,
  'hourly',
  v.amount_cents,
  date '2026-08-15',
  'Seeded from BAM_Teacher_Pay_Rates.xlsx (Amanda, 2026-07-28)'
from (values
  ('ccastner717@gmail.com','class_lead',3500),
  ('ccastner717@gmail.com','class_assistant',2000),
  ('ccastner717@gmail.com','private',3500),
  ('ccastner717@gmail.com','rehearsal',3500),
  ('ccastner717@gmail.com','performance_event',2000),
  ('ccastner717@gmail.com','competition',2000),
  ('ccastner717@gmail.com','training',2000),
  ('ccastner717@gmail.com','admin',2000),
  ('ccastner717@gmail.com','substitute',5000),
  ('amandacobb@bamsocal.com','class_lead',7500),
  ('amandacobb@bamsocal.com','class_assistant',2000),
  ('amandacobb@bamsocal.com','private',15000),
  ('amandacobb@bamsocal.com','rehearsal',3500),
  ('amandacobb@bamsocal.com','performance_event',2000),
  ('amandacobb@bamsocal.com','competition',2000),
  ('amandacobb@bamsocal.com','training',2000),
  ('amandacobb@bamsocal.com','admin',2000),
  ('amandacobb@bamsocal.com','substitute',5000),
  ('aleahdoone@gmail.com','class_lead',3500),
  ('aleahdoone@gmail.com','class_assistant',2000),
  ('aleahdoone@gmail.com','private',4500),
  ('aleahdoone@gmail.com','rehearsal',3500),
  ('aleahdoone@gmail.com','performance_event',2000),
  ('aleahdoone@gmail.com','competition',2000),
  ('aleahdoone@gmail.com','training',2000),
  ('aleahdoone@gmail.com','admin',2000),
  ('aleahdoone@gmail.com','substitute',5000),
  ('4forfauer@gmail.com','class_lead',5000),
  ('4forfauer@gmail.com','class_assistant',2000),
  ('4forfauer@gmail.com','private',5000),
  ('4forfauer@gmail.com','rehearsal',4500),
  ('4forfauer@gmail.com','performance_event',2000),
  ('4forfauer@gmail.com','competition',2000),
  ('4forfauer@gmail.com','training',2000),
  ('4forfauer@gmail.com','admin',2000),
  ('4forfauer@gmail.com','substitute',5000),
  ('cgalpin.cjb@gmail.com','class_lead',5000),
  ('cgalpin.cjb@gmail.com','class_assistant',2000),
  ('cgalpin.cjb@gmail.com','private',6000),
  ('cgalpin.cjb@gmail.com','rehearsal',3500),
  ('cgalpin.cjb@gmail.com','performance_event',2000),
  ('cgalpin.cjb@gmail.com','competition',2000),
  ('cgalpin.cjb@gmail.com','training',2000),
  ('cgalpin.cjb@gmail.com','admin',2000),
  ('cgalpin.cjb@gmail.com','substitute',5000),
  ('paola.gonzalez9798@gmail.com','class_lead',5000),
  ('paola.gonzalez9798@gmail.com','class_assistant',2000),
  ('paola.gonzalez9798@gmail.com','private',6000),
  ('paola.gonzalez9798@gmail.com','rehearsal',4500),
  ('paola.gonzalez9798@gmail.com','performance_event',2000),
  ('paola.gonzalez9798@gmail.com','competition',2000),
  ('paola.gonzalez9798@gmail.com','training',2000),
  ('paola.gonzalez9798@gmail.com','admin',2000),
  ('paola.gonzalez9798@gmail.com','substitute',5000),
  ('hamptonmadelynn@gmail.com','class_lead',5000),
  ('hamptonmadelynn@gmail.com','class_assistant',2000),
  ('hamptonmadelynn@gmail.com','private',5000),
  ('hamptonmadelynn@gmail.com','rehearsal',5000),
  ('hamptonmadelynn@gmail.com','performance_event',2000),
  ('hamptonmadelynn@gmail.com','competition',2000),
  ('hamptonmadelynn@gmail.com','training',2000),
  ('hamptonmadelynn@gmail.com','admin',2000),
  ('hamptonmadelynn@gmail.com','substitute',5000),
  ('allyhelman@icloud.com','class_lead',6000),
  ('allyhelman@icloud.com','class_assistant',2000),
  ('allyhelman@icloud.com','private',7500),
  ('allyhelman@icloud.com','rehearsal',6000),
  ('allyhelman@icloud.com','performance_event',2000),
  ('allyhelman@icloud.com','competition',2000),
  ('allyhelman@icloud.com','training',2000),
  ('allyhelman@icloud.com','admin',2000),
  ('allyhelman@icloud.com','substitute',5000),
  ('eliza.johnson@bamsocal.com','class_lead',3000),
  ('eliza.johnson@bamsocal.com','class_assistant',2000),
  ('eliza.johnson@bamsocal.com','private',3500),
  ('eliza.johnson@bamsocal.com','rehearsal',2000),
  ('eliza.johnson@bamsocal.com','performance_event',2000),
  ('eliza.johnson@bamsocal.com','competition',2000),
  ('eliza.johnson@bamsocal.com','training',2000),
  ('eliza.johnson@bamsocal.com','admin',2000),
  ('eliza.johnson@bamsocal.com','substitute',5000),
  ('kaileyluebrecht@gmail.com','class_lead',4000),
  ('kaileyluebrecht@gmail.com','class_assistant',2000),
  ('kaileyluebrecht@gmail.com','private',5000),
  ('kaileyluebrecht@gmail.com','rehearsal',3500),
  ('kaileyluebrecht@gmail.com','performance_event',2000),
  ('kaileyluebrecht@gmail.com','competition',2000),
  ('kaileyluebrecht@gmail.com','training',2000),
  ('kaileyluebrecht@gmail.com','admin',2000),
  ('kaileyluebrecht@gmail.com','substitute',5000),
  ('cara@bamsocal.com','class_lead',6000),
  ('cara@bamsocal.com','class_assistant',2000),
  ('cara@bamsocal.com','private',7000),
  ('cara@bamsocal.com','rehearsal',6000),
  ('cara@bamsocal.com','performance_event',2000),
  ('cara@bamsocal.com','competition',2000),
  ('cara@bamsocal.com','training',2000),
  ('cara@bamsocal.com','admin',2000),
  ('cara@bamsocal.com','substitute',5000),
  ('leilameghdadi47@gmail.com','class_lead',4500),
  ('leilameghdadi47@gmail.com','class_assistant',2000),
  ('leilameghdadi47@gmail.com','private',5000),
  ('leilameghdadi47@gmail.com','rehearsal',3500),
  ('leilameghdadi47@gmail.com','performance_event',2000),
  ('leilameghdadi47@gmail.com','competition',2000),
  ('leilameghdadi47@gmail.com','training',2000),
  ('leilameghdadi47@gmail.com','admin',2000),
  ('leilameghdadi47@gmail.com','substitute',5000),
  ('kaitlan.mills@bamsocal.com','class_lead',3500),
  ('kaitlan.mills@bamsocal.com','class_assistant',2000),
  ('kaitlan.mills@bamsocal.com','private',4500),
  ('kaitlan.mills@bamsocal.com','rehearsal',3500),
  ('kaitlan.mills@bamsocal.com','performance_event',2000),
  ('kaitlan.mills@bamsocal.com','competition',2000),
  ('kaitlan.mills@bamsocal.com','training',2000),
  ('kaitlan.mills@bamsocal.com','admin',2000),
  ('kaitlan.mills@bamsocal.com','substitute',5000),
  ('mooreapike@gmail.com','class_lead',5000),
  ('mooreapike@gmail.com','class_assistant',2000),
  ('mooreapike@gmail.com','private',5000),
  ('mooreapike@gmail.com','rehearsal',3500),
  ('mooreapike@gmail.com','performance_event',2000),
  ('mooreapike@gmail.com','competition',2000),
  ('mooreapike@gmail.com','training',2000),
  ('mooreapike@gmail.com','admin',2000),
  ('mooreapike@gmail.com','substitute',5000),
  ('laurynrowe19@gmail.com','class_lead',4000),
  ('laurynrowe19@gmail.com','class_assistant',2000),
  ('laurynrowe19@gmail.com','private',5000),
  ('laurynrowe19@gmail.com','rehearsal',2000),
  ('laurynrowe19@gmail.com','performance_event',2000),
  ('laurynrowe19@gmail.com','competition',2000),
  ('laurynrowe19@gmail.com','training',2000),
  ('laurynrowe19@gmail.com','admin',2000),
  ('laurynrowe19@gmail.com','substitute',5000),
  ('twinkletoesmel@yahoo.com','class_lead',7500),
  ('twinkletoesmel@yahoo.com','class_assistant',2000),
  ('twinkletoesmel@yahoo.com','private',7500),
  ('twinkletoesmel@yahoo.com','rehearsal',3500),
  ('twinkletoesmel@yahoo.com','performance_event',2000),
  ('twinkletoesmel@yahoo.com','competition',2000),
  ('twinkletoesmel@yahoo.com','training',2000),
  ('twinkletoesmel@yahoo.com','admin',2000),
  ('twinkletoesmel@yahoo.com','substitute',5000),
  ('kcrthomas@gmail.com','class_lead',5500),
  ('kcrthomas@gmail.com','class_assistant',2000),
  ('kcrthomas@gmail.com','private',6500),
  ('kcrthomas@gmail.com','rehearsal',5500),
  ('kcrthomas@gmail.com','performance_event',2000),
  ('kcrthomas@gmail.com','competition',2000),
  ('kcrthomas@gmail.com','training',2000),
  ('kcrthomas@gmail.com','admin',2000),
  ('kcrthomas@gmail.com','substitute',5000),
  ('samweeks16@gmail.com','class_lead',5000),
  ('samweeks16@gmail.com','class_assistant',2000),
  ('samweeks16@gmail.com','private',5500),
  ('samweeks16@gmail.com','rehearsal',3500),
  ('samweeks16@gmail.com','performance_event',2000),
  ('samweeks16@gmail.com','competition',2000),
  ('samweeks16@gmail.com','training',2000),
  ('samweeks16@gmail.com','admin',2000),
  ('samweeks16@gmail.com','substitute',5000),
  ('kylieyamano@gmail.com','class_lead',3500),
  ('kylieyamano@gmail.com','class_assistant',2000),
  ('kylieyamano@gmail.com','private',4500),
  ('kylieyamano@gmail.com','rehearsal',3500),
  ('kylieyamano@gmail.com','performance_event',2000),
  ('kylieyamano@gmail.com','competition',2000),
  ('kylieyamano@gmail.com','training',2000),
  ('kylieyamano@gmail.com','admin',2000),
  ('kylieyamano@gmail.com','substitute',5000)
) as v(email, rate_key, amount_cents)
join profiles p on lower(p.email) = lower(v.email)
join teachers t on t.id = p.id and t.is_active = true
where not exists (
  select 1 from public.teacher_rates tr
  where tr.teacher_id = p.id
    and tr.rate_key = v.rate_key
    and tr.valid_from = date '2026-08-15'
);

do $$
declare v_count int; v_teachers int;
begin
  select count(*), count(distinct teacher_id) into v_count, v_teachers
  from teacher_rates where valid_from = date '2026-08-15';

  if v_teachers <> 19 then
    raise exception 'Post-flight failed: expected 19 teachers with rates, got %', v_teachers;
  end if;
  if v_count <> 171 then
    raise exception 'Post-flight failed: expected 171 rate rows, got %', v_count;
  end if;
end $$;
