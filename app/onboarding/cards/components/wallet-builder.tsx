"use client";

import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useRouter } from "next/navigation";
import {
  KeyboardEvent,
  memo,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { fetchCards, fetchIssuers, saveWallet } from "../api";
import { SMART_SUGGESTED_IDS } from "../mock-data";
import { Issuer, SortMode, WalletCard } from "../types";

const TOKENS = {
  bg: "#0B1220",
  surface: "rgba(15,24,42,0.62)",
  border: "rgba(148,163,184,0.24)",
  accent: "#78D8FF",
  good: "#68FFBB",
  glow: "0 0 30px rgba(120,216,255,0.35)",
  radius: "18px",
};

const cardSpring = { type: "spring", stiffness: 430, damping: 34, mass: 0.72 } as const;
const stackSpring = { type: "spring", stiffness: 360, damping: 30, mass: 0.65 } as const;

const gridMetrics = {
  cardHeight: 170,
  rowGap: 16,
  overscanRows: 2,
};

const columnClasses = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
const columnsByWidth = [
  { min: 1280, cols: 3 },
  { min: 640, cols: 2 },
  { min: 0, cols: 1 },
];

export function WalletBuilder() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [activeIssuer, setActiveIssuer] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [lastAnchorIndex, setLastAnchorIndex] = useState<number | null>(null);

  const virtualRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(620);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [issuerData, cardData] = await Promise.all([fetchIssuers(), fetchCards()]);
        setIssuers(issuerData);
        setCards(cardData);
      } catch {
        setError("Couldn’t load wallet catalog. Retry in a few.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const node = virtualRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const filteredCards = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return cards
      .filter((card) => (activeIssuer === "all" ? true : card.issuerId === activeIssuer))
      .filter((card) => {
        if (!normalized) return true;
        return (
          card.name.toLowerCase().includes(normalized) ||
          card.issuerName.toLowerCase().includes(normalized)
        );
      });
  }, [activeIssuer, cards, searchQuery]);

  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      if (sortMode === "popular") return a.popularityRank - b.popularityRank;
      if (sortMode === "annual-fee") return a.annualFee - b.annualFee;
      return b.recentlyAddedWeight - a.recentlyAddedWeight;
    });
  }, [filteredCards, sortMode]);

  const selectedCards = useMemo(
    () => cards.filter((card) => selectedCardIds.has(card.id)),
    [cards, selectedCardIds],
  );

  const suggestions = useMemo(
    () => cards.filter((card) => SMART_SUGGESTED_IDS.includes(card.id)).slice(0, 6),
    [cards],
  );

  const issuerCount = useMemo(
    () =>
      issuers.reduce<Record<string, number>>((acc, issuer) => {
        acc[issuer.id] = cards.filter((card) => card.issuerId === issuer.id).length;
        return acc;
      }, {}),
    [cards, issuers],
  );

  const selectedCount = selectedCardIds.size;
  const fill = Math.min(100, Math.round((selectedCount / 8) * 100));

  const toggleCard = (card: WalletCard, mode: "toggle" | "add" | "remove" = "toggle") => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      const has = next.has(card.id);
      if (mode === "add" || (!has && mode === "toggle")) next.add(card.id);
      if (mode === "remove" || (has && mode === "toggle")) next.delete(card.id);
      return next;
    });
  };

  const handleCardPress = (event: MouseEvent<HTMLButtonElement>, card: WalletCard, index: number) => {
    const isCommand = event.metaKey || event.ctrlKey;
    if (event.shiftKey && lastAnchorIndex !== null) {
      const start = Math.min(lastAnchorIndex, index);
      const end = Math.max(lastAnchorIndex, index);
      const inRange = sortedCards.slice(start, end + 1);
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        inRange.forEach((entry) => next.add(entry.id));
        return next;
      });
    } else if (isCommand) {
      toggleCard(card, "toggle");
      setLastAnchorIndex(index);
    } else {
      toggleCard(card, "toggle");
      setLastAnchorIndex(index);
    }
    setActiveCardIndex(index);
  };

  const handleGridKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!sortedCards.length) return;
    const key = event.key;
    const width = virtualRef.current?.offsetWidth ?? 1200;
    const colCount = columnsByWidth.find((entry) => width >= entry.min)?.cols ?? 1;

    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(key)) {
      event.preventDefault();
      setActiveCardIndex((prev) => {
        if (key === "ArrowRight") return Math.min(sortedCards.length - 1, prev + 1);
        if (key === "ArrowLeft") return Math.max(0, prev - 1);
        if (key === "ArrowDown") return Math.min(sortedCards.length - 1, prev + colCount);
        return Math.max(0, prev - colCount);
      });
      return;
    }

    if (key === " " || key === "Enter") {
      event.preventDefault();
      const active = sortedCards[activeCardIndex];
      if (active) {
        toggleCard(active, event.ctrlKey || event.metaKey ? "add" : "toggle");
        setLastAnchorIndex(activeCardIndex);
      }
    }
  };

  const selectAllVisibleIssuer = () => {
    const target = sortedCards.filter((card) => activeIssuer === "all" || card.issuerId === activeIssuer);
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      target.forEach((card) => next.add(card.id));
      return next;
    });
  };

  const submit = async () => {
    if (!selectedCount || saveState === "saving") return;
    setSaveState("saving");
    try {
      await saveWallet(Array.from(selectedCardIds));
      setSaveState("saved");
      setTimeout(() => router.push("/dashboard"), 900);
    } catch {
      setSaveState("error");
    }
  };

  const width = virtualRef.current?.offsetWidth ?? 1200;
  const columns = columnsByWidth.find((entry) => width >= entry.min)?.cols ?? 1;
  const rowHeight = gridMetrics.cardHeight + gridMetrics.rowGap;
  const totalRows = Math.ceil(sortedCards.length / columns);
  const totalHeight = totalRows * rowHeight;
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - gridMetrics.overscanRows);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + gridMetrics.overscanRows);
  const startIndex = startRow * columns;
  const endIndex = Math.min(sortedCards.length, endRow * columns);
  const visibleCards = sortedCards.slice(startIndex, endIndex);

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"} transition={cardSpring}>
      <LayoutGroup>
        <main
          className="min-h-screen text-slate-100"
          style={{
            background: `radial-gradient(circle at 0% 0%, rgba(120,216,255,0.18), transparent 55%), radial-gradient(circle at 90% 20%, rgba(92,164,255,0.16), transparent 45%), ${TOKENS.bg}`,
          }}
        >
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:h-screen lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-[auto_1fr_auto]">
            <header className="rounded-2xl border px-4 py-4 backdrop-blur-xl lg:col-span-2 lg:px-6"
              style={{ background: TOKENS.surface, borderColor: TOKENS.border, boxShadow: TOKENS.glow }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Wallet Builder</p>
                  <h1 className="text-2xl font-semibold text-white">Add Cards</h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <span>{selectedCount} selected</span>
                  <div className="h-2 w-44 overflow-hidden rounded-full bg-slate-800/90">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #63F8D6, #78D8FF)" }}
                      animate={{ width: `${fill}%` }}
                      transition={stackSpring}
                    />
                  </div>
                </div>
              </div>
            </header>

            <section className="rounded-2xl border p-4 backdrop-blur-xl lg:row-span-2"
              style={{ background: TOKENS.surface, borderColor: TOKENS.border }}>
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <IssuerPill
                  key="all"
                  issuer={{ id: "all", name: "All", enabled: true, accent: TOKENS.accent }}
                  active={activeIssuer === "all"}
                  onClick={() => setActiveIssuer("all")}
                />
                {issuers.map((issuer) => (
                  <IssuerPill
                    key={issuer.id}
                    issuer={issuer}
                    active={activeIssuer === issuer.id}
                    onClick={() => issuer.enabled && setActiveIssuer(issuer.id)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pb-3">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Search cards"
                  placeholder="Search issuer or card"
                  className="min-w-[220px] flex-1 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-300/80"
                />
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  aria-label="Sort cards"
                  className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm"
                >
                  <option value="recent">Recently added</option>
                  <option value="popular">Most popular</option>
                  <option value="annual-fee">Annual fee</option>
                </select>
                <button
                  type="button"
                  onClick={selectAllVisibleIssuer}
                  className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm hover:border-cyan-300/70"
                >
                  Select all {activeIssuer === "all" ? "visible" : issuers.find((x) => x.id === activeIssuer)?.name ?? "issuer"}
                </button>
              </div>

              {showSuggestions && suggestions.length > 0 ? (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 rounded-xl border border-slate-700/70 bg-slate-950/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Popular wallet combos</p>
                    <button
                      className="text-xs text-slate-400 hover:text-slate-200"
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                    >
                      Hide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => toggleCard(card, "add")}
                        type="button"
                        className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 hover:border-cyan-200"
                      >
                        + {card.name}
                      </button>
                    ))}
                  </div>
                </motion.section>
              ) : null}

              {isLoading ? <CatalogSkeleton /> : null}
              {error ? (
                <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
              ) : null}
              {!isLoading && !error ? (
                <div
                  ref={virtualRef}
                  onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                  onKeyDown={handleGridKeys}
                  tabIndex={0}
                  role="grid"
                  aria-label="Card catalog"
                  className="h-[62vh] overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/35 p-3 outline-none focus:ring-2 focus:ring-cyan-300/50"
                >
                  {sortedCards.length === 0 ? (
                    <div className="grid h-full place-items-center text-sm text-slate-400">No cards match this filter.</div>
                  ) : (
                    <div style={{ height: totalHeight, position: "relative" }}>
                      <div
                        className={`grid ${columnClasses} gap-4`}
                        style={{
                          position: "absolute",
                          top: startRow * rowHeight,
                          left: 0,
                          right: 0,
                        }}
                      >
                        {visibleCards.map((card, index) => {
                          const actualIndex = startIndex + index;
                          const selected = selectedCardIds.has(card.id);
                          return (
                            <CatalogCard
                              key={card.id}
                              card={card}
                              issuerCount={issuerCount[card.issuerId] ?? 0}
                              selected={selected}
                              focused={actualIndex === activeCardIndex}
                              onSelect={(event) => handleCardPress(event, card, actualIndex)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border p-4 backdrop-blur-xl"
              style={{ background: TOKENS.surface, borderColor: TOKENS.border }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.16em] text-cyan-200/80">Digital Wallet</h2>
                <span className="text-xs text-slate-400">{selectedCount === 0 ? "Empty" : `${selectedCount} cards`}</span>
              </div>

              <div className="relative min-h-[320px] rounded-xl border border-slate-700/65 bg-slate-950/50 p-4">
                <AnimatePresence mode="sync">
                  {selectedCards.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="grid min-h-[220px] place-content-center text-sm text-slate-500"
                    >
                      Start stacking your wallet.
                    </motion.div>
                  ) : (
                    selectedCards.slice(0, 10).map((card, idx) => (
                      <motion.div
                        key={card.id}
                        layoutId={`wallet-card-${card.id}`}
                        transition={stackSpring}
                        className="absolute left-6 right-6"
                        style={{
                          top: 20 + idx * 10,
                          zIndex: 25 + idx,
                          rotate: idx % 2 === 0 ? idx * 0.4 : -idx * 0.35,
                        }}
                      >
                        <CardFace card={card} compact onRemove={() => toggleCard(card, "remove")} />
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
                {saveState === "saved" ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute bottom-4 right-4 rounded-full border border-emerald-300/50 bg-emerald-300/20 px-3 py-1 text-xs text-emerald-100"
                  >
                    Wallet synced ✓
                  </motion.div>
                ) : null}
              </div>
            </section>

            <footer className="rounded-2xl border p-4 backdrop-blur-xl lg:col-span-2"
              style={{ background: TOKENS.surface, borderColor: TOKENS.border }}>
              {saveState === "error" ? (
                <p className="mb-2 text-sm text-rose-300">Couldn’t save. Retry in a moment.</p>
              ) : null}
              <button
                onClick={submit}
                disabled={selectedCount === 0 || saveState === "saving"}
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "linear-gradient(100deg, #63F8D6 0%, #78D8FF 45%, #B5B3FF 100%)",
                  boxShadow: "0 0 20px rgba(120,216,255,0.28)",
                }}
              >
                {saveState === "saving"
                  ? "Syncing wallet..."
                  : `Add ${selectedCount} card${selectedCount === 1 ? "" : "s"} to my wallet`}
              </button>
            </footer>
          </div>
        </main>
      </LayoutGroup>
    </MotionConfig>
  );
}

type IssuerPillProps = {
  issuer: Issuer;
  active: boolean;
  onClick: () => void;
};

function IssuerPill({ issuer, active, onClick }: IssuerPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!issuer.enabled}
      aria-pressed={active}
      className="rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        borderColor: active ? issuer.accent : "rgba(148,163,184,0.3)",
        background: active ? "rgba(120,216,255,0.18)" : "rgba(15,23,42,0.5)",
        boxShadow: active ? `0 0 20px ${issuer.accent}40` : "none",
      }}
    >
      {issuer.name}
      {issuer.comingSoon ? <span className="ml-2 text-xs text-slate-400">Soon</span> : null}
    </button>
  );
}

type CatalogCardProps = {
  card: WalletCard;
  selected: boolean;
  focused: boolean;
  issuerCount: number;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
};

const CatalogCard = memo(function CatalogCard({ card, selected, focused, issuerCount, onSelect }: CatalogCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  return (
    <motion.button
      type="button"
      layoutId={`wallet-card-${card.id}`}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 6;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * -6;
        setTilt({ x, y });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      role="gridcell"
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      className="group rounded-xl text-left outline-none"
      style={{ transformStyle: "preserve-3d" }}
      animate={{ rotateX: tilt.y, rotateY: tilt.x }}
      transition={{ type: "spring", stiffness: 250, damping: 16, mass: 0.4 }}
    >
      <CardFace card={card} selected={selected} />
      <p className="mt-1 px-1 text-[11px] text-slate-400">{issuerCount} cards from {card.issuerName}</p>
    </motion.button>
  );
});

type CardFaceProps = {
  card: WalletCard;
  selected?: boolean;
  compact?: boolean;
  onRemove?: () => void;
};

function CardFace({ card, selected = false, compact = false, onRemove }: CardFaceProps) {
  return (
    <div
      className={`${compact ? "h-[132px]" : "h-[170px]"} relative overflow-hidden rounded-xl border p-4`}
      style={{
        borderColor: selected ? "rgba(120,216,255,0.65)" : "rgba(148,163,184,0.3)",
        background: `linear-gradient(140deg, ${card.art.gradientFrom}, ${card.art.gradientTo})`,
        boxShadow: selected ? `0 0 20px ${card.art.shine}77` : "0 12px 22px rgba(2,6,23,0.45)",
      }}
    >
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl" style={{ background: `${card.art.shine}A0` }} />
      <div className="relative flex h-full flex-col justify-between text-slate-950">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">{card.issuerName}</p>
          <h3 className="mt-1 text-lg font-semibold">{card.name}</h3>
          {card.variantLabel ? <p className="text-xs opacity-80">{card.variantLabel}</p> : null}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{card.network}</p>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full border border-slate-950/25 bg-slate-950/15 px-2 py-0.5 text-[10px]"
              aria-label={`Remove ${card.name}`}
            >
              Remove
            </button>
          ) : (
            <p className="text-xs font-medium">${card.annualFee} AF</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="h-[170px] animate-pulse rounded-xl border border-slate-700/70 bg-slate-900/70" />
      ))}
    </div>
  );
}
