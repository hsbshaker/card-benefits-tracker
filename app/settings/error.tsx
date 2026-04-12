"use client";

import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";

type SettingsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SettingsError({ reset }: SettingsErrorProps) {
  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        <div className="mx-auto max-w-xl pt-8">
          <Surface className="rounded-3xl border-rose-300/20 bg-rose-300/10 p-6 sm:p-7">
            <p className="text-sm font-medium tracking-[0.22em] text-rose-100/80 uppercase">Settings</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">We couldn’t load your settings right now.</h1>
            <p className="mt-3 text-sm leading-6 text-rose-100/75">Try again in a moment.</p>
            <div className="mt-6">
              <Button onClick={reset}>Retry</Button>
            </div>
          </Surface>
        </div>
      </MobilePageContainer>
    </AppShell>
  );
}
