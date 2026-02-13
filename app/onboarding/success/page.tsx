import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { Surface } from "@/components/ui/Surface";
import { createClient } from "@/utils/supabase/server";

type AuthUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function firstToken(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [token] = trimmed.split(/\s+/);
  return token?.trim() || null;
}

function resolveFirstName(user: AuthUserLike) {
  const metadata = user.user_metadata ?? {};
  const fromFullName = firstToken(metadata.full_name);
  if (fromFullName) return fromFullName;

  const fromName = firstToken(metadata.name);
  if (fromName) return fromName;

  const emailPrefix = typeof user.email === "string" ? user.email.split("@")[0] : null;
  const fromEmail = firstToken(emailPrefix);
  if (fromEmail) return fromEmail;

  return "there";
}

function SuccessCheckBadge() {
  return (
    <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-full border border-[#BCEBD1]/45 bg-[#86EFAC]/12 text-[#D7FFE8] shadow-[0_0_0_1px_rgba(188,235,209,0.18),0_20px_45px_-28px_rgba(134,239,172,0.6)]">
      <span aria-hidden className="absolute inset-0 rounded-full bg-[#86EFAC]/20 blur-xl" />
      <svg viewBox="0 0 24 24" fill="none" className="relative h-10 w-10" aria-hidden="true">
        <path
          d="M6.5 12.5 10 16l7.5-8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function SmallCheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-[#BAF3D2]" aria-hidden="true">
      <path d="M5.2 10.2 8 13l6.4-6.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function OnboardingSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const firstName = resolveFirstName(user);

  return (
    <AppShell
      className="min-h-[calc(100dvh-4rem)] overflow-hidden"
      containerClassName="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="relative w-full max-w-[680px]">
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[8%] h-56 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(127,182,255,0.28)_0%,rgba(127,182,255,0.09)_45%,transparent_72%)] blur-2xl"
        />

        <div className="relative flex flex-col items-center text-center motion-safe:transition-all motion-safe:duration-[220ms] motion-safe:ease-out motion-safe:starting:translate-y-1.5 motion-safe:starting:opacity-0 motion-reduce:transition-none">
          <section className="w-full space-y-5">
            <SuccessCheckBadge />
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">You&apos;re all set, {firstName}.</h1>
              <p className="mx-auto max-w-[620px] text-sm text-white/72 sm:text-base">
                We&apos;ll email you before benefits expire so you never leave value on the table.
              </p>
            </div>
          </section>

          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />

          <section aria-labelledby="what-happens-next" className="w-full max-w-[620px]">
            <Surface className="space-y-4 border-white/18 bg-white/[0.09] p-4 text-left sm:p-5">
              <h2 id="what-happens-next" className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                What Happens Next
              </h2>

              <ul className="space-y-3 text-sm text-white/82 sm:text-[15px]">
                <li className="flex items-start gap-2.5">
                  <SmallCheckIcon />
                  <span>Email reminders before statement credits and perks expire</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <SmallCheckIcon />
                  <span>Monthly nudges for recurring benefits</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <SmallCheckIcon />
                  <span>Update your preferences anytime</span>
                </li>
              </ul>

              <p className="pt-1 text-xs text-white/55">You can close this tab - we&apos;ve got it from here.</p>
            </Surface>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
