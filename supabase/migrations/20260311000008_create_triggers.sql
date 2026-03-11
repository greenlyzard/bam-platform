-- ============================================================
-- BAM Platform — Triggers and Functions
-- Auto-update timestamps, enrollment count sync
-- ============================================================

-- ============================================================
-- Auto-update updated_at timestamp
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger set_updated_at before update on students
  for each row execute function update_updated_at();

create trigger set_updated_at before update on classes
  for each row execute function update_updated_at();

create trigger set_updated_at before update on enrollments
  for each row execute function update_updated_at();

create trigger set_updated_at before update on teachers
  for each row execute function update_updated_at();

create trigger set_updated_at before update on lms_content
  for each row execute function update_updated_at();

create trigger set_updated_at before update on student_content_progress
  for each row execute function update_updated_at();

create trigger set_updated_at before update on live_sessions
  for each row execute function update_updated_at();

create trigger set_updated_at before update on shop_configs
  for each row execute function update_updated_at();

create trigger set_updated_at before update on products
  for each row execute function update_updated_at();

create trigger set_updated_at before update on shop_orders
  for each row execute function update_updated_at();

create trigger set_updated_at before update on competitor_studios
  for each row execute function update_updated_at();

create trigger set_updated_at before update on expansion_markets
  for each row execute function update_updated_at();

-- ============================================================
-- Enforce class max_students on enrollment insert
-- ============================================================
create or replace function check_class_capacity()
returns trigger as $$
declare
  current_count int;
  max_cap int;
begin
  if NEW.status = 'active' then
    select count(*) into current_count
    from enrollments
    where class_id = NEW.class_id and status = 'active';

    select max_students into max_cap
    from classes
    where id = NEW.class_id;

    if current_count >= max_cap then
      raise exception 'Class is full (% of % spots taken). Student must be waitlisted.',
        current_count, max_cap;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger enforce_class_capacity
  before insert on enrollments
  for each row execute function check_class_capacity();
