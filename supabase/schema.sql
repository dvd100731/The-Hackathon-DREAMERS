-- 이 회의 통역 되나요?: Supabase SQL Editor에서 전체 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  scene text not null check (scene in ('school','safety','university','religion','tourism','other')),
  translation_languages text[] not null default array['en','vi','zh','ru','ja']::text[],
  status text not null default 'live' check (status in ('live','ended')),
  created_at timestamptz not null default now()
);
alter table public.rooms drop constraint if exists rooms_scene_check;
alter table public.rooms add constraint rooms_scene_check check (scene in ('school','safety','university','religion','tourism','other'));

create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  original text not null,
  translations jsonb not null default '{}'::jsonb,
  terms jsonb not null default '[]'::jsonb,
  translation_status text not null default 'pending' check (translation_status in ('pending','translating','completed','failed')),
  created_at timestamptz not null default now()
);
alter table public.captions add column if not exists translation_status text not null default 'pending';
alter table public.captions drop constraint if exists captions_translation_status_check;
alter table public.captions add constraint captions_translation_status_check check (translation_status in ('pending','translating','completed','failed'));
create index if not exists captions_room_created_idx on public.captions (room_code, created_at);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  language text not null check (language in ('ko','en','vi','zh','ru','ja')),
  summary jsonb not null default '{}'::jsonb,
  todos jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_code, language)
);

alter table public.rooms enable row level security;
alter table public.captions enable row level security;
alter table public.summaries enable row level security;

drop policy if exists "hackathon anon rooms read" on public.rooms;
create policy "hackathon anon rooms read" on public.rooms for select to anon using (true);
drop policy if exists "hackathon anon rooms insert" on public.rooms;
create policy "hackathon anon rooms insert" on public.rooms for insert to anon with check (true);
drop policy if exists "hackathon anon rooms update" on public.rooms;
create policy "hackathon anon rooms update" on public.rooms for update to anon using (true) with check (true);

drop policy if exists "hackathon anon captions read" on public.captions;
create policy "hackathon anon captions read" on public.captions for select to anon using (true);
drop policy if exists "hackathon anon captions insert" on public.captions;
create policy "hackathon anon captions insert" on public.captions for insert to anon with check (true);
drop policy if exists "hackathon anon captions update" on public.captions;
create policy "hackathon anon captions update" on public.captions for update to anon using (true) with check (true);

drop policy if exists "hackathon anon summaries read" on public.summaries;
create policy "hackathon anon summaries read" on public.summaries for select to anon using (true);
drop policy if exists "hackathon anon summaries insert" on public.summaries;
create policy "hackathon anon summaries insert" on public.summaries for insert to anon with check (true);
drop policy if exists "hackathon anon summaries update" on public.summaries;
create policy "hackathon anon summaries update" on public.summaries for update to anon using (true) with check (true);

grant usage on schema public to anon;
grant select, insert, update on public.rooms, public.captions, public.summaries to anon;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'captions') then
    alter publication supabase_realtime add table public.captions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'summaries') then
    alter publication supabase_realtime add table public.summaries;
  end if;
end $$;

