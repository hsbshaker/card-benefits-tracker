"use client";

import { useMemo, useState } from "react";
import type { AddCardFlowPreviewResult } from "@/lib/types/server-data";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Surface } from "@/components/ui/Surface";

type BenefitSelectionState = Record<string, { enabled: boolean; conditionalValue?: string | null }>;

type BenefitConfirmationProps = {
  preview: AddCardFlowPreviewResult;
  selections: BenefitSelectionState;
  onToggleBenefit: (benefitId: string, enabled: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
};

function BenefitRow({
  benefitName,
  meta,
  checked,
  onCheckedChange,
}: {
  benefitName: string;
  meta: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 hover:border-[#F7C948]/35">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-1 h-5 w-5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{benefitName}</p>
        <p className="mt-1 text-sm text-white/55">{meta}</p>
      </div>
    </label>
  );
}

export function BenefitConfirmation({
  preview,
  selections,
  onToggleBenefit,
  onBack,
  onContinue,
}: BenefitConfirmationProps) {
  const [showOtherBenefits, setShowOtherBenefits] = useState(false);

  const topBenefits = useMemo(() => preview.allBenefits.slice(0, 3), [preview.allBenefits]);
  const otherBenefits = useMemo(() => preview.allBenefits.slice(3), [preview.allBenefits]);
  const selectedCount = useMemo(
    () => preview.allBenefits.filter((benefit) => selections[benefit.benefitId]?.enabled !== false).length,
    [preview.allBenefits, selections],
  );

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm font-medium text-white/60 hover:text-white/85">
        Back
      </button>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">Confirm Benefits</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Review exceptions, not everything.</h1>
        <p className="max-w-2xl text-sm leading-6 text-white/65">
          Everything starts on. Turn off anything you don’t want Memento to keep in view.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white/85">Top Benefits</h2>
          <p className="text-xs text-white/45">{selectedCount} selected</p>
        </div>
        {topBenefits.map((benefit) => (
          <BenefitRow
            key={benefit.benefitId}
            benefitName={benefit.benefitName}
            meta={[benefit.value, benefit.periodLabel, benefit.valueDescriptor].filter(Boolean).join(" · ") || "Tracked benefit"}
            checked={selections[benefit.benefitId]?.enabled !== false}
            onCheckedChange={(checked) => onToggleBenefit(benefit.benefitId, checked)}
          />
        ))}
      </div>

      {otherBenefits.length > 0 ? (
        <Surface className="rounded-3xl border-white/12 bg-white/6 p-4">
          <button
            type="button"
            onClick={() => setShowOtherBenefits((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-white/85">Other Benefits</p>
              <p className="mt-1 text-sm text-white/55">Keep them on unless you know you don’t want reminders.</p>
            </div>
            <span className="text-sm font-medium text-[#F7C948]">{showOtherBenefits ? "Hide" : `+${otherBenefits.length} more`}</span>
          </button>

          {showOtherBenefits ? (
            <div className="mt-4 space-y-3">
              {otherBenefits.map((benefit) => (
                <BenefitRow
                  key={benefit.benefitId}
                  benefitName={benefit.benefitName}
                  meta={[benefit.value, benefit.periodLabel, benefit.valueDescriptor].filter(Boolean).join(" · ") || "Tracked benefit"}
                  checked={selections[benefit.benefitId]?.enabled !== false}
                  onCheckedChange={(checked) => onToggleBenefit(benefit.benefitId, checked)}
                />
              ))}
            </div>
          ) : null}
        </Surface>
      ) : null}

      {selectedCount === 0 ? (
        <Surface className="rounded-2xl border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          You won’t receive reminders.
        </Surface>
      ) : null}

      <div className="sticky bottom-4 flex gap-3 rounded-3xl border border-white/12 bg-[#0B1220]/90 p-3 backdrop-blur-md">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
