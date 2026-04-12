export type TimeBasedBenefitCadence = "monthly" | "quarterly" | "semiannual" | "annual";

export type BenefitPeriod = {
  start_date: Date;
  end_date: Date;
  label: string;
};

export type BenefitPeriodUrgency = {
  days_remaining: number;
  urgency_label: string;
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function createUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function createUtcEndOfDay(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999));
}

function getLastDayOfMonthUtc(year: number, monthIndex: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  return createUtcEndOfDay(year, monthIndex, lastDay.getUTCDate());
}

function normalizeSemiannualResetTiming(resetTiming: string | null | undefined) {
  return (resetTiming ?? "").trim().toLowerCase();
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function getCurrentBenefitPeriod(
  cadence: TimeBasedBenefitCadence | string,
  resetTiming: string | null | undefined,
  currentDate: Date = new Date(),
): BenefitPeriod | null {
  const year = currentDate.getUTCFullYear();
  const monthIndex = currentDate.getUTCMonth();

  switch (cadence) {
    case "monthly": {
      // Monthly benefits always run for the full current calendar month.
      const start_date = createUtcDate(year, monthIndex, 1);
      const end_date = getLastDayOfMonthUtc(year, monthIndex);
      return {
        start_date,
        end_date,
        label: MONTH_LABEL_FORMATTER.format(start_date),
      };
    }
    case "quarterly": {
      // Quarterly benefits use standard calendar quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.
      const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
      const start_date = createUtcDate(year, quarterStartMonth, 1);
      const end_date = getLastDayOfMonthUtc(year, quarterStartMonth + 2);
      return {
        start_date,
        end_date,
        label: `Q${Math.floor(monthIndex / 3) + 1} ${year}`,
      };
    }
    case "semiannual": {
      // For now we only support the imported Jan-Jun / Jul-Dec reset pattern.
      if (normalizeSemiannualResetTiming(resetTiming) !== "jan-jun / jul-dec") {
        return null;
      }

      const inFirstHalf = monthIndex < 6;
      const startMonth = inFirstHalf ? 0 : 6;
      const endMonth = inFirstHalf ? 5 : 11;
      const start_date = createUtcDate(year, startMonth, 1);
      const end_date = getLastDayOfMonthUtc(year, endMonth);
      return {
        start_date,
        end_date,
        label: inFirstHalf ? `Jan-Jun ${year}` : `Jul-Dec ${year}`,
      };
    }
    case "annual": {
      // Annual benefits in this phase are calendar-year based, not anniversary based.
      const start_date = createUtcDate(year, 0, 1);
      const end_date = createUtcEndOfDay(year, 11, 31);
      return {
        start_date,
        end_date,
        label: String(year),
      };
    }
    default:
      return null;
  }
}

export function isBenefitCurrentlyActive(period: BenefitPeriod | null, currentDate: Date = new Date()) {
  if (!period) return false;
  return currentDate >= period.start_date && currentDate <= period.end_date;
}

export function getBenefitPeriodUrgency(
  cadence: TimeBasedBenefitCadence | string,
  resetTiming: string | null | undefined,
  currentDate: Date = new Date(),
): BenefitPeriodUrgency | null {
  const period = getCurrentBenefitPeriod(cadence, resetTiming, currentDate);
  if (!period) return null;

  // Compare UTC day boundaries so countdown text stays stable within a calendar day.
  const today = startOfUtcDay(currentDate);
  const periodEndDay = startOfUtcDay(period.end_date);
  const days_remaining = Math.max(
    0,
    Math.floor((periodEndDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (days_remaining === 0) {
    return {
      days_remaining,
      urgency_label: "Expires today",
    };
  }

  return {
    days_remaining,
    urgency_label: `Expires in ${days_remaining} ${days_remaining === 1 ? "day" : "days"}`,
  };
}
