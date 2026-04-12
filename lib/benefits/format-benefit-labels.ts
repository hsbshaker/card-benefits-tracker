import type { ConfigurationStatus, ConfigurationType } from "@/lib/types/server-data";
import { computeBenefitPeriod, normalizeSupportedBenefitCadence } from "@/lib/benefits/compute-benefit-period";

type BenefitValueInput = {
  benefitValue: string | null;
  valueCents?: number | null;
};

type ConfigurationInput = {
  requiresSelection?: boolean | null;
  selectionType?: string | null;
  requiresSetup?: boolean | null;
};

type ConfigurationStatusInput = ConfigurationInput & {
  conditionalValue?: string | null;
};

export function normalizeCardArtUrl(sourceUrl: string | null | undefined) {
  return null;
}

export function formatBenefitValue({ benefitValue, valueCents }: BenefitValueInput) {
  const rawValue = benefitValue?.trim() || null;
  const parsedCents = typeof valueCents === "number" ? valueCents : null;

  if (rawValue) {
    const currencyMatch = rawValue.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
    if (!currencyMatch) {
      return {
        value: rawValue,
        valueDescriptor: null,
        sortValue: parsedCents ?? 0,
      };
    }

    const normalizedCurrency = `$${currencyMatch[1]}`;
    const descriptor = rawValue.replace(currencyMatch[0], "").trim().replace(/^[-,:]\s*/, "") || null;
    const parsedNumeric = Number.parseFloat(currencyMatch[1].replace(/,/g, ""));

    return {
      value: normalizedCurrency,
      valueDescriptor: descriptor,
      sortValue: Number.isFinite(parsedNumeric) ? Math.round(parsedNumeric * 100) : parsedCents ?? 0,
    };
  }

  if (parsedCents && parsedCents > 0) {
    return {
      value: `$${(parsedCents / 100).toFixed(0)}`,
      valueDescriptor: null,
      sortValue: parsedCents,
    };
  }

  return {
    value: null,
    valueDescriptor: null,
    sortValue: 0,
  };
}

export function buildBenefitDescription({
  notes,
  resetTiming,
  enrollmentRequired,
  requiresSetup,
}: {
  notes: string | null;
  resetTiming: string | null;
  enrollmentRequired: boolean;
  requiresSetup: boolean;
}) {
  const parts = [
    notes?.trim() || null,
    resetTiming?.trim() ? `Resets: ${resetTiming.trim()}` : null,
    enrollmentRequired ? "Enrollment required." : null,
    requiresSetup ? "Additional setup required." : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : null;
}

export function getConfigurationType({
  requiresSelection,
  selectionType,
  requiresSetup,
}: ConfigurationInput): ConfigurationType {
  if (requiresSelection || Boolean(selectionType?.trim())) {
    return "selection";
  }

  if (requiresSetup) {
    return "setup";
  }

  return null;
}

export function getConfigurationStatus(input: ConfigurationStatusInput): ConfigurationStatus {
  const configurationType = getConfigurationType(input);

  if (!configurationType) {
    return "not_required";
  }

  return input.conditionalValue?.trim() ? "configured" : "needs_configuration";
}

export function getBenefitPeriodLabel({
  cadence,
  resetTiming,
  cardAnniversaryDate,
  now = new Date(),
}: {
  cadence: string | null;
  resetTiming?: string | null;
  cardAnniversaryDate?: string | null;
  now?: Date;
}) {
  const period = computeBenefitPeriod({
    cadence: normalizeSupportedBenefitCadence(cadence),
    resetTiming,
    cardAnniversaryDate,
    now,
  });

  if (period) {
    return period.periodLabel;
  }

  switch ((cadence ?? "").trim()) {
    case "one_time":
      return "One-time";
    case "per_booking":
      return "Per booking";
    default:
      return null;
  }
}
