"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

type AccountSectionProps = {
  email: string | null;
};

export function AccountSection({ email }: AccountSectionProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    const supabase = createSupabaseBrowserClient();
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setIsSigningOut(false);
      return;
    }

    window.location.assign("/");
  };

  return (
    <Surface className="rounded-[1.75rem] border-white/12 bg-white/6 p-5 sm:p-6">
      <p className="text-xs font-medium tracking-[0.22em] text-white/42 uppercase">Account</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-white/56">Signed in as</p>
          <p className="mt-1 text-base font-semibold text-white">{email ?? "Unknown email"}</p>
        </div>
        <Button variant="secondary" onClick={() => void handleSignOut()} disabled={isSigningOut}>
          {isSigningOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    </Surface>
  );
}
