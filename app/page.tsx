"use client";

import type React from "react";
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

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/" className="group inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7FB6FF] shadow-[0_0_20px_3px_rgba(127,182,255,0.55)]" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-white/90 group-hover:text-white">
              Card Benefits Tracker
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#how" className="hover:text-white transition-colors">
              How it works
            </a>
            <a href="#privacy" className="hover:text-white transition-colors">
              Privacy
            </a>

            <Link
              href="/app"
              className="rounded-xl bg-[#7FB6FF] px-4 py-2 font-medium text-[#08111F] shadow-[0_10px_35px_-15px_rgba(127,182,255,0.7)] hover:brightness-110 active:brightness-95 transition"
            >
              Continue with Google
            </Link>
          </nav>

          <Link
            href="/app"
            className="md:hidden rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-white/90 ring-1 ring-white/10 hover:bg-white/10 transition"
          >
            Get started
          </Link>
        </header>

        {/* Hero */}
        <section className="pt-16 md:pt-20">
          <div className="max-w-3xl">


            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.08}
              className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Stop leaving credit card benefits on the table.
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.16}
              className="mt-4 text-base leading-relaxed text-white/70 md:text-lg"
            >
              Track statement credits, free nights, airline fees, and renewal dates in one clean dashboard. We preload the benefits you’re likely to have—you confirm what applies, and we keep you on track.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.24}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/app"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7FB6FF] px-6 py-3 text-sm font-semibold text-[#08111F] shadow-[0_16px_45px_-18px_rgba(127,182,255,0.75)] hover:brightness-110 active:brightness-95 transition"
              >
                Sign-in with Google
                <span className="text-[#08111F]/70 group-hover:text-[#08111F] transition">
                  →
                </span>
              </Link>

              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 transition"
              >
                See how it works
              </a>
            </motion.div>

            {/* Trust cards */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.32}
              className="mt-10 grid gap-3"
            >
              <TrustCard
                title="Free forever — seriously."
                body="No subscriptions, no paywalls — this stays free."
                icon={<IconSpark />}
              />

              <TrustCard
                title="No bank logins, no credit card numbers"
                body="We’ll never ask you to connect your bank accounts or enter your credit card numbers."
                icon={<IconShield />}
              />

              <TrustCard
                title="You control your wallet"
                body="You select the cards you have; we’ll track benefits, deadlines, and send you reminders."
                accent
                icon={<IconWallet />}
              />
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mt-24 scroll-mt-24">
          <SectionTitle eyebrow="How it works" title="Simple setup. Zero integrations." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StepCard
              num="1"
              title="Sign in with Google"
              body="So we can save your dashboard and preferences."
            />
            <StepCard
              num="2"
              title="Add cards manually"
              body="Search + select the cards you have. No card numbers."
            />
            <StepCard
              num="3"
              title="Confirm benefits"
              body="We preload perks; you confirm. We track deadlines + reminders."
            />
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="mt-24 scroll-mt-24">
          <SectionTitle eyebrow="Privacy" title="Designed to be low-risk by default." />

          <div className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <ul className="grid gap-3 text-sm text-white/70 md:grid-cols-2">
              <li className="flex gap-3">
                <Dot />
                <span>
                  <strong className="text-white/90">No bank access</strong> — we don’t connect to accounts.
                </span>
              </li>
              <li className="flex gap-3">
                <Dot />
                <span>
                  <strong className="text-white/90">No Plaid</strong> — nothing to link, nothing to authorize.
                </span>
              </li>
              <li className="flex gap-3">
                <Dot />
                <span>
                  <strong className="text-white/90">No card numbers</strong> — you only pick the card names.
                </span>
              </li>
              <li className="flex gap-3">
                <Dot />
                <span>
                  <strong className="text-white/90">Self-entered</strong> — you control what gets tracked.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/10 py-10 text-sm text-white/55">
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

function TrustCard({
  title,
  body,
  accent = false,
  icon,
}: {
  title: string;
  body: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur transition",
        "hover:bg-white/7 hover:ring-white/15",
        accent ? "shadow-[0_0_0_1px_rgba(247,201,72,0.25)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl",
            accent ? "bg-[#F7C948]/15 text-[#F7C948]" : "bg-[#7FB6FF]/15 text-[#7FB6FF]",
          ].join(" ")}
        >
          {icon}
        </span>

        <div>
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-sm text-white/65">{body}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-2xl font-semibold tracking-tight text-white/95 md:text-3xl">
      {title}
    </h2>
  );
}


function StepCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 hover:bg-white/7 transition">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7FB6FF]/15 text-sm font-semibold text-[#7FB6FF] ring-1 ring-white/10">
        {num}
      </div>
      <div className="mt-4 text-base font-semibold text-white/90">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-white/65">{body}</div>
    </div>
  );
}

function Dot() {
  return (
    <span className="mt-2 h-2 w-2 rounded-full bg-[#F7C948] shadow-[0_0_18px_2px_rgba(247,201,72,0.35)]" />
  );
}

/* ---------------- Icons (inline SVG) ---------------- */

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 2l1.2 6.2L20 12l-6.8 3.8L12 22l-1.2-6.2L4 12l6.8-3.8L12 2z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M4 7.5C4 6.1 5.1 5 6.5 5H18c1.1 0 2 .9 2 2v1H7.2c-1.8 0-3.2 1.4-3.2 3.2V7.5z" />
      <path
        d="M20 10v7c0 1.1-.9 2-2 2H6.5C5.1 19 4 17.9 4 16.5V12.2C4 10.4 5.4 9 7.2 9H20z"
        opacity="0.8"
      />
      <circle cx="16.5" cy="14" r="1" className="fill-[#0B1220]" />
    </svg>
  );
}
