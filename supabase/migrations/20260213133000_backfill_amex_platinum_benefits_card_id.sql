-- Backfill orphaned Amex Platinum benefits where card_id is NULL.
-- Card id: American Express Platinum = 70170d8e-97c7-42d0-8603-3ad1a71c2473

begin;

update public.benefits
set card_id = '70170d8e-97c7-42d0-8603-3ad1a71c2473'::uuid
where card_id is null;

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
