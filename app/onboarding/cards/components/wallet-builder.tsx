"use client";

import { useMemo, useState, useEffect, useRef, KeyboardEvent } from "react";

type IssuerOption = {
  id: string;
  name: string;
  enabled: boolean;
};

type CardResult = {
  id: string;
  issuer: string;
  brand: string | null;
  card_name: string;
};

type SelectedCardInstance = {
  instanceId: string;
  cardId: string;
  card_name: string;
  brand: string | null;
  issuer: string;
};

const ISSUER_OPTIONS: IssuerOption[] = [
  { id: "amex", name: "American Express", enabled: true },
  { id: "chase", name: "Chase", enabled: false },
  { id: "citi", name: "Citi", enabled: false },
  { id: "capital-one", name: "Capital One", enabled: false },
  { id: "bilt", name: "Bilt", enabled: false },
];

const rowTransition = "transition duration-150 ease-out";

export function WalletBuilder() {
  const [activeIssuer, setActiveIssuer] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCards, setSelectedCards] = useState<SelectedCardInstance[]>([]);

  const requestAbortRef = useRef<AbortController | null>(null);
  const canSearch = activeIssuer === "amex";
  const normalizedQuery = query.trim();
  const shouldShowResults = canSearch && normalizedQuery.length >= 1;

  useEffect(() => {
    if (!shouldShowResults) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setHighlightedIndex(0);
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      return;
    }

    const controller = new AbortController();
    requestAbortRef.current?.abort();
    requestAbortRef.current = controller;

    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ issuer: "amex", q: normalizedQuery });
        const response = await fetch(`/api/cards?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load cards");
        }

        const data: CardResult[] = await response.json();
        setResults(data);
        setHighlightedIndex((prev) => (data.length === 0 ? 0 : Math.min(prev, data.length - 1)));
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setResults([]);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load cards");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedQuery, shouldShowResults]);

  const addCard = (card: CardResult) => {
    const instanceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${card.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSelectedCards((prev) => [
      ...prev,
      {
        instanceId,
        cardId: card.id,
        card_name: card.card_name,
        brand: card.brand,
        issuer: card.issuer,
      },
    ]);
  };

  const removeCardInstance = (instanceId: string) => {
    setSelectedCards((prev) => prev.filter((card) => card.instanceId !== instanceId));
  };

  const handleResultsKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShowResults || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const highlighted = results[highlightedIndex];
      if (highlighted) addCard(highlighted);
    }
  };

  const ctaLabel = useMemo(() => {
    return `Add ${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"} to my wallet`;
  }, [selectedCards.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Add cards</h1>
          <p className="mt-2 text-sm text-slate-400">Build your digital wallet with your cards.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {ISSUER_OPTIONS.map((issuer) => {
                const isActive = activeIssuer === issuer.id;

                return (
                  <button
                    key={issuer.id}
                    type="button"
                    onClick={() => issuer.enabled && setActiveIssuer(issuer.id)}
                    disabled={!issuer.enabled}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${rowTransition} ${
                      issuer.enabled
                        ? isActive
                          ? "border-cyan-300/70 bg-cyan-400/10 text-cyan-100"
                          : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                        : "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500"
                    }`}
                  >
                    <span>{issuer.name}</span>
                    {!issuer.enabled ? (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
                        Coming soon
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="card-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Search cards
              </label>
              <input
                id="card-search"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleResultsKeyDown}
                disabled={!canSearch}
                placeholder={canSearch ? "Search American Express cards" : "Select an issuer to search"}
                className={`w-full rounded-xl border bg-slate-950 px-3 py-2.5 text-sm outline-none ${rowTransition} ${
                  canSearch
                    ? "border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40"
                    : "cursor-not-allowed border-slate-800 text-slate-500 placeholder:text-slate-600"
                }`}
              />
              {canSearch && isLoading ? <p className="mt-2 text-xs text-slate-400">Loading cards…</p> : null}
              {canSearch && error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
            </div>

            {shouldShowResults ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70">
                {results.length === 0 && !isLoading && !error ? (
                  <p className="px-3 py-3 text-sm text-slate-400">No matches</p>
                ) : (
                  <ul className="max-h-96 overflow-auto py-1">
                    {results.map((card, index) => {
                      const highlighted = index === highlightedIndex;

                      return (
                        <li key={`${card.id}-${index}`}>
                          <button
                            type="button"
                            onClick={() => addCard(card)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${rowTransition} ${
                              highlighted
                                ? "bg-cyan-400/10 text-cyan-100"
                                : "text-slate-200 hover:bg-slate-800/70 hover:text-slate-100"
                            }`}
                          >
                            <span className="h-2 w-2 rounded-full bg-cyan-300/80" aria-hidden />
                            <span>{card.card_name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-slate-200">Digital Wallet</h2>
            <p className="mt-1 text-xs text-slate-400">Selected cards</p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60">
              {selectedCards.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">No cards added yet.</p>
              ) : (
                <ul className="max-h-[22.5rem] overflow-auto py-1">
                  {selectedCards.map((card) => (
                    <li key={card.instanceId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2 text-slate-200">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300/80" aria-hidden />
                        <span className="truncate">{card.card_name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCardInstance(card.instanceId)}
                        className={`shrink-0 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 ${rowTransition}`}
                        aria-label={`Remove ${card.card_name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-6">
          <button
            type="button"
            disabled={selectedCards.length === 0}
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium ${rowTransition} ${
              selectedCards.length === 0
                ? "cursor-not-allowed bg-slate-800 text-slate-500"
                : "bg-cyan-400/90 text-slate-950 hover:bg-cyan-300"
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
