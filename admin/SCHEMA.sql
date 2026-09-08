-- PROT CARD — Supabase schema
-- Pega este bloque completo en el SQL editor de tu Supabase self-hosted
-- y corré (Run). Todo es idempotente: se puede ejecutar más de una vez.
--
-- Después: creá un usuario admin desde Authentication > Users > Add user
-- (email + password). Con eso ya podés entrar a /admin.

-- ============ TABLAS =========================================
create extension if not exists "pgcrypto";

create table if not exists public.pc_marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  logo_url text,
  orden int default 0,
  created_at timestamptz default now()
);

create table if not exists public.pc_modelos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid references public.pc_marcas(id) on delete cascade,
  nombre text not null,
  orden int default 0,
  created_at timestamptz default now(),
  unique (marca_id, nombre)
);

create table if not exists public.pc_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text not null,
  modelo text not null,
  tipo text not null default 'Pickup',
  compat text,
  precio text,
  img_url text,
  img_alt text,
  destacado boolean default false,
  orden int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pc_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- ============ SEED de settings ===============================
insert into public.pc_settings (key, value) values
  ('wa_number',      '595971813847'),
  ('wa_default_msg', 'Hola PROT CARD, necesito un cubrecárter para {vehiculo}.'),
  ('email',          'loewenjohny2002@gmail.com'),
  ('instagram_url',  'https://www.instagram.com/protcard_'),
  ('tiktok_url',     'https://www.tiktok.com/@johny.loewen')
on conflict (key) do nothing;

-- ============ SEED de marcas y modelos (opcional) ============
insert into public.pc_marcas (nombre, orden) values
  ('Toyota', 1),('Ford', 2),('Chevrolet', 3),('Nissan', 4)
on conflict (nombre) do nothing;

insert into public.pc_modelos (marca_id, nombre, orden)
select m.id, x.nombre, x.orden from public.pc_marcas m
join (values
  ('Toyota','Hilux',1),('Toyota','Fortuner',2),
  ('Ford','Ranger',1),
  ('Chevrolet','S10',1),
  ('Nissan','Frontier',1)
) as x(marca, nombre, orden) on x.marca = m.nombre
on conflict (marca_id, nombre) do nothing;

-- ============ RLS ============================================
alter table public.pc_marcas    enable row level security;
alter table public.pc_modelos   enable row level security;
alter table public.pc_productos enable row level security;
alter table public.pc_settings  enable row level security;

drop policy if exists "public read pc_marcas"    on public.pc_marcas;
drop policy if exists "public read pc_modelos"   on public.pc_modelos;
drop policy if exists "public read pc_productos" on public.pc_productos;
drop policy if exists "public read pc_settings"  on public.pc_settings;
create policy "public read pc_marcas"    on public.pc_marcas    for select using (true);
create policy "public read pc_modelos"   on public.pc_modelos   for select using (true);
create policy "public read pc_productos" on public.pc_productos for select using (true);
create policy "public read pc_settings"  on public.pc_settings  for select using (true);

drop policy if exists "auth cud pc_marcas"    on public.pc_marcas;
drop policy if exists "auth cud pc_modelos"   on public.pc_modelos;
drop policy if exists "auth cud pc_productos" on public.pc_productos;
drop policy if exists "auth cud pc_settings"  on public.pc_settings;
create policy "auth cud pc_marcas"    on public.pc_marcas    for all to authenticated using (true) with check (true);
create policy "auth cud pc_modelos"   on public.pc_modelos   for all to authenticated using (true) with check (true);
create policy "auth cud pc_productos" on public.pc_productos for all to authenticated using (true) with check (true);
create policy "auth cud pc_settings"  on public.pc_settings  for all to authenticated using (true) with check (true);

-- ============ STORAGE: bucket público para fotos =============
insert into storage.buckets (id, name, public)
values ('pc-images','pc-images', true)
on conflict (id) do nothing;

drop policy if exists "public read pc-images"   on storage.objects;
drop policy if exists "auth insert pc-images"   on storage.objects;
drop policy if exists "auth update pc-images"   on storage.objects;
drop policy if exists "auth delete pc-images"   on storage.objects;
create policy "public read pc-images"  on storage.objects for select                using (bucket_id = 'pc-images');
create policy "auth insert pc-images"  on storage.objects for insert to authenticated with check (bucket_id = 'pc-images');
create policy "auth update pc-images"  on storage.objects for update to authenticated using (bucket_id = 'pc-images');
create policy "auth delete pc-images"  on storage.objects for delete to authenticated using (bucket_id = 'pc-images');
