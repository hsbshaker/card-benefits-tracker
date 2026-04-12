import "server-only";

import { computeBenefitPeriod } from "@/lib/benefits/compute-benefit-period";
import {
  formatBenefitValue,
  getConfigurationStatus,
  getConfigurationType,
  normalizeCardArtUrl,
} from "@/lib/benefits/format-benefit-labels";
import { sortHomeFeedItems } from "@/lib/benefits/rank-benefits";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { HomeFeedItem, HomeFeedResult } from "@/lib/types/server-data";
import { buildHomeHeader } from "@/lib/home/build-home-header";

type HomeCandidateRow = {
  id: string;
  user_card_id: string;
  benefit_id: string;
  reminder_override: "balanced" | "earlier" | "minimal" | null;
  conditional_value: string | null;
  snoozed_until: string | null;
  user_cards: {
    id: string;
    card_id: string;
    card_anniversary_date: string | null;
    status: "active" | "removed";
    cards: {
      id: string;
      card_name: string;
      display_name: string | null;
      source_url: string | null;
      card_status: "active" | "no_trackable_benefits" | null;
    } | {
      id: string;
      card_name: string;
      display_name: string | null;
      source_url: string | null;
      card_status: "active" | "no_trackable_benefits" | null;
    }[] | null;
  } | {
    id: string;
    card_id: string;
    card_anniversary_date: string | null;
    status: "active" | "removed";
    cards: {
      id: string;
      card_name: string;
      display_name: string | null;
      source_url: string | null;
      card_status: "active" | "no_trackable_benefits" | null;
    } | {
      id: string;
      card_name: string;
      display_name: string | null;
      source_url: string | null;
      card_status: "active" | "no_trackable_benefits" | null;
    }[] | null;
  }[] | null;
  benefits: {
    id: string;
    benefit_name: string | null;
    benefit_value: string | null;
    value_cents: number | null;
    cadence: string | null;
    reset_timing: string | null;
    requires_setup: boolean | null;
    requires_selection: boolean | null;
    selection_type: string | null;
    track_in_memento: "yes" | "later" | "no" | null;
  } | {
    id: string;
    benefit_name: string | null;
    benefit_value: string | null;
    value_cents: number | null;
    cadence: string | null;
    reset_timing: string | null;
    requires_setup: boolean | null;
    requires_selection: boolean | null;
    selection_type: string | null;
    track_in_memento: "yes" | "later" | "no" | null;
  }[] | null;
};

const USE_SOON_LIMIT = 6;

function takeFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildUrgencyTier(daysRemaining: number) {
  if (daysRemaining <= 7) {
    return "high" as const;
  }

  if (daysRemaining <= 30) {
    return "soon" as const;
  }

  return "upcoming" as const;
}

function mapHomeFeedItem(row: HomeCandidateRow, now: Date): HomeFeedItem | null {
  const ownedUserCard = takeFirst(row.user_cards);
  const canonicalCard = takeFirst(ownedUserCard?.cards);
  const canonicalBenefit = takeFirst(row.benefits);

  if (
    !ownedUserCard ||
    !canonicalCard ||
    !canonicalBenefit ||
    ownedUserCard.status !== "active" ||
    (canonicalCard.card_status !== "active" && canonicalCard.card_status !== "no_trackable_benefits") ||
    canonicalBenefit.track_in_memento !== "yes"
  ) {
    return null;
  }

  if (row.snoozed_until && new Date(row.snoozed_until) > now) {
    return null;
  }

  const period = computeBenefitPeriod({
    cadence: canonicalBenefit.cadence,
    resetTiming: canonicalBenefit.reset_timing,
    cardAnniversaryDate: ownedUserCard.card_anniversary_date,
    now,
  });

  if (!period || period.daysRemaining > 90) {
    return null;
  }

  const value = formatBenefitValue({
    benefitValue: canonicalBenefit.benefit_value,
    valueCents: canonicalBenefit.value_cents,
  });
  const configurationType = getConfigurationType({
    requiresSelection: canonicalBenefit.requires_selection,
    selectionType: canonicalBenefit.selection_type,
    requiresSetup: canonicalBenefit.requires_setup,
  });

  return {
    userBenefitId: row.id,
    userCardId: row.user_card_id,
    cardId: ownedUserCard.card_id,
    benefitId: row.benefit_id,
    benefitName: canonicalBenefit.benefit_name?.trim() || "Unnamed benefit",
    cardName: canonicalCard.display_name ?? canonicalCard.card_name,
    cardArtUrl: normalizeCardArtUrl(canonicalCard.source_url),
    value: value.value,
    valueDescriptor: value.valueDescriptor,
    periodLabel: period.periodLabel,
    periodEndDate: period.periodEndDate,
    daysRemaining: period.daysRemaining,
    urgencyTier: buildUrgencyTier(period.daysRemaining),
    requiresConfiguration: configurationType !== null,
    configurationType,
    configurationStatus: getConfigurationStatus({
      requiresSelection: canonicalBenefit.requires_selection,
      selectionType: canonicalBenefit.selection_type,
      requiresSetup: canonicalBenefit.requires_setup,
      conditionalValue: row.conditional_value,
    }),
    reminderOverride: row.reminder_override,
    snoozedUntil: row.snoozed_until,
  };
}

export async function buildHomeFeed(userId: string): Promise<HomeFeedResult> {
  const supabase = getServiceRoleSupabaseClient();
  const now = new Date();

  const { data: trackedCardRows, error: trackedCardsError } = await supabase
    .from("user_cards")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (trackedCardsError) {
    throw trackedCardsError;
  }

  const trackedCards = (trackedCardRows ?? []).length;

  if (trackedCards === 0) {
    return {
      header: buildHomeHeader({
        trackedCards: 0,
        trackedBenefits: 0,
        useSoonCount: 0,
        comingUpCount: 0,
      }),
      useSoon: [],
      useSoonHiddenCount: 0,
      comingUp: [],
      comingUpCount: 0,
      walletSummary: {
        trackedBenefits: 0,
        trackedCards: 0,
      },
      isAllClear: false,
      isEmpty: true,
    };
  }

  const { count: trackedBenefitsCount, error: trackedBenefitsError } = await supabase
    .from("user_benefits")
    .select("id", { count: "exact", head: true })
    .in(
      "user_card_id",
      (trackedCardRows ?? []).map((row) => (row as { id: string }).id),
    )
    .eq("is_active", true);

  if (trackedBenefitsError) {
    throw trackedBenefitsError;
  }

  const { data: candidateRows, error: candidatesError } = await supabase
    .from("user_benefits")
    .select(
      "id, user_card_id, benefit_id, reminder_override, conditional_value, snoozed_until, user_cards!inner(id, card_id, card_anniversary_date, status, cards!inner(id, card_name, display_name, source_url, card_status)), benefits!inner(id, benefit_name, benefit_value, value_cents, cadence, reset_timing, requires_setup, requires_selection, selection_type, track_in_memento)",
    )
    .eq("is_active", true)
    .eq("is_used_this_period", false)
    .eq("user_cards.user_id", userId)
    .eq("benefits.track_in_memento", "yes");

  if (candidatesError) {
    throw candidatesError;
  }

  const allEligibleItems = sortHomeFeedItems(
    ((candidateRows ?? []) as unknown as HomeCandidateRow[])
      .map((row) => mapHomeFeedItem(row, now))
      .filter((row): row is HomeFeedItem => row !== null),
  );

  const useSoonAll = allEligibleItems.filter((item) => item.daysRemaining <= 30);
  const comingUp = allEligibleItems.filter((item) => item.daysRemaining >= 31 && item.daysRemaining <= 90);
  const useSoon = useSoonAll.slice(0, USE_SOON_LIMIT);

  return {
    header: buildHomeHeader({
      trackedCards,
      trackedBenefits: trackedBenefitsCount ?? 0,
      useSoonCount: useSoonAll.length,
      comingUpCount: comingUp.length,
    }),
    useSoon,
    useSoonHiddenCount: Math.max(0, useSoonAll.length - USE_SOON_LIMIT),
    comingUp,
    comingUpCount: comingUp.length,
    walletSummary: {
      trackedBenefits: trackedBenefitsCount ?? 0,
      trackedCards,
    },
    isAllClear: trackedCards > 0 && useSoonAll.length === 0 && comingUp.length === 0,
    isEmpty: trackedCards === 0,
  };
}
