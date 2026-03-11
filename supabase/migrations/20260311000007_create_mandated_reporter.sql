-- ============================================================
-- BAM Platform — Mandated Reporter Incident Table
-- California law compliance — incidents are IMMUTABLE
-- ============================================================

create table mandated_reporter_incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  student_id uuid references students(id),
  observed_at timestamptz not null,
  concern_type text not null
    check (concern_type in ('abuse', 'neglect', 'bullying', 'self_harm', 'other')),
  description text not null,
  action_taken text,
  reported_to_authorities boolean default false,
  reported_to_authorities_at timestamptz,
  authority_name text,
  report_number text,
  admin_acknowledged_by uuid references profiles(id),
  admin_acknowledged_at timestamptz,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'acknowledged', 'reported_to_authorities', 'resolved')),
  created_at timestamptz default now()
  -- No updated_at — incidents are immutable after creation
);

create index idx_incidents_reporter on mandated_reporter_incidents(reporter_id);
create index idx_incidents_student on mandated_reporter_incidents(student_id);
create index idx_incidents_status on mandated_reporter_incidents(status);

-- Prevent updates to incident description/details (immutability)
create or replace function prevent_incident_detail_changes()
returns trigger as $$
begin
  if OLD.description != NEW.description
    or OLD.concern_type != NEW.concern_type
    or OLD.observed_at != NEW.observed_at
    or OLD.reporter_id != NEW.reporter_id
    or OLD.student_id is distinct from NEW.student_id
  then
    raise exception 'Mandated reporter incident details cannot be modified after creation';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger protect_incident_details
  before update on mandated_reporter_incidents
  for each row execute function prevent_incident_detail_changes();
