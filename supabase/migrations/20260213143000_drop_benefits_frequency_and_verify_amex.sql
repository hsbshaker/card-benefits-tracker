-- Backfill cadence from legacy frequency if needed, then remove legacy frequency.
begin;

update public.benefits
set cadence = frequency
where cadence is null
  and frequency is not null;

alter table public.benefits
  drop column if exists frequency;

commit;

-- Verification A: total benefits linked to this card.
select count(*) as benefit_count
from public.benefits
where card_id = '70170d8e-97c7-42d0-8603-3ad1a71c2473'::uuid;

-- Verification B: cadence breakdown for this card.
select
  cadence,
  count(*) as benefit_count
from public.benefits
where card_id = '70170d8e-97c7-42d0-8603-3ad1a71c2473'::uuid
group by cadence
order by cadence;
