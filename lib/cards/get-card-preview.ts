import "server-only";

import { getIssuerDisplayName } from "@/lib/format-card";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { CardPreviewBenefit, CardPreviewResult } from "@/lib/types/server-data";
import { getBenefitPeriodLabel, getConfigurationType, normalizeCardArtUrl, formatBenefitValue } from "@/lib/benefits/format-benefit-labels";
import { sortPreviewBenefits } from "@/lib/benefits/rank-benefits";

type CanonicalCardRow = {
  id: string;
  card_name: string;
  display_name: string | null;
  issuer: string | null;
  source_url: string | null;
  card_status: "active" | "no_trackable_benefits" | null;
};

type CanonicalBenefitRow = {
  id: string;
  benefit_name: string | null;
  benefit_value: string | null;
  value_cents: number | null;
  cadence: string | null;
  reset_timing: string | null;
  enrollment_required: boolean | null;
  requires_setup: boolean | null;
  requires_selection: boolean | null;
  selection_type: string | null;
};

const PREVIEW_VISIBLE_LIMIT = 3;

function mapPreviewBenefit(row: CanonicalBenefitRow): CardPreviewBenefit {
  const value = formatBenefitValue({
    benefitValue: row.benefit_value,
    valueCents: row.value_cents,
  });

  return {
    benefitId: row.id,
    benefitName: row.benefit_name?.trim() || "Unnamed benefit",
    value: value.value,
    valueDescriptor: value.valueDescriptor,
    periodLabel: getBenefitPeriodLabel({
      cadence: row.cadence,
      resetTiming: row.reset_timing,
    }),
    enrollmentRequired: row.enrollment_required === true,
    requiresConfiguration: getConfigurationType({
      requiresSelection: row.requires_selection,
      selectionType: row.selection_type,
      requiresSetup: row.requires_setup,
    }) !== null,
    configurationType: getConfigurationType({
      requiresSelection: row.requires_selection,
      selectionType: row.selection_type,
      requiresSetup: row.requires_setup,
    }),
  };
}

export async function getTrackableCardPreviewBenefits(cardId: string): Promise<CardPreviewBenefit[]> {
  const supabase = getServiceRoleSupabaseClient();

  const { data: benefitRows, error: benefitsError } = await supabase
    .from("benefits")
    .select(
      "id, benefit_name, benefit_value, value_cents, cadence, reset_timing, enrollment_required, requires_setup, requires_selection, selection_type",
    )
    .eq("card_id", cardId)
    .eq("track_in_memento", "yes");

  if (benefitsError) {
    throw benefitsError;
  }

  return sortPreviewBenefits(((benefitRows ?? []) as CanonicalBenefitRow[]).map(mapPreviewBenefit));
}

export async function getCardPreview(cardId: string): Promise<CardPreviewResult | null> {
  const supabase = getServiceRoleSupabaseClient();

  const { data: cardRow, error: cardError } = await supabase
    .from("cards")
    .select("id, card_name, display_name, issuer, source_url, card_status")
    .eq("id", cardId)
    .in("card_status", ["active", "no_trackable_benefits"])
    .maybeSingle();

  if (cardError) {
    throw cardError;
  }

  if (!cardRow) {
    return null;
  }

  const previewBenefits = await getTrackableCardPreviewBenefits(cardId);

  const card = cardRow as CanonicalCardRow;

  return {
    card: {
      cardId: card.id,
      cardName: card.display_name ?? card.card_name,
      issuer: getIssuerDisplayName(card.issuer ?? ""),
      cardArtUrl: normalizeCardArtUrl(card.source_url),
      cardStatus: card.card_status ?? "no_trackable_benefits",
    },
    benefits: previewBenefits.slice(0, PREVIEW_VISIBLE_LIMIT),
    hiddenBenefitCount: Math.max(0, previewBenefits.length - PREVIEW_VISIBLE_LIMIT),
    hasTrackableBenefits: previewBenefits.length > 0,
  };
}
