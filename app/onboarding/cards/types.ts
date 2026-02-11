export type Issuer = {
  id: string;
  name: string;
  enabled: boolean;
  accent: string;
  comingSoon?: boolean;
};

export type WalletCard = {
  id: string;
  issuerId: string;
  issuerName: string;
  name: string;
  network: "Visa" | "Mastercard" | "Amex";
  annualFee: number;
  popularityRank: number;
  recentlyAddedWeight: number;
  art: {
    gradientFrom: string;
    gradientTo: string;
    shine: string;
  };
  variantLabel?: string;
};

export type SortMode = "recent" | "popular" | "annual-fee";
