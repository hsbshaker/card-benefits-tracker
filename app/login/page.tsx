"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/cards`,
      },
    });

    if (error) {
      setLoading(false);
      alert(error.message);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6">
        <h1 className="text-xl font-semibold">Card Benefits Tracker</h1>
        <p className="text-sm text-gray-600 mt-2">
          Sign in with Google to continue
        </p>

        <button
  type="button"
  onClick={signInWithGoogle}
  disabled={loading}
  className="mt-6 w-full rounded-xl bg-black text-white py-3 text-sm font-medium disabled:opacity-60"
>
  {loading ? "Signing in with Google..." : "Continue with Google"}
</button>



      </div>
    </main>
  );
}
