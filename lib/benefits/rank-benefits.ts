import type { CardDetailBenefitRow, CardPreviewBenefit, HomeFeedItem } from "@/lib/types/server-data";

function compareNullableStrings(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "");
}

function valueRank(value: string | null | undefined) {
  if (!value) return 0;
  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function sortPreviewBenefits(benefits: CardPreviewBenefit[]) {
  return [...benefits].sort(
    (a, b) => valueRank(b.value) - valueRank(a.value) || compareNullableStrings(a.benefitName, b.benefitName),
  );
}

export function sortCardDetailBenefits(benefits: CardDetailBenefitRow[]) {
  return [...benefits].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      valueRank(b.value) - valueRank(a.value) ||
      compareNullableStrings(a.benefitName, b.benefitName),
  );
}

export function sortHomeFeedItems(items: HomeFeedItem[]) {
  return [...items].sort(
    (a, b) =>
      a.daysRemaining - b.daysRemaining ||
      valueRank(b.value) - valueRank(a.value) ||
      compareNullableStrings(a.benefitName, b.benefitName),
  );
}
