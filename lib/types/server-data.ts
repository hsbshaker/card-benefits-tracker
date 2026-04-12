import type { ReminderStyle } from "@/lib/constants/memento-schema";

export type SupportedBenefitCadence = "monthly" | "quarterly" | "semiannual" | "annual";
export type ConfigurationType = "selection" | "setup" | null;
export type ConfigurationStatus = "not_required" | "configured" | "needs_configuration";
export type HomeUrgencyTier = "high" | "soon" | "upcoming";

export interface BenefitPeriodResult {
  periodStartDate: string;
  periodEndDate: string;
  daysRemaining: number;
  periodLabel: string;
}

export interface CardSearchResult {
  cardId: string;
  cardName: string;
  displayName: string | null;
  issuer: string;
  cardArtUrl: string | null;
  cardStatus: "active" | "no_trackable_benefits";
}

export interface CardPreviewBenefit {
  benefitId: string;
  benefitName: string;
  value: string | null;
  valueDescriptor: string | null;
  periodLabel: string | null;
  enrollmentRequired: boolean;
  requiresConfiguration: boolean;
  configurationType: ConfigurationType;
}

export interface CardPreviewResult {
  card: {
    cardId: string;
    cardName: string;
    issuer: string;
    cardArtUrl: string | null;
    cardStatus: "active" | "no_trackable_benefits";
  };
  benefits: CardPreviewBenefit[];
  hiddenBenefitCount: number;
  hasTrackableBenefits: boolean;
}

export interface AddCardFlowPreviewResult extends CardPreviewResult {
  allBenefits: CardPreviewBenefit[];
  estimatedTotalValueCents: number;
  estimatedTotalValueLabel: string | null;
}

export interface WalletCardSummary {
  userCardId: string;
  cardId: string;
  cardName: string;
  issuer: string;
  cardArtUrl: string | null;
  cardStatus: "active" | "no_trackable_benefits" | null;
  trackedBenefitCount: number;
  hasUrgentBenefit: boolean;
}

export interface CardDetailBenefitRow {
  userBenefitId: string;
  benefitId: string;
  benefitName: string;
  value: string | null;
  valueDescriptor: string | null;
  periodLabel: string | null;
  description: string | null;
  isActive: boolean;
  isUsedThisPeriod: boolean;
  lastUsedAt: string | null;
  reminderOverride: ReminderStyle | null;
  conditionalValue: string | null;
  requiresConfiguration: boolean;
  configurationType: ConfigurationType;
  configurationStatus: ConfigurationStatus;
  enrollmentRequired: boolean;
}

export interface CardDetailResult {
  card: {
    userCardId: string;
    cardId: string;
    cardName: string;
    issuer: string;
    cardArtUrl: string | null;
    cardStatus: "active" | "no_trackable_benefits" | null;
  };
  benefits: CardDetailBenefitRow[];
}

export interface HomeFeedItem {
  userBenefitId: string;
  userCardId: string;
  cardId: string;
  benefitId: string;
  benefitName: string;
  cardName: string;
  cardArtUrl: string | null;
  value: string | null;
  valueDescriptor: string | null;
  periodLabel: string;
  periodEndDate: string;
  daysRemaining: number;
  urgencyTier: HomeUrgencyTier;
  requiresConfiguration: boolean;
  configurationType: ConfigurationType;
  configurationStatus: ConfigurationStatus;
  reminderOverride: ReminderStyle | null;
  snoozedUntil: string | null;
}

export interface HomeFeedResult {
  header: string;
  useSoon: HomeFeedItem[];
  useSoonHiddenCount: number;
  comingUp: HomeFeedItem[];
  comingUpCount: number;
  walletSummary: {
    trackedBenefits: number;
    trackedCards: number;
  };
  isAllClear: boolean;
  isEmpty: boolean;
}

export interface HomeHeaderInput {
  trackedCards: number;
  trackedBenefits: number;
  useSoonCount: number;
  comingUpCount: number;
}

export interface ConfirmAddCardSelectionInput {
  benefitId: string;
  enabled: boolean;
  conditionalValue?: string | null;
}

export interface ConfirmAddCardInput {
  userId: string;
  cardId: string;
  reminderStyle: "balanced" | "earlier" | "minimal";
  selections: ConfirmAddCardSelectionInput[];
}

export interface ConfirmAddCardResult {
  userCardId: string;
  duplicateStatus: "none" | "possible_duplicate";
  redirectTo: string;
}
