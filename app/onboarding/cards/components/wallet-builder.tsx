"use client";

import { useMemo, useState, useEffect, useRef, KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCards, setSelectedCards] = useState<SelectedCardInstance[]>([]);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [duplicateToast, setDuplicateToast] = useState<DuplicateToastState | null>(null);

  const requestAbortRef = useRef<AbortController | null>(null);
  const moreContainerRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const normalizedQuery = query.trim();
  const shouldShowResults = normalizedQuery.length >= 1;
  const enabledIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && option.enabled);
  const comingSoonIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && !option.enabled);
  const selectedIssuerLabel =
    activeIssuer === null
      ? "All issuers"
      : ISSUER_OPTIONS.find((option) => option.id === activeIssuer)?.name ?? "All issuers";

  const resetSearchState = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setHighlightedIndex(0);
    setIsLoading(false);
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
        const params = new URLSearchParams({ q: normalizedQuery });

        if (activeIssuer) {
          params.set("issuer", activeIssuer);
        } else if (enabledIssuers.length === 1) {
          params.set("issuer", enabledIssuers[0].id);
        }

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
  }, [activeIssuer, enabledIssuers, normalizedQuery, shouldShowResults]);

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (!moreContainerRef.current?.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreMenuOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    if (isMoreMenuOpen) {
      window.setTimeout(() => {
        moreMenuRef.current?.focus();
      }, 0);
    }
  }, [isMoreMenuOpen]);

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
    if (!duplicateToast) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setDuplicateToast(null);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [duplicateToast]);

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
      setDuplicateToast({ card });
      return;
    }

    addCardInstance(card);
  };

  const confirmDuplicateAdd = () => {
    if (!duplicateToast) return;
    addCardInstance(duplicateToast.card);
    setDuplicateToast(null);
  };

  const removeCardInstance = (instanceId: string) => {
    setSelectedCards((prev) => prev.filter((card) => card.instanceId !== instanceId));
  };

  const handleIssuerClick = (issuerId: string | null) => {
    setIsMoreMenuOpen(false);

    if (issuerId === activeIssuer) {
      return;
    }

    setActiveIssuer(issuerId);
    resetSearchState();
  };

  const handleClearIssuer = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (activeIssuer === null) {
      return;
    }

    setActiveIssuer(null);
    setIsMoreMenuOpen(false);
    resetSearchState();
  };

  const handleMoreButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsMoreMenuOpen((prev) => !prev);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsMoreMenuOpen(false);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsMoreMenuOpen(true);
    }
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
        const alreadyAdded = selectedCards.some((selected) => selected.cardId === highlighted.id);
        if (!alreadyAdded) {
          attemptAddCard(highlighted);
        }
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
              {isLoading ? <p className="mt-2 text-xs text-slate-400">Loading cards…</p> : null}
              {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
            </div>

            <div className="relative mt-3" ref={moreContainerRef}>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">Issuer</label>
              <button
                ref={moreButtonRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isMoreMenuOpen}
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                onKeyDown={handleMoreButtonKeyDown}
                className={`group flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 hover:border-slate-600 focus:border-cyan-300/70 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 ${rowTransition}`}
              >
                <span>{selectedIssuerLabel}</span>
                <span className="flex items-center gap-2">
                  {activeIssuer !== null ? (
                    <button
                      type="button"
                      onClick={handleClearIssuer}
                      className={`rounded px-1 text-slate-400 opacity-0 hover:bg-slate-800 hover:text-slate-100 group-hover:opacity-100 group-focus-within:opacity-100 ${rowTransition}`}
                      aria-label="Clear issuer filter"
                    >
                      ×
                    </button>
                  ) : null}
                  <span className="text-slate-500" aria-hidden>
                    ▾
                  </span>
                </span>
              </button>
              {isMoreMenuOpen ? (
                <div
                  ref={moreMenuRef}
                  role="listbox"
                  tabIndex={-1}
                  className="absolute left-0 top-full z-20 mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/95 p-2 shadow-lg shadow-black/30"
                >
                  <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-slate-500">Available</p>
                  <button
                    type="button"
                    onClick={() => handleIssuerClick(null)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ${rowTransition} ${
                      activeIssuer === null
                        ? "bg-cyan-400/10 text-cyan-100"
                        : "text-slate-200 hover:bg-slate-800/80 hover:text-slate-100"
                    }`}
                  >
                    <span>All issuers</span>
                    {activeIssuer === null ? <span className="text-cyan-200">✓</span> : null}
                  </button>
                  {enabledIssuers.map((issuer) => (
                    <button
                      key={issuer.id}
                      type="button"
                      onClick={() => handleIssuerClick(issuer.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ${rowTransition} ${
                        activeIssuer === issuer.id
                          ? "bg-cyan-400/10 text-cyan-100"
                          : "text-slate-200 hover:bg-slate-800/80 hover:text-slate-100"
                      }`}
                    >
                      <span>{issuer.name}</span>
                      {activeIssuer === issuer.id ? <span className="text-cyan-200">✓</span> : null}
                    </button>
                  ))}
                  <div className="my-2 border-t border-slate-700/70" />
                  <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-slate-500">Coming soon</p>
                  <div className="space-y-1">
                    {comingSoonIssuers.map((issuer) => (
                      <div key={issuer.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-500">
                        <span>{issuer.name}</span>
                        <span className="text-xs italic text-slate-600">Coming soon</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {duplicateToast ? (
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
                    onClick={() => setDuplicateToast(null)}
                    className={`rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 ${rowTransition}`}
                  >
                    Cancel
                  </button>
                </div>
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
                          <button
                            type="button"
                            onClick={() => {
                              if (!alreadyAdded) {
                                attemptAddCard(card);
                              }
                            }}
                            disabled={alreadyAdded}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm ${rowTransition} ${
                              highlighted
                                ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                                : "text-slate-200 hover:border-amber-200/20 hover:bg-slate-800/70 hover:text-slate-100"
                            } ${alreadyAdded ? "opacity-80" : ""}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate">{card.card_name}</p>
                              {activeIssuer === null ? <p className="mt-0.5 text-xs text-slate-400">{card.issuer}</p> : null}
                            </div>
                            {alreadyAdded ? (
                              <span className="shrink-0 rounded-lg border border-slate-700/80 bg-slate-900/70 px-2 py-1 text-xs text-slate-300">
                                Added ✓
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100">
                                + Add
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/70">
                <p className="px-3 py-3 text-sm text-slate-400">Start typing to find your card.</p>
              </div>
            )}
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
