"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CardResult, CardResultsList } from "./card-results-list";

type BaseCardInstance = {
  instanceId: string;
  cardId: string;
  product_key: string | null;
  card_name: string;
  display_name: string | null;
  issuer: string;
  network: string | null;
};

export type SelectedCardInstance = BaseCardInstance;

type WalletCard = {
  id: string;
  product_key: string | null;
  card_name: string;
  display_name: string | null;
  issuer: string;
  network: string | null;
};

type WalletCardRow = {
  card_id: string;
  cards: WalletCard[] | null;
};

type IssuerFilterOption = {
  id: string;
  label: string;
  searchTokens: string[];
};

const rowTransition = "transition motion-safe:duration-200 ease-out";
const controlClasses =
  "w-full rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 text-sm outline-none placeholder:text-white/45 focus:border-[#F7C948]/35 focus:ring-2 focus:ring-[#F7C948]/20";
const ISSUER_FILTER_OPTIONS: IssuerFilterOption[] = [
  { id: "AMEX", label: "AMEX", searchTokens: ["amex", "american express"] },
  { id: "Chase", label: "Chase", searchTokens: ["chase"] },
  { id: "Capital One", label: "Capital One", searchTokens: ["capital one", "capitalone"] },
  { id: "Citi", label: "Citi", searchTokens: ["citi"] },
];

function getCleanCardName(displayName: string | null, cardName: string) {
  let name = displayName ?? cardName;
  if (name.startsWith("American Express ")) {
    name = name.slice("American Express ".length);
  }
  if (name.endsWith(" Card")) {
    name = name.slice(0, -" Card".length);
  }
  return name;
}

function getCanonicalIssuerLabel(issuer: string) {
  const normalizedIssuer = normalizeValue(issuer);
  if (normalizedIssuer === "american express" || normalizedIssuer === "amex") return "AMEX";
  if (normalizedIssuer === "capital one" || normalizedIssuer === "capitalone") return "Capital One";
  if (normalizedIssuer === "chase") return "Chase";
  if (normalizedIssuer === "citi") return "Citi";
  return issuer.trim();
}

function getIssuerDisplayName(issuer: string) {
  return getCanonicalIssuerLabel(issuer);
}

function getCardSortName(displayName: string | null, cardName: string) {
  return getCleanCardName(displayName, cardName).toLowerCase().trim();
}

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getIssuerSearchTokens(issuer: string) {
  const canonicalIssuer = getCanonicalIssuerLabel(issuer);
  const knownOption = ISSUER_FILTER_OPTIONS.find((option) => option.id === canonicalIssuer);
  if (knownOption) return knownOption.searchTokens;
  const normalizedIssuer = normalizeValue(issuer);
  return normalizedIssuer ? [normalizedIssuer] : [];
}

function getMatchScore(value: string, query: string) {
  if (!value) return 0;
  if (value === query) return 700;
  if (value.startsWith(query)) return 500;
  if (value.includes(query)) return 280;
  return 0;
}

function filterAndRankCards(cards: CardResult[], query: string, selectedIssuers: string[]) {
  const normalizedQuery = normalizeValue(query);
  const selectedIssuerSet = new Set(selectedIssuers);
  const hasIssuerFilter = selectedIssuerSet.size > 0;

  return cards
    .filter((card) => {
      if (hasIssuerFilter && !selectedIssuerSet.has(getCanonicalIssuerLabel(card.issuer))) return false;
      return true;
    })
    .map((card) => {
      const issuerTokens = getIssuerSearchTokens(card.issuer);
      const nameTokens = [normalizeValue(card.display_name), normalizeValue(card.card_name)];

      if (!normalizedQuery) {
        return { card, score: 0 };
      }

      const issuerScore = Math.max(...issuerTokens.map((token) => getMatchScore(token, normalizedQuery)));
      const nameScore = Math.max(...nameTokens.map((token) => getMatchScore(token, normalizedQuery)));
      const score = Math.max(issuerScore + 40, nameScore);

      if (score <= 0) return null;
      return { card, score };
    })
    .filter((row): row is { card: CardResult; score: number } => row !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const nameCompare = getCardSortName(a.card.display_name, a.card.card_name).localeCompare(
        getCardSortName(b.card.display_name, b.card.card_name),
      );
      if (nameCompare !== 0) return nameCompare;
      return a.card.issuer.localeCompare(b.card.issuer);
    })
    .map((row) => row.card);
}

function TrashCanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M3.75 5.5h12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.25 5.5v-.75c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1v.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.75 7.5v7.25c0 .83.67 1.5 1.5 1.5h3.5c.83 0 1.5-.67 1.5-1.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.75 9v5.25M11.25 9v5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WalletBuilder() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [query, setQuery] = useState("");
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [cardsIndex, setCardsIndex] = useState<CardResult[]>([]);
  const [isCardsIndexLoading, setIsCardsIndexLoading] = useState(false);
  const [cardsIndexError, setCardsIndexError] = useState<string | null>(null);
  const [selectedIssuerFilters, setSelectedIssuerFilters] = useState<string[]>([]);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCards, setSelectedCards] = useState<SelectedCardInstance[]>([]);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [removeTargetCard, setRemoveTargetCard] = useState<BaseCardInstance | null>(null);
  const [removeCardError, setRemoveCardError] = useState<string | null>(null);
  const [isRemovingCard, setIsRemovingCard] = useState(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [enteringCardIds, setEnteringCardIds] = useState<Set<string>>(new Set());
  const [showWalletScrollCue, setShowWalletScrollCue] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputWrapRef = useRef<HTMLDivElement | null>(null);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const resultsOverlayRef = useRef<HTMLDivElement | null>(null);
  const walletListRef = useRef<HTMLDivElement | null>(null);
  const addToastTimerRef = useRef<number | null>(null);
  const enterTimersRef = useRef<number[]>([]);
  const enterAnimationFramesRef = useRef<number[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [resultsOverlayStyle, setResultsOverlayStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const normalizedQuery = query.trim();
  const hasActiveFilters = selectedIssuerFilters.length > 0;
  const shouldShowResults = !isFilterPopoverOpen && isResultsOpen && normalizedQuery.length >= 1;
  const availableIssuerSet = useMemo(
    () => new Set(cardsIndex.map((card) => getCanonicalIssuerLabel(card.issuer))),
    [cardsIndex],
  );
  const issuerFilterOptions = useMemo(
    () =>
      ISSUER_FILTER_OPTIONS.map((issuer) => ({
        ...issuer,
        enabled: availableIssuerSet.has(issuer.id),
      })),
    [availableIssuerSet],
  );
  const results = useMemo(
    () => filterAndRankCards(cardsIndex, normalizedQuery, selectedIssuerFilters),
    [cardsIndex, normalizedQuery, selectedIssuerFilters],
  );
  const walletCardIds = useMemo(() => new Set(selectedCards.map((selected) => selected.cardId)), [selectedCards]);
  const sortedWalletCards = useMemo(
    () =>
      [...selectedCards].sort((a, b) =>
        getCardSortName(a.display_name, a.card_name).localeCompare(getCardSortName(b.display_name, b.card_name)),
      ),
    [selectedCards],
  );
  const savedCards = sortedWalletCards;
  const savedCardIds = useMemo(
    () => new Set(savedCards.map((selected) => selected.cardId)),
    [savedCards],
  );

  useEffect(() => {
    let isMounted = true;

    const resolveUser = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError) {
        console.error("Failed to load authenticated user", userError);
      }

      setUserId(user?.id ?? null);
      setIsAuthResolved(true);
    };

    void resolveUser();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const loadExistingWalletCards = useCallback(async () => {
    if (!userId) {
      setSelectedCards([]);
      setIsWalletLoading(false);
      return;
    }

    setIsWalletLoading(true);

    const { data, error: walletError } = await supabase
      .from("user_cards")
      .select("card_id, cards!inner(id, card_name, display_name, product_key, issuer, network)")
      .eq("user_id", userId);

    if (walletError) {
      console.error("Failed to load wallet cards", walletError);
      setIsWalletLoading(false);
      return;
    }

    const walletRows: WalletCardRow[] = data ?? [];

    const walletCards: WalletCard[] = walletRows.flatMap((row) => row.cards ?? []).filter(Boolean);

    const persistedCards: BaseCardInstance[] = walletCards.map((card) => ({
      instanceId: `persisted-${card.id}`,
      cardId: card.id,
      product_key: card.product_key,
      card_name: card.card_name,
      display_name: card.display_name,
      issuer: card.issuer,
      network: card.network,
    }));

    persistedCards.sort((a, b) =>
      getCardSortName(a.display_name, a.card_name).localeCompare(getCardSortName(b.display_name, b.card_name)),
    );

    setSelectedCards(persistedCards);
    setIsWalletLoading(false);
  }, [supabase, userId]);

  const resetSearchUI = useCallback(({ focus = false }: { focus?: boolean } = {}) => {
    setIsResultsOpen(false);
    setQuery("");
    setHighlightedIndex(0);
    if (focus) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isAuthResolved) return;
    void loadExistingWalletCards();
  }, [isAuthResolved, loadExistingWalletCards]);

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
    return () => {
      if (addToastTimerRef.current) {
        window.clearTimeout(addToastTimerRef.current);
        addToastTimerRef.current = null;
      }
      for (const timeoutId of enterTimersRef.current) {
        window.clearTimeout(timeoutId);
      }
      enterTimersRef.current = [];
      for (const frameId of enterAnimationFramesRef.current) {
        window.cancelAnimationFrame(frameId);
      }
      enterAnimationFramesRef.current = [];
    };
  }, []);

  const markCardForFadeIn = useCallback((cardId: string) => {
    setEnteringCardIds((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });

    const frameId = window.requestAnimationFrame(() => {
      setEnteringCardIds((prev) => {
        if (!prev.has(cardId)) return prev;
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      enterAnimationFramesRef.current = enterAnimationFramesRef.current.filter((id) => id !== frameId);
    });
    enterAnimationFramesRef.current.push(frameId);

    const timeoutId = window.setTimeout(() => {
      setEnteringCardIds((prev) => {
        if (!prev.has(cardId)) return prev;
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      enterTimersRef.current = enterTimersRef.current.filter((id) => id !== timeoutId);
    }, 350);
    enterTimersRef.current.push(timeoutId);
  }, []);

  const showAddedConfirmation = useCallback(() => {
    setShowAddedToast(true);
    if (addToastTimerRef.current) {
      window.clearTimeout(addToastTimerRef.current);
    }
    addToastTimerRef.current = window.setTimeout(() => {
      setShowAddedToast(false);
      addToastTimerRef.current = null;
    }, 2400);
  }, []);

  const resolveCanonicalCard = useCallback(
    async (selected: BaseCardInstance): Promise<{ id: string; product_key: string | null } | null> => {
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

  const addCardFromSearch = useCallback(
    async (card: CardResult) => {
      if (walletCardIds.has(card.id)) return;

      const optimisticInstanceId = `optimistic-${card.id}-${Date.now()}`;
      setSelectedCards((prev) => {
        if (prev.some((selected) => selected.cardId === card.id)) return prev;

        const next = [
          ...prev,
          {
            instanceId: optimisticInstanceId,
            cardId: card.id,
            product_key: card.product_key,
            card_name: card.card_name,
            display_name: card.display_name,
            issuer: card.issuer,
            network: card.network,
          } satisfies BaseCardInstance,
        ];

        next.sort((a, b) =>
          getCardSortName(a.display_name, a.card_name).localeCompare(getCardSortName(b.display_name, b.card_name)),
        );

        return next;
      });
      markCardForFadeIn(card.id);

      resetSearchUI({ focus: false });
      showAddedConfirmation();

      if (!userId) {
        setSelectedCards((prev) => prev.filter((selected) => selected.instanceId !== optimisticInstanceId));
        return;
      }

      const resolved = await resolveCanonicalCard({
        instanceId: optimisticInstanceId,
        cardId: card.id,
        product_key: card.product_key,
        card_name: card.card_name,
        display_name: card.display_name,
        issuer: card.issuer,
        network: card.network,
      });

      if (!resolved?.id) {
        setSelectedCards((prev) => prev.filter((selected) => selected.instanceId !== optimisticInstanceId));
        return;
      }

      const canonicalCardId = resolved.id;
      const { error: insertError } = await addCardToWallet(userId, canonicalCardId);
      if (insertError) {
        console.error("Failed to add card from search", insertError);
        setSelectedCards((prev) => prev.filter((selected) => selected.instanceId !== optimisticInstanceId));
        return;
      }

      const { error: bootstrapError } = await supabase.rpc("bootstrap_user_benefits_for_card", {
        p_user_id: userId,
        p_card_id: canonicalCardId,
      });

      if (bootstrapError) {
        console.error(`Failed to bootstrap benefits for card ${canonicalCardId}`, bootstrapError);
      }

      await loadExistingWalletCards();
    },
    [
      addCardToWallet,
      loadExistingWalletCards,
      resolveCanonicalCard,
      resetSearchUI,
      showAddedConfirmation,
      markCardForFadeIn,
      supabase,
      userId,
      walletCardIds,
    ],
  );

  useEffect(() => {
    setHighlightedIndex((prev) => (results.length === 0 ? 0 : Math.min(prev, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    let cancelled = false;

    const loadCardsIndex = async () => {
      setIsCardsIndexLoading(true);
      setCardsIndexError(null);

      try {
        const response = await fetch("/api/cards", { method: "GET" });
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? "Failed to load cards");
        }

        const data: CardResult[] = await response.json();
        if (cancelled) return;
        setCardsIndex(data);
      } catch (fetchError) {
        if (cancelled) return;
        setCardsIndex([]);
        setCardsIndexError(fetchError instanceof Error ? fetchError.message : "Failed to load cards");
      } finally {
        if (!cancelled) setIsCardsIndexLoading(false);
      }
    };

    void loadCardsIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shouldShowResults) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchAreaRef.current?.contains(target)) return;
      if (resultsOverlayRef.current?.contains(target)) return;
      if (target instanceof HTMLElement && target.closest("[data-search-filters-content='true']")) return;
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
  }, [shouldShowResults, resetSearchUI]);

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
  }, [shouldShowResults, isClient, results.length, isCardsIndexLoading, cardsIndexError]);

  const updateWalletScrollCue = useCallback(() => {
    const element = walletListRef.current;
    if (!element) return;

    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    setShowWalletScrollCue(canScroll && !atBottom);
  }, []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updateWalletScrollCue);
    window.addEventListener("resize", updateWalletScrollCue);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateWalletScrollCue);
    };
  }, [updateWalletScrollCue]);

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
      if (highlighted) void addCardFromSearch(highlighted);
    }
  };

  const toggleIssuerFilter = useCallback((issuerId: string) => {
    setSelectedIssuerFilters((prev) =>
      prev.includes(issuerId) ? prev.filter((value) => value !== issuerId) : [...prev, issuerId],
    );
    setHighlightedIndex(0);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedIssuerFilters([]);
    setHighlightedIndex(0);
    setIsResultsOpen(normalizedQuery.length >= 1);
  }, [normalizedQuery]);

  const handleRequestRemove = useCallback(
    (card: BaseCardInstance) => {
      if (isRemovingCard) return;
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
    if (!removeTargetCard || isRemovingCard) return;

    setIsRemovingCard(true);
    setRemoveCardError(null);

    if (!userId) {
      setRemoveCardError("Could not verify your account. Please try again.");
      setIsRemovingCard(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", userId)
      .eq("card_id", removeTargetCard.cardId);

    if (deleteError) {
      console.error("Failed to remove card from wallet", deleteError);
      setRemoveCardError("Could not remove this card right now. Please try again.");
      setIsRemovingCard(false);
      return;
    }

    setSelectedCards((prev) => prev.filter((card) => card.cardId !== removeTargetCard.cardId));
    await loadExistingWalletCards();
    setRemoveTargetCard(null);
    setRemoveCardError(null);
    setIsRemovingCard(false);
  }, [isRemovingCard, loadExistingWalletCards, removeTargetCard, supabase, userId]);

  return (
    <AppShell className="min-h-dvh overflow-x-hidden" containerClassName="px-0 py-8 sm:py-10 md:px-6">
      <MobilePageContainer>
        <div className="mb-6 min-w-0">
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

        <div className="flex flex-col gap-6 pb-32 md:pb-0">
          <Surface as="section" className="relative z-30 w-full min-w-0 overflow-visible p-4 sm:p-5">
            <div ref={searchAreaRef} className="min-w-0">
              <label htmlFor="card-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/60">
                <span className="font-semibold">Search cards</span>
              </label>
              <div className="relative z-20 min-w-0">
                <div ref={searchInputWrapRef} className="relative min-w-0">
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
                      const nextQuery = event.target.value;
                      setQuery(nextQuery);
                      setIsResultsOpen(nextQuery.trim().length >= 1);
                      setHighlightedIndex(0);
                    }}
                    onFocus={() => {
                      if (query.trim().length >= 1) setIsResultsOpen(true);
                    }}
                    onKeyDown={handleResultsKeyDown}
                    placeholder="Search by credit card (e.g., Sapphire, Platinum)"
                    autoComplete="off"
                    className={cn(controlClasses, "min-w-0 pl-9 pr-12 text-white/95", rowTransition)}
                  />
                  <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Filters"
                        className={cn(
                          "absolute inset-y-0 right-1.5 inline-flex h-9 w-9 items-center justify-center self-center rounded-lg border border-transparent text-white/65 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white",
                          hasActiveFilters && "border-[#F7C948]/35 bg-[#F7C948]/15 text-[#F7C948]",
                        )}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        {hasActiveFilters ? <span className="sr-only">Filters active</span> : null}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent data-search-filters-content="true" className="w-64 p-3">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Filters</p>
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="text-xs font-medium text-white/70 transition-colors hover:text-white"
                            disabled={!hasActiveFilters}
                          >
                            Clear
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-white/55">Issuer</p>
                          <div className="space-y-1.5">
                            {issuerFilterOptions.map((issuer) => {
                              const checkboxId = `issuer-filter-${issuer.id.toLowerCase().replace(/\s+/g, "-")}`;
                              const checked = selectedIssuerFilters.includes(issuer.id);
                              return (
                                <label
                                  key={issuer.id}
                                  htmlFor={checkboxId}
                                  className={cn(
                                    "flex items-center gap-2.5 text-sm",
                                    issuer.enabled ? "cursor-pointer text-white/85" : "cursor-not-allowed text-white/45",
                                  )}
                                >
                                  <Checkbox
                                    id={checkboxId}
                                    checked={checked}
                                    onCheckedChange={() => {
                                      if (!issuer.enabled) return;
                                      toggleIssuerFilter(issuer.id);
                                    }}
                                    aria-label={issuer.label}
                                    disabled={!issuer.enabled}
                                  />
                                  <span className="truncate">
                                    {issuer.label}
                                    {!issuer.enabled ? " (Coming Soon)" : ""}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {shouldShowResults ? (
                <div className="mt-3 w-full min-w-0 md:hidden">
                  <CardResultsList
                    className={cn(
                      "w-full rounded-2xl border border-white/10 bg-slate-950/85 ring-1 ring-white/5 shadow-2xl shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md",
                      "translate-y-0 opacity-100",
                    )}
                    listClassName="max-h-[40vh] overflow-auto"
                    cards={results}
                    savedCardIds={savedCardIds}
                    emptyMessage="No results found."
                    onAdd={(card) => {
                      void addCardFromSearch(card);
                    }}
                    isLoading={isCardsIndexLoading}
                    error={cardsIndexError}
                    highlightedIndex={highlightedIndex}
                  />
                </div>
              ) : null}

              {isClient && shouldShowResults && resultsOverlayStyle
                ? createPortal(
                    <div
                      ref={resultsOverlayRef}
                      className="pointer-events-auto fixed z-[100] hidden md:block"
                      style={{
                        top: resultsOverlayStyle.top,
                        left: resultsOverlayStyle.left,
                        width: resultsOverlayStyle.width,
                      }}
                    >
                      <CardResultsList
                        className={cn(
                          "rounded-2xl border border-white/10 bg-slate-950/85 ring-1 ring-white/5 shadow-2xl shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md",
                          "translate-y-0 opacity-100",
                        )}
                        listClassName="max-h-[24rem] overflow-auto"
                        cards={results}
                        savedCardIds={savedCardIds}
                        emptyMessage="No results found."
                        onAdd={(card) => {
                          void addCardFromSearch(card);
                        }}
                        isLoading={isCardsIndexLoading}
                        error={cardsIndexError}
                        highlightedIndex={highlightedIndex}
                      />
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </Surface>

        <Surface as="section" className="w-full min-w-0 border-white/18 bg-white/10 p-5 sm:p-6">
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
            <div className="relative w-full min-w-0">
              <div
                ref={walletListRef}
                className="max-h-[45vh] overflow-y-auto pr-1 sm:max-h-[360px] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-track]:bg-transparent"
                onScroll={updateWalletScrollCue}
              >
                <ul className="divide-y divide-white/10">
                  {savedCards.map((card) => (
                    <li
                      key={card.cardId}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-4 transition-opacity transition-colors duration-200 hover:bg-white/[0.025] sm:py-3",
                        enteringCardIds.has(card.cardId) ? "opacity-0" : "opacity-100",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate pr-2 font-medium leading-tight text-white/90">
                          {getCleanCardName(card.display_name, card.card_name)}
                        </p>
                        <p className="mt-0.5 text-sm text-white/55">
                          {getIssuerDisplayName(card.issuer)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-200 transition hover:bg-red-500/15 hover:text-red-100 sm:h-9 sm:w-9 disabled:cursor-not-allowed disabled:bg-red-500/6 disabled:text-red-200/55"
                        onClick={() => handleRequestRemove(card)}
                        aria-label={`Remove ${getCleanCardName(card.display_name, card.card_name)} from wallet`}
                      >
                        <TrashCanIcon className="h-4 w-4" />
                        <span className="sr-only">Remove From Wallet</span>
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
        <div className="hidden justify-end md:flex">
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

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0B1220]/75 px-4 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="mx-auto w-full max-w-6xl">
          <Button
            type="button"
            size="sm"
            onClick={() => router.push("/onboarding/benefits")}
            disabled={savedCards.length === 0}
            className="w-full rounded-lg px-3 text-sm"
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
                {isRemovingCard ? "Removing..." : "Remove"}
              </button>
            </div>
          </Surface>
        </div>
      ) : null}
      {showAddedToast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[120]">
          <div className="rounded-lg border border-white/15 bg-[#121A28]/90 px-3 py-2 text-xs text-white/90 shadow-xl backdrop-blur-sm">
            Added to wallet
          </div>
        </div>
      ) : null}
      </MobilePageContainer>
    </AppShell>
  );
}
