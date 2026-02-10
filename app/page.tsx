"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", delay },
  }),
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white selection:bg-[#F7C948]/30 selection:text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#7FB6FF]/20 blur-3xl" />
        <div className="absolute top-[320px] right-[-120px] h-[460px] w-[460px] rounded-full bg-[#F7C948]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/" className="group inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7FB6FF] shadow-[0_0_20px_3px_rgba(127,182,255,0.55)]" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-white/90 group-hover:text-white transition-colors">
              Card Benefits Tracker
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 transition"
            >
              See it in action
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-[#7FB6FF] px-4 py-2 text-sm font-semibold text-[#08111F] shadow-[0_10px_35px_-15px_rgba(127,182,255,0.7)] hover:brightness-110 active:brightness-95 transition"
            >
              Continue with Google
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="pt-12 md:pt-14">
          <div className="max-w-3xl">
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.08}
              className="text-5xl font-semibold tracking-tight md:text-6xl md:leading-tight"
            >
              Stop leaving credit card benefits on the table.
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.16}
              className="mt-4 text-lg leading-relaxed text-white/70 md:text-xl"
            >
              Track statement credits, free nights, airline fees, and renewal dates in one clean dashboard.
              We preload what you’re likely to have — you confirm what applies, and we keep you on track.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.24}
              className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7FB6FF] px-7 py-3.5 text-base font-semibold text-[#08111F] shadow-[0_16px_45px_-18px_rgba(127,182,255,0.75)] hover:brightness-110 active:brightness-95 transition"
              >
                Sign in with Google
                <span className="text-[#08111F]/70 group-hover:text-[#08111F] transition">→</span>
              </Link>

              <a
                href="#"
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-7 py-3.5 text-base font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 transition"
              >
                How it works
              </a>
            </motion.div>
          </div>
        </section>

        <section className="mt-10">
          {/* Trust tiles */}
          <div className="grid gap-4 md:grid-cols-3">
            <TrustCard
              title="Free forever — seriously."
              body="No subscriptions, no paywalls — this stays free."
              icon={<IconSpark />}
            />
            <TrustCard
              title="No bank logins, no credit card numbers"
              body="We’ll never ask you to connect bank accounts or enter card numbers."
              icon={<IconShield />}
            />
            <TrustCard
              title="Self-entered, fully in your control"
              body="You pick the cards you have; we track benefits, deadlines, and reminders."
              icon={<IconWallet />}
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-white/10 py-6 text-sm text-white/55">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <span>© {new Date().getFullYear()} Card Benefits Tracker</span>
            <div className="flex gap-5">
              <Link href="/terms" className="hover:text-white/80 transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white/80 transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ---------------- UI components ---------------- */

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
    <div className="group relative flex h-full flex-col items-center rounded-3xl border border-white/15 bg-white/8 p-6 text-center shadow-[0_16px_40px_-28px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-300 hover:border-[#F7C948]/40 hover:bg-[#F7C948]/10 hover:shadow-[0_24px_60px_-34px_rgba(247,201,72,0.5)]">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#7FB6FF]/15 text-[#7FB6FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors duration-300 group-hover:border-[#F7C948]/35 group-hover:bg-[#F7C948]/20 group-hover:text-[#F7C948]">
          {icon}
      </span>

      <div className="mt-6 space-y-2.5">
        <div className="text-lg font-bold leading-tight text-white/95">{title}</div>
        <div className="text-sm leading-relaxed text-white/65">{body}</div>
      </div>
    </div>
  );
}

/* ---------------- Icons (inline SVG) ---------------- */

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
      <path d="M12 2l1.2 6.2L20 12l-6.8 3.8L12 22l-1.2-6.2L4 12l6.8-3.8L12 2z" />
    </svg>
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
