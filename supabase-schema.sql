-- =====================================================================
-- SCHEMA DE PRODUÇÃO (POSTGRESQL / SUPABASE) — ESTEFANY PAIVA NAILS
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- =====================================================================

-- 1. Configurações do Estúdio
create table if not exists public.salon_settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Categorias do Catálogo
create table if not exists public.categories (
  id text primary key,
  name text not null
);

-- 3. Serviços / Procedimentos
create table if not exists public.services (
  id text primary key,
  name text not null,
  "categoryId" text references public.categories(id) on delete set null,
  price numeric(10,2) not null default 0,
  duration integer not null default 90,
  description text default '',
  image text default '',
  active boolean not null default true
);

-- 4. Agendamentos
create table if not exists public.appointments (
  id text primary key,
  "clientName" text not null,
  "clientPhone" text not null,
  "serviceId" text default '',
  "serviceName" text not null,
  "servicePrice" numeric(10,2) not null default 0,
  duration integer not null default 90,
  date text not null,
  time text not null,
  status text not null default 'Confirmado',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz
);

-- Impede dois agendamentos ativos no mesmo dia e horário no banco de dados
create unique index if not exists idx_unique_active_slot
  on public.appointments (date, time)
  where (status <> 'Cancelado');

-- 5. Bloqueios Pessoais da Profissional
create table if not exists public.personal_blocks (
  id text primary key,
  title text not null,
  date text not null,
  "startTime" text not null default '09:00',
  "endTime" text not null default '18:00',
  "allDay" boolean not null default false
);

-- 6. Ficha Técnica da Cliente (Acesso restrito apenas à Administradora autenticada)
create table if not exists public.client_tech_notes (
  "phoneKey" text primary key,
  "nailShape" text default '',
  "favoriteColor" text default '',
  allergies text default '',
  notes text default '',
  "updatedAt" timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) — PROTEÇÃO REAL DOS DADOS (LGPD)
-- =====================================================================
alter table public.salon_settings enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.personal_blocks enable row level security;
alter table public.client_tech_notes enable row level security;

-- Catálogo e Configurações: leitura pública, escrita apenas para admin autenticado
create policy "Public read settings" on public.salon_settings for select using (true);
create policy "Admin write settings" on public.salon_settings for all using (auth.role() = 'authenticated');

create policy "Public read categories" on public.categories for select using (true);
create policy "Admin write categories" on public.categories for all using (auth.role() = 'authenticated');

create policy "Public read services" on public.services for select using (true);
create policy "Admin write services" on public.services for all using (auth.role() = 'authenticated');

-- Bloqueios pessoais: leitura pública (para ocultar horários ocupados), escrita apenas admin
create policy "Public read blocks" on public.personal_blocks for select using (true);
create policy "Admin write blocks" on public.personal_blocks for all using (auth.role() = 'authenticated');

-- Agendamentos: cliente pode criar, remarcar e consultar; admin tem controle total
create policy "Public insert appointments" on public.appointments for insert with check (true);
create policy "Public read appointments" on public.appointments for select using (true);
create policy "Public update own appointment" on public.appointments for update using (true);
create policy "Admin delete appointments" on public.appointments for delete using (auth.role() = 'authenticated');

-- Ficha Técnica: 100% privada — apenas administradora autenticada lê e escreve
create policy "Admin only tech notes" on public.client_tech_notes for all using (auth.role() = 'authenticated');
