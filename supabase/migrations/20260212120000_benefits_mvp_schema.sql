-- MVP backend schema for card benefits tracking (boolean per period)

create extension if not exists "pgcrypto";

-- Cards table additions for product-based catalog
alter table if exists public.cards
  add column if not exists product_key text,
  add column if not exists display_name text,
  add column if not exists is_business boolean not null default false;

-- Cleanup: drop legacy triggers on public.cards that reference removed column "brand"
do $$
declare
  r record;
  fn_def text;
begin
  for r in
    select
      t.tgname,
      p.oid as func_oid,
      n.nspname as func_schema,
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as func_args
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'public.cards'::regclass
      and not t.tgisinternal
  loop
    fn_def := pg_get_functiondef(r.func_oid);

    if fn_def ilike '%brand%' then
      execute format('drop trigger if exists %I on public.cards;', r.tgname);
      execute format('drop function if exists %I.%I(%s);', r.func_schema, r.func_name, r.func_args);
    end if;
  end loop;
end $$;


-- Backfill display_name from legacy card_name when present
update public.cards
set display_name = card_name
where display_name is null
  and card_name is not null;

-- Ensure required card fields and uniqueness for product_key
update public.cards
set product_key = lower(regexp_replace(coalesce(issuer, 'card') || '_' || coalesce(card_name, display_name, id::text), '[^a-zA-Z0-9]+', '_', 'g'))
where product_key is null;

alter table if exists public.cards
  alter column product_key set not null,
  alter column display_name set not null,
  alter column issuer set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_product_key_unique'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
      add constraint cards_product_key_unique unique (product_key);
  end if;
end $$;

-- Benefits catalog
create table if not exists public.benefits (
  id uuid primary key default gen_random_uuid(),
  benefit_key text not null unique,
  display_name text not null,
  category text not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'semiannual', 'annual', 'activation', 'multi_year')),
  value_cents integer,
  requires_enrollment boolean not null default false,
  requires_selection boolean not null default false,
  selection_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Card <> benefits join
create table if not exists public.card_benefits (
  card_id uuid not null references public.cards(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, benefit_id)
);

-- User benefits settings
create table if not exists public.user_benefits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  is_enabled boolean not null default true,
  is_enrolled boolean,
  selection_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, benefit_id)
);

-- Per-period boolean status
create table if not exists public.user_benefit_period_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  period_key text not null,
  is_used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, benefit_id, period_key)
);

-- Helpful indexes
create index if not exists cards_product_key_idx on public.cards (product_key);
create index if not exists benefits_benefit_key_idx on public.benefits (benefit_key);
create index if not exists card_benefits_benefit_id_idx on public.card_benefits (benefit_id);
create index if not exists user_cards_user_id_idx on public.user_cards (user_id);
create index if not exists user_benefits_user_id_idx on public.user_benefits (user_id);
create index if not exists user_benefits_benefit_id_idx on public.user_benefits (benefit_id);
create index if not exists user_benefit_period_status_user_id_idx on public.user_benefit_period_status (user_id);
create index if not exists user_benefit_period_status_benefit_id_idx on public.user_benefit_period_status (benefit_id);
create index if not exists user_benefit_period_status_period_key_idx on public.user_benefit_period_status (period_key);

-- Keep updated_at current for new tables (helper may already exist)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_user_benefits_updated_at' and tgrelid = 'public.user_benefits'::regclass
  ) then
    create trigger set_user_benefits_updated_at
    before update on public.user_benefits
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_user_benefit_period_status_updated_at' and tgrelid = 'public.user_benefit_period_status'::regclass
  ) then
    create trigger set_user_benefit_period_status_updated_at
    before update on public.user_benefit_period_status
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_benefits_updated_at' and tgrelid = 'public.benefits'::regclass
  ) then
    create trigger set_benefits_updated_at
    before update on public.benefits
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS
alter table public.cards enable row level security;
alter table public.benefits enable row level security;
alter table public.card_benefits enable row level security;
alter table public.user_cards enable row level security;
alter table public.user_benefits enable row level security;
alter table public.user_benefit_period_status enable row level security;

-- Cards catalog: authenticated read, service-role writes
DROP POLICY IF EXISTS cards_select_all ON public.cards;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='cards' and policyname='cards_select_authenticated'
  ) then
    create policy cards_select_authenticated
      on public.cards
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Benefits + card_benefits: authenticated read, service-role writes

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='benefits' and policyname='benefits_select_authenticated'
  ) then
    create policy benefits_select_authenticated
      on public.benefits
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='benefits' and policyname='benefits_service_role_insert'
  ) then
    create policy benefits_service_role_insert
      on public.benefits
      for insert
      to service_role
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='benefits' and policyname='benefits_service_role_update'
  ) then
    create policy benefits_service_role_update
      on public.benefits
      for update
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='benefits' and policyname='benefits_service_role_delete'
  ) then
    create policy benefits_service_role_delete
      on public.benefits
      for delete
      to service_role
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='card_benefits' and policyname='card_benefits_select_authenticated'
  ) then
    create policy card_benefits_select_authenticated
      on public.card_benefits
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='card_benefits' and policyname='card_benefits_service_role_insert'
  ) then
    create policy card_benefits_service_role_insert
      on public.card_benefits
      for insert
      to service_role
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='card_benefits' and policyname='card_benefits_service_role_delete'
  ) then
    create policy card_benefits_service_role_delete
      on public.card_benefits
      for delete
      to service_role
      using (true);
  end if;
end $$;

-- User-owned rows

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_cards' and policyname='user_cards_update_own'
  ) then
    create policy user_cards_update_own
      on public.user_cards
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_select_own'
  ) then
    create policy user_benefits_select_own
      on public.user_benefits
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_insert_own'
  ) then
    create policy user_benefits_insert_own
      on public.user_benefits
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_update_own'
  ) then
    create policy user_benefits_update_own
      on public.user_benefits
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_delete_own'
  ) then
    create policy user_benefits_delete_own
      on public.user_benefits
      for delete
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefit_period_status' and policyname='user_benefit_period_status_select_own'
  ) then
    create policy user_benefit_period_status_select_own
      on public.user_benefit_period_status
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefit_period_status' and policyname='user_benefit_period_status_insert_own'
  ) then
    create policy user_benefit_period_status_insert_own
      on public.user_benefit_period_status
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefit_period_status' and policyname='user_benefit_period_status_update_own'
  ) then
    create policy user_benefit_period_status_update_own
      on public.user_benefit_period_status
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_benefit_period_status' and policyname='user_benefit_period_status_delete_own'
  ) then
    create policy user_benefit_period_status_delete_own
      on public.user_benefit_period_status
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- RPC for bootstrapping user_benefits rows from a card's linked benefits
create or replace function public.bootstrap_user_benefits_for_card(p_user_id uuid, p_card_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'cannot bootstrap benefits for another user';
  end if;

  with inserted as (
    insert into public.user_benefits (user_id, benefit_id)
    select p_user_id, cb.benefit_id
    from public.card_benefits cb
    where cb.card_id = p_card_id
    on conflict (user_id, benefit_id) do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

-- Seed data: Amex Platinum Personal US card
insert into public.cards (issuer, product_key, display_name, is_business, card_name, network)
values ('amex', 'amex_platinum_personal_us', 'American Express Platinum Card', false, 'American Express Platinum Card', 'Amex')
on conflict (product_key)
do update set
  issuer = excluded.issuer,
  display_name = excluded.display_name,
  is_business = excluded.is_business,
  card_name = excluded.card_name,
  network = excluded.network;

-- Seed benefits
insert into public.benefits (benefit_key, display_name, category, frequency, value_cents, requires_enrollment, requires_selection, selection_type, notes)
values
  ('uber_cash_credit', 'Uber Cash Credit', 'lifestyle', 'monthly', null, false, false, null, null),
  ('digital_entertainment_credit', 'Digital Entertainment Credit', 'entertainment', 'monthly', null, false, false, null, null),
  ('walmart_plus_credit', 'Walmart+ Credit', 'shopping', 'monthly', null, false, false, null, null),
  ('equinox_credit', 'Equinox Credit', 'fitness', 'monthly', null, false, false, null, 'Tracked as one benefit; annual cap nuances are intentionally stored in notes.'),
  ('lululemon_credit', 'lululemon Credit', 'shopping', 'quarterly', null, false, false, null, null),
  ('resy_credit', 'Resy Credit', 'dining', 'quarterly', null, false, false, null, null),
  ('saks_credit', 'Saks Credit', 'shopping', 'semiannual', null, false, false, null, null),
  ('airline_fee_credit', 'Airline Fee Credit', 'travel', 'annual', null, true, true, 'airline', 'Requires airline selection and enrollment with issuer.'),
  ('clear_credit', 'CLEAR Credit', 'travel', 'annual', null, false, false, null, null),
  ('hotel_collection_credit', 'Hotel Collection Credit', 'travel', 'annual', null, false, false, null, null),
  ('uber_one_credit', 'Uber One Credit', 'lifestyle', 'annual', null, false, false, null, null),
  ('oura_credit', 'Oura Credit', 'wellness', 'annual', null, false, false, null, null),
  ('global_entry_tsa_credit', 'Global Entry/TSA PreCheck Credit', 'travel', 'multi_year', null, false, false, null, 'Modeled as multi_year due to long renewal cadence; still tracked as boolean use status.'),
  ('airline_selected', 'Airline Selected', 'travel', 'activation', null, false, true, 'airline', 'Activation/selection state used for airline-dependent benefits.'),
  ('priority_pass_enrolled', 'Priority Pass Enrolled', 'travel', 'activation', null, true, false, null, null),
  ('hilton_gold_enrolled', 'Hilton Gold Enrolled', 'hotel_status', 'activation', null, true, false, null, null),
  ('marriott_gold_enrolled', 'Marriott Gold Enrolled', 'hotel_status', 'activation', null, true, false, null, null)
on conflict (benefit_key)
do update set
  display_name = excluded.display_name,
  category = excluded.category,
  frequency = excluded.frequency,
  value_cents = excluded.value_cents,
  requires_enrollment = excluded.requires_enrollment,
  requires_selection = excluded.requires_selection,
  selection_type = excluded.selection_type,
  notes = excluded.notes,
  updated_at = now();

-- Link all seeded benefits to the seeded card
insert into public.card_benefits (card_id, benefit_id)
select c.id, b.id
from public.cards c
join public.benefits b on b.benefit_key in (
  'uber_cash_credit',
  'digital_entertainment_credit',
  'walmart_plus_credit',
  'equinox_credit',
  'lululemon_credit',
  'resy_credit',
  'saks_credit',
  'airline_fee_credit',
  'clear_credit',
  'hotel_collection_credit',
  'uber_one_credit',
  'oura_credit',
  'global_entry_tsa_credit',
  'airline_selected',
  'priority_pass_enrolled',
  'hilton_gold_enrolled',
  'marriott_gold_enrolled'
)
where c.product_key = 'amex_platinum_personal_us'
on conflict (card_id, benefit_id) do nothing;
