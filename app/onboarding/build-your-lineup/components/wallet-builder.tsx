"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { createClient } from "@/utils/supabase/client";
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
  product_key: string | null;
  card_name: string;
  display_name: string | null;
  issuer: string;
  network: string | null;
  isPersisted: boolean;
};

type WalletCard = {
  id: string;
  product_key: string | null;
  card_name: string;
  display_name: string | null;
  issuer: string;
  network: string | null;
};

type WalletCardRow = {
  cards: WalletCard[] | null;
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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
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
  const [isSaving, setIsSaving] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [removeTargetCard, setRemoveTargetCard] = useState<SelectedCardInstance | null>(null);
  const [removeCardError, setRemoveCardError] = useState<string | null>(null);
  const [isRemovingCard, setIsRemovingCard] = useState(false);
  const [pendingActionError, setPendingActionError] = useState<string | null>(null);
  const [committingPendingIds, setCommittingPendingIds] = useState<Set<string>>(new Set());
  const [showScrollCue, setShowScrollCue] = useState(false);
  const [showWalletScrollCue, setShowWalletScrollCue] = useState(false);

  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const latestQueryRef = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputWrapRef = useRef<HTMLDivElement | null>(null);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const resultsOverlayRef = useRef<HTMLDivElement | null>(null);
  const pendingListRef = useRef<HTMLDivElement | null>(null);
  const walletListRef = useRef<HTMLDivElement | null>(null);
  const loadingDelayRef = useRef<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [resultsOverlayStyle, setResultsOverlayStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length > 0;
  const shouldShowResults = normalizedQuery.length >= 1;
  const enabledIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && option.enabled);
  const comingSoonIssuers = ISSUER_OPTIONS.filter((option) => option.kind === "issuer" && !option.enabled);
  const walletCardIds = useMemo(() => new Set(selectedCards.map((selected) => selected.cardId)), [selectedCards]);
  const savedCardIds = useMemo(
    () => new Set(selectedCards.filter((selected) => selected.isPersisted).map((selected) => selected.cardId)),
    [selectedCards],
  );
  const pendingCardIds = useMemo(
    () => new Set(selectedCards.filter((selected) => !selected.isPersisted).map((selected) => selected.cardId)),
    [selectedCards],
  );
  const issuerHasValue = activeIssuer !== "";
  const cardHasValue = Boolean(selectedIssuerCardId);
  const savedCards = useMemo(() => selectedCards.filter((card) => card.isPersisted), [selectedCards]);
  const pendingCards = useMemo(() => selectedCards.filter((card) => !card.isPersisted), [selectedCards]);

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
        product_key: card.product_key,
        card_name: card.card_name,
        display_name: card.display_name,
        issuer: card.issuer,
        network: card.network,
        isPersisted: false,
      },
    ]);
  };

  const addCard = (card: CardResult) => {
    if (walletCardIds.has(card.id)) return;
    setPendingActionError(null);
    addCardInstance(card);
  };

  const loadExistingWalletCards = useCallback(
    async ({ keepPending = true }: { keepPending?: boolean } = {}) => {
      setIsWalletLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (userError) {
          console.error("Failed to load authenticated user", userError);
        }
        setIsWalletLoading(false);
        return;
      }

      const { data, error: walletError } = await supabase
        .from("user_cards")
        .select("cards(id, product_key, card_name, display_name, issuer, network)")
        .eq("user_id", user.id);

      if (walletError) {
        console.error("Failed to load wallet cards", walletError);
        setIsWalletLoading(false);
        return;
      }

      const walletRows: WalletCardRow[] = data ?? [];

      const walletCards: WalletCard[] = walletRows.flatMap((row) => {
        const cards = row.cards;
        if (!Array.isArray(cards)) return [];

        return cards.filter(
          (card): card is WalletCard =>
            Boolean(card) &&
            typeof card.id === "string" &&
            typeof card.card_name === "string" &&
            typeof card.issuer === "string",
        );
      });

      setSelectedCards((prev) => {
        const nextPendingCards = keepPending ? prev.filter((card) => !card.isPersisted) : [];

        const persistedCards: SelectedCardInstance[] = walletCards.map((card) => ({
          instanceId: `persisted-${card.id}`,
          cardId: card.id,
          product_key: card.product_key,
          card_name: card.card_name,
          display_name: card.display_name,
          issuer: card.issuer,
          network: card.network,
          isPersisted: true,
        }));

        const pendingWithoutPersistedDuplicates = nextPendingCards.filter(
          (card) => !walletCards.some((wallet) => wallet.id === card.cardId),
        );

        return [...persistedCards, ...pendingWithoutPersistedDuplicates];
      });

      setIsWalletLoading(false);
    },
    [supabase],
  );

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
    setIsClient(true);
  }, []);

  useEffect(() => {
    void loadExistingWalletCards();
  }, [loadExistingWalletCards]);

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
      if (resultsOverlayRef.current?.contains(target)) return;
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
    if (!shouldShowResults || !isClient) {
      setResultsOverlayStyle(null);
      return;
    }

    const updateOverlayPosition = () => {
      const anchor = searchInputWrapRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setResultsOverlayStyle({
        top: rect.bottom + 12,
        left: rect.left,
        width: rect.width,
      });
    };

    updateOverlayPosition();
    window.addEventListener("resize", updateOverlayPosition);
    window.addEventListener("scroll", updateOverlayPosition, true);

    return () => {
      window.removeEventListener("resize", updateOverlayPosition);
      window.removeEventListener("scroll", updateOverlayPosition, true);
    };
  }, [shouldShowResults, isClient, results.length, showLoading, error]);

  const updatePendingScrollCue = useCallback(() => {
    const element = pendingListRef.current;
    if (!element) return;

    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    setShowScrollCue(canScroll && !atBottom);
  }, []);

  const updateWalletScrollCue = useCallback(() => {
    const element = walletListRef.current;
    if (!element) return;

    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    setShowWalletScrollCue(canScroll && !atBottom);
  }, []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updatePendingScrollCue);
    window.addEventListener("resize", updatePendingScrollCue);
    window.addEventListener("resize", updateWalletScrollCue);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePendingScrollCue);
      window.removeEventListener("resize", updateWalletScrollCue);
    };
  }, [updatePendingScrollCue, updateWalletScrollCue]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updatePendingScrollCue);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [pendingCards.length, updatePendingScrollCue]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updateWalletScrollCue);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [savedCards.length, isWalletLoading, updateWalletScrollCue]);

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
        if (walletCardIds.has(highlighted.id)) return;
        addCard(highlighted);
        resetSearchUI({ focus: true });
      }
    }
  };

  const handleIssuerCardSelect = (nextCardId: string) => {
    setSelectedIssuerCardId(nextCardId);
    if (!nextCardId) return;

    const nextCard = issuerCardOptions.find((card) => card.id === nextCardId);
    if (!nextCard) return;

    if (walletCardIds.has(nextCard.id)) {
      setSelectedIssuerCardId("");
      return;
    }

    addCard(nextCard);
    setSelectedIssuerCardId("");
  };

  const resolveCanonicalCard = useCallback(
    async (selected: SelectedCardInstance): Promise<{ id: string; product_key: string | null } | null> => {
      if (selected.product_key) {
        const { data, error } = await supabase
          .from("cards")
          .select("id, product_key")
          .eq("product_key", selected.product_key)
          .order("id", { ascending: true })
          .limit(1);

        if (error) {
          console.error("Failed to resolve card by product_key", error);
          return { id: selected.cardId, product_key: selected.product_key };
        }

        const canonicalCard = data?.[0];
        if (canonicalCard?.id) {
          return { id: canonicalCard.id, product_key: canonicalCard.product_key };
        }

        return { id: selected.cardId, product_key: selected.product_key };
      }

      return { id: selected.cardId, product_key: selected.product_key };
    },
    [supabase],
  );

  const addCardToWallet = useCallback(
    async (userId: string, cardId: string) =>
      supabase.from("user_cards").upsert(
        {
          user_id: userId,
          card_id: cardId,
        },
        { onConflict: "user_id,card_id", ignoreDuplicates: true },
      ),
    [supabase],
  );

  const handleRequestRemove = useCallback(
    (card: SelectedCardInstance) => {
      if (!card.isPersisted || isRemovingCard) return;
      setRemoveTargetCard(card);
      setRemoveCardError(null);
    },
    [isRemovingCard],
  );

  const handleCancelRemove = useCallback(() => {
    if (isRemovingCard) return;
    setRemoveTargetCard(null);
    setRemoveCardError(null);
  }, [isRemovingCard]);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTargetCard || !removeTargetCard.isPersisted || isRemovingCard) return;

    setIsRemovingCard(true);
    setRemoveCardError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setRemoveCardError("Could not verify your account. Please try again.");
      setIsRemovingCard(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", user.id)
      .eq("card_id", removeTargetCard.cardId);

    if (deleteError) {
      console.error("Failed to remove card from wallet", deleteError);
      setRemoveCardError("Could not remove this card right now. Please try again.");
      setIsRemovingCard(false);
      return;
    }

    setSelectedCards((prev) => prev.filter((card) => card.cardId !== removeTargetCard.cardId));
    setRemoveTargetCard(null);
    setRemoveCardError(null);
    setIsRemovingCard(false);
  }, [isRemovingCard, removeTargetCard, supabase]);

  const handleContinue = async () => {
    if (pendingCards.length === 0 || isSaving) return;

    const pendingInstanceIds = pendingCards.map((card) => card.instanceId);
    setPendingActionError(null);
    setCommittingPendingIds(new Set(pendingInstanceIds));
    setIsSaving(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 160));

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (userError) console.error("Failed to load authenticated user", userError);
        setPendingActionError("Could not verify your account. Please try again.");
        return;
      }

      const resolvedCards = await Promise.all(pendingCards.map((card) => resolveCanonicalCard(card)));
      const uniqueCardIds = Array.from(
        new Set(
          resolvedCards
            .filter((card): card is { id: string; product_key: string | null } => Boolean(card?.id))
            .map((card) => card.id),
        ),
      );
      if (uniqueCardIds.length === 0) {
        setSelectedCards((prev) => prev.filter((card) => card.isPersisted));
        return;
      }

      const { data: existingRows, error: existingError } = await supabase
        .from("user_cards")
        .select("card_id")
        .eq("user_id", user.id)
        .in("card_id", uniqueCardIds);

      if (existingError) {
        console.error("Failed to check existing cards", existingError);
        setPendingActionError("Could not save cards right now. Please try again.");
        return;
      }

      const existingCardIds = new Set((existingRows ?? []).map((row) => row.card_id));
      const newCardIds = uniqueCardIds.filter((cardId) => !existingCardIds.has(cardId));

      if (newCardIds.length > 0) {
        for (const cardId of newCardIds) {
          const { error: insertError } = await addCardToWallet(user.id, cardId);
          if (insertError) {
            console.error("Failed to save selected cards", insertError);
            setPendingActionError("Could not save cards right now. Please try again.");
            return;
          }
        }
      }

      let bootstrapFailures = 0;
      for (const cardId of newCardIds) {
        const { error: bootstrapError } = await supabase.rpc("bootstrap_user_benefits_for_card", {
          p_user_id: user.id,
          p_card_id: cardId,
        });

        if (bootstrapError) {
          bootstrapFailures += 1;
          console.error(`Failed to bootstrap benefits for card ${cardId}`, bootstrapError);
        }
      }

      if (bootstrapFailures > 0) {
        setPendingActionError("Cards were added, but some benefits may load shortly.");
      }

      await loadExistingWalletCards({ keepPending: false });
    } finally {
      setCommittingPendingIds(new Set());
      setIsSaving(false);
    }
  };

  return (
    <AppShell containerClassName="py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">Step 1 of 2 · Wallet Setup</p>
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 h-8 w-1 rounded-full bg-[#F7C948]" aria-hidden />
          <div>
            <h1
              className="text-3xl font-semibold tracking-tight text-white transition md:text-4xl motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0"
            >
              Build Your Lineup
            </h1>
            <p
              className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 transition md:text-base motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0"
            >
              Add your cards to unlock personalized benefit tracking.
            </p>
          </div>
        </div>
        <div
          className="mx-auto mt-4 h-px w-3/4 bg-gradient-to-r from-transparent via-[#F7C948]/60 to-transparent blur-[0.5px]"
          aria-hidden
        />
      </div>

      <div className="space-y-6">
        <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Surface as="section" className="relative z-30 overflow-visible p-4 sm:p-5">
            <div ref={searchAreaRef}>
              <label htmlFor="card-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/60">
                <span className="font-semibold">Search cards</span>
              </label>
              <div className="relative z-20">
                <div ref={searchInputWrapRef} className="relative">
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
              </div>

              {isClient && shouldShowResults && resultsOverlayStyle
                ? createPortal(
                    <div
                      ref={resultsOverlayRef}
                      className="pointer-events-auto fixed z-[100]"
                      style={{
                        top: resultsOverlayStyle.top,
                        left: resultsOverlayStyle.left,
                        width: resultsOverlayStyle.width,
                      }}
                    >
                      <CardResultsList
                        className={cn(
                          "rounded-2xl border border-white/10 bg-slate-950/85 ring-1 ring-white/5 shadow-2xl shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md",
                          showLoading || error || results.length > 0
                            ? "translate-y-0 opacity-100"
                            : "pointer-events-none -translate-y-1 opacity-0",
                        )}
                        cards={results}
                        savedCardIds={savedCardIds}
                        pendingCardIds={pendingCardIds}
                        onAdd={(card) => {
                          addCard(card);
                          resetSearchUI({ focus: true });
                        }}
                        isLoading={showLoading}
                        error={error}
                        highlightedIndex={highlightedIndex}
                      />
                    </div>,
                    document.body,
                  )
                : null}

              <div
                className={cn(
                  "mt-5 transition-opacity transition-transform motion-safe:duration-200 ease-out",
                  isSearching ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100",
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
                      {issuerCardOptions.map((card) => {
                        const isSaved = savedCardIds.has(card.id);
                        const isPending = pendingCardIds.has(card.id);
                        const isUnavailable = isSaved || isPending;

                        return (
                          <option key={card.id} value={card.id} disabled={isUnavailable}>
                            {card.display_name ?? card.card_name}
                            {isSaved ? " (Saved)" : isPending ? " (Pending)" : ""}
                          </option>
                        );
                      })}
                    </select>

                    {issuerCardLoading ? <p className="mt-2 text-xs text-white/60">Loading issuer cards…</p> : null}
                    {issuerCardError ? <p className="mt-2 text-xs text-[#F7C948]">{issuerCardError}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          <Surface as="aside" className="flex flex-col p-4 sm:p-5">
            <div className="mb-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                  <span className="font-semibold">Pending</span> ({pendingCards.length})
                </p>
                <button
                  type="button"
                  disabled={pendingCards.length === 0 || isSaving}
                  onClick={handleContinue}
                  className="ml-auto shrink-0 rounded-lg border border-[#7FD9A8]/30 bg-[#2E7D57]/20 px-3 py-1.5 text-xs font-medium text-[#BFF3D6] transition-colors hover:border-[#8EE3B4]/45 hover:bg-[#2E7D57]/35 disabled:cursor-not-allowed disabled:border-white/12 disabled:bg-white/8 disabled:text-white/40"
                >
                  {isSaving
                    ? "Adding..."
                    : `Add ${pendingCards.length} ${pendingCards.length === 1 ? "Card" : "Cards"} to Wallet`}
                </button>
              </div>
            </div>

            {pendingActionError ? <p className="mb-2 text-xs text-[#F4B4B4]">{pendingActionError}</p> : null}

            <div className="relative mt-2 h-[8.5rem]">
              <div ref={pendingListRef} className="h-full overflow-y-auto pr-1" onScroll={updatePendingScrollCue}>
                {pendingCards.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-3 py-4">
                    <p className="text-center text-sm text-white/45">Use the search on the left to start adding cards to your wallet.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {pendingCards.map((card) => (
                      <li
                        key={card.instanceId}
                        className={cn(
                          "group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm",
                          "motion-safe:transition motion-safe:duration-200 ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0 hover:border-[#F7C948]/30 hover:bg-[#F7C948]/10",
                          committingPendingIds.has(card.instanceId) && "pointer-events-none translate-y-1 opacity-0",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2 text-white/90">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#7FB6FF]/90" aria-hidden />
                          <span className="truncate">{card.display_name ?? card.card_name}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCards((prev) => prev.filter((selectedCard) => selectedCard.instanceId !== card.instanceId))
                            }
                            className={cn(
                              "rounded-lg px-1.5 py-0.5 text-white/55 opacity-20 hover:bg-white/10 hover:text-white group-hover:opacity-100",
                              rowTransition,
                            )}
                            aria-label={`Remove ${card.display_name ?? card.card_name}`}
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#232833] to-transparent transition-opacity duration-200",
                  showScrollCue ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              >
                <svg
                  viewBox="0 0 20 20"
                  className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 text-white/35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m5.5 7.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </Surface>
        </div>

        <Surface as="section" className="border-white/18 bg-white/10 p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                <span className="font-semibold">Memento Wallet</span> ({savedCards.length})
              </p>
            </div>
          </div>

          {isWalletLoading && savedCards.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/50">Loading your wallet...</p>
          ) : savedCards.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/45">Your lineup starts here.</p>
          ) : (
            <div className="relative max-h-[24rem]">
              <div ref={walletListRef} className="max-h-[24rem] overflow-y-auto pr-1" onScroll={updateWalletScrollCue}>
                <ul className="space-y-2">
                  {savedCards.map((card) => (
                    <li
                      key={card.instanceId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/14 bg-white/9 px-3 py-2.5 transition motion-safe:duration-200 ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate pr-2 text-sm font-medium text-white/90">{card.display_name ?? card.card_name}</p>
                        <p className="mt-0.5 text-xs text-white/55">
                          {card.issuer}
                          {" • "}
                          {card.network ?? "N/A"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ml-auto shrink-0 rounded-lg border border-[#E87979]/30 bg-[#B04646]/20 px-3 py-1.5 text-xs font-medium text-[#F7C5C5] transition-colors hover:border-[#F08A8A]/40 hover:bg-[#B04646]/35 disabled:cursor-not-allowed disabled:border-[#E87979]/15 disabled:bg-[#B04646]/10 disabled:text-[#F7C5C5]/55"
                        onClick={() => handleRequestRemove(card)}
                        aria-label={`Remove ${card.display_name ?? card.card_name} from wallet`}
                      >
                        Remove From Wallet
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#232833] to-transparent transition-opacity duration-200",
                  showWalletScrollCue ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              >
                <svg
                  viewBox="0 0 20 20"
                  className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 text-white/35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m5.5 7.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}
        </Surface>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => router.push("/onboarding/benefits")}
            disabled={savedCards.length === 0}
            className="rounded-lg px-3 text-sm"
          >
            Personalize Your Benefits →
          </Button>
        </div>
      </div>

      {removeTargetCard ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/70 px-4">
          <Surface className="w-full max-w-md space-y-4 p-5">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Remove card from wallet?</h2>
              <p className="text-sm text-white/70">
                This will remove this card and its benefits from your wallet. You can add it again later.
              </p>
            </div>

            {removeCardError ? <p className="text-sm text-[#F4B4B4]">{removeCardError}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={handleCancelRemove} disabled={isRemovingCard}>
                Cancel
              </Button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-[#E87979]/35 bg-[#B04646]/25 px-5 py-2.5 text-sm font-semibold text-[#F9D1D1] transition-colors hover:bg-[#B04646]/40 disabled:cursor-not-allowed disabled:border-[#E87979]/15 disabled:bg-[#B04646]/12 disabled:text-[#F9D1D1]/60"
                onClick={() => void handleConfirmRemove()}
                disabled={isRemovingCard}
              >
                {isRemovingCard ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </Surface>
        </div>
      ) : null}

    </AppShell>
  );
}
