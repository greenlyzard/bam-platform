-- Resource Intelligence System
-- Tables: studio_hours, resource_recommendations, room_rentals

-- Studio open hours (when rooms are available)
CREATE TABLE studio_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  open_time time NOT NULL,
  close_time time NOT NULL,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, day_of_week)
);

-- AI recommendation log
CREATE TABLE resource_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  recommendation_type text NOT NULL CHECK (recommendation_type IN (
    'fill_class', 'add_class', 'move_class', 'rental_opportunity',
    'teacher_load', 'room_conflict'
  )),
  title text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'acted_on')),
  metadata jsonb DEFAULT '{}',
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  acted_on_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Room rental inquiries and bookings
CREATE TABLE room_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  room_id uuid REFERENCES rooms(id),
  renter_name text NOT NULL,
  renter_email text NOT NULL,
  renter_phone text,
  renter_type text CHECK (renter_type IN (
    'yoga', 'pilates', 'fitness', 'dance', 'therapy', 'other'
  )),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  rate_per_hour numeric(8,2),
  total_amount numeric(8,2),
  status text DEFAULT 'inquiry' CHECK (status IN (
    'inquiry', 'confirmed', 'cancelled', 'completed'
  )),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE studio_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_rentals ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin-only access
CREATE POLICY "admins_studio_hours" ON studio_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admins_resource_recommendations" ON resource_recommendations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admins_room_rentals" ON room_rentals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Apply updated_at trigger to room_rentals
CREATE TRIGGER set_room_rentals_updated_at
  BEFORE UPDATE ON room_rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Seed BAM studio hours (Mon-Fri 3pm-9pm, Sat 9am-5pm, Sun closed)
INSERT INTO studio_hours (tenant_id, day_of_week, open_time, close_time, is_closed)
SELECT
  t.id,
  d.day_of_week,
  d.open_time,
  d.close_time,
  d.is_closed
FROM tenants t
CROSS JOIN (VALUES
  (0, '09:00'::time, '17:00'::time, true),   -- Sunday: closed
  (1, '15:00'::time, '21:00'::time, false),  -- Monday: 3pm-9pm
  (2, '15:00'::time, '21:00'::time, false),  -- Tuesday: 3pm-9pm
  (3, '15:00'::time, '21:00'::time, false),  -- Wednesday: 3pm-9pm
  (4, '15:00'::time, '21:00'::time, false),  -- Thursday: 3pm-9pm
  (5, '10:00'::time, '17:00'::time, false),  -- Friday: 10am-5pm
  (6, '09:00'::time, '17:00'::time, false)   -- Saturday: 9am-5pm
) AS d(day_of_week, open_time, close_time, is_closed)
WHERE t.slug = 'bam';
