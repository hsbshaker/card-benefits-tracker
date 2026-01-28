-- Migration: normalize cards fields + remove redundant constraint

-- Drop the redundant case-sensitive uniqueness constraint if it exists
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

-- Normalize/trim cards fields; canonicalize network aliases to match CHECK constraint
create or replace function public.normalize_cards_fields()
returns trigger
language plpgsql
as $$
begin
  new.issuer := trim(new.issuer);
  new.brand := case when new.brand is null then null else nullif(trim(new.brand), '') end;
  new.card_name := trim(new.card_name);
  new.network := trim(new.network);

  -- Canonicalize network values
  if lower(new.network) in ('visa') then
    new.network := 'Visa';
  elsif lower(new.network) in ('mastercard', 'master card', 'mc') then
    new.network := 'Mastercard';
  elsif lower(new.network) in ('amex', 'american express') then
    new.network := 'Amex';
  elsif lower(new.network) in ('discover') then
    new.network := 'Discover';
  end if;

  return new;
end;
$$;

DO $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'normalize_cards_fields_trigger'
      and tgrelid = 'public.cards'::regclass
  ) then
    create trigger normalize_cards_fields_trigger
    before insert or update on public.cards
    for each row
    execute function public.normalize_cards_fields();
  end if;
end $$;
