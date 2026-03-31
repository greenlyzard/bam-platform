CREATE TABLE IF NOT EXISTS public.location_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES studio_locations(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  open_time TIME,
  close_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, day_of_week)
);

ALTER TABLE public.location_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage location hours" ON public.location_hours;
CREATE POLICY "Admins can manage location hours"
  ON public.location_hours FOR ALL USING (is_admin());

-- Seed default hours for BAM San Clemente
INSERT INTO public.location_hours
  (tenant_id, location_id, day_of_week, is_open, open_time, close_time)
VALUES
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 0, false, null, null),
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 1, true, '15:30', '21:00'),
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 2, true, '15:30', '21:00'),
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 3, true, '15:30', '21:00'),
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 4, true, '15:30', '21:00'),
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 5, false, null, null),
  ('84d98f72-c82f-414f-8b17-172b802f6993', '70acde19-bd54-46c2-a4f4-2200b0adb393', 6, true, '09:00', '14:00')
ON CONFLICT (location_id, day_of_week) DO NOTHING;
