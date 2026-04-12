import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBenefitPeriodStatusMap,
  buildBenefitUsageUpdate,
  getBenefitUsedForCurrentPeriod,
  type UserBenefitPeriodStatusRecord,
} from "@/lib/benefits/usage-state";
import { getBenefitPeriodUrgency } from "@/lib/benefit-periods";
import { getIssuerDisplayName } from "@/lib/format-card";

export type Cadence = "monthly" | "quarterly" | "semiannual" | "annual" | "multi_year" | "one_time" | "per_booking";

export type BenefitRow = {
  id: string;
  display_name: string;
  description: string | null;
  cadence: Cadence;
  cadence_detail: Record<string, unknown> | null;
  value_cents: number | null;
  reset_timing: string | null;
  notes: string | null;
  user_benefit_id: string | null;
  remind_me: boolean;
  current_period_used: boolean;
};

export type CardGroup = {
  cardId: string;
  cardName: string;
  issuer: string;
  cardStatus: "active" | "no_trackable_benefits" | null;
  benefits: BenefitRow[];
};

type WalletRow = {
  card_id: string;
  cards: {
    id: string;
    card_name: string;
    display_name: string | null;
    product_key: string | null;
    issuer: string;
    network: string | null;
    card_status: "active" | "no_trackable_benefits" | null;
  };
};

type CanonicalBenefitRecord = {
  card_id: string;
  id: string;
  benefit_name: string | null;
  benefit_value: string | null;
  cadence: string | null;
  reset_timing: string | null;
  enrollment_required: boolean | null;
  requires_setup: boolean | null;
  track_in_memento: "yes" | "later" | "no" | null;
  source_url: string | null;
  notes: string | null;
};

type UserBenefitRecord = {
  id: string;
  benefit_id: string;
  remind_me: boolean;
  used: boolean;
};

type LoadBenefitsOnboardingSuccess = {
  userId: string;
  cards: CardGroup[];
  expandedCardId: string | null;
  activeCadenceByCardId: Record<string, Cadence>;
};

type LoadBenefitsOnboardingFailure = {
  errorMessage: string;
};

export type LoadBenefitsOnboardingResult =
  | LoadBenefitsOnboardingSuccess
  | LoadBenefitsOnboardingFailure;

const CADENCE_ORDER: Cadence[] = ["monthly", "quarterly", "semiannual", "annual", "multi_year", "one_time", "per_booking"];
const UNSCHEDULED_BENEFIT_SORT_ORDER = Number.MAX_SAFE_INTEGER;

function normalizeCadence(cadence: string | null | undefined): Cadence {
  if (
    cadence === "monthly" ||
    cadence === "quarterly" ||
    cadence === "semiannual" ||
    cadence === "annual" ||
    cadence === "multi_year" ||
    cadence === "one_time" ||
    cadence === "per_booking"
  ) {
    return cadence;
  }

  return "annual";
}

function formatCanonicalBenefitValue(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  const numericPortion = trimmedValue.replace(/[^0-9.]/g, "");
  if (!numericPortion) return null;

  const parsedValue = Number.parseFloat(numericPortion);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return null;

  return Math.round(parsedValue * 100);
}

function buildBenefitDescription({
  notes,
  resetTiming,
  enrollmentRequired,
  requiresSetup,
}: {
  notes: string | null;
  resetTiming: string | null;
  enrollmentRequired: boolean;
  requiresSetup: boolean;
}) {
  const details = [
    notes?.trim() || null,
    resetTiming?.trim() ? `Resets: ${resetTiming.trim()}` : null,
    enrollmentRequired ? "Enrollment required." : null,
    requiresSetup ? "Additional setup required." : null,
  ].filter((value): value is string => Boolean(value));

  return details.length > 0 ? details.join(" ") : null;
}

function getBenefitUrgencySortValue(benefit: Pick<BenefitRow, "cadence" | "reset_timing">, currentDate: Date) {
  return getBenefitPeriodUrgency(benefit.cadence, benefit.reset_timing, currentDate)?.days_remaining ?? UNSCHEDULED_BENEFIT_SORT_ORDER;
}

function getExpandedCardId(cards: CardGroup[], previousExpandedCardId: string | null) {
  return previousExpandedCardId && cards.some((card) => card.cardId === previousExpandedCardId)
    ? previousExpandedCardId
    : null;
}

export function getDefaultCadence(benefits: BenefitRow[]) {
  if (benefits.some((benefit) => benefit.cadence === "monthly")) return "monthly";
  return CADENCE_ORDER.find((cadence) => benefits.some((benefit) => benefit.cadence === cadence)) ?? "monthly";
}

function getActiveCadenceByCardId(
  cards: CardGroup[],
  previousActiveCadenceByCardId: Record<string, Cadence>,
) {
  const next: Record<string, Cadence> = {};

  for (const card of cards) {
    const existing = previousActiveCadenceByCardId[card.cardId];
    if (existing && card.benefits.some((benefit) => benefit.cadence === existing)) {
      next[card.cardId] = existing;
      continue;
    }

    next[card.cardId] = getDefaultCadence(card.benefits);
  }

  return next;
}

function buildCardsWithoutBenefits(wallet: WalletRow[]) {
  return wallet
    .map((walletCard) => ({
      cardId: walletCard.cards.id,
      cardName: walletCard.cards.display_name ?? walletCard.cards.card_name,
      issuer: getIssuerDisplayName(walletCard.cards.issuer),
      cardStatus: walletCard.cards.card_status,
      benefits: [],
    }))
    .sort((a, b) => a.cardName.localeCompare(b.cardName));
}

async function loadWalletRows(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_cards")
    .select("card_id, cards!inner(id, card_name, display_name, product_key, issuer, network, card_status)")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load wallet cards", error);
    return { errorMessage: "Could not load your cards right now." } as const;
  }

  const wallet = (data ?? []) as unknown as WalletRow[];

  if (process.env.NODE_ENV !== "production") {
    const seenCardIds = new Set<string>();
    const duplicateCardIds = new Set<string>();
    for (const row of wallet) {
      if (seenCardIds.has(row.card_id)) duplicateCardIds.add(row.card_id);
      seenCardIds.add(row.card_id);
    }
    if (duplicateCardIds.size > 0) {
      console.warn("[benefits-onboarding] duplicate wallet card_ids detected after load", {
        user_id: userId,
        card_ids: Array.from(duplicateCardIds),
      });
    }
  }

  return { wallet } as const;
}

async function loadCanonicalBenefits(
  supabase: SupabaseClient,
  wallet: WalletRow[],
) {
  const cardIds = wallet.map((row) => row.cards.id);
  const { data, error } = await supabase
    .from("benefits")
    .select("id, card_id, benefit_name, benefit_value, cadence, reset_timing, enrollment_required, requires_setup, track_in_memento, source_url, notes")
    .in("card_id", cardIds)
    .eq("track_in_memento", "yes");

  if (error) {
    console.error("Failed to load card benefits", error);
    return { errorMessage: "Could not load card benefits right now." } as const;
  }

  const benefits = (data ?? []) as unknown as CanonicalBenefitRecord[];

  if (process.env.NODE_ENV !== "production") {
    const benefitCountByCard = new Map<string, number>();
    for (const row of benefits) {
      benefitCountByCard.set(row.card_id, (benefitCountByCard.get(row.card_id) ?? 0) + 1);
    }

    for (const walletCard of wallet) {
      console.debug("[benefits-onboarding] card benefit match", {
        card_id: walletCard.cards.id,
        product_key: walletCard.cards.product_key,
        matched_benefits: benefitCountByCard.get(walletCard.cards.id) ?? 0,
      });
    }
  }

  return { benefits } as const;
}

async function loadUserBenefits(
  supabase: SupabaseClient,
  userId: string,
  wallet: WalletRow[],
  benefits: CanonicalBenefitRecord[],
) {
  const benefitIds = Array.from(new Set(benefits.map((row) => row.id)));
  let { data: userBenefitRows, error: userBenefitsError } = await supabase
    .from("user_benefits")
    .select("id, benefit_id, remind_me, used")
    .eq("user_id", userId)
    .in("benefit_id", benefitIds);

  if (userBenefitsError) {
    console.error("Failed to load user benefits", userBenefitsError);
    return { errorMessage: "Could not load your benefit settings right now." } as const;
  }

  const userBenefitMap = new Map(((userBenefitRows ?? []) as UserBenefitRecord[]).map((row) => [row.benefit_id, row]));
  const cardsMissingUserBenefits = new Set<string>();

  for (const card of wallet) {
    const cardBenefitIds = benefits.filter((row) => row.card_id === card.cards.id).map((row) => row.id);
    if (cardBenefitIds.some((benefitId) => !userBenefitMap.has(benefitId))) {
      cardsMissingUserBenefits.add(card.cards.id);
    }
  }

  if (cardsMissingUserBenefits.size > 0) {
    for (const cardId of cardsMissingUserBenefits) {
      const { error: bootstrapError } = await supabase.rpc("bootstrap_user_benefits_for_card", {
        p_user_id: userId,
        p_card_id: cardId,
      });
      if (bootstrapError) {
        console.error(`Failed to bootstrap missing user benefits for card ${cardId}`, bootstrapError);
      }
    }

    const refetch = await supabase
      .from("user_benefits")
      .select("id, benefit_id, remind_me, used")
      .eq("user_id", userId)
      .in("benefit_id", benefitIds);

    userBenefitRows = refetch.data ?? userBenefitRows;
    userBenefitsError = refetch.error;

    if (userBenefitsError) {
      console.error("Failed to reload user benefits", userBenefitsError);
      return { errorMessage: "Could not load your benefit settings right now." } as const;
    }
  }

  return {
    benefitIds,
    userBenefitMap: new Map(((userBenefitRows ?? []) as UserBenefitRecord[]).map((row) => [row.benefit_id, row])),
  } as const;
}

async function loadPeriodStatusMap(
  supabase: SupabaseClient,
  userId: string,
  benefitIds: string[],
  benefits: CanonicalBenefitRecord[],
  currentDate: Date,
) {
  const periodKeys = Array.from(
    new Set(
      benefits
        .map((benefit) => {
          if (!benefit.cadence || benefit.cadence === "one_time") {
            return null;
          }

          return buildBenefitUsageUpdate({
            userId,
            benefitId: benefit.id,
            cadence: benefit.cadence,
            nextUsed: true,
            at: currentDate,
          }).periodStatusUpsert?.period_key ?? null;
        })
        .filter((periodKey): periodKey is string => Boolean(periodKey)),
    ),
  );

  if (periodKeys.length === 0) {
    return { periodStatusMap: new Map<string, UserBenefitPeriodStatusRecord>() } as const;
  }

  const { data, error } = await supabase
    .from("user_benefit_period_status")
    .select("benefit_id, period_key, is_used, used_at")
    .eq("user_id", userId)
    .in("benefit_id", benefitIds)
    .in("period_key", periodKeys);

  if (error) {
    console.error("Failed to load current-period benefit usage", error);
    return { errorMessage: "Could not load your benefit settings right now." } as const;
  }

  return {
    periodStatusMap: buildBenefitPeriodStatusMap((data ?? []) as UserBenefitPeriodStatusRecord[]),
  } as const;
}

function buildBenefitRowsForCard(
  walletCard: WalletRow,
  benefits: CanonicalBenefitRecord[],
  userBenefitMap: Map<string, UserBenefitRecord>,
  periodStatusMap: Map<string, UserBenefitPeriodStatusRecord>,
  currentDate: Date,
) {
  return benefits
    .filter((benefit) => benefit.card_id === walletCard.cards.id)
    .sort(
      (a, b) =>
        getBenefitUrgencySortValue(
          { cadence: normalizeCadence(a.cadence), reset_timing: a.reset_timing },
          currentDate,
        ) -
          getBenefitUrgencySortValue(
            { cadence: normalizeCadence(b.cadence), reset_timing: b.reset_timing },
            currentDate,
          ) ||
        CADENCE_ORDER.indexOf(normalizeCadence(a.cadence)) -
          CADENCE_ORDER.indexOf(normalizeCadence(b.cadence)) ||
        (a.benefit_name?.trim() || "").localeCompare(b.benefit_name?.trim() || ""),
    )
    .map((benefit) => {
      const userBenefit = userBenefitMap.get(benefit.id);

      return {
        id: benefit.id,
        display_name: benefit.benefit_name?.trim() || "Unnamed benefit",
        description: buildBenefitDescription({
          notes: benefit.notes,
          resetTiming: benefit.reset_timing,
          enrollmentRequired: benefit.enrollment_required === true,
          requiresSetup: benefit.requires_setup === true,
        }),
        cadence: normalizeCadence(benefit.cadence),
        cadence_detail: null,
        value_cents: formatCanonicalBenefitValue(benefit.benefit_value),
        reset_timing: benefit.reset_timing,
        notes: benefit.notes,
        user_benefit_id: userBenefit?.id ?? null,
        remind_me: userBenefit?.remind_me ?? true,
        current_period_used: getBenefitUsedForCurrentPeriod({
          benefitId: benefit.id,
          cadence: normalizeCadence(benefit.cadence),
          periodStatusMap,
          at: currentDate,
          fallbackUsed: typeof userBenefit?.used === "boolean" ? userBenefit.used : false,
        }),
      } satisfies BenefitRow;
    });
}

function buildCardGroups(
  wallet: WalletRow[],
  benefits: CanonicalBenefitRecord[],
  userBenefitMap: Map<string, UserBenefitRecord>,
  periodStatusMap: Map<string, UserBenefitPeriodStatusRecord>,
  currentDate: Date,
) {
  return wallet
    .map((walletCard) => ({
      cardId: walletCard.cards.id,
      cardName: walletCard.cards.display_name ?? walletCard.cards.card_name,
      issuer: getIssuerDisplayName(walletCard.cards.issuer),
      cardStatus: walletCard.cards.card_status,
      benefits: buildBenefitRowsForCard(walletCard, benefits, userBenefitMap, periodStatusMap, currentDate),
    }))
    .sort((a, b) => a.cardName.localeCompare(b.cardName));
}

export async function loadBenefitsOnboardingData({
  supabase,
  previousExpandedCardId,
  previousActiveCadenceByCardId,
}: {
  supabase: SupabaseClient;
  previousExpandedCardId: string | null;
  previousActiveCadenceByCardId: Record<string, Cadence>;
}): Promise<LoadBenefitsOnboardingResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { errorMessage: "Could not verify your account. Please log in again." };
  }

  const walletResult = await loadWalletRows(supabase, user.id);
  if (walletResult.errorMessage) {
    return { errorMessage: walletResult.errorMessage };
  }

  if (walletResult.wallet.length === 0) {
    return {
      userId: user.id,
      cards: [],
      expandedCardId: null,
      activeCadenceByCardId: {},
    };
  }

  const benefitsResult = await loadCanonicalBenefits(supabase, walletResult.wallet);
  if (benefitsResult.errorMessage) {
    return { errorMessage: benefitsResult.errorMessage };
  }

  const benefitIds = Array.from(new Set(benefitsResult.benefits.map((row) => row.id)));
  if (benefitIds.length === 0) {
    const cards = buildCardsWithoutBenefits(walletResult.wallet);
    return {
      userId: user.id,
      cards,
      expandedCardId: getExpandedCardId(cards, previousExpandedCardId),
      activeCadenceByCardId: getActiveCadenceByCardId(cards, previousActiveCadenceByCardId),
    };
  }

  const currentDate = new Date();
  const userBenefitsResult = await loadUserBenefits(supabase, user.id, walletResult.wallet, benefitsResult.benefits);
  if (userBenefitsResult.errorMessage) {
    return { errorMessage: userBenefitsResult.errorMessage };
  }

  const periodStatusResult = await loadPeriodStatusMap(
    supabase,
    user.id,
    userBenefitsResult.benefitIds,
    benefitsResult.benefits,
    currentDate,
  );
  if (periodStatusResult.errorMessage) {
    return { errorMessage: periodStatusResult.errorMessage };
  }

  const cards = buildCardGroups(
    walletResult.wallet,
    benefitsResult.benefits,
    userBenefitsResult.userBenefitMap,
    periodStatusResult.periodStatusMap,
    currentDate,
  );

  return {
    userId: user.id,
    cards,
    expandedCardId: getExpandedCardId(cards, previousExpandedCardId),
    activeCadenceByCardId: getActiveCadenceByCardId(cards, previousActiveCadenceByCardId),
  };
}
