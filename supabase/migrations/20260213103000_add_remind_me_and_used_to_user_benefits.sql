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
