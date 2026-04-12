"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { HomeFeedItem } from "@/lib/types/server-data";
import { UseSoonItem } from "@/components/home/UseSoonItem";

type UseSoonListProps = {
  items: HomeFeedItem[];
  hiddenCount: number;
  pendingById: Record<string, "mark-used" | "snooze" | null | undefined>;
  onOpenItem: (item: HomeFeedItem) => void;
  onMarkUsed: (item: HomeFeedItem) => void;
  onSnooze: (item: HomeFeedItem) => void;
};

export function UseSoonList({
  items,
  hiddenCount,
  pendingById,
  onOpenItem,
  onMarkUsed,
  onSnooze,
}: UseSoonListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">Use Soon</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">What needs attention now</h2>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.userBenefitId}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <UseSoonItem
                item={item}
                pendingAction={pendingById[item.userBenefitId] ?? null}
                onOpen={onOpenItem}
                onMarkUsed={onMarkUsed}
                onSnooze={onSnooze}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hiddenCount > 0 ? <p className="text-sm text-white/48">+{hiddenCount} more benefits need attention soon.</p> : null}
    </section>
  );
}
