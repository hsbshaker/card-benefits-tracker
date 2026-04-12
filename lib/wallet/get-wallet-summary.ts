import "server-only";

import { computeBenefitPeriod } from "@/lib/benefits/compute-benefit-period";
import { getIssuerDisplayName } from "@/lib/format-card";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { WalletCardSummary } from "@/lib/types/server-data";
import { normalizeCardArtUrl } from "@/lib/benefits/format-benefit-labels";

type WalletCardRow = {
  id: string;
  card_id: string;
  card_anniversary_date: string | null;
  status: "active" | "removed";
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

type WalletBenefitRow = {
  user_card_id: string;
  is_active: boolean;
  is_used_this_period: boolean;
  snoozed_until: string | null;
  benefits: {
    cadence: string | null;
    reset_timing: string | null;
    track_in_memento: "yes" | "later" | "no" | null;
  } | {
    cadence: string | null;
    reset_timing: string | null;
    track_in_memento: "yes" | "later" | "no" | null;
  }[] | null;
};

function takeFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function getWalletSummary(userId: string): Promise<WalletCardSummary[]> {
  const supabase = getServiceRoleSupabaseClient();
  const now = new Date();

  const { data: walletRows, error: walletError } = await supabase
    .from("user_cards")
    .select(
      "id, card_id, card_anniversary_date, status, cards!inner(id, card_name, display_name, issuer, source_url, card_status)",
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (walletError) {
    throw walletError;
  }

  const typedWalletRows = (walletRows ?? []) as unknown as WalletCardRow[];
  if (typedWalletRows.length === 0) {
    return [];
  }

  const userCardIds = typedWalletRows.map((row) => row.id);
  const anniversaryByCardId = new Map(typedWalletRows.map((row) => [row.id, row.card_anniversary_date]));

  const { data: benefitRows, error: benefitsError } = await supabase
    .from("user_benefits")
    .select(
      "user_card_id, is_active, is_used_this_period, snoozed_until, benefits!inner(cadence, reset_timing, track_in_memento)",
    )
    .in("user_card_id", userCardIds);

  if (benefitsError) {
    throw benefitsError;
  }

  const benefitRowsByCardId = new Map<string, WalletBenefitRow[]>();
  for (const row of (benefitRows ?? []) as unknown as WalletBenefitRow[]) {
    const existing = benefitRowsByCardId.get(row.user_card_id) ?? [];
    existing.push(row);
    benefitRowsByCardId.set(row.user_card_id, existing);
  }

  return typedWalletRows.map((row) => {
    const benefitsForCard = benefitRowsByCardId.get(row.id) ?? [];
    const trackedBenefitCount = benefitsForCard.filter((benefit) => benefit.is_active).length;
    const canonicalCard = takeFirst(row.cards);

    const hasUrgentBenefit = benefitsForCard.some((benefit) => {
      if (!benefit.is_active || benefit.is_used_this_period) {
        return false;
      }

      if (benefit.snoozed_until && new Date(benefit.snoozed_until) > now) {
        return false;
      }

      const canonicalBenefit = takeFirst(benefit.benefits);
      if (canonicalBenefit?.track_in_memento !== "yes") {
        return false;
      }

      const period = computeBenefitPeriod({
        cadence: canonicalBenefit?.cadence,
        resetTiming: canonicalBenefit?.reset_timing,
        cardAnniversaryDate: anniversaryByCardId.get(row.id) ?? null,
        now,
      });

      return period !== null && period.daysRemaining <= 30;
    });

    return {
      userCardId: row.id,
      cardId: row.card_id,
      cardName: canonicalCard?.display_name ?? canonicalCard?.card_name ?? "Unknown card",
      issuer: getIssuerDisplayName(canonicalCard?.issuer ?? ""),
      cardArtUrl: normalizeCardArtUrl(canonicalCard?.source_url),
      cardStatus: canonicalCard?.card_status ?? null,
      trackedBenefitCount,
      hasUrgentBenefit,
    };
  });
}
