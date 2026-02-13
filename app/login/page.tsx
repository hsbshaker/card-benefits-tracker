"use client";

import { useCallback, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  const signInWithGoogle = useCallback(async () => {
    const supabase = createClient();
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
