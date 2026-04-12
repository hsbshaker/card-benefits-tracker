"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { HomeFeedItem } from "@/lib/types/server-data";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

type BenefitActionOverlayProps = {
  item: HomeFeedItem | null;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onMarkUsed: (item: HomeFeedItem) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function getStatusText(item: HomeFeedItem) {
  if (item.requiresConfiguration && item.configurationStatus === "needs_configuration") {
    return "Needs one quick setup choice before tracking is exact.";
  }

  if (item.daysRemaining <= 7) {
    return `Ends in ${item.daysRemaining} day${item.daysRemaining === 1 ? "" : "s"}.`;
  }

  return `Expires in ${item.daysRemaining} days.`;
}

export function BenefitActionOverlay({
  item,
  open,
  loading,
  onClose,
  onMarkUsed,
}: BenefitActionOverlayProps) {
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
      {open && item ? (
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
            <Surface className="h-full rounded-[2rem] border-white/12 bg-[#0D1525]/96 p-6 shadow-[0_28px_80px_-38px_rgba(0,0,0,0.95)] md:rounded-[2rem]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-white/52">{item.cardName}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{item.benefitName}</h2>
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
                  <p className="text-sm font-medium text-[#F7C948]">{item.value ?? "Tracked benefit"}</p>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    {[item.valueDescriptor, item.periodLabel].filter(Boolean).join(" · ") || "Track this benefit before it resets."}
                  </p>
                </div>

                <div className="space-y-3 text-sm text-white/68">
                  <p>Resets {formatDate(item.periodEndDate)}</p>
                  <p>{getStatusText(item)}</p>
                  <p>
                    Reminder style: <span className="text-white/88">{item.reminderOverride ?? "Balanced default"}</span>
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button size="lg" onClick={() => onMarkUsed(item)} disabled={loading}>
                  {loading ? "Saving..." : "Mark used"}
                </Button>
                <Link href="/wallet" className="block">
                  <Button variant="secondary" size="lg" className="w-full">
                    View in Wallet
                  </Button>
                </Link>
              </div>
            </Surface>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
