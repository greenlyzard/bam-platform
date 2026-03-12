-- Expand user_role enum with new admin sub-roles
-- Note: 'super_admin', 'admin', 'teacher', 'parent', 'student' already exist
alter type user_role add value if not exists 'studio_admin';
alter type user_role add value if not exists 'finance_admin';
alter type user_role add value if not exists 'studio_manager';

-- Add approval status to profiles for teacher self-signup
alter table profiles
  add column if not exists approval_status text not null default 'active'
    check (approval_status in ('active', 'pending_approval', 'rejected'));

-- Staff invites table
create table if not exists staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role user_role not null,
  first_name text,
  last_name text,
  invited_by uuid references auth.users(id),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index idx_staff_invites_token on staff_invites(token);
create index idx_staff_invites_email on staff_invites(email);

-- RLS
alter table staff_invites enable row level security;

create policy "Admins can manage invites"
  on staff_invites for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- Allow public read by token (for accepting invite)
create policy "Anyone can read invite by token"
  on staff_invites for select
  to anon, authenticated
  using (true);
