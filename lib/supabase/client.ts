import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    const missing = [!url ? "NEXT_PUBLIC_SUPABASE_URL" : null, !anon ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Missing required Supabase env vars: ${missing}. Redeploy after setting env vars.`);
  }

  browserClient = createBrowserClient(url, anon, {
    auth: { flowType: "pkce" },
  });

  return browserClient;
}
