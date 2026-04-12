"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export function PublicLandingPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [envError, setEnvError] = useState<string | null>(null);
  const shouldShowEnvBanner =
    process.env.NODE_ENV !== "production" ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV != null && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production");

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const run = async () => {
      let supabase;
      try {
        supabase = createSupabaseBrowserClient();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Missing Supabase browser environment variables.";
        if (!isMounted) return;
        setEnvError(message);
        setUser(null);
        return;
      }

      if (!supabase || !isMounted) return;

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      setUser(currentUser ?? null);
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      });

      unsubscribe = () => subscription.unsubscribe();
    };

    void run();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  async function signInWithGoogle() {
    if (isSigningIn) return;

    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Missing Supabase browser environment variables.";
      setEnvError(message);
      return;
    }

    if (!supabase) return;

    setIsSigningIn(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    if (process.env.NODE_ENV !== "production") {
      console.info("[landing] OAuth redirect diagnostics", {
        windowOrigin: window.location.origin,
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
      setIsSigningIn(false);
      alert(error.message);
    }
  }

  async function signOut() {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Missing Supabase browser environment variables.";
      setEnvError(message);
      return;
    }

    if (!supabase) return;

    if (isSigningOut) return;
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setIsSigningOut(false);
      alert(error.message);
      return;
    }

    setUser(null);
    setIsSigningOut(false);
    window.location.assign("/");
  }

  function getFirstName(currentUser: User | null | undefined) {
    if (!currentUser) return "there";

    const metadata = (currentUser.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
    if (fullName) return fullName.split(/\s+/)[0];

    const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
    if (name) return name.split(/\s+/)[0];

    const emailPrefix = typeof currentUser.email === "string" ? currentUser.email.split("@")[0] : "";
    if (emailPrefix) return emailPrefix;

    return "there";
  }

  const firstName = getFirstName(user);

  return (
    <AppShell className="overflow-x-hidden">
      <div aria-hidden className="h-9" />
      {shouldShowEnvBanner && envError ? (
        <div className="mb-3 rounded-lg border border-amber-400/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          Env warning: {envError}
        </div>
      ) : null}

      <section className="px-4 pt-10 md:px-0 md:pt-14">
        <div className="min-w-0 max-w-[22rem] sm:max-w-md md:max-w-3xl">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl md:leading-tight"
          >
            Stop leaving credit card benefits on the table.
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-4 max-w-[26rem] text-base leading-7 text-white/70 md:text-xl md:leading-relaxed"
          >
            Track statement credits, free nights, airline fees, and renewal dates in one clean dashboard. We preload what
            you’re likely to have — you confirm what applies, and we keep you on track.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:items-center"
          >
            {user === undefined ? (
              <div aria-hidden className="h-12 w-full sm:w-[13.5rem] opacity-0" />
            ) : user ? (
              <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Link href="/onboarding/benefits" className="w-full sm:w-auto">
                  <Button size="md" className="group h-12 w-full sm:w-auto">
                    Welcome back, {firstName}
                  </Button>
                </Link>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={isSigningOut}
                  className="text-left text-sm text-white/70 underline-offset-4 transition hover:text-white/90 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220] disabled:cursor-not-allowed disabled:text-white/45"
                >
                  Not you? Sign-Out
                </button>
              </div>
            ) : (
              <Button
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                size="md"
                className="group h-12 w-full shadow-[0_10px_35px_-18px_rgba(127,182,255,0.7)] sm:w-auto"
              >
                <svg viewBox="0 0 18 18" aria-hidden="true" className="h-4 w-4">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.796 2.7164v2.2582h2.9087c1.7018-1.5664 2.6837-3.8746 2.6837-6.6155z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.4673-.8055 5.9563-2.1791l-2.9087-2.2582c-.8055.54-1.8368.8591-3.0476.8591-2.3441 0-4.3282-1.5832-5.0359-3.7091H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.9641 10.7127c-.18-.54-.2823-1.1168-.2823-1.7127s.1023-1.1727.2823-1.7127V4.9555H.9573C.3477 6.1705 0 7.5436 0 9s.3477 2.8295.9573 4.0445l3.0068-2.3318z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.5782c1.3214 0 2.5077.4541 3.4405 1.3459l2.5809-2.5809C13.4636.8918 11.4264 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9555l3.0068 2.3318C4.6718 5.1614 6.6559 3.5782 9 3.5782z"
                  />
                </svg>
                Continue with Google
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      <section className="mt-10">
        <div className="grid gap-4 md:grid-cols-3">
          <TrustCard
            title="No bank logins, no card details."
            body="We'll never connect to your bank or ask for your credit card details."
            icon={<IconShield />}
          />
          <TrustCard
            title="You stay in control."
            body="Simply select the cards you own and we'll track your benefits and deadlines."
            icon={<IconWallet />}
          />
          <TrustCard title="Free forever — seriously." body="No subscriptions. No trials. No paywalls." icon={<IconFree />} />
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <Surface className="p-6 md:p-7">
          <p className="text-sm text-white/55">How it works</p>
          <ol className="mt-4 space-y-5">
            <Step number="1" title="Pick your cards">
              Search from our growing catalog of cards and select the ones you have in your wallet.
            </Step>
            <Step number="2" title="Confirm your benefits">
              We preload the statement credits, free nights, and perks that likely apply to you.
            </Step>
            <Step number="3" title="Stay ahead of deadlines">
              We'll keep your benefit windows visible and remind you before value expires.
            </Step>
          </ol>
        </Surface>

        <Surface className="p-6 md:p-7">
          <p className="text-sm text-white/55">What you can track</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
            <li>Airline fee credits</li>
            <li>Dining and travel statement credits</li>
            <li>Free night certificates</li>
            <li>Anniversary and renewal dates</li>
            <li>Lounge, rideshare, and merchant perks</li>
          </ul>
        </Surface>
      </section>
    </AppShell>
  );
}

function TrustCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <Surface className="h-full p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-white/85">{icon}</div>
        <p className="text-base font-semibold tracking-tight">{title}</p>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/65">{body}</p>
    </Surface>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-white/85">
        {number}
      </div>
      <div>
        <p className="text-base font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-sm leading-6 text-white/65">{children}</p>
      </div>
    </li>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path
        d="M10 2.2 4.2 4.6v4.1c0 3.8 2.4 6.5 5.8 8.1 3.4-1.6 5.8-4.3 5.8-8.1V4.6L10 2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m7.4 10 1.7 1.7 3.5-3.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <rect x="2.5" y="4" width="15" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 10h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13.5" cy="10" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconFree() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path
        d="M10 2.5 12 6.6l4.5.6-3.3 3.2.8 4.6L10 12.8 6 15l.8-4.6L3.5 7.2 8 6.6 10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
