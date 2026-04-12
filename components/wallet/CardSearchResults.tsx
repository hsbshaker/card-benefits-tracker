"use client";

import type { CardSearchResult } from "@/lib/types/server-data";
import { Surface } from "@/components/ui/Surface";
import { getCleanCardName } from "@/lib/format-card";
import { cn } from "@/lib/cn";

type CardSearchResultsProps = {
  results: CardSearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
  onSelect: (card: CardSearchResult) => void;
};

export function CardSearchResults({
  results,
  loading,
  error,
  query,
  onRetry,
  onSelect,
}: CardSearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Surface key={index} className="rounded-2xl border-white/10 bg-white/6 p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-20 rounded-full bg-white/10" />
              <div className="h-5 w-2/3 rounded-full bg-white/12" />
              <div className="h-3 w-24 rounded-full bg-white/10" />
            </div>
          </Surface>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Surface className="rounded-2xl border-rose-300/20 bg-rose-300/10 p-5">
        <p className="text-sm font-medium text-rose-100">We couldn’t load cards right now.</p>
        <p className="mt-1 text-sm text-rose-100/70">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-sm font-semibold text-white underline decoration-white/30 underline-offset-4"
        >
          Try again
        </button>
      </Surface>
    );
  }

  if (!query.trim()) {
    return (
      <Surface className="rounded-2xl border-white/10 bg-white/6 p-5 text-sm text-white/70">
        Search your card to begin.
      </Surface>
    );
  }

  if (results.length === 0) {
    return (
      <Surface className="rounded-2xl border-white/10 bg-white/6 p-5 text-sm text-white/70">
        No matches found.
      </Surface>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((card) => (
        <button key={card.cardId} type="button" onClick={() => onSelect(card)} className="w-full text-left">
          <Surface
            variant="card"
            className="rounded-2xl border-white/10 bg-white/6 p-4 hover:border-[#F7C948]/45 hover:bg-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-[0.22em] text-white/45 uppercase">{card.issuer}</p>
                <h3 className="mt-2 text-base font-semibold text-white">
                  {getCleanCardName(card.displayName, card.cardName)}
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  {card.cardStatus === "active" ? "Trackable benefits available" : "No trackable benefits right now"}
                </p>
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
      ))}
    </div>
  );
}
