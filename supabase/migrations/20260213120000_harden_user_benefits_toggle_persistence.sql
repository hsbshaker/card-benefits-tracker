-- Ensure toggle persistence columns exist with stable defaults.
alter table if exists public.user_benefits
  add column if not exists remind_me boolean default true,
  add column if not exists used boolean default false;

update public.user_benefits
set remind_me = coalesce(remind_me, true),
    used = coalesce(used, false)
where remind_me is null
   or used is null;

alter table if exists public.user_benefits
  alter column remind_me set default true,
  alter column used set default false,
  alter column remind_me set not null,
  alter column used set not null;

-- Ensure upsert target exists for onConflict: user_id,benefit_id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'user_benefits'
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 2
      and (
        select string_agg(a.attname, ',' order by u.ord)
        from unnest(c.conkey) with ordinality as u(attnum, ord)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = u.attnum
      ) = 'user_id,benefit_id'
  ) then
    alter table public.user_benefits
      add constraint user_benefits_user_id_benefit_id_key unique (user_id, benefit_id);
  end if;
end $$;

-- Ensure RLS is enabled and authenticated users can only access their own rows.
alter table if exists public.user_benefits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_select_own'
  ) then
    create policy user_benefits_select_own
      on public.user_benefits
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_insert_own'
  ) then
    create policy user_benefits_insert_own
      on public.user_benefits
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_benefits' and policyname='user_benefits_update_own'
  ) then
    create policy user_benefits_update_own
      on public.user_benefits
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
