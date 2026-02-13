"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { createClient } from "@/utils/supabase/client";

type Toast = { id: string; message: string };

type Cadence = "monthly" | "quarterly" | "semi_annual" | "annual" | "one_time";
type LegacyFrequency = "monthly" | "quarterly" | "semiannual" | "annual" | "activation" | "multi_year";

type BenefitRow = {
  id: string;
  display_name: string;
  description: string | null;
  cadence: Cadence;
  cadence_detail: Record<string, unknown> | null;
  value_cents: number | null;
  notes: string | null;
  user_benefit_id: string | null;
  remind_me: boolean;
  used: boolean;
};

type CardGroup = {
  cardId: string;
  cardName: string;
  productKey: string | null;
  issuer: string;
  network: string | null;
  benefits: BenefitRow[];
};

type UserBenefitRecord = {
  id: string;
  benefit_id: string;
  remind_me?: boolean | null;
  used?: boolean | null;
  is_enabled?: boolean | null;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const CADENCE_ORDER: Cadence[] = ["monthly", "quarterly", "semi_annual", "annual", "one_time"];
const BENEFIT_AMOUNT_ACCENT_CLASS = "text-[#F7C948]";
const ISSUER_DISPLAY_MAP: Record<string, string> = {
  amex: "American Express",
  "american express": "American Express",
  chase: "Chase",
  citi: "Citi",
  "capital-one": "Capital One",
  "capital one": "Capital One",
  discover: "Discover",
  wellsfargo: "Wells Fargo",
  "wells fargo": "Wells Fargo",
  usbank: "US Bank",
  "us bank": "US Bank",
  bankofamerica: "Bank of America",
  "bank of america": "Bank of America",
};
const NETWORK_DISPLAY_MAP: Record<string, string> = {
  amex: "Amex",
  "american express": "Amex",
  visa: "Visa",
  mastercard: "Mastercard",
  "master card": "Mastercard",
  mc: "Mastercard",
  discover: "Discover",
};

function formatCadenceLabel(cadence: Cadence) {
  if (cadence === "semi_annual") return "Semi-Annually";
  if (cadence === "one_time") return "One-Time Activation";
  return cadence.charAt(0).toUpperCase() + cadence.slice(1);
}

function formatCurrencyFromCents(valueCents: number) {
  const hasCents = Math.abs(valueCents) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(valueCents / 100);
}

function formatBenefitAmount(value_cents: number | null, cadence: Cadence) {
  if (value_cents == null || value_cents <= 0) return null;

  const amount = formatCurrencyFromCents(value_cents);

  if (cadence === "one_time") return `${amount} one-time`;
  if (cadence === "monthly") return `${amount}/month`;
  if (cadence === "quarterly") return `${amount}/quarter`;
  if (cadence === "semi_annual") return `${amount}/semi-annual`;
  return `${amount}/year`;
}

function normalizeCadence(cadence: string | null | undefined, frequency: LegacyFrequency | null | undefined): Cadence {
  if (cadence === "monthly" || cadence === "quarterly" || cadence === "semi_annual" || cadence === "annual" || cadence === "one_time") {
    return cadence;
  }

  if (frequency === "monthly" || frequency === "quarterly" || frequency === "annual") return frequency;
  if (frequency === "semiannual") return "semi_annual";
  if (frequency === "activation") return "one_time";
  if (frequency === "multi_year") return "annual";
  return "annual";
}

function toTitleCase(raw: string) {
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeIssuerDisplayName(rawIssuer: string) {
  const normalizedKey = rawIssuer.trim().toLowerCase();
  return ISSUER_DISPLAY_MAP[normalizedKey] ?? toTitleCase(rawIssuer);
}

function normalizeNetworkDisplayName(rawNetwork: string | null) {
  if (!rawNetwork) return null;
  const normalizedKey = rawNetwork.trim().toLowerCase();
  return NETWORK_DISPLAY_MAP[normalizedKey] ?? toTitleCase(rawNetwork);
}

function describeSupabaseError(error: unknown) {
  const err = (error ?? {}) as SupabaseErrorLike;
  return {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    raw: error,
    stringified:
      typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
  };
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
  const [activeCadenceByCardId, setActiveCadenceByCardId] = useState<Record<string, Cadence>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const hasLoggedRepairWarningRef = useRef(false);

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
      .select("card_id, cards!inner(id, card_name, display_name, product_key, issuer, network)")
      .eq("user_id", user.id);

    if (walletError) {
      console.error("Failed to load wallet cards", walletError);
      setError("Could not load your cards right now.");
      setLoading(false);
      return;
    }

    type WalletRow = {
      card_id: string;
      cards: { id: string; card_name: string; display_name: string | null; product_key: string | null; issuer: string; network: string | null };
    };

    const wallet = (walletRows ?? []) as WalletRow[];

    if (wallet.length === 0) {
      setCards([]);
      setExpandedCardId(null);
      setLoading(false);
      return;
    }

    const productKeys = Array.from(new Set(wallet.map((row) => row.cards.product_key).filter((value): value is string => Boolean(value))));

    let canonicalIdByProductKey = new Map<string, string>();
    if (productKeys.length > 0) {
      const { data: canonicalCardRows, error: canonicalCardsError } = await supabase
        .from("cards")
        .select("id, product_key")
        .in("product_key", productKeys);

      if (canonicalCardsError) {
        console.error("Failed to load canonical cards", canonicalCardsError);
      } else {
        canonicalIdByProductKey = new Map(
          (canonicalCardRows ?? [])
            .filter((row): row is { id: string; product_key: string } => Boolean(row.product_key && row.id))
            .map((row) => [row.product_key, row.id]),
        );
      }
    }

    const walletRepairRows = wallet
      .map((row) => {
        const productKey = row.cards.product_key;
        const canonicalId = productKey ? canonicalIdByProductKey.get(productKey) ?? null : null;
        return {
          row,
          productKey,
          canonicalId,
          needsRepair: Boolean(canonicalId && canonicalId !== row.card_id),
        };
      })
      .filter((entry) => entry.needsRepair);

    if (walletRepairRows.length > 0 && !hasLoggedRepairWarningRef.current) {
      hasLoggedRepairWarningRef.current = true;
      console.warn("[benefits-onboarding] repaired non-canonical wallet card ids", {
        repairs: walletRepairRows.map((repair) => ({
          product_key: repair.productKey,
          wrong_card_id: repair.row.card_id,
          canonical_card_id: repair.canonicalId,
        })),
      });
    }

    if (walletRepairRows.length > 0) {
      for (const repair of walletRepairRows) {
        const canonicalId = repair.canonicalId;
        if (!canonicalId) continue;

        const { error: insertCanonicalError } = await supabase.from("user_cards").upsert(
          {
            user_id: user.id,
            card_id: canonicalId,
          },
          { onConflict: "user_id,card_id", ignoreDuplicates: true },
        );

        if (insertCanonicalError) {
          console.error("Failed to insert canonical wallet row", insertCanonicalError);
          continue;
        }

        const { error: deleteOldError } = await supabase
          .from("user_cards")
          .delete()
          .eq("user_id", user.id)
          .eq("card_id", repair.row.card_id);

        if (deleteOldError) {
          console.error("Failed to delete duplicate wallet row", deleteOldError);
        }
      }
    }

    const { data: refreshedWalletRows, error: refreshedWalletError } = await supabase
      .from("user_cards")
      .select("card_id, cards!inner(id, card_name, display_name, product_key, issuer, network)")
      .eq("user_id", user.id);

    if (refreshedWalletError) {
      console.error("Failed to reload wallet cards", refreshedWalletError);
    }

    const walletForView =
      refreshedWalletError || !refreshedWalletRows
        ? wallet.map((row) => {
            const productKey = row.cards.product_key;
            const canonicalId = productKey ? canonicalIdByProductKey.get(productKey) ?? row.card_id : row.card_id;
            return {
              ...row,
              card_id: canonicalId,
              cards: {
                ...row.cards,
                id: canonicalId,
              },
            };
          })
        : ((refreshedWalletRows as WalletRow[]).map((row) => {
            const productKey = row.cards.product_key;
            const canonicalId = productKey ? canonicalIdByProductKey.get(productKey) ?? row.card_id : row.card_id;
            return {
              ...row,
              card_id: canonicalId,
              cards: {
                ...row.cards,
                id: canonicalId,
              },
            };
          }) as WalletRow[]);

    const walletByCanonicalCardId = new Map(walletForView.map((row) => [row.card_id, row]));
    const dedupedWallet = Array.from(walletByCanonicalCardId.values());

    const cardIds = dedupedWallet.map((row) => row.card_id);
    const { data: cardBenefitRows, error: cardBenefitsError } = await supabase
      .from("card_benefits")
      .select(
        "card_id, benefit_id, benefits!inner(id, display_name, description, cadence, cadence_detail, frequency, value_cents, requires_enrollment, requires_selection, notes)",
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
        description: string | null;
        cadence: string | null;
        cadence_detail: Record<string, unknown> | null;
        frequency: LegacyFrequency | null;
        value_cents: number | null;
        notes: string | null;
      };
    }>;

    if (process.env.NODE_ENV !== "production") {
      const benefitCountByCard = new Map<string, number>();
      for (const row of cardBenefits) {
        benefitCountByCard.set(row.card_id, (benefitCountByCard.get(row.card_id) ?? 0) + 1);
      }

      for (const walletCard of dedupedWallet) {
        console.debug("[benefits-onboarding] card benefit match", {
          card_id: walletCard.card_id,
          product_key: walletCard.cards.product_key,
          canonical_id: walletCard.cards.product_key ? (canonicalIdByProductKey.get(walletCard.cards.product_key) ?? null) : null,
          matched_benefits: benefitCountByCard.get(walletCard.card_id) ?? 0,
        });
      }
    }

    const benefitIds = Array.from(new Set(cardBenefits.map((row) => row.benefit_id)));

    let { data: userBenefitRows, error: userBenefitsError } = await supabase
      .from("user_benefits")
      .select("*")
      .eq("user_id", user.id)
      .in("benefit_id", benefitIds);

    if (userBenefitsError) {
      console.error("Failed to load user benefits", userBenefitsError);
      setError("Could not load your benefit settings right now.");
      setLoading(false);
      return;
    }

    const userBenefitMap = new Map(((userBenefitRows ?? []) as UserBenefitRecord[]).map((row) => [row.benefit_id, row]));

    const cardsMissingUserBenefits = new Set<string>();
    for (const card of dedupedWallet) {
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
        .select("*")
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

    const refreshedUserBenefitMap = new Map(((userBenefitRows ?? []) as UserBenefitRecord[]).map((row) => [row.benefit_id, row]));

    const nextCards: CardGroup[] = dedupedWallet
      .map((walletCard) => {
        const benefitsForCard = cardBenefits
          .filter((cb) => cb.card_id === walletCard.card_id)
          .sort(
            (a, b) =>
              CADENCE_ORDER.indexOf(normalizeCadence(a.benefits.cadence, a.benefits.frequency)) -
                CADENCE_ORDER.indexOf(normalizeCadence(b.benefits.cadence, b.benefits.frequency)) ||
              a.benefits.display_name.localeCompare(b.benefits.display_name),
          )
          .map((cb) => {
            const userBenefit = refreshedUserBenefitMap.get(cb.benefit_id);

            return {
              id: cb.benefit_id,
              display_name: cb.benefits.display_name,
              description: cb.benefits.description,
              cadence: normalizeCadence(cb.benefits.cadence, cb.benefits.frequency),
              cadence_detail: cb.benefits.cadence_detail,
              value_cents: cb.benefits.value_cents,
              notes: cb.benefits.notes,
              user_benefit_id: userBenefit?.id ?? null,
              remind_me:
                typeof userBenefit?.remind_me === "boolean"
                  ? userBenefit.remind_me
                  : typeof userBenefit?.is_enabled === "boolean"
                    ? userBenefit.is_enabled
                    : true,
              used: typeof userBenefit?.used === "boolean" ? userBenefit.used : false,
            };
          });

        return {
          cardId: walletCard.card_id,
          cardName: walletCard.cards.display_name ?? walletCard.cards.card_name,
          productKey: walletCard.cards.product_key,
          issuer: normalizeIssuerDisplayName(walletCard.cards.issuer),
          network: normalizeNetworkDisplayName(walletCard.cards.network),
          benefits: benefitsForCard,
        };
      })
      .sort((a, b) => a.cardName.localeCompare(b.cardName));

    setCards(nextCards);
    setExpandedCardId((prev) => prev ?? nextCards[0]?.cardId ?? null);
    setActiveCadenceByCardId((prev) => {
      const next: Record<string, Cadence> = {};
      for (const card of nextCards) {
        const existing = prev[card.cardId];
        if (existing && card.benefits.some((benefit) => benefit.cadence === existing)) {
          next[card.cardId] = existing;
          continue;
        }

        next[card.cardId] = card.benefits.some((benefit) => benefit.cadence === "monthly")
          ? "monthly"
          : (CADENCE_ORDER.find((cadence) => card.benefits.some((benefit) => benefit.cadence === cadence)) ?? "monthly");
      }
      return next;
    });
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

  const updateRemindMe = async (benefit: BenefitRow, nextValue: boolean) => {
    if (!userId) return;
    if (benefit.used && nextValue) return;

    updateBenefitLocal(benefit.id, (prev) => ({ ...prev, remind_me: nextValue }));

    const { data: savedRow, error: updateError } = await supabase
      .from("user_benefits")
      .upsert(
        {
          user_id: userId,
          benefit_id: benefit.id,
          remind_me: nextValue,
          used: benefit.used,
        },
        { onConflict: "user_id,benefit_id" },
      )
      .select("id, benefit_id, remind_me, used")
      .single();

    if (updateError) {
      const errorDetails = describeSupabaseError(updateError);
      console.error("Failed to update remind me status", errorDetails);
      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, remind_me: !nextValue }));
      pushToast(`Could not save. ${errorDetails.message ?? "Please try again."}`);
      return;
    }

    updateBenefitLocal(benefit.id, (prev) => ({
      ...prev,
      user_benefit_id: savedRow?.id ?? prev.user_benefit_id,
      remind_me: savedRow?.remind_me ?? nextValue,
      used: savedRow?.used ?? prev.used,
    }));

    pushToast(nextValue ? "Reminder enabled." : "Reminder disabled.");
  };

  const updateUsed = async (benefit: BenefitRow, nextUsed: boolean) => {
    if (!userId) return;
    const nextRemindMe = nextUsed ? false : benefit.remind_me;

    updateBenefitLocal(benefit.id, (prev) => ({ ...prev, used: nextUsed, remind_me: nextRemindMe }));

    const { data: savedRow, error: upsertError } = await supabase
      .from("user_benefits")
      .upsert(
        {
          user_id: userId,
          benefit_id: benefit.id,
          used: nextUsed,
          remind_me: nextRemindMe,
        },
        { onConflict: "user_id,benefit_id" },
      )
      .select("id, benefit_id, remind_me, used")
      .single();

    if (upsertError) {
      const errorDetails = describeSupabaseError(upsertError);
      console.error("Failed to update used status", errorDetails);
      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, used: !nextUsed, remind_me: benefit.remind_me }));
      pushToast(`Could not save. ${errorDetails.message ?? "Please try again."}`);
      return;
    }

    updateBenefitLocal(benefit.id, (prev) => ({
      ...prev,
      user_benefit_id: savedRow?.id ?? prev.user_benefit_id,
      used: savedRow?.used ?? nextUsed,
      remind_me: savedRow?.remind_me ?? nextRemindMe,
    }));

    pushToast(nextUsed ? "Marked as used." : "Used status reset.");
  };

  const getCadenceCount = (benefits: BenefitRow[], cadence: Cadence) => benefits.filter((benefit) => benefit.cadence === cadence).length;

  const getDefaultCadence = (benefits: BenefitRow[]) => {
    if (getCadenceCount(benefits, "monthly") > 0) return "monthly";
    return CADENCE_ORDER.find((cadence) => getCadenceCount(benefits, cadence) > 0) ?? "monthly";
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cardId: string, cadence: Cadence) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const currentIndex = CADENCE_ORDER.indexOf(cadence);
    let nextCadence = cadence;

    if (event.key === "ArrowRight") {
      nextCadence = CADENCE_ORDER[(currentIndex + 1) % CADENCE_ORDER.length];
    } else if (event.key === "ArrowLeft") {
      nextCadence = CADENCE_ORDER[(currentIndex - 1 + CADENCE_ORDER.length) % CADENCE_ORDER.length];
    } else if (event.key === "Home") {
      nextCadence = CADENCE_ORDER[0];
    } else if (event.key === "End") {
      nextCadence = CADENCE_ORDER[CADENCE_ORDER.length - 1];
    }

    setActiveCadenceByCardId((prev) => ({ ...prev, [cardId]: nextCadence }));
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
          <p className="mt-2 text-sm text-white/65">Turn reminders on for active perks, and mark benefits as used once consumed.</p>
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
              const activeCadence = activeCadenceByCardId[card.cardId] ?? getDefaultCadence(card.benefits);
              const activeCadenceBenefits = card.benefits.filter((benefit) => benefit.cadence === activeCadence);

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
                        {card.issuer}
                        {card.network ? ` • ${card.network}` : ""}
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
                      <div className="overflow-x-auto pb-1">
                        <div role="tablist" aria-label={`${card.cardName} benefit cadence`} className="inline-flex min-w-full gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                          {CADENCE_ORDER.map((cadence) => {
                            const count = getCadenceCount(card.benefits, cadence);
                            const isActive = cadence === activeCadence;
                            return (
                              <button
                                key={cadence}
                                id={`tab-${card.cardId}-${cadence}`}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={`panel-${card.cardId}-${cadence}`}
                                tabIndex={isActive ? 0 : -1}
                                className={cn(
                                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                  isActive ? "bg-white/16 text-white" : "text-white/70 hover:bg-white/10 hover:text-white/90",
                                )}
                                onClick={() => setActiveCadenceByCardId((prev) => ({ ...prev, [card.cardId]: cadence }))}
                                onKeyDown={(event) => handleTabKeyDown(event, card.cardId, cadence)}
                              >
                                {formatCadenceLabel(cadence)} ({count})
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        id={`panel-${card.cardId}-${activeCadence}`}
                        role="tabpanel"
                        aria-labelledby={`tab-${card.cardId}-${activeCadence}`}
                        className="space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{formatCadenceLabel(activeCadence)}</p>
                        </div>

                        {activeCadenceBenefits.length === 0 ? (
                          <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/65">
                            No benefits in this cadence.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {activeCadenceBenefits.map((benefit) => {
                              const formattedAmount = formatBenefitAmount(benefit.value_cents, benefit.cadence);
                              const descriptionText = benefit.description?.trim();
                              const remindMeDisabled = benefit.used;

                              return (
                                <li
                                  key={benefit.id}
                                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 sm:px-3.5 sm:py-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium leading-5 text-white/95">
                                        <span>{benefit.display_name}</span>
                                        {formattedAmount ? (
                                          <span>
                                            {" — "}
                                            <span className={BENEFIT_AMOUNT_ACCENT_CLASS}>{formattedAmount}</span>
                                          </span>
                                        ) : null}
                                      </p>
                                      {descriptionText ? <p className="truncate text-xs leading-4 text-white/60">{descriptionText}</p> : null}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        className={cn(
                                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                          remindMeDisabled
                                            ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                                            : benefit.remind_me
                                              ? "border-[#60A5FA]/40 bg-[#60A5FA]/15 text-[#BFDBFE]"
                                              : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                                        )}
                                        onClick={() => updateRemindMe(benefit, !benefit.remind_me)}
                                        disabled={remindMeDisabled}
                                      >
                                        Remind Me
                                      </button>

                                      <button
                                        type="button"
                                        className={cn(
                                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                          benefit.used
                                            ? "border-[#86EFAC]/35 bg-[#86EFAC]/10 text-[#BBF7D0]"
                                            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                                        )}
                                        onClick={() => updateUsed(benefit, !benefit.used)}
                                      >
                                        Used
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
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

        {activeCard ? <p className="text-center text-xs text-white/45">Currently editing: {activeCard.cardName}</p> : null}
      </div>
    </AppShell>
  );
}
