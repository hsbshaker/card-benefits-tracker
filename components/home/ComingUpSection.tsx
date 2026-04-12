"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { HomeFeedItem } from "@/lib/types/server-data";
import { UseSoonItem } from "@/components/home/UseSoonItem";
import { cn } from "@/lib/cn";

type ComingUpSectionProps = {
  items: HomeFeedItem[];
  count: number;
  onOpenItem: (item: HomeFeedItem) => void;
};

export function ComingUpSection({ items, count, onOpenItem }: ComingUpSectionProps) {
  const [open, setOpen] = useState(false);

  if (count === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/8"
      >
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-white/42 uppercase">Coming Up</p>
          <p className="mt-2 text-base font-semibold text-white/86">Coming up · {count} benefits</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-white/46 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div className="space-y-3">
          {items.map((item) => (
            <UseSoonItem key={item.userBenefitId} item={item} variant="upcoming" pendingAction={null} onOpen={onOpenItem} onMarkUsed={() => {}} onSnooze={() => {}} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
