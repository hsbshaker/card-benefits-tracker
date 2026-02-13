"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
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
  const supabase = createClient();
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function signInWithGoogle() {
    setIsSigningIn(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/cards`,
      },
    });

    if (error) {
      setIsSigningIn(false);
      alert(error.message);
    }
  }

  return (
    <AppShell>
      <div className="flex justify-end">
        <Button onClick={signInWithGoogle} disabled={isSigningIn} size="sm" className="shadow-[0_10px_35px_-15px_rgba(127,182,255,0.7)]">
          Continue with Google
        </Button>
      </div>

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
            className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button onClick={signInWithGoogle} disabled={isSigningIn} size="lg" className="group">
              Continue with Google
              <span className="text-[#08111F]/70 transition group-hover:text-[#08111F]">→</span>
            </Button>

            <a
              href="#"
              className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-7 py-3.5 text-base font-semibold text-white/85 ring-1 ring-white/10 transition duration-200 ease-out hover:bg-white/10"
            >
              How it works
            </a>
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
