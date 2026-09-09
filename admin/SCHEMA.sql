-- PROT CARD — schema dedicado en Supabase self-hosted.
-- Todo vive en el schema `protcard` (no en public), coherente con
-- cómo tenés otros proyectos separados en la misma instancia.
--
-- Pasos:
--   1. Pegar este bloque en el SQL editor y correr (Run).
--      Es idempotente: se puede volver a correr sin romper nada.
--   2. Exponer el schema en PostgREST — en tu docker-compose / config
--      de Supabase agregar `protcard` a PGRST_DB_SCHEMAS
--      (ej. PGRST_DB_SCHEMAS="public,storage,graphql_public,protcard")
--      y reiniciar el servicio de postgrest/kong.
--   3. Crear un usuario admin desde Authentication > Users.
--   4. Rellenar url + anon key en /pc-supabase-config.js.

create schema if not exists protcard;
create extension if not exists "pgcrypto";

-- Permisos base sobre el schema para los roles de Supabase.
grant usage on schema protcard to anon, authenticated, service_role;
alter default privileges in schema protcard
  grant select on tables to anon, authenticated;
alter default privileges in schema protcard
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema protcard
  grant usage, select on sequences to anon, authenticated;

-- ============ TABLAS =========================================
create table if not exists protcard.marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  logo_url text,
  orden int default 0,
  created_at timestamptz default now()
);

create table if not exists protcard.modelos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid references protcard.marcas(id) on delete cascade,
  nombre text not null,
  orden int default 0,
  created_at timestamptz default now(),
  unique (marca_id, nombre)
);

create table if not exists protcard.productos (
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

create table if not exists protcard.settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Grants explícitos (por si las policies default no aplican a estas tablas).
grant select on protcard.marcas, protcard.modelos, protcard.productos, protcard.settings to anon, authenticated;
grant insert, update, delete on protcard.marcas, protcard.modelos, protcard.productos, protcard.settings to authenticated;

-- ============ SEED de settings ===============================
insert into protcard.settings (key, value) values
  ('wa_number',      '595971813847'),
  ('wa_default_msg', 'Hola PROT CARD, necesito un cubrecárter para {vehiculo}.'),
  ('email',          'loewenjohny2002@gmail.com'),
  ('instagram_url',  'https://www.instagram.com/protcard_'),
  ('tiktok_url',     'https://www.tiktok.com/@johny.loewen')
on conflict (key) do nothing;

-- ============ SEED de marcas y modelos (opcional) ============
insert into protcard.marcas (nombre, orden) values
  ('Toyota', 1),('Ford', 2),('Chevrolet', 3),('Nissan', 4)
on conflict (nombre) do nothing;

insert into protcard.modelos (marca_id, nombre, orden)
select m.id, x.nombre, x.orden from protcard.marcas m
join (values
  ('Toyota','Hilux',1),('Toyota','Fortuner',2),
  ('Ford','Ranger',1),
  ('Chevrolet','S10',1),
  ('Nissan','Frontier',1)
) as x(marca, nombre, orden) on x.marca = m.nombre
on conflict (marca_id, nombre) do nothing;

-- ============ RLS ============================================
alter table protcard.marcas    enable row level security;
alter table protcard.modelos   enable row level security;
alter table protcard.productos enable row level security;
alter table protcard.settings  enable row level security;

drop policy if exists "public read marcas"    on protcard.marcas;
drop policy if exists "public read modelos"   on protcard.modelos;
drop policy if exists "public read productos" on protcard.productos;
drop policy if exists "public read settings"  on protcard.settings;
create policy "public read marcas"    on protcard.marcas    for select using (true);
create policy "public read modelos"   on protcard.modelos   for select using (true);
create policy "public read productos" on protcard.productos for select using (true);
create policy "public read settings"  on protcard.settings  for select using (true);

drop policy if exists "auth cud marcas"    on protcard.marcas;
drop policy if exists "auth cud modelos"   on protcard.modelos;
drop policy if exists "auth cud productos" on protcard.productos;
drop policy if exists "auth cud settings"  on protcard.settings;
create policy "auth cud marcas"    on protcard.marcas    for all to authenticated using (true) with check (true);
create policy "auth cud modelos"   on protcard.modelos   for all to authenticated using (true) with check (true);
create policy "auth cud productos" on protcard.productos for all to authenticated using (true) with check (true);
create policy "auth cud settings"  on protcard.settings  for all to authenticated using (true) with check (true);

-- ============ STORAGE: bucket público para fotos =============
insert into storage.buckets (id, name, public)
values ('pc-images','pc-images', true)
on conflict (id) do nothing;

drop policy if exists "public read pc-images"  on storage.objects;
drop policy if exists "auth insert pc-images"  on storage.objects;
drop policy if exists "auth update pc-images"  on storage.objects;
drop policy if exists "auth delete pc-images"  on storage.objects;
create policy "public read pc-images"  on storage.objects for select                using (bucket_id = 'pc-images');
create policy "auth insert pc-images"  on storage.objects for insert to authenticated with check (bucket_id = 'pc-images');
create policy "auth update pc-images"  on storage.objects for update to authenticated using (bucket_id = 'pc-images');
create policy "auth delete pc-images"  on storage.objects for delete to authenticated using (bucket_id = 'pc-images');
