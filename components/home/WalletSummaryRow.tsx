import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Surface } from "@/components/ui/Surface";

type WalletSummaryRowProps = {
  trackedBenefits: number;
  trackedCards: number;
};

export function WalletSummaryRow({ trackedBenefits, trackedCards }: WalletSummaryRowProps) {
  return (
    <Link href="/wallet" className="block">
      <Surface className="rounded-[1.75rem] border-white/10 bg-white/5 p-4 transition hover:border-white/18 hover:bg-white/8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/78">
            Tracking <span className="font-semibold text-white">{trackedBenefits}</span> benefits across{" "}
            <span className="font-semibold text-white">{trackedCards}</span> cards
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />
        </div>
      </Surface>
    </Link>
  );
}
