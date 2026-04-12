"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import type { CardDetailBenefitRow, CardDetailResult } from "@/lib/types/server-data";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

type BenefitDetailOverlayProps = {
  card: CardDetailResult["card"];
  benefit: CardDetailBenefitRow | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onToggleActive: (benefit: CardDetailBenefitRow) => void;
  onToggleUsed: (benefit: CardDetailBenefitRow) => void;
  onUpdateReminder: (benefit: CardDetailBenefitRow, reminderOverride: ReminderStyle) => void;
  onUpdateConditionalValue: (benefit: CardDetailBenefitRow, conditionalValue: string | null) => void;
};

const REMINDER_OPTIONS: ReminderStyle[] = ["balanced", "earlier", "minimal"];

function formatReminderLabel(value: ReminderStyle) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function BenefitDetailOverlay({
  card,
  benefit,
  open,
  saving,
  onClose,
  onToggleActive,
  onToggleUsed,
  onUpdateReminder,
  onUpdateConditionalValue,
}: BenefitDetailOverlayProps) {
  const [draftConditionalValue, setDraftConditionalValue] = useState("");

  useEffect(() => {
    if (!benefit) return;
    setDraftConditionalValue(benefit.conditionalValue ?? "");
  }, [benefit]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && benefit ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-[#050914]/55 p-3 backdrop-blur-[2px] md:items-stretch md:justify-end md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-xl md:max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <Surface className="h-full rounded-[2rem] border-white/12 bg-[#0D1525]/96 p-6 shadow-[0_28px_80px_-38px_rgba(0,0,0,0.95)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-white/52">{card.cardName}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{benefit.benefitName}</h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/72 transition hover:bg-white/10"
                  aria-label="Close benefit details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-[#F7C948]">{benefit.value ?? "Tracked benefit"}</p>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    {[benefit.valueDescriptor, benefit.periodLabel].filter(Boolean).join(" · ") || "Tracked benefit"}
                  </p>
                </div>

                {benefit.description ? <p className="text-sm leading-6 text-white/66">{benefit.description}</p> : null}

                <div className="space-y-3 text-sm text-white/68">
                  <p>Status: {benefit.isActive ? "Active" : "Inactive"}</p>
                  <p>Usage: {benefit.isUsedThisPeriod ? "Used this period" : "Not used this period"}</p>
                  {benefit.lastUsedAt ? <p>Last used: {new Date(benefit.lastUsedAt).toLocaleDateString()}</p> : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-[0.18em] text-white/44 uppercase">Reminder style</p>
                  <div className="grid grid-cols-3 gap-2">
                    {REMINDER_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={saving}
                        onClick={() => onUpdateReminder(benefit, option)}
                        className={cn(
                          "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                          benefit.reminderOverride === option
                            ? "border-[#F7C948]/45 bg-[#F7C948]/10 text-[#F7C948]"
                            : "border-white/12 bg-white/5 text-white/74",
                        )}
                      >
                        {formatReminderLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>

                {benefit.requiresConfiguration ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium tracking-[0.18em] text-white/44 uppercase">Configuration</p>
                    <input
                      value={draftConditionalValue}
                      onChange={(event) => setDraftConditionalValue(event.target.value)}
                      placeholder="Enter a tracked value"
                      className="w-full rounded-2xl border border-white/12 bg-[#0E1625]/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#F7C948]/45"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() => onUpdateConditionalValue(benefit, draftConditionalValue.trim() || null)}
                    >
                      Save value
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button variant="secondary" size="lg" disabled={saving} onClick={() => onToggleActive(benefit)}>
                  {benefit.isActive ? "Deactivate benefit" : "Activate benefit"}
                </Button>
                <Button size="lg" disabled={saving} onClick={() => onToggleUsed(benefit)}>
                  {benefit.isUsedThisPeriod ? "Unmark used" : "Mark as used"}
                </Button>
                <Button variant="secondary" size="lg" disabled={saving} onClick={onClose}>
                  Done
                </Button>
              </div>
            </Surface>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
