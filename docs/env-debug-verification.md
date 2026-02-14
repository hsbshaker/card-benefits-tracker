# Env Debug Verification

1. After deploy, verify the debug route returns JSON (not HTML):

```bash
curl -i "https://<prod-domain>/api/debug/env" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- `HTTP/1.1 200`
- `content-type: application/json`
- `nextPublicSupabaseUrlPresent: true`
- `nextPublicSupabaseAnonKeyPresent: true`

2. Temporarily remove `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Vercel env and redeploy:
- `/api/debug/env` shows `nextPublicSupabaseAnonKeyPresent: false`
- The app should not fail at module-import time; auth flows should fail only when Supabase client creation is attempted in-browser.

3. Dev/non-production banner check:
- In development or non-production client env, missing browser env vars should show the on-page env warning banner without exposing secrets.
