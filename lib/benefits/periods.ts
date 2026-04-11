export type BenefitCadence = "monthly" | "quarterly" | "semi_annual" | "semiannual" | "annual" | "one_time";
export type PeriodAwareBenefitCadence = "monthly" | "quarterly" | "semi_annual" | "semiannual" | "annual";
export type DigestSection = "monthly" | "quarterly" | "semiannual" | "annual";

export type ResolvedBenefitPeriod = {
  section: DigestSection;
  periodKey: string;
  isEligibleInDigestMonth: boolean;
};

export const DIGEST_SECTION_ORDER: DigestSection[] = ["monthly", "quarterly", "semiannual", "annual"];

export const toUtcMonthStart = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

export const toUtcMonthKey = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export function isPeriodAwareBenefitCadence(cadence: string): cadence is PeriodAwareBenefitCadence {
  return cadence === "monthly" || cadence === "quarterly" || cadence === "semi_annual" || cadence === "semiannual" || cadence === "annual";
}

export function resolveBenefitPeriod(monthStart: Date, cadence: BenefitCadence | string): ResolvedBenefitPeriod | null {
  if (!isPeriodAwareBenefitCadence(cadence)) {
    return null;
  }

  const normalizedMonthStart = toUtcMonthStart(monthStart);
  const year = normalizedMonthStart.getUTCFullYear();
  const monthIndex = normalizedMonthStart.getUTCMonth();

  switch (cadence) {
    case "monthly":
      return {
        section: "monthly",
        periodKey: toUtcMonthKey(normalizedMonthStart),
        isEligibleInDigestMonth: true,
      };
    case "quarterly":
      return {
        section: "quarterly",
        periodKey: `${year}-Q${Math.floor(monthIndex / 3) + 1}`,
        isEligibleInDigestMonth: [2, 5, 8, 11].includes(monthIndex),
      };
    case "semi_annual":
    case "semiannual":
      return {
        section: "semiannual",
        periodKey: `${year}-H${monthIndex < 6 ? 1 : 2}`,
        isEligibleInDigestMonth: monthIndex === 5 || monthIndex === 11,
      };
    case "annual":
      return {
        section: "annual",
        periodKey: String(year),
        isEligibleInDigestMonth: monthIndex === 11,
      };
  }
}

export function getDigestSectionsForMonth(monthStart: Date = new Date()): DigestSection[] {
  return DIGEST_SECTION_ORDER.filter((section) => {
    const cadence = section === "semiannual" ? "semi_annual" : section;
    return resolveBenefitPeriod(monthStart, cadence)?.isEligibleInDigestMonth ?? false;
  });
}
