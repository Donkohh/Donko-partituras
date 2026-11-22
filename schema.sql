-- Donko Partituras — Esquema de base de datos Supabase

-- Función auxiliar para verificar si el usuario autenticado tiene rol admin en app_metadata
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- 1. Tabla de Partituras
create table if not exists public.partituras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) > 0 and char_length(nombre) <= 255),
  archivo_path text not null unique check (archivo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'),
  hash_sha256 text not null unique,
  etiquetas text[] not null default '{}' check (cardinality(etiquetas) <= 10),
  tamano_bytes bigint not null check (tamano_bytes > 0 and tamano_bytes <= 52428800), -- 50 MB máx
  creado_en timestamptz not null default now()
);

-- Índices para búsqueda y rendimiento
create index if not exists idx_partituras_nombre on public.partituras (nombre);
create index if not exists idx_partituras_hash_sha256 on public.partituras (hash_sha256);
create index if not exists idx_partituras_creado_en on public.partituras (creado_en desc);
create index if not exists idx_partituras_etiquetas on public.partituras using gin (etiquetas);

-- RLS Partituras
alter table public.partituras enable row level security;

create policy "Lectura pública de partituras"
  on public.partituras for select
  to public
  using (true);

create policy "Escritura solo admin en partituras"
  on public.partituras for insert
  to authenticated
  with check (public.is_admin());

create policy "Actualización solo admin en partituras"
  on public.partituras for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Eliminación solo admin en partituras"
  on public.partituras for delete
  to authenticated
  using (public.is_admin());

-- 2. Tabla de Carpetas
create table if not exists public.carpetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) > 0 and char_length(nombre) <= 100),
  creado_en timestamptz not null default now()
);

create index if not exists idx_carpetas_nombre on public.carpetas (nombre);

-- RLS Carpetas
alter table public.carpetas enable row level security;

create policy "Lectura pública de carpetas"
  on public.carpetas for select
  to public
  using (true);

create policy "Escritura solo admin en carpetas"
  on public.carpetas for insert
  to authenticated
  with check (public.is_admin());

create policy "Actualización solo admin en carpetas"
  on public.carpetas for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Eliminación solo admin en carpetas"
  on public.carpetas for delete
  to authenticated
  using (public.is_admin());

-- 3. Tabla Intermedia partitura_carpeta
create table if not exists public.partitura_carpeta (
  partitura_id uuid not null references public.partituras(id) on delete cascade,
  carpeta_id uuid not null references public.carpetas(id) on delete cascade,
  primary key (partitura_id, carpeta_id)
);

create index if not exists idx_partitura_carpeta_carpeta_id on public.partitura_carpeta (carpeta_id);
create index if not exists idx_partitura_carpeta_partitura_id on public.partitura_carpeta (partitura_id);

-- RLS partitura_carpeta
alter table public.partitura_carpeta enable row level security;

create policy "Lectura pública de partitura_carpeta"
  on public.partitura_carpeta for select
  to public
  using (true);

create policy "Escritura solo admin en partitura_carpeta"
  on public.partitura_carpeta for insert
  to authenticated
  with check (public.is_admin());

create policy "Eliminación solo admin en partitura_carpeta"
  on public.partitura_carpeta for delete
  to authenticated
  using (public.is_admin());

-- 4. Storage Bucket 'partituras'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partituras', 'partituras', true, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf'];

-- Políticas de Storage
create policy "Lectura pública de archivos PDF"
  on storage.objects for select
  to public
  using (bucket_id = 'partituras');

create policy "Subida de PDFs solo admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'partituras' and public.is_admin());

create policy "Eliminación de PDFs solo admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'partituras' and public.is_admin());

-- 5. Comando para otorgar rol admin a tu usuario (ejecutar manualmente en SQL Editor con tu correo):
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}' where email = 'tu_correo@ejemplo.com';
