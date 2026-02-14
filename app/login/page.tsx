"use client";

import { useCallback, useEffect } from "react";
import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [envError, setEnvError] = useState<string | null>(null);
  const shouldShowEnvBanner =
    process.env.NODE_ENV !== "production" ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV != null && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production");

  const signInWithGoogle = useCallback(async () => {
    let supabase;
    try {
      supabase = getBrowserSupabaseClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Missing Supabase browser environment variables.";
      throw new Error(message);
    }

    if (!supabase) return;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/onboarding/benefits`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Missing Supabase browser environment variables.";
        setEnvError(message);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [signInWithGoogle]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-3 text-center">
        {shouldShowEnvBanner && envError ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">Env warning: {envError}</p>
        ) : null}
        <p className="text-sm text-gray-600">Redirecting to Google sign-in...</p>
      </div>
    </main>
  );
}
