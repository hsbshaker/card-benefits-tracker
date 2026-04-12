-- Memento benefits schema evolution
-- Safe phase only: add canonical Memento schema surface without inventing
-- business semantics for existing rows. Tightening items are documented at the
-- bottom of this file for a later post-import migration.

create extension if not exists "pgcrypto";

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
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'issuer_enum'
  ) then
    create type public.issuer_enum as enum (
      'amex',
      'chase',
      'citi',
      'capital_one'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'card_status_enum'
  ) then
    create type public.card_status_enum as enum (
      'active',
      'no_trackable_benefits',
      'retired'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'benefit_cadence_enum'
  ) then
    create type public.benefit_cadence_enum as enum (
      'monthly',
      'quarterly',
      'semiannual',
      'annual',
      'multi_year',
      'one_time',
      'per_booking'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'track_in_memento_enum'
  ) then
    create type public.track_in_memento_enum as enum (
      'yes',
      'later',
      'no'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'benefit_change_type_enum'
  ) then
    create type public.benefit_change_type_enum as enum (
      'created',
      'updated',
      'retired',
      'reclassified'
    );
  end if;
end $$;

alter table if exists public.cards
  add column if not exists card_code text,
  add column if not exists source_url text,
  add column if not exists card_status public.card_status_enum;

update public.cards
set card_code = coalesce(
  nullif(btrim(product_key), ''),
  lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(issuer::text, 'card') || '_' || coalesce(card_name, display_name, id::text),
          '[™®℠]',
          '',
          'g'
        ),
        '&',
        'and',
        'g'
      ),
      '[^a-zA-Z0-9]+',
      '_',
      'g'
    )
  )
)
where card_code is null;

update public.cards
set card_code = trim(both '_' from regexp_replace(card_code, '_+', '_', 'g'))
where card_code is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_card_code_not_blank'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
      add constraint cards_card_code_not_blank
      check (card_code is null or length(btrim(card_code)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_source_url_not_blank'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
      add constraint cards_source_url_not_blank
      check (source_url is null or length(btrim(source_url)) > 0);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cards'
      and column_name = 'issuer'
      and udt_name = 'text'
  ) then
    alter table public.cards
      alter column issuer drop not null;

    alter table public.cards
      alter column issuer type public.issuer_enum
      using (
        case lower(trim(issuer::text))
          when 'amex' then 'amex'::public.issuer_enum
          when 'american express' then 'amex'::public.issuer_enum
          when 'capital one' then 'capital_one'::public.issuer_enum
          when 'capital_one' then 'capital_one'::public.issuer_enum
          when 'chase' then 'chase'::public.issuer_enum
          when 'citi' then 'citi'::public.issuer_enum
          when 'citibank' then 'citi'::public.issuer_enum
          else null
        end
      );
  end if;
end $$;

create index if not exists cards_card_code_idx on public.cards (card_code);
create index if not exists cards_card_status_idx on public.cards (card_status);

alter table if exists public.benefits
  add column if not exists benefit_code text,
  add column if not exists benefit_name text,
  add column if not exists benefit_value text,
  add column if not exists reset_timing text,
  add column if not exists enrollment_required boolean,
  add column if not exists requires_setup boolean,
  add column if not exists track_in_memento public.track_in_memento_enum,
  add column if not exists source_url text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists benefit_hash text;

update public.benefits
set benefit_code = coalesce(nullif(btrim(benefit_key), ''), benefit_code)
where benefit_code is null
  and benefit_key is not null;

update public.benefits
set benefit_name = coalesce(nullif(btrim(display_name), ''), benefit_name)
where benefit_name is null
  and display_name is not null;

update public.benefits
set enrollment_required = requires_enrollment
where enrollment_required is null;

update public.benefits
set cadence = 'semiannual'
where cadence in ('semi_annual', 'semiannual');

alter table public.benefits
  alter column cadence drop default,
  alter column cadence drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'benefits_cadence_check'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      drop constraint benefits_cadence_check;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'benefits'
      and column_name = 'cadence'
      and udt_name = 'text'
  ) then
    alter table public.benefits
      alter column cadence type public.benefit_cadence_enum
      using (
        case trim(cadence)
          when 'monthly' then 'monthly'::public.benefit_cadence_enum
          when 'quarterly' then 'quarterly'::public.benefit_cadence_enum
          when 'semiannual' then 'semiannual'::public.benefit_cadence_enum
          when 'annual' then 'annual'::public.benefit_cadence_enum
          when 'multi_year' then 'multi_year'::public.benefit_cadence_enum
          when 'one_time' then 'one_time'::public.benefit_cadence_enum
          when 'per_booking' then 'per_booking'::public.benefit_cadence_enum
          else null
        end
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_benefit_code_not_blank'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_benefit_code_not_blank
      check (benefit_code is null or length(btrim(benefit_code)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_benefit_name_not_blank'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_benefit_name_not_blank
      check (benefit_name is null or length(btrim(benefit_name)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_benefit_value_not_blank'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_benefit_value_not_blank
      check (benefit_value is null or length(btrim(benefit_value)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_reset_timing_not_blank'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_reset_timing_not_blank
      check (reset_timing is null or length(btrim(reset_timing)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_source_url_not_blank'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_source_url_not_blank
      check (source_url is null or length(btrim(source_url)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_benefit_hash_not_blank'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_benefit_hash_not_blank
      check (benefit_hash is null or length(btrim(benefit_hash)) > 0);
  end if;
end $$;

do $$
declare
  fk_name text;
begin
  select conname
  into fk_name
  from pg_constraint
  where conrelid = 'public.benefits'::regclass
    and contype = 'f'
    and conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.benefits'::regclass and attname = 'card_id')
    ];

  if fk_name is not null then
    execute format('alter table public.benefits drop constraint %I', fk_name);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_card_id_fkey'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_card_id_fkey
      foreign key (card_id) references public.cards(id) on delete restrict;
  end if;
end $$;

create index if not exists benefits_card_id_idx on public.benefits (card_id);
create index if not exists benefits_benefit_code_idx on public.benefits (benefit_code);
create index if not exists benefits_benefit_hash_idx on public.benefits (benefit_hash);
create index if not exists benefits_cadence_idx on public.benefits (cadence);
create index if not exists benefits_track_in_memento_idx on public.benefits (track_in_memento);
create index if not exists benefits_last_verified_at_idx on public.benefits (last_verified_at);

comment on table public.benefits is $$
Memento benefits catalog.

cadence_v2_candidates:
- model multi-year cadence with an integer year interval plus anchor metadata
- split per-booking benefits into a dedicated redemption model when importer semantics are finalized
- move reset_timing text into structured reset metadata once canonical importer data is loaded
$$;

create table if not exists public.benefit_history (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid not null,
  card_id uuid not null,
  benefit_code text,
  benefit_name text,
  benefit_value text,
  cadence public.benefit_cadence_enum,
  reset_timing text,
  enrollment_required boolean,
  requires_setup boolean,
  track_in_memento public.track_in_memento_enum,
  source_url text,
  notes text,
  benefit_hash text,
  change_type public.benefit_change_type_enum not null,
  change_summary text,
  effective_start_date date not null,
  effective_end_date date,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint benefit_history_benefit_id_fkey
    foreign key (benefit_id) references public.benefits(id) on delete restrict,
  constraint benefit_history_card_id_fkey
    foreign key (card_id) references public.cards(id) on delete restrict,
  constraint benefit_history_benefit_code_not_blank
    check (benefit_code is null or length(btrim(benefit_code)) > 0),
  constraint benefit_history_benefit_name_not_blank
    check (benefit_name is null or length(btrim(benefit_name)) > 0),
  constraint benefit_history_benefit_value_not_blank
    check (benefit_value is null or length(btrim(benefit_value)) > 0),
  constraint benefit_history_reset_timing_not_blank
    check (reset_timing is null or length(btrim(reset_timing)) > 0),
  constraint benefit_history_source_url_not_blank
    check (source_url is null or length(btrim(source_url)) > 0),
  constraint benefit_history_benefit_hash_not_blank
    check (benefit_hash is null or length(btrim(benefit_hash)) > 0),
  constraint benefit_history_change_summary_not_blank
    check (change_summary is null or length(btrim(change_summary)) > 0),
  constraint benefit_history_effective_date_order
    check (effective_end_date is null or effective_start_date is null or effective_end_date >= effective_start_date)
);

create index if not exists benefit_history_benefit_id_idx on public.benefit_history (benefit_id);
create index if not exists benefit_history_card_id_idx on public.benefit_history (card_id);
create index if not exists benefit_history_benefit_code_idx on public.benefit_history (benefit_code);
create index if not exists benefit_history_benefit_hash_idx on public.benefit_history (benefit_hash);
create index if not exists benefit_history_change_type_idx on public.benefit_history (change_type);
create index if not exists benefit_history_verified_at_idx on public.benefit_history (verified_at desc);
create index if not exists benefit_history_effective_start_date_idx on public.benefit_history (effective_start_date);
create index if not exists benefit_history_effective_end_date_idx on public.benefit_history (effective_end_date);

do $$
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
    where tgname = 'set_benefits_updated_at'
      and tgrelid = 'public.benefits'::regclass
  ) then
    create trigger set_benefits_updated_at
    before update on public.benefits
    for each row
    execute function public.set_updated_at();
  end if;
end $$;

-- Deferred tightening after canonical Memento importer load:
-- 1. cards.card_code uniqueness can be added only after collision-free backfill is proven for all existing rows.
-- 2. cards.card_status can become not null after importer assigns approved statuses.
-- 3. cards.source_url can become not null after importer populates authoritative URLs.
-- 4. cards.issuer can become not null again after any unmapped legacy issuer rows are normalized.
-- 5. benefits.benefit_code uniqueness can be added only after collision-free backfill is proven for all existing rows.
-- 6. benefits.benefit_name can become not null after importer loads canonical benefit names.
-- 7. benefits.benefit_value can become not null only if the approved schema requires every imported benefit to carry a textual value.
-- 8. benefits.reset_timing can become not null after importer provides canonical reset timing.
-- 9. benefits.requires_setup can become not null after importer provides explicit setup semantics.
-- 10. benefits.track_in_memento can become not null after importer provides explicit tracking intent.
-- 11. benefits.source_url can become not null after importer provides authoritative benefit URLs.
-- 12. benefits.last_verified_at can become not null after importer stamps verification time.
-- 13. benefits.benefit_hash can become not null after importer computes canonical hashes.
-- 14. benefits.cadence can become not null again after legacy rows with unmapped cadence text are normalized.
