-- Translation status for captions (run in Supabase SQL Editor).
alter table public.captions add column if not exists translation_status text not null default 'pending';
alter table public.captions drop constraint if exists captions_translation_status_check;
alter table public.captions add constraint captions_translation_status_check
  check (translation_status in ('pending','translating','completed','failed'));
