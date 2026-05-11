create table if not exists public.table_rolls (
  id text primary key,
  room text not null,
  character_name text not null,
  pool_name text not null,
  pool_type text not null default '',
  dice_count integer not null check (dice_count >= 0),
  dice jsonb not null default '[]'::jsonb,
  successes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists table_rolls_room_created_at_idx
  on public.table_rolls (room, created_at desc);

alter table public.table_rolls enable row level security;

drop policy if exists "Anyone can read table rolls" on public.table_rolls;
create policy "Anyone can read table rolls"
  on public.table_rolls
  for select
  using (true);

drop policy if exists "Anyone can create table rolls" on public.table_rolls;
create policy "Anyone can create table rolls"
  on public.table_rolls
  for insert
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_rolls'
  ) then
    alter publication supabase_realtime add table public.table_rolls;
  end if;
end $$;

create table if not exists public.table_images (
  id text primary key,
  room text not null,
  name text not null,
  image_data text not null,
  created_at timestamptz not null default now()
);

create index if not exists table_images_room_created_at_idx
  on public.table_images (room, created_at desc);

alter table public.table_images enable row level security;

drop policy if exists "Anyone can read table images" on public.table_images;
create policy "Anyone can read table images"
  on public.table_images
  for select
  using (true);

drop policy if exists "Anyone can create table images" on public.table_images;
create policy "Anyone can create table images"
  on public.table_images
  for insert
  with check (true);

drop policy if exists "Anyone can delete table images" on public.table_images;
create policy "Anyone can delete table images"
  on public.table_images
  for delete
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_images'
  ) then
    alter publication supabase_realtime add table public.table_images;
  end if;
end $$;
