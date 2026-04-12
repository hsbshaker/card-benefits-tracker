"use client";

import type { CardSearchResult } from "@/lib/types/server-data";
import { Surface } from "@/components/ui/Surface";
import { getCleanCardName } from "@/lib/format-card";
import { cn } from "@/lib/cn";

type SuggestedCardRowProps = {
  card: CardSearchResult;
  onSelect: (card: CardSearchResult) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function SuggestedCardRow({ card, onSelect, disabled = false, compact = false }: SuggestedCardRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(card)}
      className={cn("text-left disabled:cursor-not-allowed disabled:opacity-60", compact ? "w-full" : "min-w-[15rem]")}
    >
      <Surface
        variant="card"
        className={cn(
          "w-full border-white/12 bg-white/6 p-4 hover:border-[#F7C948]/45 hover:bg-white/10",
          compact ? "rounded-2xl px-4 py-3" : "min-h-[7.75rem] rounded-3xl p-5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.24em] text-white/45 uppercase">{card.issuer}</p>
            <h3 className={cn("mt-2 font-semibold text-white", compact ? "text-sm" : "text-base")}>
              {getCleanCardName(card.displayName, card.cardName)}
            </h3>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase",
              card.cardStatus === "active"
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                : "border-white/15 bg-white/8 text-white/70",
            )}
          >
            {card.cardStatus === "active" ? "Trackable" : "Saved"}
          </span>
        </div>
      </Surface>
    </button>
  );
}
