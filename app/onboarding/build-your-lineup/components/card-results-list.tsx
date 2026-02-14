import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

export type CardResult = {
  id: string;
  issuer: string;
  card_name: string;
  display_name: string | null;
  network: string | null;
  product_key: string | null;
};

type CardResultsListProps = {
  cards: CardResult[];
  savedCardIds: Set<string>;
  pendingCardIds: Set<string>;
  onAdd: (card: CardResult) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  error?: string | null;
  highlightedIndex?: number;
  className?: string;
  listClassName?: string;
};

const rowTransition = "transition motion-safe:duration-200 ease-out";

export function CardResultsList({
  cards,
  savedCardIds,
  pendingCardIds,
  onAdd,
  emptyMessage = "No cards found.",
  isLoading = false,
  error,
  highlightedIndex,
  className,
  listClassName,
}: CardResultsListProps) {
  return (
    <Surface
      className={cn(
        "p-1 transition-opacity transition-transform motion-safe:duration-200 motion-safe:ease-out",
        className,
      )}
    >
      {error ? <p className="px-3 py-3 text-sm text-[#F7C948]">{error}</p> : null}
      {isLoading ? <p className="px-3 py-3 text-sm text-white/60">Searching cards…</p> : null}

      {!error && !isLoading ? (
        cards.length === 0 ? (
          <p className="px-3 py-3 text-sm text-white/60">{emptyMessage}</p>
        ) : (
          <ul className={cn("max-h-96 overflow-auto py-1", listClassName)}>
            {cards.map((card, index) => {
              const highlighted = highlightedIndex === index;
              const isSaved = savedCardIds.has(card.id);
              const isPending = pendingCardIds.has(card.id);
              const isUnavailable = isSaved || isPending;
              const label = card.display_name ?? card.card_name;

              const handleRowClick = () => {
                if (isUnavailable) return;
                onAdd(card);
              };

              return (
                <li key={`${card.id}-${index}`}>
                  <button
                    type="button"
                    disabled={isUnavailable}
                    onClick={handleRowClick}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-all duration-150",
                      isUnavailable
                        ? "cursor-not-allowed opacity-60"
                        : cn(
                            rowTransition,
                            "active:scale-[0.99]",
                            highlighted
                              ? "border-[#F7C948]/40 bg-[#F7C948]/12 text-white"
                              : "text-white/90 hover:border-[#F7C948]/30 hover:bg-white/10 hover:text-white active:bg-white/12",
                          ),
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate">{label}</p>
                      <p className="mt-0.5 text-xs text-white/55">{card.issuer}</p>
                    </div>
                    {isUnavailable ? <span className="shrink-0 text-xs text-white/55">Saved</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </Surface>
  );
}
