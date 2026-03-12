-- ============================================================
-- BAM Platform — Communications Module
-- Tables: announcements, announcement_recipients, message_threads,
--         messages, class_reminders
-- Seed: email templates for announcements, reminders, messaging
-- ============================================================


-- ── ANNOUNCEMENTS ───────────────────────────────────────────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete set null,
  title text not null,
  body_html text not null,
  audience text not null check (audience in ('all_parents', 'class', 'season', 'teachers', 'all')),
  audience_filter jsonb,  -- e.g. { "class_ids": ["..."] } or { "season_id": "..." }
  channel text not null default 'email' check (channel in ('email', 'in_app', 'both')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  recipient_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_announcements_tenant_status on announcements(tenant_id, status);
create index idx_announcements_audience on announcements(audience);
create index idx_announcements_created_at on announcements(created_at desc);


-- ── ANNOUNCEMENT_RECIPIENTS ─────────────────────────────────
create table public.announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'read')),
  sent_at timestamptz,
  read_at timestamptz
);

create index idx_announcement_recipients_announcement on announcement_recipients(announcement_id);
create index idx_announcement_recipients_profile on announcement_recipients(profile_id);


-- ── MESSAGE_THREADS ─────────────────────────────────────────
create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text,
  participant_ids uuid[] not null,
  class_id uuid references classes(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_message_threads_participants on message_threads using gin (participant_ids);
create index idx_message_threads_last_message on message_threads(last_message_at desc);


-- ── MESSAGES ────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_thread on messages(thread_id, created_at);
create index idx_messages_sender on messages(sender_id);


-- ── CLASS_REMINDERS ─────────────────────────────────────────
create table public.class_reminders (
  id uuid primary key default gen_random_uuid(),
  schedule_instance_id uuid not null references schedule_instances(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  recipient_count int default 0,
  unique(schedule_instance_id)
);

create index idx_class_reminders_date on class_reminders(reminder_date);


-- ── AUTO-UPDATE TRIGGERS ────────────────────────────────────
create trigger set_announcements_updated_at
  before update on announcements
  for each row execute function update_updated_at();

create trigger set_message_threads_last_message
  before update on message_threads
  for each row execute function update_updated_at();


-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table announcements enable row level security;
alter table announcement_recipients enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table class_reminders enable row level security;

-- Announcements: admins have full access
create policy "admins_announcements_all" on announcements
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Announcements: teachers can read teacher-targeted announcements
create policy "teachers_announcements_select" on announcements
  for select using (
    audience in ('teachers', 'all')
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'teacher'
    )
  );

-- Announcements: parents can read parent-targeted announcements they received
create policy "parents_announcements_select" on announcements
  for select using (
    audience in ('all_parents', 'class', 'season', 'all')
    and exists (
      select 1 from announcement_recipients
      where announcement_recipients.announcement_id = announcements.id
        and announcement_recipients.profile_id = auth.uid()
    )
  );

-- Announcement recipients: admins have full access
create policy "admins_announcement_recipients_all" on announcement_recipients
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Announcement recipients: users can read their own
create policy "users_own_announcement_recipients" on announcement_recipients
  for select using (profile_id = auth.uid());

-- Announcement recipients: users can update their own (for marking read)
create policy "users_update_own_announcement_recipients" on announcement_recipients
  for update using (profile_id = auth.uid());

-- Message threads: participants can read their own threads
create policy "participants_message_threads_select" on message_threads
  for select using (auth.uid() = any(participant_ids));

-- Message threads: authenticated users can create threads
create policy "auth_message_threads_insert" on message_threads
  for insert with check (auth.uid() = any(participant_ids));

-- Message threads: admins can read all threads
create policy "admins_message_threads_all" on message_threads
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Messages: participants in the thread can read
create policy "participants_messages_select" on messages
  for select using (
    exists (
      select 1 from message_threads
      where message_threads.id = messages.thread_id
        and auth.uid() = any(message_threads.participant_ids)
    )
  );

-- Messages: participants can insert into their threads
create policy "participants_messages_insert" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from message_threads
      where message_threads.id = messages.thread_id
        and auth.uid() = any(message_threads.participant_ids)
    )
  );

-- Messages: recipients can update (for marking read)
create policy "recipients_messages_update" on messages
  for update using (
    sender_id != auth.uid()
    and exists (
      select 1 from message_threads
      where message_threads.id = messages.thread_id
        and auth.uid() = any(message_threads.participant_ids)
    )
  );

-- Messages: admins can read all
create policy "admins_messages_all" on messages
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );

-- Class reminders: admin only
create policy "admins_class_reminders_all" on class_reminders
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('super_admin', 'admin')
    )
  );


-- ── SEED EMAIL TEMPLATES ────────────────────────────────────
insert into email_templates (slug, name, description, subject, header_text, body_html, button_text, button_url) values
  (
    'announcement',
    'Studio Announcement',
    'Template for admin-created studio announcements',
    '{{title}}',
    '{{title}}',
    '{{body}}',
    'View in Portal',
    '{{app_url}}/portal/messages'
  ),
  (
    'class_reminder',
    'Class Reminder (24hr)',
    'Automated reminder sent 24 hours before a scheduled class',
    'Reminder: {{class_name}} tomorrow at {{time}}',
    'Class Reminder',
    '<p>This is a friendly reminder that <strong>{{student_name}}</strong> has <strong>{{class_name}}</strong> tomorrow!</p><p><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{time}}<br><strong>Teacher:</strong> {{teacher_name}}<br><strong>Location:</strong> 400-C Camino De Estrella, San Clemente</p><p>Please arrive 5 minutes early so class can start on time. We can''t wait to see {{student_name}}!</p>',
    'View Schedule',
    '{{app_url}}/portal/schedule'
  ),
  (
    'performance_announcement',
    'Performance Announcement',
    'Template for performance and rehearsal announcements with dates and details',
    '{{production_name}} — {{title}}',
    '{{production_name}}',
    '{{body}}',
    'View Details',
    '{{app_url}}/portal/performances'
  ),
  (
    'new_message',
    'New Message Notification',
    'Notification sent when a parent or teacher receives a new portal message',
    'New message from {{sender_name}}',
    'New Message',
    '<p>You have a new message from <strong>{{sender_name}}</strong>.</p><p style="background-color: #f5f0e8; padding: 16px; border-radius: 8px; font-style: italic;">{{preview}}</p><p>Log in to the portal to read the full message and reply.</p>',
    'View Message',
    '{{app_url}}/portal/messages'
  )
on conflict (slug) do nothing;
