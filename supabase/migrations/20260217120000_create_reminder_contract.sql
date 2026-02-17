-- Reminder idempotency contract:
-- - Claim exactly once per (schedule_id, planned_send_at)
-- - Keep schedule uniqueness at (user_id, card_id, benefit_id)
-- - Keep due-scan efficient with (enabled, next_send_at)

create extension if not exists "pgcrypto";

create table if not exists public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  enabled boolean not null default true,
  cadence text not null,
  timezone text not null default 'UTC',
  next_send_at timestamptz not null,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.reminder_schedules
  add column if not exists user_id uuid,
  add column if not exists card_id uuid,
  add column if not exists benefit_id uuid,
  add column if not exists enabled boolean,
  add column if not exists cadence text,
  add column if not exists timezone text,
  add column if not exists next_send_at timestamptz,
  add column if not exists last_sent_at timestamptz,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.reminder_schedules
set enabled = true
where enabled is null;

update public.reminder_schedules
set timezone = 'UTC'
where timezone is null;

update public.reminder_schedules
set created_at = now()
where created_at is null;

update public.reminder_schedules
set updated_at = now()
where updated_at is null;

update public.reminder_schedules
set next_send_at = now()
where next_send_at is null;

update public.reminder_schedules
set cadence = 'monthly'
where cadence is null;

alter table if exists public.reminder_schedules
  alter column enabled set default true,
  alter column enabled set not null,
  alter column cadence set not null,
  alter column timezone set default 'UTC',
  alter column timezone set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column next_send_at type timestamptz using next_send_at::timestamptz,
  alter column next_send_at set not null,
  alter column last_sent_at type timestamptz using last_sent_at::timestamptz;

do $$
begin
  begin
    alter table public.reminder_schedules
      add constraint reminder_schedules_user_card_benefit_key
      unique (user_id, card_id, benefit_id);
  exception
    when duplicate_object then null;
  end;
end
$$;

do $$
begin
  if to_regclass('public.reminder_schedules_enabled_next_send_at_idx') is null then
    create index reminder_schedules_enabled_next_send_at_idx
      on public.reminder_schedules (enabled, next_send_at);
  end if;
end
$$;

do $$
begin
  begin
    alter table public.reminder_schedules
      add constraint reminder_schedules_cadence_check
      check (cadence in ('monthly', 'quarterly', 'annual'));
  exception
    when duplicate_object then null;
  end;
end
$$;

create table if not exists public.reminder_send_log (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.reminder_schedules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  run_id uuid not null,
  planned_send_at timestamptz not null,
  status text not null default 'attempted',
  error text,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.reminder_send_log
  add column if not exists schedule_id uuid,
  add column if not exists user_id uuid,
  add column if not exists card_id uuid,
  add column if not exists benefit_id uuid,
  add column if not exists run_id uuid,
  add column if not exists planned_send_at timestamptz,
  add column if not exists status text,
  add column if not exists error text,
  add column if not exists skip_reason text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table if exists public.reminder_send_log
  alter column planned_send_at type timestamptz using planned_send_at::timestamptz,
  alter column created_at type timestamptz using created_at::timestamptz,
  alter column updated_at type timestamptz using updated_at::timestamptz;

update public.reminder_send_log
set planned_send_at = coalesce(planned_send_at, created_at, now())
where planned_send_at is null;

update public.reminder_send_log
set status = 'failed'
where status is null;

update public.reminder_send_log
set created_at = now()
where created_at is null;

update public.reminder_send_log
set updated_at = now()
where updated_at is null;

alter table if exists public.reminder_send_log
  alter column planned_send_at set not null,
  alter column status set default 'attempted',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  begin
    alter table public.reminder_send_log
      add constraint reminder_send_log_status_check
      check (status in ('attempted', 'sent', 'failed', 'skipped'));
  exception
    when duplicate_object then null;
  end;
end
$$;

-- Remove duplicate claims before enforcing one-row-per-(schedule_id, planned_send_at).
with ranked as (
  select
    id,
    row_number() over (
      partition by schedule_id, planned_send_at
      order by created_at asc, id asc
    ) as rn
  from public.reminder_send_log
)
delete from public.reminder_send_log l
using ranked r
where l.id = r.id
  and r.rn > 1;

do $$
begin
  begin
    alter table public.reminder_send_log
      add constraint reminder_send_log_schedule_planned_key
      unique (schedule_id, planned_send_at);
  exception
    when duplicate_object then null;
  end;
end
$$;

do $$
begin
  if to_regclass('public.reminder_send_log_planned_send_at_idx') is null then
    create index reminder_send_log_planned_send_at_idx
      on public.reminder_send_log (planned_send_at);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.reminder_send_log_schedule_id_idx') is null then
    create index reminder_send_log_schedule_id_idx
      on public.reminder_send_log (schedule_id);
  end if;
end
$$;
