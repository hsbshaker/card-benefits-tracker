"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      if (!code) {
        router.replace("/auth/error?reason=oauth_callback_failed&detail=missing_code");
        return;
      }

      try {
        const supabase = getBrowserSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          router.replace("/auth/error?reason=oauth_callback_failed&detail=exchange_failed");
          return;
        }

        router.replace("/onboarding/benefits");
      } catch {
        router.replace("/auth/error?reason=oauth_callback_failed&detail=exchange_failed");
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-2 text-center">
        <p className="text-sm text-gray-600">Signing you in...</p>
      </div>
    </main>
  );
}
