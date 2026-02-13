# Deploy and Cron Tests (Vercel Hobby)

## A) Vercel env vars checklist

Set these in **Vercel Project Settings -> Environment Variables** for **Production**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## B) Deploy assertions

1. Deploy with the daily cron schedule (`0 13 * * *`) in `vercel.json`.
2. Confirm deployment succeeds on Hobby (no cron frequency validation error).
3. In Vercel Project Settings, open **Cron Jobs** and confirm:
   - Path: `/api/cron/run-reminders`
   - Schedule: `0 13 * * *`

## C) Endpoint auth assertions (curl)

1. No auth header should return 401:

```bash
curl -i "https://<YOUR_DOMAIN>/api/cron/run-reminders"
```

Expected:
- `HTTP/1.1 401`

2. Wrong token returns 401:

```bash
curl -i "https://<YOUR_DOMAIN>/api/cron/run-reminders" \
  -H "Authorization: Bearer WRONG"
```

Expected:
- `HTTP/1.1 401`

3. Correct token returns 200:

```bash
curl -i "https://<YOUR_DOMAIN>/api/cron/run-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected:
- `HTTP/1.1 200`
- JSON includes `runId` and counters (`dueCount`, `claimed`, `deduped`, `sent`, `advanced`, `truncated`, `processedCount`)

## D) DB seed + happy path assertion (SQL + curl)

1. Upsert one due schedule (replace UUID placeholders with real values):

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
  '<USER_ID_UUID>'::uuid,
  '<CARD_ID_UUID>'::uuid,
  '<BENEFIT_ID_UUID>'::uuid,
  true,
  'monthly',
  'UTC',
  now() - interval '10 minutes'
)
on conflict (user_id, card_id, benefit_id)
do update set
  enabled = true,
  cadence = 'monthly',
  timezone = 'UTC',
  next_send_at = now() - interval '10 minutes',
  updated_at = now()
returning id, next_send_at;
```

2. Run endpoint with correct auth header:

```bash
curl -i "https://<YOUR_DOMAIN>/api/cron/run-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

3. SQL assertions:

```sql
-- Check latest send log row for this schedule is sent.
with s as (
  select id
  from reminder_schedules
  where user_id = '<USER_ID_UUID>'::uuid
    and card_id = '<CARD_ID_UUID>'::uuid
    and benefit_id = '<BENEFIT_ID_UUID>'::uuid
)
select status, dedupe_key, planned_send_at, created_at
from reminder_send_log
where schedule_id = (select id from s)
order by created_at desc
limit 1;
```

Expected:
- `status = 'sent'`

```sql
-- Check schedule advanced to a future next_send_at.
select id, next_send_at, last_sent_at
from reminder_schedules
where user_id = '<USER_ID_UUID>'::uuid
  and card_id = '<CARD_ID_UUID>'::uuid
  and benefit_id = '<BENEFIT_ID_UUID>'::uuid;
```

Expected:
- `next_send_at > now()`
- `last_sent_at` is not null

## E) Idempotency assertion

1. Run endpoint twice back-to-back:

```bash
curl -i "https://<YOUR_DOMAIN>/api/cron/run-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
curl -i "https://<YOUR_DOMAIN>/api/cron/run-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

2. Assert there is only one row for dedupe key `<schedule_id>:<YYYY-MM-DD>`:

```sql
with s as (
  select id
  from reminder_schedules
  where user_id = '<USER_ID_UUID>'::uuid
    and card_id = '<CARD_ID_UUID>'::uuid
    and benefit_id = '<BENEFIT_ID_UUID>'::uuid
),
target_day as (
  select to_char(planned_send_at at time zone 'UTC', 'YYYY-MM-DD') as utc_day
  from reminder_send_log
  where schedule_id = (select id from s)
  order by created_at desc
  limit 1
)
select count(*) as dedupe_rows
from reminder_send_log
where dedupe_key = ((select id::text from s) || ':' || (select utc_day from target_day));
```

Expected:
- `dedupe_rows = 1`
