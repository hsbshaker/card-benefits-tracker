import { Issuer, WalletCard } from "./types";

export const MOCK_ISSUERS: Issuer[] = [
  { id: "amex", name: "American Express", enabled: true, accent: "#78D8FF" },
  { id: "chase", name: "Chase", enabled: true, accent: "#5CA4FF" },
  { id: "citi", name: "Citi", enabled: true, accent: "#8F7CFF" },
  { id: "capital-one", name: "Capital One", enabled: false, accent: "#FF8A7A", comingSoon: true },
  { id: "bilt", name: "Bilt", enabled: false, accent: "#68FFBB", comingSoon: true },
];

const baseCards: Omit<WalletCard, "id">[] = [
  { issuerId: "amex", issuerName: "American Express", name: "Platinum Card", network: "Amex", annualFee: 695, popularityRank: 1, recentlyAddedWeight: 90, art: { gradientFrom: "#A6E1FF", gradientTo: "#4B91FF", shine: "#E8F6FF" } },
  { issuerId: "amex", issuerName: "American Express", name: "Gold Card", network: "Amex", annualFee: 325, popularityRank: 2, recentlyAddedWeight: 88, art: { gradientFrom: "#FFDC8E", gradientTo: "#D08B2F", shine: "#FFF6E1" } },
  { issuerId: "amex", issuerName: "American Express", name: "Blue Business Plus", network: "Amex", annualFee: 0, popularityRank: 8, recentlyAddedWeight: 72, art: { gradientFrom: "#9CF9F2", gradientTo: "#2B9DA9", shine: "#DEFFFB" } },
  { issuerId: "chase", issuerName: "Chase", name: "Sapphire Reserve", network: "Visa", annualFee: 550, popularityRank: 3, recentlyAddedWeight: 95, art: { gradientFrom: "#A9B8FF", gradientTo: "#3447A6", shine: "#E5E9FF" } },
  { issuerId: "chase", issuerName: "Chase", name: "Sapphire Preferred", network: "Visa", annualFee: 95, popularityRank: 4, recentlyAddedWeight: 84, art: { gradientFrom: "#9CC5FF", gradientTo: "#345DA6", shine: "#E2EEFF" } },
  { issuerId: "chase", issuerName: "Chase", name: "Freedom Flex", network: "Mastercard", annualFee: 0, popularityRank: 5, recentlyAddedWeight: 76, art: { gradientFrom: "#9EA4B6", gradientTo: "#5D6475", shine: "#EEF1F8" } },
  { issuerId: "citi", issuerName: "Citi", name: "Strata Premier", network: "Mastercard", annualFee: 95, popularityRank: 6, recentlyAddedWeight: 79, art: { gradientFrom: "#B29FFF", gradientTo: "#5340A3", shine: "#EEE9FF" } },
  { issuerId: "citi", issuerName: "Citi", name: "Double Cash", network: "Mastercard", annualFee: 0, popularityRank: 7, recentlyAddedWeight: 81, art: { gradientFrom: "#87C3FF", gradientTo: "#1D5DAB", shine: "#DEEEFF" } },
];

const duplicateVariants = ["Player 1", "Player 2", "Business", "Authorized User"];

export const MOCK_CARDS: WalletCard[] = Array.from({ length: 72 }, (_, index) => {
  const base = baseCards[index % baseCards.length];
  const cycle = Math.floor(index / baseCards.length);
  const variant = cycle > 0 ? duplicateVariants[cycle % duplicateVariants.length] : undefined;
  return {
    ...base,
    id: `${base.issuerId}-${base.name.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
    recentlyAddedWeight: Math.max(35, base.recentlyAddedWeight - cycle * 3 + (index % 4)),
    popularityRank: base.popularityRank + cycle,
    variantLabel: variant,
  };
});

export const SMART_SUGGESTED_IDS = MOCK_CARDS
  .filter((card) => ["Platinum Card", "Sapphire Reserve", "Double Cash"].includes(card.name))
  .slice(0, 6)
  .map((card) => card.id);
