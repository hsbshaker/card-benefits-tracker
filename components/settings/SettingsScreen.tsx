"use client";

import { useState } from "react";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { ReminderStyleSelector } from "@/components/settings/ReminderStyleSelector";
import { AccountSection } from "@/components/settings/AccountSection";

type SettingsScreenProps = {
  initialReminderStyle: ReminderStyle;
  email: string | null;
};

export function SettingsScreen({ initialReminderStyle, email }: SettingsScreenProps) {
  const [reminderStyle, setReminderStyle] = useState<ReminderStyle>(initialReminderStyle);
  const [savingStyle, setSavingStyle] = useState(false);
  const [resettingOverrides, setResettingOverrides] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChangeReminderStyle = async (nextStyle: ReminderStyle) => {
    if (savingStyle || nextStyle === reminderStyle) return;

    const previous = reminderStyle;
    setReminderStyle(nextStyle);
    setSavingStyle(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/settings/update-reminder-style", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderStyle: nextStyle,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update reminder style.");
      }

      setSuccessMessage("Default reminder style updated.");
    } catch (error) {
      setReminderStyle(previous);
      setErrorMessage(error instanceof Error ? error.message : "Failed to update reminder style.");
    } finally {
      setSavingStyle(false);
    }
  };

  const handleResetOverrides = async () => {
    if (resettingOverrides) return;

    setResettingOverrides(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/settings/reset-reminder-overrides", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to reset reminder overrides.");
      }

      setSuccessMessage("Benefit-level reminder overrides cleared.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reset reminder overrides.");
    } finally {
      setResettingOverrides(false);
    }
  };

  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        <div className="space-y-6 pt-6">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">Settings</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Preferences</h1>
          </div>

          {errorMessage ? (
            <Surface className="rounded-2xl border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              {errorMessage}
            </Surface>
          ) : null}

          {successMessage ? (
            <Surface className="rounded-2xl border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
              {successMessage}
            </Surface>
          ) : null}

          <Surface className="rounded-[1.75rem] border-white/12 bg-white/6 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-[0.22em] text-white/42 uppercase">Preferences</p>
              <h2 className="text-xl font-semibold tracking-tight text-white">Global reminder style</h2>
              <p className="text-sm leading-6 text-white/62">
                This acts as your default reminder behavior unless a specific benefit has its own override.
              </p>
            </div>

            <div className="mt-5">
              <ReminderStyleSelector value={reminderStyle} disabled={savingStyle} onChange={handleChangeReminderStyle} />
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Reset all reminder overrides</p>
                  <p className="mt-1 text-sm text-white/58">Benefit-level overrides will fall back to your global style.</p>
                </div>
                <Button variant="secondary" onClick={() => void handleResetOverrides()} disabled={resettingOverrides}>
                  {resettingOverrides ? "Resetting..." : "Reset overrides"}
                </Button>
              </div>
            </div>
          </Surface>

          <AccountSection email={email} />
        </div>
      </MobilePageContainer>
    </AppShell>
  );
}
