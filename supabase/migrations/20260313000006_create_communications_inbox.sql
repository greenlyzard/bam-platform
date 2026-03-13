-- ============================================================
-- Communications Inbox Module
-- Tables: leads, communication_threads, communication_messages,
--         communication_attachments, communication_thread_reads
-- ============================================================

-- ── LEADS ─────────────────────────────────────────────────────
-- Prospective families not yet enrolled
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  first_name    text not null,
  last_name     text,
  email         text,
  phone         text,
  source        text check (source in ('website','referral','walk_in','email','social','other')),
  status        text not null default 'new' check (status in ('new','contacted','trial_scheduled','enrolled','lost')),
  notes         text,
  family_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_leads_tenant on leads(tenant_id);
create index idx_leads_email on leads(email);
create index idx_leads_status on leads(tenant_id, status);

-- ── COMMUNICATION_THREADS ─────────────────────────────────────
create table communication_threads (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  thread_token    text unique not null,
  subject         text,
  thread_type     text not null default 'direct'
    check (thread_type in ('direct','system','announcement','bulk')),
  state           text not null default 'open'
    check (state in ('open','resolved','archived','spam')),
  priority        text not null default 'normal'
    check (priority in ('normal','flagged','urgent')),
  channel         text not null default 'email'
    check (channel in ('email','sms','in_app','system')),

  -- Contact linkage (one of these set)
  family_id       uuid,
  lead_id         uuid,
  staff_user_id   uuid,

  -- Contact info (denormalized for fast display)
  contact_name    text,
  contact_email   text,

  -- Assignment
  assigned_to     uuid references profiles(id) on delete set null,
  created_by      uuid references profiles(id) on delete set null,

  -- Counters
  unread_count    integer not null default 0,
  message_count   integer not null default 0,
  last_message_at timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_comm_threads_tenant_state on communication_threads(tenant_id, state);
create index idx_comm_threads_token on communication_threads(thread_token);
create index idx_comm_threads_family on communication_threads(family_id);
create index idx_comm_threads_lead on communication_threads(lead_id);
create index idx_comm_threads_assigned on communication_threads(assigned_to);
create index idx_comm_threads_last_msg on communication_threads(tenant_id, last_message_at desc);
create index idx_comm_threads_contact_email on communication_threads(contact_email);

-- ── COMMUNICATION_MESSAGES ────────────────────────────────────
create table communication_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  thread_id       uuid not null references communication_threads(id) on delete cascade,
  direction       text not null check (direction in ('inbound','outbound','system')),

  -- Sender info
  sender_id       uuid references profiles(id) on delete set null,
  sender_name     text,
  sender_email    text,

  -- Content
  subject         text,
  body_html       text,
  body_text       text,

  -- Matching
  matched         boolean not null default true,

  -- Email metadata
  message_id_header text,
  in_reply_to       text,

  -- Template reference (for system messages)
  template_slug   text,

  created_at      timestamptz not null default now()
);

create index idx_comm_messages_thread on communication_messages(thread_id, created_at);
create index idx_comm_messages_sender on communication_messages(sender_id);
create index idx_comm_messages_unmatched on communication_messages(tenant_id, matched) where matched = false;
create index idx_comm_messages_direction on communication_messages(thread_id, direction);

-- ── COMMUNICATION_ATTACHMENTS ─────────────────────────────────
create table communication_attachments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  message_id      uuid not null references communication_messages(id) on delete cascade,
  filename        text not null,
  content_type    text,
  size_bytes      integer,
  storage_path    text not null,
  created_at      timestamptz not null default now()
);

create index idx_comm_attachments_message on communication_attachments(message_id);

-- ── COMMUNICATION_THREAD_READS ────────────────────────────────
create table communication_thread_reads (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references communication_threads(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  last_read_at    timestamptz not null default now()
);

create unique index idx_comm_thread_reads_unique on communication_thread_reads(thread_id, user_id);
create index idx_comm_thread_reads_user on communication_thread_reads(user_id);

-- ── TRIGGERS ──────────────────────────────────────────────────
create trigger set_communication_threads_updated_at
  before update on communication_threads
  for each row execute function update_updated_at();

create trigger set_leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

alter table leads enable row level security;
alter table communication_threads enable row level security;
alter table communication_messages enable row level security;
alter table communication_attachments enable row level security;
alter table communication_thread_reads enable row level security;

-- Leads: admin full access
create policy "Admin full access to leads"
  on leads for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Communication threads: admin full access
create policy "Admin full access to communication_threads"
  on communication_threads for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Communication threads: teachers see assigned threads
create policy "Teachers see assigned threads"
  on communication_threads for select
  using (
    assigned_to = auth.uid()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'teacher'
    )
  );

-- Communication messages: admin full access
create policy "Admin full access to communication_messages"
  on communication_messages for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Communication messages: teachers see messages in assigned threads
create policy "Teachers see messages in assigned threads"
  on communication_messages for select
  using (
    exists (
      select 1 from communication_threads ct
      where ct.id = thread_id
        and ct.assigned_to = auth.uid()
    )
  );

-- Attachments: admin full access
create policy "Admin full access to communication_attachments"
  on communication_attachments for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Thread reads: users manage own reads
create policy "Users manage own thread reads"
  on communication_thread_reads for all
  using (user_id = auth.uid());

-- Service role bypass for inbound webhook (service_role key bypasses RLS)

-- ── MODULE REGISTRATION ───────────────────────────────────────
insert into platform_modules (key, label, description, nav_group, icon, href, sort_order, platform_enabled, tenant_enabled, nav_visible)
values ('communications_inbox', 'Inbox', 'Unified communications inbox', 'Communications', '✉', '/admin/communications/inbox', 5, true, true, true)
on conflict (key) do nothing;
