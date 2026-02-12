"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { createClient } from "@/utils/supabase/client";

type Toast = { id: string; message: string };

type Frequency = "monthly" | "quarterly" | "semiannual" | "annual" | "activation" | "multi_year";

type BenefitRow = {
  id: string;
  display_name: string;
  frequency: Frequency;
  value_cents: number | null;
  requires_enrollment: boolean;
  requires_selection: boolean;
  notes: string | null;
  user_benefit_id: string | null;
  is_enabled: boolean;
  is_enrolled: boolean;
  current_period_key: string;
  is_used: boolean;
};

type CardGroup = {
  cardId: string;
  cardName: string;
  issuer: string;
  network: string | null;
  benefits: BenefitRow[];
};

const FREQUENCY_ORDER: Frequency[] = ["monthly", "quarterly", "semiannual", "annual", "activation", "multi_year"];
const MARK_USED_FREQUENCIES = new Set<Frequency>(["monthly", "quarterly", "semiannual", "annual"]);

function formatFrequencyLabel(frequency: Frequency) {
  if (frequency === "semiannual") return "Semiannual";
  if (frequency === "multi_year") return "Multi-year";
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function formatMoney(valueCents: number | null) {
  if (valueCents == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    valueCents / 100,
  );
}

function getCurrentPeriodKey(frequency: Frequency, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (frequency === "monthly") {
    const monthLabel = date.toLocaleString("en-US", { month: "short" });
    return `${monthLabel}-${year}`;
  }

  if (frequency === "quarterly") {
    return `Q${Math.floor(month / 3) + 1}-${year}`;
  }

  if (frequency === "semiannual") {
    return `${month < 6 ? "H1" : "H2"}-${year}`;
  }

  if (frequency === "annual" || frequency === "multi_year") {
    return `${year}`;
  }

  return "Lifetime";
}

export function BenefitsOnboarding() {
  const supabase = createClient();
  const router = useRouter();

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CardGroup[]>([]);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const pushToast = (message: string) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    setToasts((prev) => [...prev, { id, message }]);
    const timeout = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      delete toastTimersRef.current[id];
    }, 2600);
    toastTimersRef.current[id] = timeout;
  };

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current = {};
    };
  }, []);

  const loadWalletBenefits = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Could not verify your account. Please log in again.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: walletRows, error: walletError } = await supabase
      .from("user_cards")
      .select("card_id, cards!inner(id, card_name, issuer, network)")
      .eq("user_id", user.id);

    if (walletError) {
      console.error("Failed to load wallet cards", walletError);
      setError("Could not load your cards right now.");
      setLoading(false);
      return;
    }

    const wallet = (walletRows ?? []) as Array<{
      card_id: string;
      cards: { id: string; card_name: string; issuer: string; network: string | null };
    }>;

    if (wallet.length === 0) {
      setCards([]);
      setExpandedCardId(null);
      setLoading(false);
      return;
    }

    const cardIds = wallet.map((row) => row.card_id);
    const { data: cardBenefitRows, error: cardBenefitsError } = await supabase
      .from("card_benefits")
      .select(
        "card_id, benefit_id, benefits!inner(id, display_name, frequency, value_cents, requires_enrollment, requires_selection, notes)",
      )
      .in("card_id", cardIds);

    if (cardBenefitsError) {
      console.error("Failed to load card benefits", cardBenefitsError);
      setError("Could not load card benefits right now.");
      setLoading(false);
      return;
    }

    const cardBenefits = (cardBenefitRows ?? []) as Array<{
      card_id: string;
      benefit_id: string;
      benefits: {
        id: string;
        display_name: string;
        frequency: Frequency;
        value_cents: number | null;
        requires_enrollment: boolean;
        requires_selection: boolean;
        notes: string | null;
      };
    }>;

    const benefitIds = Array.from(new Set(cardBenefits.map((row) => row.benefit_id)));

    let { data: userBenefitRows, error: userBenefitsError } = await supabase
      .from("user_benefits")
      .select("id, benefit_id, is_enabled, is_enrolled")
      .eq("user_id", user.id)
      .in("benefit_id", benefitIds);

    if (userBenefitsError) {
      console.error("Failed to load user benefits", userBenefitsError);
      setError("Could not load your benefit settings right now.");
      setLoading(false);
      return;
    }

    const userBenefitMap = new Map((userBenefitRows ?? []).map((row) => [row.benefit_id, row]));

    const cardsMissingUserBenefits = new Set<string>();
    for (const card of wallet) {
      const cardBenefitIds = cardBenefits.filter((row) => row.card_id === card.card_id).map((row) => row.benefit_id);
      if (cardBenefitIds.some((benefitId) => !userBenefitMap.has(benefitId))) {
        cardsMissingUserBenefits.add(card.card_id);
      }
    }

    if (cardsMissingUserBenefits.size > 0) {
      for (const cardId of cardsMissingUserBenefits) {
        const { error: bootstrapError } = await supabase.rpc("bootstrap_user_benefits_for_card", {
          p_user_id: user.id,
          p_card_id: cardId,
        });
        if (bootstrapError) {
          console.error(`Failed to bootstrap missing user benefits for card ${cardId}`, bootstrapError);
        }
      }

      const refetch = await supabase
        .from("user_benefits")
        .select("id, benefit_id, is_enabled, is_enrolled")
        .eq("user_id", user.id)
        .in("benefit_id", benefitIds);

      userBenefitRows = refetch.data ?? userBenefitRows;
      userBenefitsError = refetch.error;

      if (userBenefitsError) {
        console.error("Failed to reload user benefits", userBenefitsError);
        setError("Could not load your benefit settings right now.");
        setLoading(false);
        return;
      }
    }

    const refreshedUserBenefitMap = new Map((userBenefitRows ?? []).map((row) => [row.benefit_id, row]));

    const periodKeys = Array.from(
      new Set(cardBenefits.map((row) => getCurrentPeriodKey(row.benefits.frequency as Frequency))),
    );

    const { data: periodRows, error: periodError } = await supabase
      .from("user_benefit_period_status")
      .select("benefit_id, period_key, is_used")
      .eq("user_id", user.id)
      .in("benefit_id", benefitIds)
      .in("period_key", periodKeys);

    if (periodError) {
      console.error("Failed to load period status", periodError);
      setError("Could not load period status right now.");
      setLoading(false);
      return;
    }

    const periodStatusMap = new Map((periodRows ?? []).map((row) => [`${row.benefit_id}:${row.period_key}`, row]));

    const nextCards: CardGroup[] = wallet
      .map((walletCard) => {
        const benefitsForCard = cardBenefits
          .filter((cb) => cb.card_id === walletCard.card_id)
          .sort(
            (a, b) =>
              FREQUENCY_ORDER.indexOf(a.benefits.frequency) - FREQUENCY_ORDER.indexOf(b.benefits.frequency) ||
              a.benefits.display_name.localeCompare(b.benefits.display_name),
          )
          .map((cb) => {
            const userBenefit = refreshedUserBenefitMap.get(cb.benefit_id);
            const currentPeriodKey = getCurrentPeriodKey(cb.benefits.frequency);
            const periodStatus = periodStatusMap.get(`${cb.benefit_id}:${currentPeriodKey}`);

            return {
              id: cb.benefit_id,
              display_name: cb.benefits.display_name,
              frequency: cb.benefits.frequency,
              value_cents: cb.benefits.value_cents,
              requires_enrollment: cb.benefits.requires_enrollment,
              requires_selection: cb.benefits.requires_selection,
              notes: cb.benefits.notes,
              user_benefit_id: userBenefit?.id ?? null,
              is_enabled: userBenefit?.is_enabled ?? false,
              // We use is_enrolled as a generic boolean confirmation flag for both
              // "enrolled" and "selected" confirmation states.
              is_enrolled: userBenefit?.is_enrolled ?? false,
              current_period_key: currentPeriodKey,
              is_used: periodStatus?.is_used ?? false,
            };
          });

        return {
          cardId: walletCard.card_id,
          cardName: walletCard.cards.card_name,
          issuer: walletCard.cards.issuer,
          network: walletCard.cards.network,
          benefits: benefitsForCard,
        };
      })
      .sort((a, b) => a.cardName.localeCompare(b.cardName));

    setCards(nextCards);
    setExpandedCardId((prev) => prev ?? nextCards[0]?.cardId ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadWalletBenefits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBenefitLocal = (benefitId: string, updater: (benefit: BenefitRow) => BenefitRow) => {
    setCards((prev) =>
      prev.map((card) => ({
        ...card,
        benefits: card.benefits.map((benefit) => (benefit.id === benefitId ? updater(benefit) : benefit)),
      })),
    );
  };

  const updateTrack = async (benefit: BenefitRow, nextValue: boolean) => {
    if (!userId) return;

    updateBenefitLocal(benefit.id, (prev) => ({ ...prev, is_enabled: nextValue }));

    const { error: updateError } = await supabase
      .from("user_benefits")
      .upsert(
        {
          user_id: userId,
          benefit_id: benefit.id,
          is_enabled: nextValue,
        },
        { onConflict: "user_id,benefit_id" },
      );

    if (updateError) {
      console.error("Failed to update track status", updateError);
      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, is_enabled: !nextValue }));
      pushToast("Could not save track setting. Please try again.");
      return;
    }

    pushToast(nextValue ? "Benefit tracking enabled." : "Benefit tracking disabled.");
  };

  const updateEnrollment = async (benefit: BenefitRow, nextValue: boolean) => {
    if (!userId) return;

    updateBenefitLocal(benefit.id, (prev) => ({ ...prev, is_enrolled: nextValue }));

    const { error: updateError } = await supabase
      .from("user_benefits")
      .upsert(
        {
          user_id: userId,
          benefit_id: benefit.id,
          is_enrolled: nextValue,
        },
        { onConflict: "user_id,benefit_id" },
      );

    if (updateError) {
      console.error("Failed to update confirmation status", updateError);
      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, is_enrolled: !nextValue }));
      pushToast("Could not save confirmation setting. Please try again.");
      return;
    }

    pushToast(nextValue ? "Confirmation saved." : "Confirmation removed.");
  };

  const toggleUsed = async (benefit: BenefitRow, nextUsed: boolean) => {
    if (!userId) return;

    updateBenefitLocal(benefit.id, (prev) => ({ ...prev, is_used: nextUsed }));

    const { error: upsertError } = await supabase.from("user_benefit_period_status").upsert(
      {
        user_id: userId,
        benefit_id: benefit.id,
        period_key: benefit.current_period_key,
        is_used: nextUsed,
        used_at: nextUsed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,benefit_id,period_key" },
    );

    if (upsertError) {
      console.error("Failed to update used status", upsertError);
      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, is_used: !nextUsed }));
      pushToast("Could not save used status. Please try again.");
      return;
    }

    pushToast(nextUsed ? "Marked as used for this period." : "Usage status reset for this period.");
  };

  const handleEnableAll = async (card: CardGroup) => {
    if (!userId || card.benefits.length === 0) return;

    const benefitIds = card.benefits.map((benefit) => benefit.id);
    setCards((prev) =>
      prev.map((entry) =>
        entry.cardId === card.cardId
          ? { ...entry, benefits: entry.benefits.map((benefit) => ({ ...benefit, is_enabled: true })) }
          : entry,
      ),
    );

    const payload = benefitIds.map((benefitId) => ({ user_id: userId, benefit_id: benefitId, is_enabled: true }));
    const { error: enableAllError } = await supabase.from("user_benefits").upsert(payload, { onConflict: "user_id,benefit_id" });

    if (enableAllError) {
      console.error("Failed to enable all benefits for card", enableAllError);
      await loadWalletBenefits();
      pushToast("Could not enable all benefits for this card.");
      return;
    }

    pushToast("Enabled all benefits for this card.");
  };

  const groupedByFrequency = (benefits: BenefitRow[]) => {
    const map = new Map<Frequency, BenefitRow[]>();
    for (const benefit of benefits) {
      const existing = map.get(benefit.frequency) ?? [];
      map.set(benefit.frequency, [...existing, benefit]);
    }

    return FREQUENCY_ORDER.filter((frequency) => map.has(frequency)).map((frequency) => ({
      frequency,
      benefits: map.get(frequency) ?? [],
    }));
  };

  const activeCard = useMemo(() => cards.find((card) => card.cardId === expandedCardId) ?? null, [cards, expandedCardId]);

  if (loading) {
    return (
      <AppShell containerClassName="py-8 sm:py-10">
        <Surface className="p-6 text-sm text-white/75">Loading your benefits setup…</Surface>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell containerClassName="py-8 sm:py-10">
        <Surface className="space-y-4 p-6">
          <p className="text-sm text-white/80">{error}</p>
          <Button onClick={loadWalletBenefits}>Try again</Button>
        </Surface>
      </AppShell>
    );
  }

  return (
    <AppShell containerClassName="py-8 sm:py-10">
      <div className="pointer-events-none fixed right-6 top-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Surface key={toast.id} className="pointer-events-auto rounded-xl px-3 py-2">
            <p className="text-sm text-white/90">{toast.message}</p>
          </Surface>
        ))}
      </div>

      <div className="mx-auto max-w-5xl space-y-4">
        <Surface className="p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-white/55">Step 2 of 2 — Flex your benefits</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Time to flex. Pick what you actually want to track.</h1>
          <p className="mt-2 text-sm text-white/65">
            Turn on only the perks you care about, confirm enrollments/selections, and mark anything already used this period.
          </p>
        </Surface>

        {cards.length === 0 ? (
          <Surface className="space-y-4 p-6">
            <p className="text-sm text-white/75">No cards in your wallet yet. Add cards first to configure benefits.</p>
            <Button variant="secondary" onClick={() => router.push("/onboarding/cards")}>
              Back to wallet builder
            </Button>
          </Surface>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const isExpanded = expandedCardId === card.cardId;
              const grouped = groupedByFrequency(card.benefits);

              return (
                <Surface key={card.cardId} className="overflow-hidden p-0">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/5"
                    onClick={() => setExpandedCardId((prev) => (prev === card.cardId ? null : card.cardId))}
                  >
                    <div>
                      <p className="text-base font-semibold text-white">{card.cardName}</p>
                      <p className="text-xs text-white/55">
                        {card.issuer} {card.network ? `• ${card.network}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-xs text-white/75">
                        {card.benefits.length} benefits
                      </span>
                      <span className="text-sm text-white/65">{isExpanded ? "−" : "+"}</span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-4 border-t border-white/10 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-white/50">Card controls</p>
                        <Button size="sm" variant="secondary" onClick={() => handleEnableAll(card)}>
                          Enable all (this card)
                        </Button>
                      </div>

                      {grouped.map((bucket) => (
                        <div key={bucket.frequency} className="space-y-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
                            {formatFrequencyLabel(bucket.frequency)}
                          </h3>

                          <ul className="space-y-2">
                            {bucket.benefits.map((benefit) => {
                              const confirmationLabel = benefit.requires_selection
                                ? "Selected"
                                : benefit.requires_enrollment
                                  ? "Enrolled"
                                  : null;
                              const value = formatMoney(benefit.value_cents);

                              return (
                                <li
                                  key={benefit.id}
                                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4 sm:py-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-medium text-white/95">{benefit.display_name}</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                        {value ? (
                                          <span className="rounded-full border border-[#7FB6FF]/40 bg-[#7FB6FF]/15 px-2 py-0.5 text-[#BFD8FF]">
                                            {value}/{formatFrequencyLabel(benefit.frequency).toLowerCase()}
                                          </span>
                                        ) : null}
                                        {benefit.requires_enrollment ? (
                                          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/70">
                                            Enrollment required
                                          </span>
                                        ) : null}
                                        {benefit.requires_selection ? (
                                          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/70">
                                            Selection required
                                          </span>
                                        ) : null}
                                        {benefit.is_used ? (
                                          <span className="rounded-full border border-[#86EFAC]/40 bg-[#86EFAC]/15 px-2 py-0.5 text-[#BBF7D0]">
                                            Used ({benefit.current_period_key})
                                          </span>
                                        ) : null}
                                      </div>
                                      {benefit.notes ? <p className="mt-1 text-xs text-white/55">{benefit.notes}</p> : null}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant={benefit.is_enabled ? "primary" : "secondary"}
                                        onClick={() => updateTrack(benefit, !benefit.is_enabled)}
                                      >
                                        Track: {benefit.is_enabled ? "On" : "Off"}
                                      </Button>

                                      {confirmationLabel ? (
                                        <Button
                                          size="sm"
                                          variant={benefit.is_enrolled ? "subtle" : "secondary"}
                                          onClick={() => updateEnrollment(benefit, !benefit.is_enrolled)}
                                        >
                                          {confirmationLabel}: {benefit.is_enrolled ? "Yes" : "No"}
                                        </Button>
                                      ) : null}

                                      {MARK_USED_FREQUENCIES.has(benefit.frequency) ? (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className={cn(benefit.is_used && "border border-[#86EFAC]/35 text-[#BBF7D0]")}
                                          onClick={() => toggleUsed(benefit, !benefit.is_used)}
                                        >
                                          {benefit.is_used ? "Undo" : "Mark used"}
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Surface>
              );
            })}
          </div>
        )}

        <Surface className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 p-4">
          <Button variant="secondary" onClick={() => router.push("/onboarding/cards")}>
            ← Back
          </Button>
          <Button onClick={() => pushToast("All set. Your benefits setup is saved.")}>Finish Set-Up</Button>
        </Surface>

        {activeCard ? (
          <p className="text-center text-xs text-white/45">Currently editing: {activeCard.cardName}</p>
        ) : null}
      </div>
    </AppShell>
  );
}
