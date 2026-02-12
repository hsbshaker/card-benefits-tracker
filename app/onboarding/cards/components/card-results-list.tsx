import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
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
  walletCardIds: Set<string>;
  onAdd: (card: CardResult) => void;
  onAddAnother: (card: CardResult) => void;
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
  walletCardIds,
  onAdd,
  onAddAnother,
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
        "rounded-xl border-white/10 bg-white/5 p-1 transition-opacity transition-transform motion-safe:duration-200 motion-safe:ease-out",
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
              const alreadyAdded = walletCardIds.has(card.id);

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
                      <p className="truncate">{card.display_name ?? card.card_name}</p>
                      <p className="mt-0.5 text-xs text-white/55">{card.issuer}</p>
                    </div>
                    {alreadyAdded ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/55">In wallet</span>
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => onAddAnother(card)}
                          className="rounded-lg px-2 py-1 text-xs"
                        >
                          Add Another
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="subtle" onClick={() => onAdd(card)} className="rounded-lg px-2 py-1 text-xs">
                        + Add
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </Surface>
  );
}
