-- Master digest idempotency log (one email per user per UTC day).
create extension if not exists "pgcrypto";

create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  send_date date not null,
  dedupe_key text not null,
  status text not null default 'attempted',
  planned_send_at timestamptz not null default now(),
  subject text,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.email_send_log
  add column if not exists user_id uuid,
  add column if not exists run_id uuid,
  add column if not exists send_date date,
  add column if not exists dedupe_key text,
  add column if not exists status text,
  add column if not exists planned_send_at timestamptz,
  add column if not exists subject text,
  add column if not exists provider_message_id text,
  add column if not exists error text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.email_send_log
set planned_send_at = now()
where planned_send_at is null;

update public.email_send_log
set send_date = planned_send_at::date
where send_date is null;

update public.email_send_log
set status = 'failed'
where status is null;

update public.email_send_log
set dedupe_key = user_id::text || ':' || send_date::text
where dedupe_key is null and user_id is not null and send_date is not null;

update public.email_send_log
set created_at = now()
where created_at is null;

update public.email_send_log
set updated_at = now()
where updated_at is null;

alter table if exists public.email_send_log
  alter column user_id set not null,
  alter column run_id set not null,
  alter column send_date set not null,
  alter column dedupe_key set not null,
  alter column status set default 'attempted',
  alter column status set not null,
  alter column planned_send_at set default now(),
  alter column planned_send_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  begin
    alter table public.email_send_log
      add constraint email_send_log_status_check
      check (status in ('attempted', 'sent', 'failed', 'skipped'));
  exception
    when duplicate_object then null;
  end;
end
$$;

-- Keep the first row for each dedupe key before enforcing uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by dedupe_key
      order by created_at asc, id asc
    ) as rn
  from public.email_send_log
)
delete from public.email_send_log l
using ranked r
where l.id = r.id
  and r.rn > 1;

do $$
begin
  begin
    alter table public.email_send_log
      add constraint email_send_log_dedupe_key_key
      unique (dedupe_key);
  exception
    when duplicate_object then null;
  end;
end
$$;

do $$
begin
  if to_regclass('public.email_send_log_user_id_send_date_idx') is null then
    create index email_send_log_user_id_send_date_idx
      on public.email_send_log (user_id, send_date);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.email_send_log_planned_send_at_idx') is null then
    create index email_send_log_planned_send_at_idx
      on public.email_send_log (planned_send_at);
  end if;
end
$$;
