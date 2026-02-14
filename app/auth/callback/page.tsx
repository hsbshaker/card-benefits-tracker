"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const code = searchParams.get("code");
      if (!code) {
        router.replace("/auth/error?reason=oauth_callback_failed&detail=exchange_failed");
        return;
      }

      try {
        const supabase = getBrowserSupabaseClient();
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          if (!cancelled) {
            setError(exchangeError.message);
          }
          router.replace("/auth/error?reason=oauth_callback_failed&detail=exchange_failed");
          return;
        }

        router.replace("/onboarding/benefits");
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to complete sign-in";
          setError(message);
        }
        router.replace("/auth/error?reason=oauth_callback_failed&detail=exchange_failed");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-2 text-center">
        <p className="text-sm text-gray-600">Signing you in...</p>
        {error ? <p className="text-xs text-red-500/90">{error}</p> : null}
      </div>
    </main>
  );
}
