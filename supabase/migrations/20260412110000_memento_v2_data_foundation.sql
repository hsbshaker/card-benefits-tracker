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

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  global_reminder_style text not null default 'balanced',
  notifications_enabled boolean not null default false,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.user_profiles
  add column if not exists global_reminder_style text,
  add column if not exists notifications_enabled boolean,
  add column if not exists timezone text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.user_profiles
set global_reminder_style = coalesce(global_reminder_style, 'balanced'),
    notifications_enabled = coalesce(notifications_enabled, false),
    timezone = coalesce(timezone, 'America/New_York'),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where global_reminder_style is null
   or notifications_enabled is null
   or timezone is null
   or created_at is null
   or updated_at is null;

alter table if exists public.user_profiles
  alter column global_reminder_style set default 'balanced',
  alter column global_reminder_style set not null,
  alter column notifications_enabled set default false,
  alter column notifications_enabled set not null,
  alter column timezone set default 'America/New_York',
  alter column timezone set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_global_reminder_style_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_global_reminder_style_check
      check (global_reminder_style in ('balanced', 'earlier', 'minimal'));
  end if;
end $$;

alter table if exists public.user_cards
  add column if not exists added_at timestamptz,
  add column if not exists card_anniversary_date date,
  add column if not exists status text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.user_cards
set added_at = coalesce(added_at, created_at, now()),
    status = coalesce(status, 'active'),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where added_at is null
   or status is null
   or created_at is null
   or updated_at is null;

alter table if exists public.user_cards
  alter column added_at set default now(),
  alter column added_at set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
declare
  duplicate_constraint_name text;
begin
  select c.conname
  into duplicate_constraint_name
  from pg_constraint c
  where c.conrelid = 'public.user_cards'::regclass
    and c.contype = 'u'
    and (
      select string_agg(a.attname, ',' order by cols.ord)
      from unnest(c.conkey) with ordinality as cols(attnum, ord)
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = cols.attnum
    ) = 'user_id,card_id'
  limit 1;

  if duplicate_constraint_name is not null then
    execute format('alter table public.user_cards drop constraint %I', duplicate_constraint_name);
  end if;
end $$;

drop index if exists public.user_cards_user_id_card_id_unique;
drop index if exists public.user_cards_user_id_card_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_cards_status_check'
      and conrelid = 'public.user_cards'::regclass
  ) then
    alter table public.user_cards
      add constraint user_cards_status_check
      check (status in ('active', 'removed'));
  end if;
end $$;

create temporary table _memento_user_benefits_stage (
  existing_id uuid,
  legacy_user_id uuid,
  legacy_user_card_id uuid,
  legacy_card_id uuid,
  benefit_id uuid,
  is_active boolean,
  is_used_this_period boolean,
  last_used_at timestamptz,
  reminder_override text,
  conditional_value text,
  snoozed_until timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) on commit drop;

do $$
begin
  if to_regclass('public.user_benefits') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_benefits'
      and column_name = 'user_card_id'
  ) then
    execute $sql$
      insert into _memento_user_benefits_stage (
        existing_id,
        legacy_user_id,
        legacy_user_card_id,
        legacy_card_id,
        benefit_id,
        is_active,
        is_used_this_period,
        last_used_at,
        reminder_override,
        conditional_value,
        snoozed_until,
        created_at,
        updated_at
      )
      select
        id,
        null,
        user_card_id,
        null,
        benefit_id,
        is_active,
        is_used_this_period,
        last_used_at,
        reminder_override,
        conditional_value,
        snoozed_until,
        created_at,
        updated_at
      from public.user_benefits
    $sql$;
  else
    execute $sql$
      insert into _memento_user_benefits_stage (
        existing_id,
        legacy_user_id,
        legacy_user_card_id,
        legacy_card_id,
        benefit_id,
        is_active,
        is_used_this_period,
        last_used_at,
        reminder_override,
        conditional_value,
        snoozed_until,
        created_at,
        updated_at
      )
      select
        ub.id,
        ub.user_id,
        null,
        b.card_id,
        ub.benefit_id,
        coalesce(ub.is_enabled, true),
        coalesce(ub.used, false),
        latest_usage.last_used_at,
        null,
        ub.selection_value,
        null,
        ub.created_at,
        ub.updated_at
      from public.user_benefits ub
      left join public.benefits b
        on b.id = ub.benefit_id
      left join lateral (
        select max(ups.used_at) as last_used_at
        from public.user_benefit_period_status ups
        where ups.user_id = ub.user_id
          and ups.benefit_id = ub.benefit_id
          and ups.is_used = true
      ) latest_usage on true
    $sql$;
  end if;
end $$;

create temporary table _memento_benefit_reminders_stage (
  existing_id uuid,
  user_benefit_id uuid,
  legacy_user_id uuid,
  legacy_card_id uuid,
  legacy_benefit_id uuid,
  scheduled_for timestamptz,
  delivered_at timestamptz,
  dismissed_at timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz
) on commit drop;

do $$
begin
  if to_regclass('public.benefit_reminders') is not null then
    execute $sql$
      insert into _memento_benefit_reminders_stage (
        existing_id,
        user_benefit_id,
        legacy_user_id,
        legacy_card_id,
        legacy_benefit_id,
        scheduled_for,
        delivered_at,
        dismissed_at,
        status,
        created_at,
        updated_at
      )
      select
        id,
        user_benefit_id,
        null,
        null,
        null,
        scheduled_for,
        delivered_at,
        dismissed_at,
        status,
        created_at,
        updated_at
      from public.benefit_reminders
    $sql$;
  elsif to_regclass('public.reminder_schedules') is not null then
    -- Legacy reminder rows were card/benefit based; map them onto user_benefits after the new table exists.
    execute $sql$
      insert into _memento_benefit_reminders_stage (
        existing_id,
        user_benefit_id,
        legacy_user_id,
        legacy_card_id,
        legacy_benefit_id,
        scheduled_for,
        delivered_at,
        dismissed_at,
        status,
        created_at,
        updated_at
      )
      select
        rs.id,
        null,
        rs.user_id,
        rs.card_id,
        rs.benefit_id,
        rs.next_send_at,
        rs.last_sent_at,
        null,
        case
          when rs.enabled then 'scheduled'
          else 'cancelled'
        end,
        rs.created_at,
        rs.updated_at
      from public.reminder_schedules rs
    $sql$;
  end if;
end $$;

drop table if exists public.benefit_reminders cascade;
drop table if exists public.user_benefits cascade;

do $$
begin
  if to_regclass('public.user_benefit_period_status') is not null then
    comment on table public.user_benefit_period_status is
      'Legacy transition table kept temporarily for runtime compatibility. Do not drop until app reads and writes are migrated.';
  end if;

  if to_regclass('public.reminder_schedules') is not null then
    comment on table public.reminder_schedules is
      'Legacy transition table kept temporarily for reminder cron compatibility. Do not drop until runtime references are removed.';
  end if;

  if to_regclass('public.reminder_send_log') is not null then
    comment on table public.reminder_send_log is
      'Legacy transition table kept temporarily for reminder cron compatibility. Do not drop until runtime references are removed.';
  end if;
end $$;

create table if not exists public.user_benefits (
  id uuid primary key default gen_random_uuid(),
  user_card_id uuid not null references public.user_cards(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  is_active boolean not null default true,
  is_used_this_period boolean not null default false,
  last_used_at timestamptz,
  reminder_override text,
  conditional_value text,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_benefits_user_card_id_benefit_id_key unique (user_card_id, benefit_id),
  constraint user_benefits_reminder_override_check
    check (reminder_override is null or reminder_override in ('balanced', 'earlier', 'minimal'))
);

create table if not exists public.benefit_reminders (
  id uuid primary key default gen_random_uuid(),
  user_benefit_id uuid not null references public.user_benefits(id) on delete cascade,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  dismissed_at timestamptz,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benefit_reminders_status_check
    check (status in ('scheduled', 'delivered', 'dismissed', 'cancelled'))
);

insert into public.user_benefits (
  id,
  user_card_id,
  benefit_id,
  is_active,
  is_used_this_period,
  last_used_at,
  reminder_override,
  conditional_value,
  snoozed_until,
  created_at,
  updated_at
)
select distinct on (resolved_user_card_id, stage.benefit_id)
  coalesce(stage.existing_id, gen_random_uuid()),
  resolved_user_card_id,
  stage.benefit_id,
  coalesce(stage.is_active, true),
  coalesce(stage.is_used_this_period, false),
  stage.last_used_at,
  stage.reminder_override,
  stage.conditional_value,
  stage.snoozed_until,
  coalesce(stage.created_at, now()),
  coalesce(stage.updated_at, now())
from (
  select
    s.*,
    coalesce(s.legacy_user_card_id, uc.id) as resolved_user_card_id
  from _memento_user_benefits_stage s
  left join public.user_cards uc
    on s.legacy_user_card_id is null
   and s.legacy_user_id = uc.user_id
   and s.legacy_card_id = uc.card_id
) as stage
where stage.benefit_id is not null
  and stage.resolved_user_card_id is not null;

insert into public.benefit_reminders (
  id,
  user_benefit_id,
  scheduled_for,
  delivered_at,
  dismissed_at,
  status,
  created_at,
  updated_at
)
select distinct on (resolved_user_benefit_id, stage.scheduled_for, stage.status)
  coalesce(stage.existing_id, gen_random_uuid()),
  resolved_user_benefit_id,
  stage.scheduled_for,
  stage.delivered_at,
  stage.dismissed_at,
  stage.status,
  coalesce(stage.created_at, now()),
  coalesce(stage.updated_at, now())
from (
  select
    s.*,
    coalesce(s.user_benefit_id, ub.id) as resolved_user_benefit_id
  from _memento_benefit_reminders_stage s
  left join public.user_cards uc
    on s.user_benefit_id is null
   and s.legacy_user_id = uc.user_id
   and s.legacy_card_id = uc.card_id
  left join public.user_benefits ub
    on s.user_benefit_id is null
   and ub.user_card_id = uc.id
   and ub.benefit_id = s.legacy_benefit_id
) as stage
where stage.scheduled_for is not null
  and stage.resolved_user_benefit_id is not null
  and stage.status in ('scheduled', 'delivered', 'dismissed', 'cancelled');

create index if not exists user_cards_user_id_idx on public.user_cards (user_id);
create index if not exists user_cards_card_id_idx on public.user_cards (card_id);
create index if not exists user_benefits_user_card_id_idx on public.user_benefits (user_card_id);
create index if not exists user_benefits_benefit_id_idx on public.user_benefits (benefit_id);
create index if not exists user_benefits_active_used_idx on public.user_benefits (is_active, is_used_this_period);
create index if not exists benefit_reminders_user_benefit_id_idx on public.benefit_reminders (user_benefit_id);
create index if not exists benefit_reminders_scheduled_for_idx on public.benefit_reminders (scheduled_for);
create index if not exists benefit_reminders_status_idx on public.benefit_reminders (status);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_user_profiles_updated_at'
      and tgrelid = 'public.user_profiles'::regclass
  ) then
    create trigger set_user_profiles_updated_at
    before update on public.user_profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_user_cards_updated_at'
      and tgrelid = 'public.user_cards'::regclass
  ) then
    create trigger set_user_cards_updated_at
    before update on public.user_cards
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_user_benefits_updated_at'
      and tgrelid = 'public.user_benefits'::regclass
  ) then
    create trigger set_user_benefits_updated_at
    before update on public.user_benefits
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_benefit_reminders_updated_at'
      and tgrelid = 'public.benefit_reminders'::regclass
  ) then
    create trigger set_benefit_reminders_updated_at
    before update on public.benefit_reminders
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.user_profiles enable row level security;
alter table public.user_cards enable row level security;
alter table public.user_benefits enable row level security;
alter table public.benefit_reminders enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;

create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_profiles_insert_own
  on public.user_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_profiles_update_own
  on public.user_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_cards_select_own on public.user_cards;
drop policy if exists user_cards_insert_own on public.user_cards;
drop policy if exists user_cards_update_own on public.user_cards;
drop policy if exists user_cards_delete_own on public.user_cards;

create policy user_cards_select_own
  on public.user_cards
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_cards_insert_own
  on public.user_cards
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.cards c
      where c.id = card_id
        and c.card_status::text in ('active', 'no_trackable_benefits')
    )
  );

create policy user_cards_update_own
  on public.user_cards
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.cards c
      where c.id = card_id
        and c.card_status::text in ('active', 'no_trackable_benefits')
    )
  );

create policy user_cards_delete_own
  on public.user_cards
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_benefits_select_own on public.user_benefits;
drop policy if exists user_benefits_insert_own on public.user_benefits;
drop policy if exists user_benefits_update_own on public.user_benefits;
drop policy if exists user_benefits_delete_own on public.user_benefits;

create policy user_benefits_select_own
  on public.user_benefits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_cards uc
      where uc.id = user_card_id
        and uc.user_id = auth.uid()
    )
  );

create policy user_benefits_insert_own
  on public.user_benefits
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_cards uc
      join public.benefits b on b.id = benefit_id
      where uc.id = user_card_id
        and uc.user_id = auth.uid()
        and b.track_in_memento::text = 'yes'
    )
  );

create policy user_benefits_update_own
  on public.user_benefits
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_cards uc
      where uc.id = user_card_id
        and uc.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.user_cards uc
      join public.benefits b on b.id = benefit_id
      where uc.id = user_card_id
        and uc.user_id = auth.uid()
        and b.track_in_memento::text = 'yes'
    )
  );

create policy user_benefits_delete_own
  on public.user_benefits
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_cards uc
      where uc.id = user_card_id
        and uc.user_id = auth.uid()
    )
  );

drop policy if exists benefit_reminders_select_own on public.benefit_reminders;
drop policy if exists benefit_reminders_insert_own on public.benefit_reminders;
drop policy if exists benefit_reminders_update_own on public.benefit_reminders;
drop policy if exists benefit_reminders_delete_own on public.benefit_reminders;

create policy benefit_reminders_select_own
  on public.benefit_reminders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_benefits ub
      join public.user_cards uc on uc.id = ub.user_card_id
      where ub.id = user_benefit_id
        and uc.user_id = auth.uid()
    )
  );

create policy benefit_reminders_insert_own
  on public.benefit_reminders
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_benefits ub
      join public.user_cards uc on uc.id = ub.user_card_id
      where ub.id = user_benefit_id
        and uc.user_id = auth.uid()
    )
  );

create policy benefit_reminders_update_own
  on public.benefit_reminders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_benefits ub
      join public.user_cards uc on uc.id = ub.user_card_id
      where ub.id = user_benefit_id
        and uc.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.user_benefits ub
      join public.user_cards uc on uc.id = ub.user_card_id
      where ub.id = user_benefit_id
        and uc.user_id = auth.uid()
    )
  );

create policy benefit_reminders_delete_own
  on public.benefit_reminders
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_benefits ub
      join public.user_cards uc on uc.id = ub.user_card_id
      where ub.id = user_benefit_id
        and uc.user_id = auth.uid()
    )
  );
