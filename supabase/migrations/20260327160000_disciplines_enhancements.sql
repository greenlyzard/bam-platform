-- Add icon and color to disciplines
ALTER TABLE public.disciplines
ADD COLUMN IF NOT EXISTS icon_id UUID
  REFERENCES public.icon_library(id) ON DELETE SET NULL;

ALTER TABLE public.disciplines
ADD COLUMN IF NOT EXISTS color_hex TEXT;

-- Backfill discipline_ids on classes from legacy discipline text field
UPDATE public.classes c
SET discipline_ids = ARRAY(
  SELECT d.id FROM public.disciplines d
  WHERE d.tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
  AND d.name ILIKE c.discipline
  AND d.is_active = true
  LIMIT 1
)
WHERE c.discipline IS NOT NULL
AND (c.discipline_ids IS NULL OR c.discipline_ids = '{}');

-- Seed icon_id on disciplines from icon_library where names match
UPDATE public.disciplines d
SET icon_id = il.id
FROM public.icon_library il
WHERE il.name ILIKE d.name
AND il.category = 'discipline'
AND d.icon_id IS NULL;
