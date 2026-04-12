-- Backfill current-period usage rows from the legacy flat used flag so
-- current-period reads can move to user_benefit_period_status.
with current_utc as (
  select timezone('UTC', now()) as now_utc
),
source_rows as (
  select
    ub.user_id,
    ub.benefit_id,
    case
      when b.cadence::text = 'monthly' then to_char(c.now_utc, 'YYYY-MM')
      when b.cadence::text = 'quarterly' then to_char(c.now_utc, 'YYYY') || '-Q' || (((extract(month from c.now_utc)::int - 1) / 3) + 1)
      when b.cadence::text in ('semi_annual', 'semiannual') then to_char(c.now_utc, 'YYYY') || '-H' || (case when extract(month from c.now_utc)::int <= 6 then 1 else 2 end)
      when b.cadence::text = 'annual' then to_char(c.now_utc, 'YYYY')
      else null
    end as period_key,
    c.now_utc as used_at
  from public.user_benefits ub
  join public.benefits b on b.id = ub.benefit_id
  cross join current_utc c
  where ub.used = true
    and b.cadence::text in ('monthly', 'quarterly', 'semi_annual', 'semiannual', 'annual')
)
insert into public.user_benefit_period_status (
  user_id,
  benefit_id,
  period_key,
  is_used,
  used_at
)
select
  user_id,
  benefit_id,
  period_key,
  true,
  used_at
from source_rows
where period_key is not null
on conflict (user_id, benefit_id, period_key)
do update
set
  is_used = excluded.is_used,
  used_at = coalesce(public.user_benefit_period_status.used_at, excluded.used_at),
  updated_at = now();
