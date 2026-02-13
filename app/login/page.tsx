"use client";

import { useCallback, useEffect } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const signInWithGoogle = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
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
      alert(error.message);
    }
  }, []);

  useEffect(() => {
    void signInWithGoogle();
  }, [signInWithGoogle]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-gray-600">Redirecting to Google sign-in...</p>
    </main>
  );
}
