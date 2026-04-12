"use client";

import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

type ReminderStyleSelectorProps = {
  value: ReminderStyle;
  disabled?: boolean;
  onChange: (value: ReminderStyle) => void;
};

const OPTIONS: Array<{
  value: ReminderStyle;
  label: string;
  description: string;
}> = [
  {
    value: "balanced",
    label: "Balanced",
    description: "A calm default that keeps expiring value in view without being noisy.",
  },
  {
    value: "earlier",
    label: "Earlier",
    description: "A bit more lead time before benefits get close.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Only the essentials when something needs attention.",
  },
];

export function ReminderStyleSelector({ value, disabled = false, onChange }: ReminderStyleSelectorProps) {
  return (
    <div className="space-y-3">
      {OPTIONS.map((option) => {
        const selected = option.value === value;

        return (
          <button key={option.value} type="button" disabled={disabled} onClick={() => onChange(option.value)} className="w-full text-left disabled:opacity-60">
            <Surface
              className={cn(
                "rounded-[1.5rem] border p-5 transition",
                selected
                  ? "border-[#F7C948]/45 bg-[#F7C948]/10 shadow-[0_20px_55px_-30px_rgba(247,201,72,0.45)]"
                  : "border-white/12 bg-white/6",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{option.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/62">{option.description}</p>
                </div>
                {selected ? (
                  <span className="rounded-full border border-[#F7C948]/45 bg-[#F7C948]/12 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-[#F7C948] uppercase">
                    Selected
                  </span>
                ) : null}
              </div>
            </Surface>
          </button>
        );
      })}
    </div>
  );
}
