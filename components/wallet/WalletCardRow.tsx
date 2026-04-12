import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import type { WalletCardSummary } from "@/lib/types/server-data";
import { Surface } from "@/components/ui/Surface";

type WalletCardRowProps = {
  card: WalletCardSummary;
};

export function WalletCardRow({ card }: WalletCardRowProps) {
  return (
    <Link href={`/wallet/${card.userCardId}`} className="block">
      <Surface className="rounded-[1.75rem] border-white/10 bg-white/6 p-4 transition hover:border-white/18 hover:bg-white/8 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0E1625]/90 text-lg font-semibold text-white/72">
            {card.cardArtUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.cardArtUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              card.cardName.slice(0, 1)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-white">{card.cardName}</h2>
                <p className="mt-1 text-sm text-white/56">
                  {card.trackedBenefitCount} tracked benefit{card.trackedBenefitCount === 1 ? "" : "s"}
                </p>
              </div>

              {card.hasUrgentBenefit ? (
                <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F7C948]/35 bg-[#F7C948]/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-[#F7C948] uppercase">
                  <AlertCircle className="h-3 w-3" />
                  Soon
                </div>
              ) : null}
            </div>
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-white/36" />
        </div>
      </Surface>
    </Link>
  );
}
