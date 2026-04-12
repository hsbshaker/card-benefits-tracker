"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock3 } from "lucide-react";
import type { HomeFeedItem } from "@/lib/types/server-data";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

type UseSoonItemProps = {
  item: HomeFeedItem;
  variant?: "soon" | "upcoming";
  pendingAction?: "mark-used" | "snooze" | null;
  onOpen: (item: HomeFeedItem) => void;
  onMarkUsed: (item: HomeFeedItem) => void;
  onSnooze: (item: HomeFeedItem) => void;
};

function formatUrgencyLabel(item: HomeFeedItem) {
  if (item.daysRemaining <= 7) {
    return item.daysRemaining <= 1 ? "Ends today" : `${item.daysRemaining} days left`;
  }

  return `${item.daysRemaining} days left`;
}

export function UseSoonItem({
  item,
  variant = "soon",
  pendingAction = null,
  onOpen,
  onMarkUsed,
  onSnooze,
}: UseSoonItemProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const isUpcoming = variant === "upcoming";
  const isBusy = pendingAction !== null;

  const x = useMemo(() => {
    if (dragOffset !== 0) return dragOffset;
    if (swipeOpen && !isUpcoming) return -116;
    return 0;
  }, [dragOffset, isUpcoming, swipeOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(item);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-[1.75rem]"
      onTouchStart={(event) => {
        if (isUpcoming) return;
        setTouchStart(event.touches[0]?.clientX ?? null);
      }}
      onTouchMove={(event) => {
        if (touchStart === null || isUpcoming) return;
        const delta = (event.touches[0]?.clientX ?? 0) - touchStart;
        if (delta < 0) {
          setDragOffset(Math.max(delta, -116));
        }
      }}
      onTouchEnd={() => {
        if (isUpcoming) return;
        setSwipeOpen(dragOffset <= -48);
        setDragOffset(0);
        setTouchStart(null);
      }}
      onTouchCancel={() => {
        setDragOffset(0);
        setTouchStart(null);
      }}
    >
      {!isUpcoming ? (
        <div className="absolute inset-y-0 right-0 flex items-stretch md:hidden">
          <button
            type="button"
            onClick={() => onSnooze(item)}
            disabled={isBusy}
            className="flex w-[58px] items-center justify-center bg-white/8 px-3 text-[11px] font-semibold text-white/78 disabled:opacity-50"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => onMarkUsed(item)}
            disabled={isBusy}
            className="flex w-[58px] items-center justify-center bg-[#7FB6FF] px-3 text-[11px] font-semibold text-[#08111F] disabled:opacity-50"
          >
            Used
          </button>
        </div>
      ) : null}

      <motion.div animate={{ x }} transition={{ duration: 0.18, ease: "easeOut" }}>
        <Surface
          className={cn(
            "rounded-[1.75rem] border-white/10 bg-white/6 p-4 sm:p-5",
            item.urgencyTier === "high" && !isUpcoming ? "border-[#F7C948]/28 bg-[#F7C948]/10" : "",
            isUpcoming ? "bg-white/[0.045]" : "",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(item)}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 cursor-pointer outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white">{item.benefitName}</h3>
                  <p className="mt-1 text-sm text-white/56">
                    {[item.value, item.valueDescriptor].filter(Boolean).join(" · ") || "Tracked benefit"}
                  </p>
                </div>
                <div
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase",
                    item.urgencyTier === "high"
                      ? "border-[#F7C948]/40 bg-[#F7C948]/12 text-[#F7C948]"
                      : "border-white/12 bg-white/7 text-white/68",
                  )}
                >
                  {formatUrgencyLabel(item)}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-white/58">
                <Clock3 className="h-3.5 w-3.5" />
                <span>{item.cardName}</span>
              </div>
            </div>

            {!isUpcoming ? (
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <Button variant="secondary" size="sm" onClick={() => onSnooze(item)} disabled={isBusy}>
                  Later
                </Button>
                <Button size="sm" onClick={() => onMarkUsed(item)} disabled={isBusy}>
                  {pendingAction === "mark-used" ? "Saving..." : "Mark used"}
                </Button>
              </div>
            ) : null}
          </div>

          {!isUpcoming ? (
            <div className="mt-4 flex items-center justify-between md:hidden">
              <span className="text-xs text-white/38">Swipe left for more actions</span>
              <button
                type="button"
                onClick={() => onMarkUsed(item)}
                disabled={isBusy}
                className="text-sm font-semibold text-[#7FB6FF] disabled:opacity-50"
              >
                {pendingAction === "mark-used" ? "Saving..." : "Mark used"}
              </button>
            </div>
          ) : null}
        </Surface>
      </motion.div>
    </div>
  );
}
