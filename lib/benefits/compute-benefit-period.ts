import type { BenefitPeriodResult, SupportedBenefitCadence } from "@/lib/types/server-data";

type ComputeBenefitPeriodArgs = {
  cadence: string | null | undefined;
  resetTiming?: string | null;
  now?: Date;
  cardAnniversaryDate?: string | null;
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function createUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function endOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function lastDayOfMonthUtc(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function normalizeSupportedBenefitCadence(
  cadence: string | null | undefined,
): SupportedBenefitCadence | null {
  switch ((cadence ?? "").trim()) {
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "semiannual":
    case "semi_annual":
      return "semiannual";
    case "annual":
      return "annual";
    default:
      return null;
  }
}

function computeMonthlyPeriod(now: Date): BenefitPeriodResult {
  const start = createUtcDate(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = endOfUtcDay(lastDayOfMonthUtc(now.getUTCFullYear(), now.getUTCMonth()));

  return {
    periodStartDate: start.toISOString(),
    periodEndDate: end.toISOString(),
    daysRemaining: Math.max(
      0,
      Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(now).getTime()) / 86_400_000),
    ),
    periodLabel: MONTH_LABEL_FORMATTER.format(start),
  };
}

function computeQuarterlyPeriod(now: Date): BenefitPeriodResult {
  const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = createUtcDate(now.getUTCFullYear(), quarterStartMonth, 1);
  const end = endOfUtcDay(lastDayOfMonthUtc(now.getUTCFullYear(), quarterStartMonth + 2));

  return {
    periodStartDate: start.toISOString(),
    periodEndDate: end.toISOString(),
    daysRemaining: Math.max(
      0,
      Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(now).getTime()) / 86_400_000),
    ),
    periodLabel: `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}`,
  };
}

function computeSemiannualPeriod(now: Date): BenefitPeriodResult {
  const inFirstHalf = now.getUTCMonth() < 6;
  const start = createUtcDate(now.getUTCFullYear(), inFirstHalf ? 0 : 6, 1);
  const end = endOfUtcDay(lastDayOfMonthUtc(now.getUTCFullYear(), inFirstHalf ? 5 : 11));

  return {
    periodStartDate: start.toISOString(),
    periodEndDate: end.toISOString(),
    daysRemaining: Math.max(
      0,
      Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(now).getTime()) / 86_400_000),
    ),
    periodLabel: inFirstHalf ? `Jan-Jun ${now.getUTCFullYear()}` : `Jul-Dec ${now.getUTCFullYear()}`,
  };
}

function computeAnnualPeriod(now: Date, cardAnniversaryDate: string | null | undefined): BenefitPeriodResult {
  if (!cardAnniversaryDate) {
    const start = createUtcDate(now.getUTCFullYear(), 0, 1);
    const end = endOfUtcDay(createUtcDate(now.getUTCFullYear(), 11, 31));

    return {
      periodStartDate: start.toISOString(),
      periodEndDate: end.toISOString(),
      daysRemaining: Math.max(
        0,
        Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(now).getTime()) / 86_400_000),
      ),
      periodLabel: String(now.getUTCFullYear()),
    };
  }

  const anchor = new Date(`${cardAnniversaryDate}T00:00:00.000Z`);
  if (Number.isNaN(anchor.getTime())) {
    return computeAnnualPeriod(now, null);
  }

  const anniversaryMonth = anchor.getUTCMonth();
  const anniversaryDay = anchor.getUTCDate();
  const thisYearAnchor = createUtcDate(now.getUTCFullYear(), anniversaryMonth, anniversaryDay);
  const periodStart = now >= thisYearAnchor ? thisYearAnchor : createUtcDate(now.getUTCFullYear() - 1, anniversaryMonth, anniversaryDay);
  const nextPeriodStart = createUtcDate(periodStart.getUTCFullYear() + 1, anniversaryMonth, anniversaryDay);
  const periodEnd = endOfUtcDay(new Date(nextPeriodStart.getTime() - 86_400_000));

  return {
    periodStartDate: periodStart.toISOString(),
    periodEndDate: periodEnd.toISOString(),
    daysRemaining: Math.max(
      0,
      Math.floor((startOfUtcDay(periodEnd).getTime() - startOfUtcDay(now).getTime()) / 86_400_000),
    ),
    periodLabel: `${MONTH_LABEL_FORMATTER.format(periodStart)}-${MONTH_LABEL_FORMATTER.format(periodEnd)}`,
  };
}

export function computeBenefitPeriod({
  cadence,
  now = new Date(),
  cardAnniversaryDate,
}: ComputeBenefitPeriodArgs): BenefitPeriodResult | null {
  switch (normalizeSupportedBenefitCadence(cadence)) {
    case "monthly":
      return computeMonthlyPeriod(now);
    case "quarterly":
      return computeQuarterlyPeriod(now);
    case "semiannual":
      return computeSemiannualPeriod(now);
    case "annual":
      return computeAnnualPeriod(now, cardAnniversaryDate);
    default:
      return null;
  }
}
