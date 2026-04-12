import "server-only";

import {
  DIGEST_SECTION_ORDER,
  resolveBenefitPeriod,
  toUtcMonthKey,
  toUtcMonthStart,
  type BenefitCadence,
  type DigestSection,
} from "@/lib/benefits/periods";
import { filterDigestEligibleBenefits as filterDigestEligibleBenefitsByUsedStatus } from "@/lib/reminders/digest-eligibility";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export { DIGEST_SECTION_ORDER, getDigestSectionsForMonth, type DigestSection } from "@/lib/benefits/periods";

export type DigestEligibleBenefit = {
  userId: string;
  benefitId: string;
  benefitDisplayName: string;
  cadence: BenefitCadence | string;
  section: DigestSection;
  periodKey: string;
  valueCents: number | null;
  notes: string | null;
  cardId: string | null;
  cardDisplayName: string;
};

export type MonthlyDigest = {
  monthKey: string;
  userId: string;
  benefits: DigestEligibleBenefit[];
  sections: Record<DigestSection, DigestEligibleBenefit[]>;
};

type DigestBenefitRow = {
  id: string;
  display_name: string;
  cadence: BenefitCadence | string | null;
  value_cents: number | null;
  notes: string | null;
  cards: {
    id: string;
    issuer: string;
    card_name: string;
  } | null;
};

type DigestCandidateRow = {
  user_id: string;
  benefits: DigestBenefitRow | DigestBenefitRow[] | null;
};

type PeriodStatusRow = {
  user_id: string;
  benefit_id: string;
  period_key: string;
  is_used: boolean;
};

type GetDigestBenefitsParams = {
  monthStart?: Date;
  supabase?: ReturnType<typeof getServiceRoleSupabaseClient>;
};

const DIGEST_CADENCES: Array<BenefitCadence> = ["monthly", "quarterly", "semi_annual", "semiannual", "annual"];

const toCompositeUsedKey = (userId: string, benefitId: string, periodKey: string) => `${userId}:${benefitId}:${periodKey}`;

async function loadDigestCandidates({
  monthStart = new Date(),
  supabase = getServiceRoleSupabaseClient(),
}: GetDigestBenefitsParams = {}): Promise<DigestEligibleBenefit[]> {
  const normalizedMonthStart = toUtcMonthStart(monthStart);
  const selectExpr =
    "user_id, benefits!inner(id,display_name,cadence,value_cents,notes,cards!benefits_card_id_fkey(id,issuer,card_name))";

  const { data, error } = await supabase
    .from("user_benefits")
    .select(selectExpr)
    .eq("remind_me", true)
    .in("benefits.cadence", DIGEST_CADENCES)
    .returns<DigestCandidateRow[]>();

  if (error) {
    throw error;
  }

  const candidates: DigestEligibleBenefit[] = [];

  for (const row of data ?? []) {
    const joinedBenefits = Array.isArray(row.benefits) ? row.benefits : row.benefits ? [row.benefits] : [];

    for (const benefit of joinedBenefits) {
      if (!benefit.cadence) {
        continue;
      }

      const resolvedPeriod = resolveBenefitPeriod(normalizedMonthStart, benefit.cadence);
      if (!resolvedPeriod?.isEligibleInDigestMonth) {
        continue;
      }

      const card = benefit.cards;
      candidates.push({
        userId: row.user_id,
        benefitId: benefit.id,
        benefitDisplayName: benefit.display_name,
        cadence: benefit.cadence,
        section: resolvedPeriod.section,
        periodKey: resolvedPeriod.periodKey,
        valueCents: benefit.value_cents,
        notes: benefit.notes,
        cardId: card?.id ?? null,
        cardDisplayName: card ? `${card.issuer} ${card.card_name}` : "Unknown Card",
      });
    }
  }

  return candidates.sort(sortDigestBenefits);
}

async function fetchUsedStatusKeys(
  candidates: DigestEligibleBenefit[],
  supabase: ReturnType<typeof getServiceRoleSupabaseClient>,
): Promise<Set<string>> {
  if (candidates.length === 0) {
    return new Set<string>();
  }

  const userIds = [...new Set(candidates.map((candidate) => candidate.userId))];
  const benefitIds = [...new Set(candidates.map((candidate) => candidate.benefitId))];
  const periodKeys = [...new Set(candidates.map((candidate) => candidate.periodKey))];

  const { data, error } = await supabase
    .from("user_benefit_period_status")
    .select("user_id,benefit_id,period_key,is_used")
    .eq("is_used", true)
    .in("user_id", userIds)
    .in("benefit_id", benefitIds)
    .in("period_key", periodKeys)
    .returns<PeriodStatusRow[]>();

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => toCompositeUsedKey(row.user_id, row.benefit_id, row.period_key)));
}

function sortDigestBenefits(a: DigestEligibleBenefit, b: DigestEligibleBenefit) {
  const sectionOrderDelta = DIGEST_SECTION_ORDER.indexOf(a.section) - DIGEST_SECTION_ORDER.indexOf(b.section);
  if (sectionOrderDelta !== 0) {
    return sectionOrderDelta;
  }

  const cardDelta = a.cardDisplayName.localeCompare(b.cardDisplayName);
  if (cardDelta !== 0) {
    return cardDelta;
  }

  return a.benefitDisplayName.localeCompare(b.benefitDisplayName);
}

export function filterDigestEligibleBenefits(
  candidates: DigestEligibleBenefit[],
  usedStatusKeys: Set<string>,
): DigestEligibleBenefit[] {
  return filterDigestEligibleBenefitsByUsedStatus(candidates, usedStatusKeys).sort(sortDigestBenefits);
}

export async function getDigestConsideredBenefits({
  monthStart = new Date(),
  supabase = getServiceRoleSupabaseClient(),
}: GetDigestBenefitsParams = {}): Promise<DigestEligibleBenefit[]> {
  return loadDigestCandidates({ monthStart, supabase });
}

export async function getDigestEligibleBenefits({
  monthStart = new Date(),
  supabase = getServiceRoleSupabaseClient(),
}: GetDigestBenefitsParams = {}): Promise<DigestEligibleBenefit[]> {
  const candidates = await loadDigestCandidates({ monthStart, supabase });
  const usedStatusKeys = await fetchUsedStatusKeys(candidates, supabase);
  return filterDigestEligibleBenefits(candidates, usedStatusKeys);
}

export function buildMonthlyDigest(
  benefits: DigestEligibleBenefit[],
  monthStart: Date = new Date(),
): Map<string, MonthlyDigest> {
  const monthKey = toUtcMonthKey(toUtcMonthStart(monthStart));
  const digestsByUser = new Map<string, MonthlyDigest>();

  for (const benefit of benefits) {
    const existingDigest = digestsByUser.get(benefit.userId);
    if (existingDigest) {
      existingDigest.benefits.push(benefit);
      existingDigest.sections[benefit.section].push(benefit);
      continue;
    }

    digestsByUser.set(benefit.userId, {
      monthKey,
      userId: benefit.userId,
      benefits: [benefit],
      sections: {
        monthly: benefit.section === "monthly" ? [benefit] : [],
        quarterly: benefit.section === "quarterly" ? [benefit] : [],
        semiannual: benefit.section === "semiannual" ? [benefit] : [],
        annual: benefit.section === "annual" ? [benefit] : [],
      },
    });
  }

  return digestsByUser;
}
