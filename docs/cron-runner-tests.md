# Cron Runner Manual Tests

These steps validate `/api/cron/run-reminders` end-to-end, including auth, happy path, dedupe, and forced advance failure behavior.

## Prerequisites

- Required env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
- Optional test-only env var:
  - `SIMULATE_ADVANCE_RACE=1` (default off; only used for Test 4)
- In Vercel, set env vars in **Project Settings -> Environment Variables**.
- Local run:
  - Start app: `npm run dev`
  - Endpoint: `http://localhost:3000/api/cron/run-reminders`
  - Local/manual calls must include `Authorization: Bearer <CRON_SECRET>`.

Use real IDs from your database for one test unit (`user_id`, `card_id`, `benefit_id`), then set them in SQL below.

```sql
-- Replace these UUIDs with real values from your DB before running tests.
-- Keeping a stable triple makes assertions easier.
\set test_user_id    '00000000-0000-0000-0000-000000000001'
\set test_card_id    '00000000-0000-0000-0000-000000000002'
\set test_benefit_id '00000000-0000-0000-0000-000000000003'
```

## Test 1 - Unauthorized

Without auth header:

```bash
curl -i http://localhost:3000/api/cron/run-reminders
```

Expected:
- HTTP `401`
- Body contains `{"error":"Unauthorized"}`

Wrong token:

```bash
curl -i http://localhost:3000/api/cron/run-reminders \
  -H "Authorization: Bearer not-the-right-secret"
```

Expected:
- HTTP `401`
- Body contains `{"error":"Unauthorized"}`

## Test 2 - Happy Path Advances Schedule

1) Seed/update one due schedule:

```sql
insert into reminder_schedules (
  user_id,
  card_id,
  benefit_id,
  enabled,
  cadence,
  timezone,
  next_send_at
)
values (
  :'test_user_id'::uuid,
  :'test_card_id'::uuid,
  :'test_benefit_id'::uuid,
  true,
  'monthly',
  'UTC',
  now() - interval '5 minutes'
)
on conflict (user_id, card_id, benefit_id)
do update set
  enabled = true,
  cadence = 'monthly',
  timezone = 'UTC',
  next_send_at = now() - interval '5 minutes',
  updated_at = now()
returning id, next_send_at;
```

2) Call cron endpoint with correct secret:

```bash
curl -sS http://localhost:3000/api/cron/run-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response shape:
- `dueCount >= 1`
- `claimed >= 1`
- `sent >= 1`
- `advanced >= 1`

3) SQL assertions:

```sql
-- Identify the target schedule.
with s as (
  select id
  from reminder_schedules
  where user_id = :'test_user_id'::uuid
    and card_id = :'test_card_id'::uuid
    and benefit_id = :'test_benefit_id'::uuid
)
select *
from reminder_send_log
where schedule_id = (select id from s)
order by created_at desc
limit 3;
```

```sql
-- Latest log for the schedule should be sent.
with s as (
  select id
  from reminder_schedules
  where user_id = :'test_user_id'::uuid
    and card_id = :'test_card_id'::uuid
    and benefit_id = :'test_benefit_id'::uuid
)
select status, dedupe_key, planned_send_at, created_at
from reminder_send_log
where schedule_id = (select id from s)
order by created_at desc
limit 1;
```

Expected:
- `status = 'sent'`
- `dedupe_key` format: `<schedule_id>:<YYYY-MM-DD>` (UTC date from `planned_send_at`)

```sql
-- Schedule should be advanced into the future.
select id, next_send_at, last_sent_at
from reminder_schedules
where user_id = :'test_user_id'::uuid
  and card_id = :'test_card_id'::uuid
  and benefit_id = :'test_benefit_id'::uuid;
```

Expected:
- `next_send_at > now()`
- `last_sent_at` is not null
- Monthly advancement preserves time-of-day and clamps day-of-month in UTC.

## Test 3 - Idempotency / Dedupe

This test verifies unique `dedupe_key` behavior directly.

1) Get the schedule id and latest planned timestamp:

```sql
with s as (
  select id
  from reminder_schedules
  where user_id = :'test_user_id'::uuid
    and card_id = :'test_card_id'::uuid
    and benefit_id = :'test_benefit_id'::uuid
)
select
  (select id from s) as schedule_id,
  (
    select planned_send_at
    from reminder_send_log
    where schedule_id = (select id from s)
    order by created_at desc
    limit 1
  ) as planned_send_at;
```

2) Force the schedule back to that exact planned timestamp so the next run reuses the same dedupe key:

```sql
with s as (
  select id
  from reminder_schedules
  where user_id = :'test_user_id'::uuid
    and card_id = :'test_card_id'::uuid
    and benefit_id = :'test_benefit_id'::uuid
),
latest as (
  select planned_send_at
  from reminder_send_log
  where schedule_id = (select id from s)
  order by created_at desc
  limit 1
)
update reminder_schedules
set next_send_at = (select planned_send_at from latest),
    updated_at = now()
where id = (select id from s);
```

3) Call endpoint twice back-to-back:

```bash
curl -sS http://localhost:3000/api/cron/run-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
curl -sS http://localhost:3000/api/cron/run-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- At least one response reports `deduped >= 1`
- `processedCount = claimed + deduped`

4) SQL assertions:

```sql
with s as (
  select id
  from reminder_schedules
  where user_id = :'test_user_id'::uuid
    and card_id = :'test_card_id'::uuid
    and benefit_id = :'test_benefit_id'::uuid
),
target_date as (
  select to_char(planned_send_at at time zone 'UTC', 'YYYY-MM-DD') as utc_day
  from reminder_send_log
  where schedule_id = (select id from s)
  order by created_at desc
  limit 1
)
select count(*) as rows_for_same_dedupe_key
from reminder_send_log
where dedupe_key = ((select id::text from s) || ':' || (select utc_day from target_date));
```

Expected:
- `rows_for_same_dedupe_key = 1`
- Schedule was only advanced once for that dedupe date.

## Test 4 - Force Advance Failure -> Log Becomes FAILED (Most Important)

This uses the built-in dev-only toggle in the route:
- Set `SIMULATE_ADVANCE_RACE=1`
- Keep default off otherwise.

Behavior of the toggle:
- After the log row is marked `sent`, it intentionally changes `reminder_schedules.next_send_at`.
- The guarded update (`.eq("next_send_at", schedule.next_send_at)`) then updates 0 rows.
- The same log row is rewritten to `status='failed'` with `error` starting `advance_failed:`.

1) Start local dev with race simulation enabled:

```bash
SIMULATE_ADVANCE_RACE=1 npm run dev
```

2) Prepare one due schedule:

```sql
insert into reminder_schedules (
  user_id,
  card_id,
  benefit_id,
  enabled,
  cadence,
  timezone,
  next_send_at
)
values (
  :'test_user_id'::uuid,
  :'test_card_id'::uuid,
  :'test_benefit_id'::uuid,
  true,
  'monthly',
  'UTC',
  now() - interval '5 minutes'
)
on conflict (user_id, card_id, benefit_id)
do update set
  enabled = true,
  cadence = 'monthly',
  timezone = 'UTC',
  next_send_at = now() - interval '5 minutes',
  updated_at = now();
```

3) Call endpoint:

```bash
curl -sS http://localhost:3000/api/cron/run-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response shape:
- `claimed >= 1`
- `sent >= 1` (it was initially marked sent)
- `advanced = 0` for the simulated row

4) SQL assertion for failed rewrite:

```sql
with s as (
  select id
  from reminder_schedules
  where user_id = :'test_user_id'::uuid
    and card_id = :'test_card_id'::uuid
    and benefit_id = :'test_benefit_id'::uuid
)
select status, error, created_at
from reminder_send_log
where schedule_id = (select id from s)
order by created_at desc
limit 1;
```

Expected:
- `status = 'failed'`
- `error like 'advance_failed:%'`

5) Cleanup:
- Stop dev server and restart without `SIMULATE_ADVANCE_RACE`.
