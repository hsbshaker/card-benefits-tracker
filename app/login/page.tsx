"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [envError, setEnvError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const shouldShowEnvBanner =
    process.env.NODE_ENV !== "production" ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV != null && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production");
  const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const nextPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    console.info("[login] Supabase NEXT_PUBLIC env presence", {
      hasNextPublicSupabaseUrl: Boolean(nextPublicSupabaseUrl),
      hasNextPublicSupabaseAnonKey: Boolean(nextPublicSupabaseAnonKey),
      nextPublicSupabaseUrlPrefix: nextPublicSupabaseUrl ? `${nextPublicSupabaseUrl.slice(0, 25)}...` : null,
    });
  }, [nextPublicSupabaseAnonKey, nextPublicSupabaseUrl]);

  const signInWithGoogle = useCallback(async () => {
    if (isSigningIn) return;

    let supabase;
    try {
      supabase = getBrowserSupabaseClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Missing Supabase browser environment variables.";
      setEnvError(message);
      return;
    }

    if (!supabase) return;
    setIsSigningIn(true);

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const redirectTo = `${origin}/auth/callback`;
    if (process.env.NODE_ENV !== "production") {
      console.info("[login] OAuth redirect diagnostics", {
        windowOrigin: typeof window !== "undefined" ? window.location.origin : null,
        computedOrigin: origin,
        redirectTo,
      });
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setEnvError(error.message);
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-3 text-center">
        {shouldShowEnvBanner && envError ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">Env warning: {envError}</p>
        ) : null}
        <p className="text-sm text-gray-600">Sign in to continue.</p>
        <Button onClick={() => void signInWithGoogle()} disabled={isSigningIn} size="md">
          {isSigningIn ? "Redirecting to Google..." : "Continue with Google"}
        </Button>
      </div>
    </main>
  );
}
