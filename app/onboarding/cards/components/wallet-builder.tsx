"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

type IssuerOption = {
  id: string;
  name: string;
  enabled: boolean;
  kind: "issuer";
};

type CardResult = {
  id: string;
  issuer: string;
  card_name: string;
  network: string | null;
};

type SelectedCardInstance = {
  instanceId: string;
  cardId: string;
  card_name: string;
  issuer: string;
  network: string | null;
};

type Toast = {
  id: string;
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

const rowTransition = "transition motion-safe:duration-200 ease-out";
const controlClasses =
  "w-full rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 text-sm text-white/95 outline-none placeholder:text-white/45 focus:border-[#F7C948]/35 focus:ring-2 focus:ring-[#F7C948]/20";

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicateState | null>(null);

  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const latestQueryRef = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimersRef = useRef<Record<string, number>>({});
  const loadingDelayRef = useRef<number | null>(null);
  const normalizedQuery = query.trim();
  const isSearching = query.trim().length > 0;
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

  const resetAllInputsAfterAdd = () => {
    setQuery("");
    if (results.length) setResults([]);
    if (highlightedIndex !== 0) setHighlightedIndex(0);
    if (error) setError(null);
    if (isLoading) setIsLoading(false);

    setShowLoading(false);
    if (loadingDelayRef.current) {
      window.clearTimeout(loadingDelayRef.current);
      loadingDelayRef.current = null;
    }

    requestSeqRef.current += 1;
    if (requestAbortRef.current) {
      requestAbortRef.current.abort();
      requestAbortRef.current = null;
    }

    setActiveIssuer(null);
    setIssuerCardId(null);
    setIssuerCardOptions([]);
    setIssuerCardLoading(false);
    setIssuerCardError(null);
    setPendingDuplicate(null);

    searchInputRef.current?.focus();
  };

  const removeToast = (id: string) => {
    const existingTimer = toastTimersRef.current[id];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete toastTimersRef.current[id];
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const pushToast = (message: string) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setToasts((prev) => [...prev, { id, message }]);

    const timeout = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      delete toastTimersRef.current[id];
    }, 2800);

    toastTimersRef.current[id] = timeout;
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
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? "Failed to load cards");
        }

        const data: CardResult[] = await response.json();
        if (seq !== requestSeqRef.current) return;

        setResults(data);
        setError(null);
        setHighlightedIndex((prev) => (data.length === 0 ? 0 : Math.min(prev, data.length - 1)));
      } catch (fetchError) {
        if (controller.signal.aborted || seq !== requestSeqRef.current) return;

        setError(fetchError instanceof Error ? fetchError.message : "Failed to load cards");
        setResults([]);
      } finally {
        if (seq === requestSeqRef.current) setIsLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [normalizedQuery, shouldShowResults, singleEnabledIssuerId]);

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current = {};
    };
  }, []);

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
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? "Failed to load issuer cards");
        }

        const data: CardResult[] = await response.json();
        setIssuerCardOptions(data);
      } catch (fetchError) {
        if (controller.signal.aborted) return;

        setIssuerCardOptions([]);
        setIssuerCardError(fetchError instanceof Error ? fetchError.message : "Failed to load issuer cards");
      } finally {
        if (!controller.signal.aborted) setIssuerCardLoading(false);
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
        issuer: card.issuer,
        network: card.network,
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
    resetAllInputsAfterAdd();
    pushToast(`Added another ${card.card_name}.`);
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
    if (selectedCards.length === 0) return "Select a card to continue";

    return `Continue with ${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"}`;
  }, [selectedCards.length]);

  return (
    <AppShell containerClassName="py-8 sm:py-10">
      <div className="pointer-events-none fixed right-6 top-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Surface
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl px-3 py-2"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="text-sm text-white/90">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className={cn("-mr-1 shrink-0 rounded-md px-1 text-white/70 hover:bg-white/10 hover:text-white", rowTransition)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </Surface>
        ))}
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-white/55">Step 1 of 2 — Add your cards</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Add cards</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
          Build your digital wallet with your cards.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Surface as="section" className="p-4 sm:p-5">
          <div>
            <label htmlFor="card-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/60">
              Search cards
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/40" aria-hidden>
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
                className={cn(controlClasses, "pl-10 pr-12", rowTransition)}
              />
              <div className="absolute inset-y-0 right-3 flex items-center">
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetSearchState();
                      searchInputRef.current?.focus();
                    }}
                    className={cn("rounded-md px-1.5 py-0.5 text-white/55 hover:bg-white/10 hover:text-white", rowTransition)}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : (
                  <span className="text-xs font-medium text-white/40">⌘K</span>
                )}
              </div>
            </div>
            {showLoading ? <p className="mt-2 text-xs text-white/60">Loading cards…</p> : null}
            {error ? <p className="mt-2 text-xs text-[#F7C948]">{error}</p> : null}
          </div>

          {shouldShowResults ? (
            <Surface
              className={cn(
                "mt-3 rounded-xl border-white/10 bg-white/5 opacity-100",
                "motion-safe:transition motion-safe:duration-200 motion-safe:ease-out",
              )}
            >
              {results.length === 0 && !isLoading && !error ? (
                <p className="px-3 py-3 text-sm text-white/60">No cards found.</p>
              ) : (
                <ul className="max-h-96 overflow-auto py-1">
                  {results.map((card, index) => {
                    const highlighted = index === highlightedIndex;
                    const alreadyAdded = selectedCards.some((selected) => selected.cardId === card.id);

                    return (
                      <li key={`${card.id}-${index}`}>
                        <div
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm",
                            rowTransition,
                            highlighted
                              ? "border-[#F7C948]/40 bg-[#F7C948]/12 text-white"
                              : "text-white/90 hover:border-[#F7C948]/30 hover:bg-[#F7C948]/10 hover:text-white",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{card.card_name}</p>
                            <p className="mt-0.5 text-xs text-white/55">{card.issuer}</p>
                          </div>
                          {alreadyAdded ? (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/55">In wallet</span>
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => addDuplicateInstance(card)}
                                className="rounded-lg px-2 py-1 text-xs"
                              >
                                Add Another
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() => attemptAddCard(card)}
                              className="rounded-lg px-2 py-1 text-xs"
                            >
                              + Add
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Surface>
          ) : null}

          <Surface
            className={cn(
              "mt-5 rounded-xl border-white/10 bg-white/5 p-3 transition-opacity transition-transform motion-safe:duration-200 ease-out",
              isSearching
                ? "pointer-events-none translate-y-1 scale-[0.99] opacity-60"
                : "pointer-events-auto translate-y-0 scale-100 opacity-100",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">Browse by issuer</p>
              {isSearching ? <span className="text-xs text-white/55">Clear search to browse</span> : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="issuer-select" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/50">
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
                  className={cn(controlClasses, "appearance-none", rowTransition)}
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
                <label
                  htmlFor="issuer-card-select"
                  className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/50"
                >
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
                  className={cn(
                    controlClasses,
                    "appearance-none disabled:cursor-not-allowed disabled:opacity-60",
                    rowTransition,
                  )}
                >
                  <option value="">Select a card…</option>
                  {issuerCardOptions.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.card_name}
                    </option>
                  ))}
                </select>
                {issuerCardLoading ? <p className="mt-2 text-xs text-white/60">Loading issuer cards…</p> : null}
                {issuerCardError ? <p className="mt-2 text-xs text-[#F7C948]">{issuerCardError}</p> : null}
              </div>
            </div>
          </Surface>

          {pendingDuplicate ? (
            <Surface className="mt-3 flex items-center justify-between gap-3 rounded-xl border-white/15 px-3 py-2">
              <p className="text-sm text-white/85" role="status" aria-live="polite">
                Already in wallet. Add another?
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={confirmDuplicateAdd} size="sm" variant="subtle" className="rounded-md px-2.5 py-1 text-xs">
                  Add
                </Button>
                <Button
                  type="button"
                  onClick={() => setPendingDuplicate(null)}
                  size="sm"
                  variant="secondary"
                  className="rounded-md px-2.5 py-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </Surface>
          ) : null}
        </Surface>

        <Surface as="aside" className="p-4 sm:p-5">
          <h2 className="text-sm font-medium text-white/90">Digital Wallet ({selectedCards.length})</h2>
          {selectedCards.length === 0 ? (
            <p className="mt-1 text-xs text-white/60">No cards added yet. Add at least one card to continue.</p>
          ) : null}

          <Surface className="mt-3 rounded-xl border-white/10 bg-white/5">
            {selectedCards.length === 0 ? (
              <p className="px-3 py-4 text-sm text-white/45">No cards added yet.</p>
            ) : (
              <ul className="max-h-[22rem] space-y-1 overflow-auto p-2">
                {selectedCards.map((card) => (
                  <li
                    key={card.instanceId}
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm",
                      "motion-safe:transition motion-safe:duration-200 ease-out hover:border-[#F7C948]/30 hover:bg-[#F7C948]/10",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2 text-white/90">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#7FB6FF]/90" aria-hidden />
                      <span className="truncate">{card.card_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCardInstance(card.instanceId)}
                      className={cn(
                        "shrink-0 rounded-lg px-1.5 py-0.5 text-white/55 opacity-20 hover:bg-white/10 hover:text-white group-hover:opacity-100",
                        rowTransition,
                      )}
                      aria-label={`Remove ${card.card_name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </Surface>
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <Button
          type="button"
          disabled={selectedCards.length === 0}
          size="lg"
          className={cn(
            "w-full",
            selectedCards.length === 0 &&
              "border border-white/15 bg-white/8 text-white/45 shadow-none hover:brightness-100 active:brightness-100",
          )}
        >
          {ctaLabel}
        </Button>
      </div>
    </AppShell>
  );
}
