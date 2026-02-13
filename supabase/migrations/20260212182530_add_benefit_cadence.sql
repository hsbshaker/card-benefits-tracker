-- Add normalized cadence fields for benefit definitions.
alter table if exists public.benefits
  add column if not exists cadence text,
  add column if not exists cadence_detail jsonb;

-- Backfill cadence from legacy frequency values where needed.
update public.benefits
set cadence = case frequency
  when 'monthly' then 'monthly'
  when 'quarterly' then 'quarterly'
  when 'semiannual' then 'semi_annual'
  when 'annual' then 'annual'
  when 'activation' then 'one_time'
  when 'multi_year' then 'annual'
  else 'annual'
end
where cadence is null;

alter table if exists public.benefits
  alter column cadence set default 'annual',
  alter column cadence set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'benefits_cadence_check'
      and conrelid = 'public.benefits'::regclass
  ) then
    alter table public.benefits
      add constraint benefits_cadence_check
      check (cadence in ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time'));
  end if;
end $$;
