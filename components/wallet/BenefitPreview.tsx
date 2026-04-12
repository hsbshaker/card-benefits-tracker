"use client";

import type { AddCardFlowPreviewResult } from "@/lib/types/server-data";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

type BenefitPreviewProps = {
  preview: AddCardFlowPreviewResult | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onContinue: () => void;
};

export function BenefitPreview({
  preview,
  loading,
  error,
  onBack,
  onRetry,
  onContinue,
}: BenefitPreviewProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-24 animate-pulse rounded-full bg-white/10" />
        <Surface className="rounded-3xl border-white/10 bg-white/6 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-24 rounded-full bg-white/10" />
            <div className="h-8 w-2/3 rounded-full bg-white/12" />
            <div className="h-4 w-40 rounded-full bg-white/10" />
          </div>
        </Surface>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Surface key={index} className="rounded-2xl border-white/10 bg-white/6 p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/2 rounded-full bg-white/12" />
                <div className="h-3 w-1/3 rounded-full bg-white/10" />
              </div>
            </Surface>
          ))}
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <Surface className="rounded-3xl border-rose-300/20 bg-rose-300/10 p-6">
        <p className="text-sm font-medium text-rose-100">We couldn’t load this card preview.</p>
        <p className="mt-1 text-sm text-rose-100/75">{error ?? "Please try again."}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm font-medium text-white/60 hover:text-white/85">
        Back
      </button>

      <Surface className="rounded-3xl border-white/12 bg-white/6 p-6 sm:p-7">
        <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">{preview.card.issuer}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{preview.card.cardName}</h1>
        <p className="mt-3 text-lg text-white/80">
          {preview.estimatedTotalValueLabel
            ? `You have ${preview.estimatedTotalValueLabel} in benefits.`
            : "We found the trackable benefits for this card."}
        </p>
        <p className="mt-2 text-sm leading-6 text-white/60">
          {preview.hasTrackableBenefits
            ? "Everything starts on by default. You can edit exceptions in the next step."
            : "This card can still live in your wallet, but it doesn’t have trackable Memento benefits right now."}
        </p>
      </Surface>

      <div className="space-y-3">
        {preview.benefits.map((benefit) => (
          <Surface key={benefit.benefitId} className="rounded-2xl border-white/10 bg-white/6 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">{benefit.benefitName}</h2>
                <p className="mt-1 text-sm text-white/60">
                  {[benefit.periodLabel, benefit.valueDescriptor].filter(Boolean).join(" · ") || "Trackable benefit"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-[#F7C948]">{benefit.value ?? "Tracked"}</p>
            </div>
          </Surface>
        ))}

        {preview.hiddenBenefitCount > 0 ? (
          <Surface className="rounded-2xl border-dashed border-white/12 bg-white/4 p-4 text-sm text-white/65">
            +{preview.hiddenBenefitCount} more benefits
          </Surface>
        ) : null}
      </div>

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
