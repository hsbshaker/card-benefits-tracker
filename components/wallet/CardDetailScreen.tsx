"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import type { CardDetailBenefitRow, CardDetailResult } from "@/lib/types/server-data";
import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { BenefitRow } from "@/components/wallet/BenefitRow";
import { BenefitDetailOverlay } from "@/components/wallet/BenefitDetailOverlay";

type CardDetailScreenProps = {
  initialDetail: CardDetailResult;
};

function updateBenefit(
  benefits: CardDetailBenefitRow[],
  userBenefitId: string,
  updater: (benefit: CardDetailBenefitRow) => CardDetailBenefitRow,
) {
  return benefits.map((benefit) => (benefit.userBenefitId === userBenefitId ? updater(benefit) : benefit));
}

export function CardDetailScreen({ initialDetail }: CardDetailScreenProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [selectedBenefit, setSelectedBenefit] = useState<CardDetailBenefitRow | null>(null);
  const [pendingBenefitId, setPendingBenefitId] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeBenefits = useMemo(() => detail.benefits.filter((benefit) => benefit.isActive), [detail.benefits]);
  const inactiveBenefits = useMemo(() => detail.benefits.filter((benefit) => !benefit.isActive), [detail.benefits]);

  const syncSelectedBenefit = (userBenefitId: string, nextBenefits: CardDetailBenefitRow[]) => {
    const updated = nextBenefits.find((benefit) => benefit.userBenefitId === userBenefitId) ?? null;
    setSelectedBenefit((current) => (current?.userBenefitId === userBenefitId ? updated : current));
  };

  const mutateBenefit = async (
    benefit: CardDetailBenefitRow,
    route: string,
    body: Record<string, unknown>,
    optimistic: (current: CardDetailBenefitRow) => CardDetailBenefitRow,
  ) => {
    const previousBenefits = detail.benefits;
    const nextBenefits = updateBenefit(previousBenefits, benefit.userBenefitId, optimistic);
    setPendingBenefitId(benefit.userBenefitId);
    setErrorMessage(null);
    setDetail((current) => ({ ...current, benefits: nextBenefits }));
    syncSelectedBenefit(benefit.userBenefitId, nextBenefits);

    try {
      const response = await fetch(route, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update benefit.");
      }
    } catch (error) {
      setDetail((current) => ({ ...current, benefits: previousBenefits }));
      syncSelectedBenefit(benefit.userBenefitId, previousBenefits);
      setErrorMessage(error instanceof Error ? error.message : "Failed to update benefit.");
    } finally {
      setPendingBenefitId(null);
    }
  };

  const handleToggleActive = (benefit: CardDetailBenefitRow) =>
    void mutateBenefit(
      benefit,
      "/api/wallet/toggle-benefit",
      { userBenefitId: benefit.userBenefitId, isActive: !benefit.isActive },
      (current) => ({ ...current, isActive: !current.isActive }),
    );

  const handleToggleUsed = (benefit: CardDetailBenefitRow) =>
    void mutateBenefit(
      benefit,
      "/api/wallet/mark-used",
      { userBenefitId: benefit.userBenefitId, isUsedThisPeriod: !benefit.isUsedThisPeriod },
      (current) => ({
        ...current,
        isUsedThisPeriod: !current.isUsedThisPeriod,
        lastUsedAt: !current.isUsedThisPeriod ? new Date().toISOString() : null,
      }),
    );

  const handleUpdateReminder = (benefit: CardDetailBenefitRow, reminderOverride: ReminderStyle) =>
    void mutateBenefit(
      benefit,
      "/api/wallet/update-reminder",
      { userBenefitId: benefit.userBenefitId, reminderOverride },
      (current) => ({ ...current, reminderOverride }),
    );

  const handleUpdateConditionalValue = (benefit: CardDetailBenefitRow, conditionalValue: string | null) =>
    void mutateBenefit(
      benefit,
      "/api/wallet/update-conditional-value",
      { userBenefitId: benefit.userBenefitId, conditionalValue },
      (current) => ({
        ...current,
        conditionalValue,
        configurationStatus: current.requiresConfiguration
          ? conditionalValue
            ? "configured"
            : "needs_configuration"
          : current.configurationStatus,
      }),
    );

  const handleRemoveCard = async () => {
    setRemovePending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/wallet/remove-card", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userCardId: detail.card.userCardId,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove card.");
      }

      router.replace("/wallet");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove card.");
      setRemovePending(false);
      setRemoveOpen(false);
    }
  };

  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        <div className="space-y-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Link href="/wallet" className="inline-block text-sm font-medium text-white/58 hover:text-white/84">
                Back
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] border border-white/10 bg-[#0E1625]/90 text-xl font-semibold text-white/72">
                  {detail.card.cardArtUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.card.cardArtUrl} alt="" className="h-full w-full rounded-[1.5rem] object-cover" />
                  ) : (
                    detail.card.cardName.slice(0, 1)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white/52">{detail.card.issuer}</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{detail.card.cardName}</h1>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRemoveOpen(true)}
              className="shrink-0 text-sm font-medium text-white/46 hover:text-rose-200"
            >
              Remove card
            </button>
          </div>

          {errorMessage ? (
            <Surface className="rounded-2xl border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              {errorMessage}
            </Surface>
          ) : null}

          {detail.benefits.length === 0 ? (
            <Surface className="rounded-[1.75rem] border-white/10 bg-white/6 p-6 text-sm text-white/65">
              No benefits are currently tracked on this card.
            </Surface>
          ) : null}

          {activeBenefits.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.22em] text-[#F7C948] uppercase">Active</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Benefits in view</h2>
                </div>
              </div>
              <div className="space-y-3">
                {activeBenefits.map((benefit) => (
                  <BenefitRow
                    key={benefit.userBenefitId}
                    benefit={benefit}
                    pending={pendingBenefitId === benefit.userBenefitId}
                    onOpen={setSelectedBenefit}
                    onToggleActive={handleToggleActive}
                    onToggleUsed={handleToggleUsed}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/42 uppercase">Inactive</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Benefits you’ve turned off</h2>
              </div>
            </div>

            {inactiveBenefits.length > 0 ? (
              <div className="space-y-3">
                {inactiveBenefits.map((benefit) => (
                  <BenefitRow
                    key={benefit.userBenefitId}
                    benefit={benefit}
                    pending={pendingBenefitId === benefit.userBenefitId}
                    onOpen={setSelectedBenefit}
                    onToggleActive={handleToggleActive}
                    onToggleUsed={handleToggleUsed}
                  />
                ))}
              </div>
            ) : (
              <Surface className="rounded-[1.5rem] border-white/10 bg-white/5 p-5 text-sm text-white/56">
                No inactive benefits right now.
              </Surface>
            )}
          </section>
        </div>

        <BenefitDetailOverlay
          card={detail.card}
          benefit={selectedBenefit}
          open={selectedBenefit !== null}
          saving={selectedBenefit ? pendingBenefitId === selectedBenefit.userBenefitId : false}
          onClose={() => setSelectedBenefit(null)}
          onToggleActive={handleToggleActive}
          onToggleUsed={handleToggleUsed}
          onUpdateReminder={handleUpdateReminder}
          onUpdateConditionalValue={handleUpdateConditionalValue}
        />

        {removeOpen ? (
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#050914]/55 p-3 backdrop-blur-[2px] md:items-center" onClick={() => setRemoveOpen(false)}>
            <Surface
              className="w-full max-w-md rounded-[2rem] border-white/12 bg-[#0D1525]/96 p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold tracking-tight text-white">Remove this card and all tracked benefits?</h2>
              <p className="mt-3 text-sm leading-6 text-white/62">This permanently removes the card, its tracked benefits, and any related reminders.</p>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setRemoveOpen(false)} disabled={removePending}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={() => void handleRemoveCard()} disabled={removePending}>
                  {removePending ? "Removing..." : "Remove"}
                </Button>
              </div>
            </Surface>
          </div>
        ) : null}
      </MobilePageContainer>
    </AppShell>
  );
}
