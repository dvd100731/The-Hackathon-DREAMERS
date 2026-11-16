alter table public.rooms
  drop constraint if exists rooms_scene_check;

alter table public.rooms
  add constraint rooms_scene_check
  check (scene in ('school', 'safety', 'university', 'religion', 'tourism', 'other'));

notify pgrst, 'reload schema'
