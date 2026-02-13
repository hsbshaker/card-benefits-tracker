"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
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


export default function LandingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      setUser(currentUser ?? null);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signInWithGoogle() {
    setIsSigningIn(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/build-your-lineup`,
      },
    });

    if (error) {
      setIsSigningIn(false);
      alert(error.message);
    }
  }

  async function signOut() {
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
    <AppShell>
      <div aria-hidden className="h-9" />

      <section className="pt-12 md:pt-14">
        <div className="max-w-3xl">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-5xl font-semibold tracking-tight md:text-6xl md:leading-tight"
          >
            Stop leaving credit card benefits on the table.
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-4 text-lg leading-relaxed text-white/70 md:text-xl"
          >
            Track statement credits, free nights, airline fees, and renewal dates in one clean dashboard. We preload what
            you’re likely to have — you confirm what applies, and we keep you on track.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-7 flex flex-col gap-3"
          >
            {user === undefined ? (
              <div aria-hidden className="h-[3.5rem] w-[14.5rem] opacity-0" />
            ) : user ? (
              <Link href="/onboarding/benefits">
                <Button size="lg" className="group">
                  Enter Viero
                  <span className="text-[#08111F]/70 transition group-hover:text-[#08111F]">→</span>
                </Button>
              </Link>
            ) : (
              <Button onClick={signInWithGoogle} disabled={isSigningIn} size="lg" className="group">
                Continue with Google
                <span className="text-[#08111F]/70 transition group-hover:text-[#08111F]">→</span>
              </Button>
            )}

            {user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={isSigningOut}
                className="w-fit text-sm text-white/70 underline-offset-4 transition hover:text-white/90 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220] disabled:cursor-not-allowed disabled:text-white/45"
              >
                Not {firstName}? Sign-Out
              </button>
            ) : null}
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

      <footer className="mt-10 border-t border-white/10 py-6 text-sm text-white/55">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Card Benefits Tracker</span>
          <div className="flex gap-5">
            <Link href="/terms" className="transition-colors hover:text-white/80">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white/80">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
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
    <Surface variant="card" className="group relative flex h-full flex-col items-center p-6 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#7FB6FF]/15 text-[#7FB6FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors duration-300 group-hover:border-[#F7C948]/35 group-hover:bg-[#F7C948]/20 group-hover:text-[#F7C948]">
        {icon}
      </span>

      <div className="mt-6 space-y-2.5">
        <div className="text-lg font-bold leading-tight text-white/95">{title}</div>
        <div className="text-sm leading-relaxed text-white/65">{body}</div>
      </div>
    </Surface>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
      <path d="M12 2l8 4v6c0 5.2-3.4 9.9-8 10-4.6-.1-8-4.8-8-10V6l8-4z" />
      <path
        d="M8.5 12.5l2.2 2.2 4.8-5.1"
        className="stroke-[#0B1220] stroke-[2.2]"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconFree() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
      <path d="M20.6 13.4l-7.2 7.2c-.8.8-2 .8-2.8 0L3 13V4h9l8.6 9.4z" />
      <circle cx="7.5" cy="7.5" r="1.5" className="fill-[#0B1220]" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
      <path d="M4 7.5C4 6.1 5.1 5 6.5 5H18c1.1 0 2 .9 2 2v1H7.2c-1.8 0-3.2 1.4-3.2 3.2V7.5z" />
      <path
        d="M20 10v7c0 1.1-.9 2-2 2H6.5C5.1 19 4 17.9 4 16.5V12.2C4 10.4 5.4 9 7.2 9H20z"
        opacity="0.85"
      />
      <circle cx="16.5" cy="14" r="1" className="fill-[#0B1220]" />
    </svg>
  );
}
