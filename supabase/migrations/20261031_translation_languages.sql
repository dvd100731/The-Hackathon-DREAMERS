alter table public.rooms
  add column if not exists translation_languages text[] not null default array['en','vi','zh','ru','ja']::text[];

alter table public.summaries drop constraint if exists summaries_language_check;
alter table public.summaries add constraint summaries_language_check
  check (language in ('ko','en','vi','zh','ru','ja'));
