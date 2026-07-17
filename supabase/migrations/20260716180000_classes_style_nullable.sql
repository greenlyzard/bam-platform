-- Make classes.style nullable.
-- The New Class form can't always name a single style: a class may span
-- multiple disciplines or none. We populate style from the first selected
-- discipline where available and leave it NULL otherwise, rather than
-- fabricating a 'ballet' default that would mislabel non-ballet classes.
-- No backfill: existing rows already have style set.

alter table public.classes
  alter column style drop not null;

notify pgrst, 'reload schema';
