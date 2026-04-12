import "server-only";

import { getCardPreview, getTrackableCardPreviewBenefits } from "@/lib/cards/get-card-preview";
import type { AddCardFlowPreviewResult, CardPreviewBenefit } from "@/lib/types/server-data";

function formatCurrency(cents: number) {
  return cents > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
        cents / 100,
      )
    : null;
}

function parseValueToCents(benefit: CardPreviewBenefit) {
  if (!benefit.value) return 0;
  const numeric = Number.parseFloat(benefit.value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export async function getAddCardFlowPreview(cardId: string): Promise<AddCardFlowPreviewResult | null> {
  const preview = await getCardPreview(cardId);
  if (!preview) {
    return null;
  }

  const allBenefits = await getTrackableCardPreviewBenefits(cardId);
  const estimatedTotalValueCents = allBenefits.reduce((sum, benefit) => sum + parseValueToCents(benefit), 0);

  return {
    ...preview,
    allBenefits,
    estimatedTotalValueCents,
    estimatedTotalValueLabel: formatCurrency(estimatedTotalValueCents),
  };
}
