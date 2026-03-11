-- ============================================================
-- BAM Platform — Email Templates Table
-- Stores editable email templates for transactional emails
-- Admin-only management, read by server-side send function
-- ============================================================

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  from_name text not null default 'Ballet Academy and Movement',
  from_email text not null default 'hello@balletacademyandmovement.com',
  reply_to text default 'dance@bamsocal.com',
  subject text not null,
  header_text text,
  body_html text not null,
  button_text text,
  button_url text,
  footer_text text default 'Ballet Academy and Movement · 400-C Camino De Estrella, San Clemente, CA 92672 · (949) 229-0846',
  is_active boolean default true,
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

create index idx_email_templates_slug on email_templates(slug);
create index idx_email_templates_active on email_templates(is_active);

-- RLS
alter table email_templates enable row level security;

-- Admins can manage templates
create policy "admins_email_templates" on email_templates
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Updated_at trigger
create trigger set_email_templates_updated_at
  before update on email_templates
  for each row execute function update_updated_at();

-- ============================================================
-- Seed default templates
-- ============================================================
insert into email_templates (slug, name, description, subject, header_text, body_html, button_text, button_url) values
  (
    'welcome',
    'Welcome Email',
    'Sent to new parents after account creation',
    'Welcome to Ballet Academy and Movement',
    'Welcome to our studio family',
    '<p>Thank you for creating your account with Ballet Academy and Movement. We''re so glad you''re here.</p><p>Our studio in San Clemente offers classical ballet training in a nurturing environment, with small class sizes and individual attention for every dancer.</p><p>Your next step is to add your child''s profile and browse our class catalog to find the perfect fit.</p>',
    'Get Started',
    '{{app_url}}/portal/children'
  ),
  (
    'magic_link',
    'Magic Link Sign In',
    'One-time login link sent via email',
    'Your sign-in link for Ballet Academy and Movement',
    'Sign in to your account',
    '<p>Click the button below to sign in to your Ballet Academy and Movement account. This link expires in 1 hour.</p><p>If you didn''t request this link, you can safely ignore this email.</p>',
    'Sign In',
    '{{magic_link}}'
  ),
  (
    'class_reminder',
    'Class Reminder',
    'Sent 24 hours before a scheduled class',
    'Reminder: {{class_name}} tomorrow at {{class_time}}',
    'Class reminder',
    '<p>This is a friendly reminder that <strong>{{student_name}}</strong> has <strong>{{class_name}}</strong> tomorrow.</p><p><strong>Time:</strong> {{class_time}}<br><strong>Room:</strong> {{class_room}}<br><strong>Teacher:</strong> {{teacher_name}}</p><p>Please arrive 5 minutes early so your dancer is settled and ready.</p>',
    'View Schedule',
    '{{app_url}}/portal/schedule'
  ),
  (
    'performance_announcement',
    'Performance Announcement',
    'Announces a new performance or show dates',
    '{{performance_name}} — Show Dates Announced',
    '{{performance_name}}',
    '<p>We are thrilled to announce the dates for <strong>{{performance_name}}</strong>!</p><p>{{performance_details}}</p><p>Casting information and rehearsal schedules will be shared with enrolled families soon.</p>',
    'View Details',
    '{{app_url}}/portal/performances'
  ),
  (
    'enrollment_confirmed',
    'Enrollment Confirmed',
    'Sent when a student is enrolled in a class',
    'Enrollment confirmed: {{student_name}} in {{class_name}}',
    'You''re all set',
    '<p>Great news! <strong>{{student_name}}</strong> is now enrolled in <strong>{{class_name}}</strong>.</p><p><strong>Day:</strong> {{class_day}}<br><strong>Time:</strong> {{class_time}}<br><strong>Room:</strong> {{class_room}}</p><p>We look forward to welcoming {{student_name}} to class. Please arrive 5 minutes early for the first session.</p>',
    'View Schedule',
    '{{app_url}}/portal/schedule'
  ),
  (
    'trial_class_confirmation',
    'Trial Class Confirmation',
    'Sent when a trial class is booked',
    'Trial class confirmed for {{student_name}}',
    'Welcome to Ballet Academy and Movement',
    '<p>We''re excited to welcome <strong>{{student_name}}</strong> for a trial class!</p><p><strong>Class:</strong> {{class_name}}<br><strong>Date:</strong> {{trial_date}}<br><strong>Time:</strong> {{class_time}}<br><strong>Location:</strong> 400-C Camino De Estrella, San Clemente, CA 92672</p><p><strong>What to wear:</strong> Pink or black leotard, pink tights, and ballet slippers. Hair pulled back in a bun.</p><p>Please arrive 10 minutes early to complete a brief registration form.</p>',
    'Get Directions',
    'https://maps.google.com/?q=400+Camino+De+Estrella+San+Clemente+CA'
  ),
  (
    'waitlist_notification',
    'Waitlist Notification',
    'Sent when a spot opens in a waitlisted class',
    'A spot has opened in {{class_name}}!',
    'Good news — a spot is available',
    '<p>A spot has opened in <strong>{{class_name}}</strong> for <strong>{{student_name}}</strong>.</p><p>Please confirm enrollment within 48 hours to secure the spot. After that, the next family on the waitlist will be offered the opening.</p>',
    'Confirm Enrollment',
    '{{app_url}}/portal/schedule'
  ),
  (
    'teacher_welcome',
    'Teacher Welcome',
    'Sent to new teachers after account creation',
    'Welcome to the Ballet Academy and Movement team',
    'Welcome to the team',
    '<p>Welcome to Ballet Academy and Movement! We''re delighted to have you join our teaching team.</p><p>Your Teacher Portal gives you access to your class schedules, attendance tracking, student rosters, and hour logging.</p><p>Before your first class, please complete your mandated reporter certification and submit your background check documentation through the portal.</p>',
    'Open Teacher Portal',
    '{{app_url}}/teach/dashboard'
  );
