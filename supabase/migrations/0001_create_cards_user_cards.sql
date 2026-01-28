-- Migration: core tables for onboarding and dashboard
-- This migration is idempotent and safe to run multiple times.

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Helper function to keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Cards catalog table
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  brand text,
  card_name text not null,
  network text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Application code should normalize aliases (e.g., 'MC') to 'Mastercard' before insert.
  constraint cards_network_check check (network in ('Visa', 'Mastercard', 'Amex', 'Discover'))
);

-- User <> cards join table
create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_cards_user_id_card_id_unique unique (user_id, card_id)
);

-- Indexes for dashboard lookups
create index if not exists cards_issuer_idx on public.cards (issuer);
create index if not exists cards_brand_idx on public.cards (brand);
create index if not exists cards_network_idx on public.cards (network);
create unique index if not exists cards_issuer_card_name_ci_unique
  on public.cards (lower(trim(issuer)), lower(trim(card_name)));
create index if not exists user_cards_user_id_idx on public.user_cards (user_id);
create index if not exists user_cards_card_id_idx on public.user_cards (card_id);

-- Triggers to keep updated_at current
DO $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_cards_updated_at'
      and tgrelid = 'public.cards'::regclass
  ) then
    create trigger set_cards_updated_at
    before update on public.cards
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_user_cards_updated_at'
      and tgrelid = 'public.user_cards'::regclass
  ) then
    create trigger set_user_cards_updated_at
    before update on public.user_cards
    for each row
    execute function public.set_updated_at();
  end if;
end $$;

-- Row Level Security
alter table public.cards enable row level security;
alter table public.user_cards enable row level security;

-- Cards: readable by everyone, writable only by service_role.
DO $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cards'
      and policyname = 'cards_select_all'
  ) then
    create policy cards_select_all
      on public.cards
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cards'
      and policyname = 'cards_service_role_insert'
  ) then
    create policy cards_service_role_insert
      on public.cards
      for insert
      to service_role
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cards'
      and policyname = 'cards_service_role_update'
  ) then
    create policy cards_service_role_update
      on public.cards
      for update
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cards'
      and policyname = 'cards_service_role_delete'
  ) then
    create policy cards_service_role_delete
      on public.cards
      for delete
      to service_role
      using (true);
  end if;
end $$;

-- User cards: users can manage only their own rows.
-- Updates are intentionally disallowed; treat join rows as immutable and use delete + insert.
DO $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_cards'
      and policyname = 'user_cards_select_own'
  ) then
    create policy user_cards_select_own
      on public.user_cards
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_cards'
      and policyname = 'user_cards_insert_own'
  ) then
    create policy user_cards_insert_own
      on public.user_cards
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_cards'
      and policyname = 'user_cards_delete_own'
  ) then
    create policy user_cards_delete_own
      on public.user_cards
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
