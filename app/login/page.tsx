"use client";

import { useCallback, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const signInWithGoogle = useCallback(async () => {
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
  }, [supabase]);

  useEffect(() => {
    void signInWithGoogle();
  }, [signInWithGoogle]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-gray-600">Redirecting to Google sign-in...</p>
    </main>
  );
}
