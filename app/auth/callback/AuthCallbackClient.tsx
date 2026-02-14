"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type ExchangeErrorLike = {
  message?: string;
  status?: number;
  name?: string;
};

const getExchangeMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "exchange_failed";
};

const getExchangeErrorLog = (error: unknown): ExchangeErrorLike => {
  if (typeof error === "object" && error !== null) {
    return {
      message: "message" in error && typeof error.message === "string" ? error.message : undefined,
      status: "status" in error && typeof error.status === "number" ? error.status : undefined,
      name: "name" in error && typeof error.name === "string" ? error.name : undefined,
    };
  }
  return {};
};

const buildErrorRedirect = (message: string) =>
  `/auth/error?reason=oauth_callback_failed&detail=exchange_failed&msg=${encodeURIComponent(message.slice(0, 120))}`;

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      console.log("OAuth callback params:", window.location.href);
      const code = searchParams.get("code");
      console.log("code exists?", Boolean(code));

      if (!code) {
        router.replace("/auth/error?reason=oauth_callback_failed&detail=missing_code");
        return;
      }

      try {
        const supabase = getBrowserSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          const errorLog = getExchangeErrorLog(error);
          console.log("OAuth exchange error:", errorLog);
          router.replace(buildErrorRedirect(getExchangeMessage(error)));
          return;
        }

        router.replace("/onboarding/benefits");
      } catch (error) {
        const errorLog = getExchangeErrorLog(error);
        console.log("OAuth exchange thrown error:", errorLog);
        router.replace(buildErrorRedirect(getExchangeMessage(error)));
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
