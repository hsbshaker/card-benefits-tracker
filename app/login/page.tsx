"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
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
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-black text-white py-3 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
