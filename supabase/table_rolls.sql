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
  x integer not null default 80,
  y integer not null default 80,
  width integer not null default 420,
  height integer not null default 280,
  z_index integer not null default 1,
  visible boolean not null default true,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.table_images
  add column if not exists x integer not null default 80,
  add column if not exists y integer not null default 80,
  add column if not exists width integer not null default 420,
  add column if not exists height integer not null default 280,
  add column if not exists z_index integer not null default 1,
  add column if not exists visible boolean not null default true,
  add column if not exists locked boolean not null default false;

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

drop policy if exists "Anyone can update table images" on public.table_images;
create policy "Anyone can update table images"
  on public.table_images
  for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete table images" on public.table_images;
create policy "Anyone can delete table images"
  on public.table_images
  for delete
  using (true);

alter table public.table_images replica identity full;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'table-images',
  'table-images',
  true,
  null,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read table image files" on storage.objects;
create policy "Anyone can read table image files"
  on storage.objects
  for select
  using (bucket_id = 'table-images');

drop policy if exists "Anyone can upload table image files" on storage.objects;
create policy "Anyone can upload table image files"
  on storage.objects
  for insert
  with check (bucket_id = 'table-images');

drop policy if exists "Anyone can update table image files" on storage.objects;
create policy "Anyone can update table image files"
  on storage.objects
  for update
  using (bucket_id = 'table-images')
  with check (bucket_id = 'table-images');

drop policy if exists "Anyone can delete table image files" on storage.objects;
create policy "Anyone can delete table image files"
  on storage.objects
  for delete
  using (bucket_id = 'table-images');
