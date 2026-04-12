import "server-only";

import { computeBenefitPeriod } from "@/lib/benefits/compute-benefit-period";
import {
  buildBenefitDescription,
  formatBenefitValue,
  getConfigurationStatus,
  getConfigurationType,
  normalizeCardArtUrl,
} from "@/lib/benefits/format-benefit-labels";
import { sortCardDetailBenefits } from "@/lib/benefits/rank-benefits";
import { getIssuerDisplayName } from "@/lib/format-card";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { CardDetailBenefitRow, CardDetailResult } from "@/lib/types/server-data";

type OwnedUserCardRow = {
  id: string;
  card_id: string;
  card_anniversary_date: string | null;
  cards: {
    id: string;
    card_name: string;
    display_name: string | null;
    issuer: string | null;
    source_url: string | null;
    card_status: "active" | "no_trackable_benefits" | null;
  } | {
    id: string;
    card_name: string;
    display_name: string | null;
    issuer: string | null;
    source_url: string | null;
    card_status: "active" | "no_trackable_benefits" | null;
  }[] | null;
};

type UserBenefitDetailRow = {
  id: string;
  benefit_id: string;
  is_active: boolean;
  is_used_this_period: boolean;
  last_used_at: string | null;
  reminder_override: "balanced" | "earlier" | "minimal" | null;
  conditional_value: string | null;
  benefits: {
    id: string;
    benefit_name: string | null;
    benefit_value: string | null;
    value_cents: number | null;
    cadence: string | null;
    reset_timing: string | null;
    notes: string | null;
    enrollment_required: boolean | null;
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
    notes: string | null;
    enrollment_required: boolean | null;
    requires_setup: boolean | null;
    requires_selection: boolean | null;
    selection_type: string | null;
    track_in_memento: "yes" | "later" | "no" | null;
  }[] | null;
};

function takeFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapCardDetailBenefit(
  row: UserBenefitDetailRow,
  cardAnniversaryDate: string | null,
  now: Date,
): CardDetailBenefitRow | null {
  const canonicalBenefit = takeFirst(row.benefits);
  if (canonicalBenefit?.track_in_memento !== "yes") {
    return null;
  }

  const configurationType = getConfigurationType({
    requiresSelection: canonicalBenefit.requires_selection,
    selectionType: canonicalBenefit.selection_type,
    requiresSetup: canonicalBenefit.requires_setup,
  });

  const value = formatBenefitValue({
    benefitValue: canonicalBenefit.benefit_value,
    valueCents: canonicalBenefit.value_cents,
  });
  const period = computeBenefitPeriod({
    cadence: canonicalBenefit.cadence,
    resetTiming: canonicalBenefit.reset_timing,
    cardAnniversaryDate,
    now,
  });

  return {
    userBenefitId: row.id,
    benefitId: row.benefit_id,
    benefitName: canonicalBenefit.benefit_name?.trim() || "Unnamed benefit",
    value: value.value,
    valueDescriptor: value.valueDescriptor,
    periodLabel: period?.periodLabel ?? null,
    description: buildBenefitDescription({
      notes: canonicalBenefit.notes,
      resetTiming: canonicalBenefit.reset_timing,
      enrollmentRequired: canonicalBenefit.enrollment_required === true,
      requiresSetup: canonicalBenefit.requires_setup === true,
    }),
    isActive: row.is_active,
    isUsedThisPeriod: row.is_used_this_period,
    lastUsedAt: row.last_used_at,
    reminderOverride: row.reminder_override,
    conditionalValue: row.conditional_value,
    requiresConfiguration: configurationType !== null,
    configurationType,
    configurationStatus: getConfigurationStatus({
      requiresSelection: canonicalBenefit.requires_selection,
      selectionType: canonicalBenefit.selection_type,
      requiresSetup: canonicalBenefit.requires_setup,
      conditionalValue: row.conditional_value,
    }),
    enrollmentRequired: canonicalBenefit.enrollment_required === true,
  };
}

export async function getCardDetail(userId: string, userCardId: string): Promise<CardDetailResult | null> {
  const supabase = getServiceRoleSupabaseClient();
  const now = new Date();

  const { data: cardRow, error: cardError } = await supabase
    .from("user_cards")
    .select(
      "id, card_id, card_anniversary_date, cards!inner(id, card_name, display_name, issuer, source_url, card_status)",
    )
    .eq("id", userCardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (cardError) {
    throw cardError;
  }

  if (!cardRow) {
    return null;
  }

  const typedCardRow = cardRow as unknown as OwnedUserCardRow;
  const canonicalCard = takeFirst(typedCardRow.cards);

  const { data: benefitRows, error: benefitsError } = await supabase
    .from("user_benefits")
    .select(
      "id, benefit_id, is_active, is_used_this_period, last_used_at, reminder_override, conditional_value, benefits!inner(id, benefit_name, benefit_value, value_cents, cadence, reset_timing, notes, enrollment_required, requires_setup, requires_selection, selection_type, track_in_memento)",
    )
    .eq("user_card_id", userCardId)
    .eq("benefits.track_in_memento", "yes");

  if (benefitsError) {
    throw benefitsError;
  }

  const benefits = sortCardDetailBenefits(
    ((benefitRows ?? []) as unknown as UserBenefitDetailRow[])
      .map((row) => mapCardDetailBenefit(row, typedCardRow.card_anniversary_date, now))
      .filter((row): row is CardDetailBenefitRow => row !== null),
  );

  return {
    card: {
      userCardId: typedCardRow.id,
      cardId: typedCardRow.card_id,
      cardName: canonicalCard?.display_name ?? canonicalCard?.card_name ?? "Unknown card",
      issuer: getIssuerDisplayName(canonicalCard?.issuer ?? ""),
      cardArtUrl: normalizeCardArtUrl(canonicalCard?.source_url),
      cardStatus: canonicalCard?.card_status ?? null,
    },
    benefits,
  };
}
