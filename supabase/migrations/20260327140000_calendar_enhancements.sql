-- Add color_hex to classes for calendar color coding
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS color_hex TEXT;

-- Clean up duplicate rooms — keep the ones WITH location_id, deactivate the old ones
UPDATE public.rooms SET is_active = false
WHERE location_id IS NULL
  AND tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
  AND name IN (
    SELECT name FROM public.rooms
    WHERE location_id IS NOT NULL
      AND tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
  );

-- Add Pilates Room if it doesn't exist
INSERT INTO public.rooms (
  tenant_id, name, location_id, capacity, is_bookable, is_active
)
SELECT
  '84d98f72-c82f-414f-8b17-172b802f6993',
  'Pilates Room',
  '70acde19-bd54-46c2-a4f4-2200b0adb393',
  8,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.rooms WHERE name = 'Pilates Room'
    AND tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
);

-- Add color_hex to class_field_config for calendar color picker
INSERT INTO class_field_config
  (tenant_id, field_key, label, field_type, admin_visible, admin_default_on, is_core, sort_order, group_name)
VALUES
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'color_hex',
   'Calendar Color', 'text', true, false, false, 99, 'Display')
ON CONFLICT DO NOTHING;

-- Add resource fields to rooms
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS color_hex TEXT DEFAULT '#9C8BBF';

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS icon_id UUID REFERENCES public.icon_library(id) ON DELETE SET NULL;

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS description TEXT;

-- Seed default colors for active rooms
UPDATE public.rooms SET color_hex = '#3B82F6'
WHERE name = 'Studio 1' AND is_active = true;

UPDATE public.rooms SET color_hex = '#22C55E'
WHERE name = 'Studio 2' AND is_active = true;

UPDATE public.rooms SET color_hex = '#F97316'
WHERE name = 'Studio 3' AND is_active = true;

UPDATE public.rooms SET color_hex = '#A855F7'
WHERE name = 'Pilates Room' AND is_active = true;
