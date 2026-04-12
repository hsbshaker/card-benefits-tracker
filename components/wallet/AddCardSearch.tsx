"use client";

import type { CardSearchResult } from "@/lib/types/server-data";
import { CardSearchResults } from "@/components/wallet/CardSearchResults";
import { SuggestedCardRow } from "@/components/wallet/SuggestedCardRow";
import { Surface } from "@/components/ui/Surface";

type AddCardSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: CardSearchResult[];
  loading: boolean;
  error: string | null;
  suggestedCards: CardSearchResult[];
  onSelectCard: (card: CardSearchResult) => void;
  onRetry: () => void;
};

export function AddCardSearch({
  query,
  onQueryChange,
  results,
  loading,
  error,
  suggestedCards,
  onSelectCard,
  onRetry,
}: AddCardSearchProps) {
  const showSuggestedCards = !query.trim() && suggestedCards.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">Add Card</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Search your card to begin.</h1>
        <p className="max-w-xl text-sm leading-6 text-white/65 sm:text-base">
          We’ll show the benefits first, then you can confirm what to track.
        </p>
      </div>

      <Surface className="rounded-3xl border-white/12 bg-white/6 p-4 sm:p-5">
        <label htmlFor="card-search" className="sr-only">
          Search cards
        </label>
        <input
          id="card-search"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by card name or issuer"
          className="w-full rounded-2xl border border-white/12 bg-[#0E1625]/90 px-4 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-[#F7C948]/45 focus:ring-2 focus:ring-[#F7C948]/20"
        />
      </Surface>

      {showSuggestedCards ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/88">Popular cards</h2>
            <p className="text-xs text-white/45">Tap once to preview</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {suggestedCards.slice(0, 6).map((card) => (
              <SuggestedCardRow key={card.cardId} card={card} onSelect={onSelectCard} />
            ))}
          </div>
        </div>
      ) : null}

      <CardSearchResults
        results={results}
        loading={loading}
        error={error}
        query={query}
        onRetry={onRetry}
        onSelect={onSelectCard}
      />
    </div>
  );
}
