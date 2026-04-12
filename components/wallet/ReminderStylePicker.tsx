"use client";

import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

type ReminderStylePickerProps = {
  value: ReminderStyle;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onChange: (value: ReminderStyle) => void;
  onSubmit: () => void;
};

const OPTIONS: Array<{
  value: ReminderStyle;
  label: string;
  description: string;
}> = [
  {
    value: "balanced",
    label: "Balanced",
    description: "A calm default that keeps expiring value in view without over-notifying you.",
  },
  {
    value: "earlier",
    label: "Earlier",
    description: "A little more lead time so you can act before things get urgent.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Only the essentials when a benefit is getting close.",
  },
];

export function ReminderStylePicker({
  value,
  submitting,
  error,
  onBack,
  onChange,
  onSubmit,
}: ReminderStylePickerProps) {
  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm font-medium text-white/60 hover:text-white/85">
        Back
      </button>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">Reminder Style</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Pick how early you want a nudge.</h1>
        <p className="max-w-2xl text-sm leading-6 text-white/65">You can change this later, but most people stick with Balanced.</p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button key={option.value} type="button" onClick={() => onChange(option.value)} className="w-full text-left">
              <Surface
                className={cn(
                  "rounded-3xl border p-5 transition",
                  selected
                    ? "border-[#F7C948]/55 bg-[#F7C948]/12 shadow-[0_20px_55px_-30px_rgba(247,201,72,0.45)]"
                    : "border-white/12 bg-white/6",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">{option.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/65">{option.description}</p>
                  </div>
                  {selected ? (
                    <span className="rounded-full border border-[#F7C948]/45 bg-[#F7C948]/14 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-[#F7C948] uppercase">
                      Selected
                    </span>
                  ) : null}
                </div>
              </Surface>
            </button>
          );
        })}
      </div>

      {error ? (
        <Surface className="rounded-2xl border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</Surface>
      ) : null}

      <div className="sticky bottom-4 flex gap-3 rounded-3xl border border-white/12 bg-[#0B1220]/90 p-3 backdrop-blur-md">
        <Button variant="secondary" className="flex-1" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button className="flex-1" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Adding card..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
