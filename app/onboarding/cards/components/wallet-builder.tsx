"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { CardResult, CardResultsList } from "./card-results-list";

type IssuerOption = {
  id: string;
  name: string;
  enabled: boolean;
  kind: "issuer";
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

const ISSUER_OPTIONS: IssuerOption[] = [
  { id: "amex", name: "American Express", enabled: true, kind: "issuer" },
  { id: "chase", name: "Chase", enabled: false, kind: "issuer" },
  { id: "capital-one", name: "Capital One", enabled: false, kind: "issuer" },
  { id: "citi", name: "Citi", enabled: false, kind: "issuer" },
];

const rowTransition = "transition motion-safe:duration-200 ease-out";
const controlClasses =
  "w-full rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 text-sm outline-none placeholder:text-white/45 focus:border-[#F7C948]/35 focus:ring-2 focus:ring-[#F7C948]/20";

export function WalletBuilder() {
  const [activeIssuer, setActiveIssuer] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCards, setSelectedCards] = useState<SelectedCardInstance[]>([]);
  const [issuerCardOptions, setIssuerCardOptions] = useState<CardResult[]>([]);
  const [issuerCardLoading, setIssuerCardLoading] = useState(false);
  const [issuerCardError, setIssuerCardError] = useState<string | null>(null);
  const [selectedIssuerCardId, setSelectedIssuerCardId] = useState("");
  const [pendingIssuerDuplicate, setPendingIssuerDuplicate] = useState<CardResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const latestQueryRef = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const toastTimersRef = useRef<Record<string, number>>({});
  const loadingDelayRef = useRef<number | null>(null);

  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length > 0;
  const shouldShowResults = normalizedQuery.length >= 1;
  const enabledIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && option.enabled);
  const comingSoonIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && !option.enabled);
  const walletCardIds = useMemo(() => new Set(selectedCards.map((selected) => selected.cardId)), [selectedCards]);
  const issuerHasValue = activeIssuer !== "";
  const cardHasValue = Boolean(selectedIssuerCardId);

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

  const addCard = (card: CardResult) => {
    if (walletCardIds.has(card.id)) return;
    addCardInstance(card);
  };

  const addDuplicateInstance = (card: CardResult) => {
    addCardInstance(card);
    pushToast(`Added another ${card.card_name}.`);
  };

  const resetSearchUI = useCallback(({ focus = true }: { focus?: boolean } = {}) => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsLoading(false);
    setShowLoading(false);
    setHighlightedIndex(0);
    requestSeqRef.current += 1;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    if (focus) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, []);

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
    return () => document.removeEventListener("keydown", handleFocusShortcut);
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
    if (!shouldShowResults) return;

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
        if (singleEnabledIssuerId) params.set("issuer", singleEnabledIssuerId);

        const response = await fetch(`/api/cards?${params.toString()}`, { method: "GET", signal: controller.signal });

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

    return () => window.clearTimeout(timeout);
  }, [normalizedQuery, shouldShowResults, singleEnabledIssuerId]);

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
    setIssuerCardOptions([]);
    setIssuerCardError(null);
    setSelectedIssuerCardId("");
    setPendingIssuerDuplicate(null);

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
        const response = await fetch(`/api/cards?${params.toString()}`, { method: "GET", signal: controller.signal });

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

    return () => controller.abort();
  }, [activeIssuer]);

  useEffect(() => {
    if (!isSearching && !shouldShowResults) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchAreaRef.current?.contains(target)) return;
      resetSearchUI({ focus: false });
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      resetSearchUI({ focus: false });
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSearching, shouldShowResults, resetSearchUI]);

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current = {};
    };
  }, []);

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
        if (walletCardIds.has(highlighted.id)) {
          addDuplicateInstance(highlighted);
        } else {
          addCard(highlighted);
        }
        resetSearchUI({ focus: true });
      }
    }
  };

  const handleIssuerCardSelect = (nextCardId: string) => {
    setSelectedIssuerCardId(nextCardId);
    if (!nextCardId) {
      setPendingIssuerDuplicate(null);
      return;
    }

    const nextCard = issuerCardOptions.find((card) => card.id === nextCardId);
    if (!nextCard) return;

    if (walletCardIds.has(nextCard.id)) {
      setPendingIssuerDuplicate(nextCard);
      return;
    }

    addCard(nextCard);
    setSelectedIssuerCardId("");
  };

  const ctaLabel = useMemo(() => {
    if (selectedCards.length === 0) return "Select a card to continue";
    return `Add ${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"} to your Viero wallet`;
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
          Time to flex your lineup — let's see what cards you're working with
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Surface as="section" className="self-start p-4 sm:p-5">
          <div ref={searchAreaRef}>
            <label htmlFor="card-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/60">
              <span className="font-semibold">Search cards</span>
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
                placeholder="Search by credit card (e.g., Sapphire, Platinum)"
                autoComplete="off"
                className={cn(controlClasses, "pl-9 text-white/95", rowTransition)}
              />
            </div>

          {shouldShowResults ? (
            <CardResultsList
              className={cn(
                "mt-3",
                showLoading || error || results.length > 0
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0",
              )}
              cards={results}
              walletCardIds={walletCardIds}
              onAdd={(card) => {
                addCard(card);
                resetSearchUI({ focus: true });
              }}
              onAddAnother={(card) => {
                addDuplicateInstance(card);
                resetSearchUI({ focus: true });
              }}
              isLoading={showLoading}
              error={error}
              highlightedIndex={highlightedIndex}
            />
          ) : null}

          <div
            className={cn(
              "mt-5 transition-opacity transition-transform motion-safe:duration-200 ease-out",
              isSearching
                ? "pointer-events-none translate-y-1 scale-[0.99] opacity-60"
                : "pointer-events-auto translate-y-0 scale-100 opacity-100",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                <span className="font-semibold">Browse by issuer</span>
              </p>
              {isSearching ? <span className="text-xs text-white/55">Clear search to browse</span> : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="issuer-select" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/50">
                  Issuer
                </label>
                <select
                  id="issuer-select"
                  value={activeIssuer}
                  onChange={(event) => {
                    const nextIssuer = event.target.value;
                    setActiveIssuer(nextIssuer);
                    if (nextIssuer === "") {
                      setSelectedIssuerCardId("");
                      setPendingIssuerDuplicate(null);
                    }
                  }}
                  className={cn(
                    controlClasses,
                    "appearance-none",
                    rowTransition,
                    issuerHasValue ? "text-white/95" : "text-white/45",
                  )}
                >
                  <option value="">
                    Select an issuer
                  </option>
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
                <label htmlFor="issuer-card-select" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/50">
                  Card
                </label>
                <select
                  id="issuer-card-select"
                  value={selectedIssuerCardId}
                  onChange={(event) => handleIssuerCardSelect(event.target.value)}
                  disabled={!issuerHasValue}
                  className={cn(
                    controlClasses,
                    "appearance-none",
                    rowTransition,
                    !issuerHasValue && "cursor-not-allowed border-white/10 bg-white/5 opacity-50",
                    cardHasValue ? "text-white/95" : "text-white/45",
                  )}
                >
                  <option value="" disabled>
                    Select a card
                  </option>
                  {issuerCardOptions.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.card_name}
                    </option>
                  ))}
                </select>

                {issuerCardLoading ? <p className="mt-2 text-xs text-white/60">Loading issuer cards…</p> : null}
                {issuerCardError ? <p className="mt-2 text-xs text-[#F7C948]">{issuerCardError}</p> : null}
                {pendingIssuerDuplicate ? (
                  <Surface className="mt-3 rounded-xl border-[#F7C948]/30 bg-white/8 p-3">
                    <p className="text-sm text-white/90">
                      {pendingIssuerDuplicate.card_name} is already in your wallet. Add another?
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPendingIssuerDuplicate(null);
                          setSelectedIssuerCardId("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          addDuplicateInstance(pendingIssuerDuplicate);
                          setPendingIssuerDuplicate(null);
                          setSelectedIssuerCardId("");
                        }}
                      >
                        Add another
                      </Button>
                    </div>
                  </Surface>
                ) : null}
              </div>
            </div>
          </div>
          </div>
        </Surface>

        <Surface as="aside" className="flex flex-col p-4 sm:p-5">
          <h2 className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/60">
            <span className="font-semibold">Viero Wallet</span> ({selectedCards.length})
          </h2>
          

          {selectedCards.length === 0 ? (
            <p className="mt-3 px-3 py-4 text-center text-sm text-white/45">Your wallet’s looking a little light...</p>
          ) : (
            <div className="mt-3 max-h-[22rem] flex-1 overflow-y-auto pr-1">
              <ul className="space-y-1">
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
                      onClick={() =>
                        setSelectedCards((prev) => prev.filter((selectedCard) => selectedCard.instanceId !== card.instanceId))
                      }
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
            </div>
          )}
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
