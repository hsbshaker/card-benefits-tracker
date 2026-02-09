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

      <div className="relative mx-auto max-w-6xl px-6 py-10">
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
              href="/app"
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 transition"
            >
              See it in action
            </Link>

            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl bg-[#7FB6FF] px-4 py-2 text-sm font-semibold text-[#08111F] shadow-[0_10px_35px_-15px_rgba(127,182,255,0.7)] hover:brightness-110 active:brightness-95 transition"
            >
              Continue with Google
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="pt-16 md:pt-20">
          <div className="max-w-3xl">
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0.08}
              className="text-4xl font-semibold tracking-tight md:text-5xl"
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
              Track statement credits, free nights, airline fees, and renewal dates in one clean dashboard.
              We preload what you’re likely to have — you confirm what applies, and we keep you on track.
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
                Sign in with Google
                <span className="text-[#08111F]/70 group-hover:text-[#08111F] transition">→</span>
              </Link>

              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 transition"
              >
                How it works
              </a>
            </motion.div>

            {/* Trust tiles */}
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
                body="We’ll never ask you to connect bank accounts or enter card numbers."
                icon={<IconShield />}
              />
              <TrustCard
                title="Self-entered, fully in your control"
                body="You pick the cards you have; we track benefits, deadlines, and reminders."
                icon={<IconWallet />}
              />
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mt-20 scroll-mt-24">
          <SectionTitle
            title="Simple setup. Zero integrations."
            subtitle="A quick 60-second flow: sign in, choose your cards, confirm perks."
          />

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StepCard
              num="1"
              title="Sign in with Google"
              body="Save your cards, benefits, and reminders"
            />
            <StepCard
              num="2"
              title="Choose your cards"
              body="Search and select by name. No numbers, no linking."
            />
            <StepCard
              num="3"
              title="Confirm your benefits"
              body="We preload what's likely — you toggle what applies"
            />
          </div>

          <div className="mt-6">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 transition"
            >
              Get started →
            </Link>
          </div>
        </section>

        {/* Privacy / Low-risk */}
        <section id="privacy" className="mt-20 scroll-mt-24">
          <SectionTitle
            title="Designed to be low-risk by default."
            subtitle="We intentionally avoid sensitive integrations. Less risk, fewer surprises."
          />

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <TrustCard
              title="No bank access"
              body="We don’t connect to accounts — nothing to compromise."
              icon={<IconNoBank />}
            />
            <TrustCard
              title="No Plaid"
              body="Nothing to link, nothing to authorize, ever."
              icon={<IconLinkOff />}
            />
            <TrustCard
              title="No card numbers"
              body="You only choose card names. That’s it."
              icon={<IconHashOff />}
            />
            <TrustCard
              title="Self-entered tracking"
              body="You decide what gets tracked and reminded."
              icon={<IconHand />}
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 py-10 text-sm text-white/55">
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
    <div className="group relative rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition-all duration-300 hover:border-[#F7C948]/40 hover:bg-[#F7C948]/10">
      <div className="flex items-start gap-3">
        {/* icon container: BLUE by default, YELLOW on hover */}
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#7FB6FF]/15 text-[#7FB6FF] transition-colors duration-300 group-hover:bg-[#F7C948]/20 group-hover:text-[#F7C948]">
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-white/95 md:text-3xl">{title}</h2>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}

function StepCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition hover:bg-white/10">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7FB6FF]/15 text-sm font-semibold text-[#7FB6FF] ring-1 ring-white/10">
          {num}
        </div>
        <div>
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-sm leading-relaxed text-white/65">{body}</div>
        </div>
      </div>
    </div>
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
        opacity="0.85"
      />
      <circle cx="16.5" cy="14" r="1" className="fill-[#0B1220]" />
    </svg>
  );
}

function IconNoBank() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 3l9 5v2H3V8l9-5z" />
      <path d="M4 12h16v7H4v-7z" opacity="0.85" />
      <path d="M6 12v7M10 12v7M14 12v7M18 12v7" className="stroke-current" strokeWidth="1.3" fill="none" opacity="0.6" />
      <path d="M4 20l16-16" className="stroke-[#0B1220]" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconLinkOff() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M10.6 13.4l-1.2 1.2a4 4 0 0 1-5.6 0 4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 0l.9.9-1.7 1.7-.5-.5a1.6 1.6 0 0 0-2.2 0l-2 2a1.6 1.6 0 0 0 0 2.2 1.6 1.6 0 0 0 2.2 0l1.2-1.2 1.3 1.3z" />
      <path d="M13.4 10.6l1.2-1.2a4 4 0 0 1 5.6 0 4 4 0 0 1 0 5.6l-2 2a4 4 0 0 1-5.6 0l-.9-.9 1.7-1.7.5.5a1.6 1.6 0 0 0 2.2 0l2-2a1.6 1.6 0 0 0 0-2.2 1.6 1.6 0 0 0-2.2 0l-1.2 1.2-1.3-1.3z" />
      <path d="M4 20l16-16" className="stroke-[#0B1220]" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconHashOff() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M9 3L7 21h2l2-18H9zm6 0l-2 18h2l2-18h-2z" />
      <path d="M4 9h18v2H4V9zm0 6h18v2H4v-2z" opacity="0.85" />
      <path d="M4 20l16-16" className="stroke-[#0B1220]" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconHand() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M7 12V6.8a1.3 1.3 0 1 1 2.6 0V12h.8V5.9a1.3 1.3 0 1 1 2.6 0V12h.8V7.1a1.3 1.3 0 1 1 2.6 0V12h.8V8.6a1.3 1.3 0 1 1 2.6 0V14c0 4-2.4 7-6.8 7H12c-3.2 0-5-1.7-5-4.6V12.5c0-.8.2-1.4 0-.5z" opacity="0.9" />
    </svg>
  );
}
