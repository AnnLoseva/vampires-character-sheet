create table if not exists public.table_music (
  room text primary key,
  url text not null default '',
  active_uri text,
  is_playing boolean not null default false,
  position_seconds numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.table_music enable row level security;

drop policy if exists "Anyone can read table music" on public.table_music;
create policy "Anyone can read table music"
  on public.table_music
  for select
  using (true);

drop policy if exists "Anyone can create table music" on public.table_music;
create policy "Anyone can create table music"
  on public.table_music
  for insert
  with check (true);

drop policy if exists "Anyone can update table music" on public.table_music;
create policy "Anyone can update table music"
  on public.table_music
  for update
  using (true)
  with check (true);

alter table public.table_music replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_music'
  ) then
    alter publication supabase_realtime add table public.table_music;
  end if;
end $$;
