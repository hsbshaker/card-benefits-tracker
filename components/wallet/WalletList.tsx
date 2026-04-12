import Link from "next/link";
import type { WalletCardSummary } from "@/lib/types/server-data";
import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { WalletCardRow } from "@/components/wallet/WalletCardRow";
import { WalletEmptyState } from "@/components/wallet/WalletEmptyState";

type WalletListProps = {
  cards: WalletCardSummary[];
};

export function WalletList({ cards }: WalletListProps) {
  if (cards.length === 0) {
    return (
      <AppShell containerClassName="max-w-4xl px-0 md:px-6">
        <MobilePageContainer className="pb-20">
          <WalletEmptyState />
        </MobilePageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        <div className="space-y-6 pt-6">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-[0.24em] text-[#F7C948] uppercase">Wallet</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Your cards</h1>
          </div>

          <div className="space-y-3">
            {cards.map((card) => (
              <WalletCardRow key={card.userCardId} card={card} />
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/wallet/add"
              className="inline-flex items-center justify-center rounded-2xl bg-[#7FB6FF] px-7 py-3.5 text-base font-semibold text-[#08111F] shadow-[0_16px_45px_-18px_rgba(127,182,255,0.75)] transition duration-200 ease-out hover:brightness-110"
            >
              Add another card
            </Link>
          </div>
        </div>
      </MobilePageContainer>
    </AppShell>
  );
}
