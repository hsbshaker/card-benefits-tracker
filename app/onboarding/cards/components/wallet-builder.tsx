"use client";

import { useMemo, useState, useEffect, useRef, KeyboardEvent } from "react";

type IssuerOption = {
  id: string;
  name: string;
  enabled: boolean;
  kind: "issuer";
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

type DuplicateToastState = {
  message: string;
};

type PendingDuplicateState = {
  card: CardResult;
};

const ISSUER_OPTIONS: IssuerOption[] = [
  { id: "amex", name: "American Express", enabled: true, kind: "issuer" },
  { id: "chase", name: "Chase", enabled: false, kind: "issuer" },
  { id: "capital-one", name: "Capital One", enabled: false, kind: "issuer" },
  { id: "citi", name: "Citi", enabled: false, kind: "issuer" },
];

const rowTransition = "transition duration-150 ease-out";

export function WalletBuilder() {
  const [activeIssuer, setActiveIssuer] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCards, setSelectedCards] = useState<SelectedCardInstance[]>([]);
  const [issuerCardId, setIssuerCardId] = useState<string | null>(null);
  const [issuerCardOptions, setIssuerCardOptions] = useState<CardResult[]>([]);
  const [issuerCardLoading, setIssuerCardLoading] = useState(false);
  const [issuerCardError, setIssuerCardError] = useState<string | null>(null);
  const [duplicateToast, setDuplicateToast] = useState<DuplicateToastState | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicateState | null>(null);

  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const latestQueryRef = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const loadingDelayRef = useRef<number | null>(null);
  const normalizedQuery = query.trim();
  const shouldShowResults = normalizedQuery.length >= 1;
  const enabledIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && option.enabled);
  const comingSoonIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && !option.enabled);
  const resetSearchState = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setHighlightedIndex(0);
    setShowLoading(false);
    setIsLoading(false);
    if (loadingDelayRef.current) {
      window.clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = null;
    }
    requestSeqRef.current += 1;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleFocusShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleFocusShortcut);

    return () => {
      document.removeEventListener("keydown", handleFocusShortcut);
    };
  }, []);

  useEffect(() => {
    if (!shouldShowResults) {
      if (results.length) setResults([]);
      if (isLoading) setIsLoading(false);
      if (error) setError(null);
      if (highlightedIndex !== 0) setHighlightedIndex(0);
      requestSeqRef.current += 1;
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    }
  }, [shouldShowResults, results.length, isLoading, error, highlightedIndex]);

  const singleEnabledIssuerId = useMemo(
    () => (enabledIssuers.length === 1 ? enabledIssuers[0].id : null),
    [enabledIssuers],
  );

  useEffect(() => {
    if (!shouldShowResults) {
      return;
    }

    latestQueryRef.current = normalizedQuery;

    const timeout = window.setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      const qAtStart = latestQueryRef.current;

      setIsLoading(true);
      setError(null);
      requestAbortRef.current?.abort();

      const controller = new AbortController();
      requestAbortRef.current = controller;

      try {
        const params = new URLSearchParams({ q: qAtStart });

        if (singleEnabledIssuerId) {
          params.set("issuer", singleEnabledIssuerId);
        }

        const response = await fetch(`/api/cards?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load cards");
        }

        const data: CardResult[] = await response.json();
        if (seq !== requestSeqRef.current) {
          return;
        }

        setResults(data);
        setError(null);
        setHighlightedIndex((prev) => (data.length === 0 ? 0 : Math.min(prev, data.length - 1)));
      } catch (fetchError) {
        if (controller.signal.aborted || seq !== requestSeqRef.current) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Failed to load cards");
        setResults([]);
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [normalizedQuery, shouldShowResults, singleEnabledIssuerId]);

  useEffect(() => {
    if (!duplicateToast) return;

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setDuplicateToast(null);
      toastTimeoutRef.current = null;
    }, 4000);

    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [duplicateToast]);

  useEffect(() => {
    if (loadingDelayRef.current) {
      window.clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = null;
    }

    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    loadingDelayRef.current = window.setTimeout(() => {
      setShowLoading(true);
      loadingDelayRef.current = null;
    }, 200);

    return () => {
      if (loadingDelayRef.current) {
        window.clearTimeout(loadingDelayRef.current);
        loadingDelayRef.current = null;
      }
    };
  }, [isLoading]);

  useEffect(() => {
    setIssuerCardId(null);
    setIssuerCardOptions([]);
    setIssuerCardError(null);

    const selectedIssuer = ISSUER_OPTIONS.find((option) => option.id === activeIssuer);
    if (!activeIssuer || !selectedIssuer?.enabled) {
      setIssuerCardLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadIssuerCards = async () => {
      setIssuerCardLoading(true);
      try {
        const params = new URLSearchParams({ issuer: activeIssuer });
        const response = await fetch(`/api/cards?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load issuer cards");
        }

        const data: CardResult[] = await response.json();
        setIssuerCardOptions(data);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setIssuerCardOptions([]);
        setIssuerCardError(fetchError instanceof Error ? fetchError.message : "Failed to load issuer cards");
      } finally {
        if (!controller.signal.aborted) {
          setIssuerCardLoading(false);
        }
      }
    };

    loadIssuerCards();

    return () => {
      controller.abort();
    };
  }, [activeIssuer]);

  const addCardInstance = (card: CardResult) => {
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

  const attemptAddCard = (card: CardResult) => {
    const hasDuplicate = selectedCards.some((selected) => selected.cardId === card.id);
    resetSearchState();

    if (hasDuplicate) {
      setPendingDuplicate({ card });
      return;
    }

    addCardInstance(card);
  };

  const addDuplicateInstance = (card: CardResult) => {
    addCardInstance(card);
    setPendingDuplicate(null);
    setDuplicateToast({ message: `Added another ${card.card_name}.` });
  };

  const confirmDuplicateAdd = () => {
    if (!pendingDuplicate) return;
    addDuplicateInstance(pendingDuplicate.card);
  };

  const removeCardInstance = (instanceId: string) => {
    setSelectedCards((prev) => {
      const cardToRemove = prev.find((card) => card.instanceId === instanceId);
      const next = prev.filter((card) => card.instanceId !== instanceId);

      if (cardToRemove && pendingDuplicate && cardToRemove.cardId === pendingDuplicate.card.id) {
        const stillHasCard = next.some((card) => card.cardId === pendingDuplicate.card.id);
        if (!stillHasCard) {
          setPendingDuplicate(null);
        }
      }

      return next;
    });
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
      if (highlighted) {
        attemptAddCard(highlighted);
      }
    }
  };

  const ctaLabel = useMemo(() => {
    if (selectedCards.length === 0) {
      return "Select a card to continue";
    }

    return `Continue with ${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"}`;
  }, [selectedCards.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Step 1 of 2 — Add your cards</p>
          <h1 className="text-2xl font-semibold tracking-tight">Add cards</h1>
          <p className="mt-2 text-sm text-slate-400">Build your digital wallet with your cards.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 sm:p-4">
            <div>
              <label htmlFor="card-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Search cards
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="m12.5 12.5 4 4" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  ref={searchInputRef}
                  id="card-search"
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleResultsKeyDown}
                  placeholder="Search cards (e.g., Platinum, Sapphire)"
                  className={`w-full rounded-xl border border-slate-700/70 bg-slate-950/80 py-2.5 pl-10 pr-12 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30 ${rowTransition}`}
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        resetSearchState();
                        searchInputRef.current?.focus();
                      }}
                      className={`rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 ${rowTransition}`}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">⌘K</span>
                  )}
                </div>
              </div>
              {showLoading ? <p className="mt-2 text-xs text-slate-400">Loading cards…</p> : null}
              {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
            </div>

            <div className="mt-5 rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Browse by issuer</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="issuer-select" className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Issuer
                  </label>
                  <select
                    id="issuer-select"
                    value={activeIssuer ?? "all"}
                    onChange={(event) => {
                      const nextIssuer = event.target.value === "all" ? null : event.target.value;
                      setActiveIssuer(nextIssuer);
                      setIssuerCardId(null);
                      setIssuerCardOptions([]);
                    }}
                    className={`w-full appearance-none rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30 ${rowTransition}`}
                  >
                    <option value="all">All issuers</option>
                    {enabledIssuers.map((issuer) => (
                      <option key={issuer.id} value={issuer.id}>
                        {issuer.name}
                      </option>
                    ))}
                    {comingSoonIssuers.map((issuer) => (
                      <option key={issuer.id} value={issuer.id} disabled>
                        {issuer.name} (Coming soon)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="issuer-card-select" className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Card
                  </label>
                  <select
                    id="issuer-card-select"
                    value={issuerCardId ?? ""}
                    onChange={(event) => {
                      const selectedCard = issuerCardOptions.find((card) => card.id === event.target.value);
                      if (!selectedCard) {
                        setIssuerCardId(null);
                        return;
                      }

                      setIssuerCardId(selectedCard.id);
                      attemptAddCard(selectedCard);
                      setIssuerCardId(null);
                    }}
                    disabled={!activeIssuer || issuerCardLoading}
                    className={`w-full appearance-none rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60 ${rowTransition}`}
                  >
                    <option value="">Select a card…</option>
                    {issuerCardOptions.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.card_name}
                      </option>
                    ))}
                  </select>
                  {issuerCardLoading ? <p className="mt-2 text-xs text-slate-400">Loading issuer cards…</p> : null}
                  {issuerCardError ? <p className="mt-2 text-xs text-rose-300">{issuerCardError}</p> : null}
                </div>
              </div>
            </div>

            {pendingDuplicate ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-950/85 px-3 py-2 shadow-sm shadow-black/30">
                <p className="text-sm text-slate-200" role="status" aria-live="polite">
                  Already in wallet. Add another?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmDuplicateAdd}
                    className={`rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-400/20 ${rowTransition}`}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDuplicate(null)}
                    className={`rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 ${rowTransition}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {duplicateToast ? (
              <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                {duplicateToast.message}
              </div>
            ) : null}

            {shouldShowResults ? (
              <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/70 opacity-100 transition duration-150 ease-out">
                {results.length === 0 && !isLoading && !error ? (
                  <p className="px-3 py-3 text-sm text-slate-400">No cards found.</p>
                ) : (
                  <ul className="max-h-96 overflow-auto py-1">
                    {results.map((card, index) => {
                      const highlighted = index === highlightedIndex;
                      const alreadyAdded = selectedCards.some((selected) => selected.cardId === card.id);

                      return (
                        <li key={`${card.id}-${index}`}>
                          <div
                            className={`flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm ${rowTransition} ${
                              highlighted
                                ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                                : "text-slate-200 hover:border-amber-200/20 hover:bg-slate-800/70 hover:text-slate-100"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate">{card.card_name}</p>
                              <p className="mt-0.5 text-xs text-slate-400">{card.issuer}</p>
                            </div>
                            {alreadyAdded ? (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">In wallet</span>
                                <button
                                  type="button"
                                  onClick={() => addDuplicateInstance(card)}
                                  className="shrink-0 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
                                >
                                  Add Another
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => attemptAddCard(card)}
                                className="shrink-0 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </section>

          <aside className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 sm:p-4">
            <h2 className="text-sm font-medium text-slate-200">Digital Wallet ({selectedCards.length})</h2>
            {selectedCards.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">No cards added yet. Add at least one card to continue.</p>
            ) : null}

            <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/60">
              {selectedCards.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">No cards added yet.</p>
              ) : (
                <ul className="max-h-[22rem] space-y-1 overflow-auto p-2">
                  {selectedCards.map((card) => (
                    <li
                      key={card.instanceId}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm hover:border-slate-700/90 hover:bg-slate-900"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-slate-200">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300/80" aria-hidden />
                        <span className="truncate">{card.card_name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCardInstance(card.instanceId)}
                        className={`shrink-0 rounded-lg px-1.5 py-0.5 text-slate-400 opacity-20 hover:bg-slate-800 hover:text-slate-100 group-hover:opacity-100 ${rowTransition}`}
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

        <div className="mt-6 border-t border-slate-800/70 pt-4">
          <button
            type="button"
            disabled={selectedCards.length === 0}
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium ${rowTransition} ${
              selectedCards.length === 0
                ? "cursor-not-allowed border border-slate-700/80 bg-slate-800/70 text-slate-500"
                : "border border-cyan-300/40 bg-cyan-400/80 text-slate-950 hover:bg-cyan-300/90"
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
