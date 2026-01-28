-- Migration: normalize cards fields and remove redundant uniqueness constraint
-- This migration is idempotent and safe to run multiple times.

-- Drop redundant case-sensitive uniqueness constraint (case-insensitive index is source of truth).
DO $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cards_issuer_card_name_unique'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards drop constraint cards_issuer_card_name_unique;
  end if;
end $$;

-- Normalize cards fields before insert/update to avoid whitespace/casing issues.
create or replace function public.normalize_cards_fields()
returns trigger
language plpgsql
as $$
begin
  new.issuer = trim(new.issuer);
  new.brand = case when new.brand is null then null else trim(new.brand) end;
  new.card_name = trim(new.card_name);
  new.network = trim(new.network);

  case lower(new.network)
    when 'visa' then new.network := 'Visa';
    when 'mastercard' then new.network := 'Mastercard';
    when 'master card' then new.network := 'Mastercard';
    when 'mc' then new.network := 'Mastercard';
    when 'amex' then new.network := 'Amex';
    when 'american express' then new.network := 'Amex';
    when 'discover' then new.network := 'Discover';
    else
      new.network := initcap(new.network);
  end case;

  return new;
end;
$$;

DO $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'normalize_cards_fields'
      and tgrelid = 'public.cards'::regclass
  ) then
    create trigger normalize_cards_fields
      before insert or update on public.cards
      for each row
      execute function public.normalize_cards_fields();
  end if;
end $$;
