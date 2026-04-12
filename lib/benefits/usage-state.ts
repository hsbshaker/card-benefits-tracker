import { resolveBenefitPeriod, type BenefitCadence } from "@/lib/benefits/periods";

export type UserBenefitPeriodStatusRecord = {
  benefit_id: string;
  period_key: string;
  is_used: boolean;
  used_at?: string | null;
};

export type BenefitUsageUpdate = {
  periodStatusUpsert: {
    user_id: string;
    benefit_id: string;
    period_key: string;
    is_used: boolean;
    used_at: string | null;
  } | null;
  compatibilityUsed: boolean;
};

export const toBenefitPeriodStatusMapKey = (benefitId: string, periodKey: string) => `${benefitId}:${periodKey}`;

export function buildBenefitUsageUpdate({
  userId,
  benefitId,
  cadence,
  nextUsed,
  at = new Date(),
}: {
  userId: string;
  benefitId: string;
  cadence: BenefitCadence | string;
  nextUsed: boolean;
  at?: Date;
}): BenefitUsageUpdate {
  const resolvedPeriod = resolveBenefitPeriod(at, cadence);

  return {
    periodStatusUpsert: resolvedPeriod
      ? {
          user_id: userId,
          benefit_id: benefitId,
          period_key: resolvedPeriod.periodKey,
          is_used: nextUsed,
          used_at: nextUsed ? at.toISOString() : null,
        }
      : null,
    compatibilityUsed: nextUsed,
  };
}

export function buildBenefitPeriodStatusMap(rows: UserBenefitPeriodStatusRecord[]): Map<string, UserBenefitPeriodStatusRecord> {
  return new Map(rows.map((row) => [toBenefitPeriodStatusMapKey(row.benefit_id, row.period_key), row]));
}

export function getBenefitUsedForCurrentPeriod({
  benefitId,
  cadence,
  periodStatusMap,
  at = new Date(),
  fallbackUsed = false,
}: {
  benefitId: string;
  cadence: BenefitCadence | string;
  periodStatusMap: Map<string, UserBenefitPeriodStatusRecord>;
  at?: Date;
  fallbackUsed?: boolean;
}) {
  const resolvedPeriod = resolveBenefitPeriod(at, cadence);
  if (!resolvedPeriod) {
    return fallbackUsed;
  }

  return periodStatusMap.get(toBenefitPeriodStatusMapKey(benefitId, resolvedPeriod.periodKey))?.is_used ?? false;
}
