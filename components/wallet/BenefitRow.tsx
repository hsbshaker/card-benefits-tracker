"use client";

import { Settings2 } from "lucide-react";
import type { CardDetailBenefitRow } from "@/lib/types/server-data";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type BenefitRowProps = {
  benefit: CardDetailBenefitRow;
  pending?: boolean;
  onOpen: (benefit: CardDetailBenefitRow) => void;
  onToggleActive: (benefit: CardDetailBenefitRow) => void;
  onToggleUsed: (benefit: CardDetailBenefitRow) => void;
};

export function BenefitRow({ benefit, pending = false, onOpen, onToggleActive, onToggleUsed }: BenefitRowProps) {
  return (
    <Surface className="rounded-[1.5rem] border-white/10 bg-white/6 p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen(benefit)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(benefit);
            }
          }}
          className="min-w-0 flex-1 cursor-pointer outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white">{benefit.benefitName}</h3>
              <p className="mt-1 text-sm text-white/58">
                {[benefit.value, benefit.valueDescriptor, benefit.periodLabel].filter(Boolean).join(" · ") || "Tracked benefit"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {benefit.requiresConfiguration && benefit.configurationStatus === "needs_configuration" ? (
                <div className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/72 uppercase">
                  <Settings2 className="h-3 w-3" />
                  Needs setup
                </div>
              ) : null}
              <div
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase",
                  benefit.isUsedThisPeriod
                    ? "border-emerald-300/28 bg-emerald-300/10 text-emerald-100"
                    : "border-white/12 bg-white/7 text-white/68",
                )}
              >
                {benefit.isUsedThisPeriod ? "Used" : "Unused"}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => onToggleActive(benefit)}>
            {benefit.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onToggleUsed(benefit)}>
            {benefit.isUsedThisPeriod ? "Unmark used" : "Mark used"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 md:hidden">
        <button
          type="button"
          onClick={() => onToggleActive(benefit)}
          disabled={pending}
          className="text-sm font-semibold text-white/80 disabled:opacity-50"
        >
          {benefit.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={() => onToggleUsed(benefit)}
          disabled={pending}
          className="text-sm font-semibold text-[#7FB6FF] disabled:opacity-50"
        >
          {benefit.isUsedThisPeriod ? "Unmark used" : "Mark used"}
        </button>
      </div>
    </Surface>
  );
}
