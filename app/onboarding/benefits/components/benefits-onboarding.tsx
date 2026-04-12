"use client";

import {
  memo,
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ProfilerOnRenderCallback,
} from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { getBenefitPeriodUrgency, getCurrentBenefitPeriod } from "@/lib/benefit-periods";
import { cn } from "@/lib/cn";
import { getIssuerShortLabel } from "@/lib/format-card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getDefaultCadence,
  loadBenefitsOnboardingData,
  type BenefitRow,
  type Cadence,
  type CardGroup,
} from "./benefits-onboarding-data";
import {
  describeSupabaseError,
  persistBenefitPreferencesOnComplete,
  persistCurrentPeriodUsedPreference,
  persistRemindMePreference,
  removeWalletCard,
} from "./benefits-onboarding-persistence";

const CADENCE_ORDER: Cadence[] = ["monthly", "quarterly", "semiannual", "annual", "multi_year", "one_time", "per_booking"];
const BENEFIT_AMOUNT_ACCENT_CLASS = "text-[#F7C948]";
const BELL_COLUMN_WIDTH_CLASS = "w-16";
const ENROLLMENT_URL_BY_BENEFIT_NAME: Record<string, string> = {
  "hilton honors gold status": "https://www.americanexpress.com/icc/cards/benefits/travel/hilton-honors-elite-gold-status.html",
  "marriott bonvoy gold elite status": "https://global.americanexpress.com/card-benefits/detail/marriott-bonvoy-gold-elite/platinum",
};
const CURRENCY_WITH_CENTS_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_NO_CENTS_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCadenceLabel(cadence: Cadence) {
  if (cadence === "semiannual") return "Semi-Annual";
  if (cadence === "multi_year") return "Multi-Year";
  if (cadence === "per_booking") return "Per Booking";
  if (cadence === "one_time") return "One-Time Activation";
  return cadence.charAt(0).toUpperCase() + cadence.slice(1);
}

function formatCurrencyFromCents(valueCents: number) {
  const hasCents = Math.abs(valueCents) % 100 !== 0;
  return (hasCents ? CURRENCY_WITH_CENTS_FORMATTER : CURRENCY_NO_CENTS_FORMATTER).format(valueCents / 100);
}

function formatBenefitAmount(value_cents: number | null, cadence: Cadence) {
  if (value_cents == null || value_cents <= 0) return null;

  const amount = formatCurrencyFromCents(value_cents);

  if (cadence === "one_time") return `${amount} one-time`;
  if (cadence === "monthly") return `${amount}/month`;
  if (cadence === "quarterly") return `${amount}/quarter`;
  if (cadence === "semiannual") return `${amount}/semi-annual`;
  if (cadence === "multi_year") return `${amount}/multi-year`;
  if (cadence === "per_booking") return `${amount}/booking`;
  return `${amount}/year`;
}

function getEnrollmentUrl(benefitDisplayName: string) {
  return ENROLLMENT_URL_BY_BENEFIT_NAME[benefitDisplayName.trim().toLowerCase()] ?? null;
}

function getShortCardName(displayName: string, issuer: string) {
  if (!displayName || !issuer) return displayName;
  if (displayName.startsWith(issuer)) {
    return displayName.replace(issuer, "").trim();
  }
  return displayName;
}

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 10.5L8.25 13.75L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellToggleIcon({ className, active }: { className?: string; active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M10 3.75a3 3 0 0 0-3 3v1.16c0 1-.35 1.96-1 2.72L4.9 11.9c-.28.33-.34.79-.16 1.18s.58.64 1 .64h8.52c.42 0 .81-.25 1-.64s.12-.85-.16-1.18L14 10.63a4.17 4.17 0 0 1-1-2.72V6.75a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 15.25a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {active ? (
        <>
          <path d="M4.5 6.75c.35-.7.88-1.3 1.52-1.72" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M15.5 6.75c-.35-.7-.88-1.3-1.52-1.72" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <path d="M5 4.75 15 14.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M4.5 6h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.5 6V4.9c0-.5.4-.9.9-.9h3.2c.5 0 .9.4.9.9V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.5 8.5v6.1c0 .8.6 1.4 1.4 1.4h4.2c.8 0 1.4-.6 1.4-1.4V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 9.5v5M11 9.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M7 13 13 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.25 7H13v4.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type BenefitItemProps = {
  benefit: BenefitRow;
  onToggleRemindMe: (benefit: BenefitRow, nextValue: boolean) => void;
  onToggleCurrentPeriodUsed: (benefit: BenefitRow, nextUsed: boolean) => void;
};

const BenefitItem = memo(function BenefitItem({ benefit, onToggleRemindMe, onToggleCurrentPeriodUsed }: BenefitItemProps) {
  const formattedAmount = useMemo(() => formatBenefitAmount(benefit.value_cents, benefit.cadence), [benefit.value_cents, benefit.cadence]);
  const descriptionText = benefit.description?.trim();
  const enrollmentUrl = useMemo(() => getEnrollmentUrl(benefit.display_name), [benefit.display_name]);
  const currentPeriod = useMemo(
    () => getCurrentBenefitPeriod(benefit.cadence, benefit.reset_timing),
    [benefit.cadence, benefit.reset_timing],
  );
  const currentPeriodLabel = currentPeriod?.label ?? null;
  const urgency = useMemo(
    () => getBenefitPeriodUrgency(benefit.cadence, benefit.reset_timing),
    [benefit.cadence, benefit.reset_timing],
  );
  const isEnrollmentBenefit = Boolean(enrollmentUrl);
  const remindMeDisabled = benefit.current_period_used;
  const isRowDimmed = isEnrollmentBenefit ? benefit.current_period_used : !benefit.remind_me;
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand = Boolean(descriptionText);
  const detailsRegionId = `benefit-details-${benefit.id}`;

  const handleToggleExpand = useCallback(() => {
    if (!canExpand) return;
    setIsExpanded((prev) => !prev);
  }, [canExpand]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!canExpand) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setIsExpanded((prev) => !prev);
    },
    [canExpand],
  );

  return (
    <li
      className={cn(
        "transition-colors",
        isRowDimmed ? "opacity-70 saturate-50" : "opacity-100 saturate-100",
      )}
    >
      <div
        role="button"
        tabIndex={canExpand ? 0 : -1}
        aria-expanded={canExpand ? isExpanded : undefined}
        aria-controls={canExpand ? detailsRegionId : undefined}
        onClick={handleToggleExpand}
        onKeyDown={handleCardKeyDown}
        className={cn(
          "w-full px-4 py-3.5 text-left transition-colors",
          canExpand ? "cursor-pointer hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-inset" : "",
        )}
      >
        {isEnrollmentBenefit ? (
          <div className="min-w-0 flex flex-col gap-3">
            <div className="min-w-0">
              <p className="min-w-0 truncate text-sm font-medium leading-tight text-white/95">{benefit.display_name}</p>
              {currentPeriodLabel ? (
                <p className="mt-1 text-xs text-white/55">Current period: {currentPeriodLabel}</p>
              ) : null}
              {urgency ? <p className="mt-1 text-xs text-[#F7C948]">{urgency.urgency_label}</p> : null}
            </div>
            {formattedAmount ? (
              <span
                className={cn(
                  "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-[#F7C948]/35 bg-[#F7C948]/15 px-3 py-1 text-sm font-medium leading-none",
                  BENEFIT_AMOUNT_ACCENT_CLASS,
                )}
              >
                {formattedAmount}
              </span>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020]",
                  benefit.current_period_used
                    ? "border-[#86EFAC]/35 bg-[#86EFAC]/10 text-[#BBF7D0]"
                    : "border-white/12 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCurrentPeriodUsed(benefit, !benefit.current_period_used);
                }}
              >
                Already Enrolled
                {benefit.current_period_used ? <CheckmarkIcon className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>

              {!benefit.current_period_used ? (
                <a
                  href={enrollmentUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#86EFAC]/35 bg-emerald-400/12 px-4 text-sm font-medium leading-none text-emerald-100 transition-colors hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020]"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  aria-label="Enroll now (opens external site)"
                >
                  <span>Enroll Now</span>
                  <ExternalLinkIcon className="h-4 w-4 shrink-0" />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
            <div className="min-w-0 flex flex-col gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight text-white/95">{benefit.display_name}</p>
              </div>
              {currentPeriodLabel ? (
                <p className="text-xs text-white/55">Current period: {currentPeriodLabel}</p>
              ) : null}
              {urgency ? <p className="text-xs text-[#F7C948]">{urgency.urgency_label}</p> : null}

              {formattedAmount || canExpand ? (
                <div className="flex items-center gap-2">
                  {formattedAmount ? (
                    <span
                      className={cn(
                        "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-[#F7C948]/35 bg-[#F7C948]/15 px-3 py-1 text-sm font-medium leading-none",
                        BENEFIT_AMOUNT_ACCENT_CLASS,
                      )}
                    >
                      {formattedAmount}
                    </span>
                  ) : null}
                  {canExpand ? (
                    <button
                      type="button"
                      className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/50 transition hover:bg-white/[0.08] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020] after:absolute after:-inset-[10px] after:content-['']"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleExpand();
                      }}
                      aria-label={isExpanded ? `Collapse details for ${benefit.display_name}` : `Expand details for ${benefit.display_name}`}
                      aria-expanded={isExpanded}
                      aria-controls={detailsRegionId}
                    >
                      <ChevronIcon className={cn("h-4 w-4 transition-transform duration-200 ease-out", isExpanded ? "rotate-180" : "")} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={cn("flex shrink-0 items-start justify-end", BELL_COLUMN_WIDTH_CLASS)}>
              <button
                type="button"
                className={cn(
                  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020]",
                  remindMeDisabled
                    ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                    : benefit.remind_me
                      ? "border-emerald-300/35 bg-emerald-400/12 text-emerald-100"
                      : "border-white/12 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white/85",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleRemindMe(benefit, !benefit.remind_me);
                }}
                disabled={remindMeDisabled}
                aria-label={`Toggle reminder for ${benefit.display_name}`}
              >
                <BellToggleIcon className="h-[18px] w-[18px] shrink-0" active={benefit.remind_me} />
              </button>
            </div>
          </div>
        )}

        <div
          id={detailsRegionId}
          className={cn(
            "overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
            isExpanded && descriptionText ? "mt-2 max-h-[240px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1",
          )}
          aria-hidden={!isExpanded}
        >
          {descriptionText ? (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-white/70">{descriptionText}</p>
            </div>
          ) : null}
        </div>

      </div>
    </li>
  );
});

type CardPanelProps = {
  card: CardGroup;
  isExpanded: boolean;
  activeCadence: Cadence;
  onToggleExpand: (cardId: string) => void;
  onCadenceChange: (cardId: string, cadence: Cadence) => void;
  onTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>, cardId: string, cadence: Cadence) => void;
  onToggleRemindMe: (benefit: BenefitRow, nextValue: boolean) => void;
  onToggleCurrentPeriodUsed: (benefit: BenefitRow, nextUsed: boolean) => void;
  onRequestRemove: (card: CardGroup) => void;
};

const CardPanel = memo(function CardPanel({
  card,
  isExpanded,
  activeCadence,
  onToggleExpand,
  onCadenceChange,
  onTabKeyDown,
  onToggleRemindMe,
  onToggleCurrentPeriodUsed,
  onRequestRemove,
}: CardPanelProps) {
  const shortCardName = useMemo(() => getShortCardName(card.cardName, card.issuer), [card.cardName, card.issuer]);
  const headerDisplayName = useMemo(() => shortCardName.replace(/\s+Card$/i, ""), [shortCardName]);
  const issuerShortLabel = useMemo(() => getIssuerShortLabel(card.issuer), [card.issuer]);
  const cadenceCountByType = useMemo(() => {
    const counts: Record<Cadence, number> = {
      monthly: 0,
      quarterly: 0,
      semiannual: 0,
      annual: 0,
      multi_year: 0,
      one_time: 0,
      per_booking: 0,
    };

    for (const benefit of card.benefits) {
      counts[benefit.cadence] += 1;
    }

    return counts;
  }, [card.benefits]);

  const activeCadenceBenefits = useMemo(
    () => card.benefits.filter((benefit) => benefit.cadence === activeCadence),
    [card.benefits, activeCadence],
  );

  return (
    <Surface key={card.cardId} className="p-0 backdrop-blur-0 [content-visibility:auto] [contain-intrinsic-size:80px]">
      <div className="relative">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={() => onToggleExpand(card.cardId)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onToggleExpand(card.cardId);
          }}
          className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 pt-3 pb-4 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-inset"
        >
          <div className="min-w-0 flex flex-col gap-1">
            <p className="min-w-0 line-clamp-2 text-xl font-semibold leading-tight text-white">{headerDisplayName}</p>
            <p className="min-w-0 truncate text-sm leading-snug text-white/55">
              {card.benefits.length > 0
                ? `${issuerShortLabel} • ${card.benefits.length} benefits`
                : card.cardStatus === "no_trackable_benefits"
                  ? `${issuerShortLabel} • No trackable benefits yet`
                  : `${issuerShortLabel} • No Memento-trackable benefits yet`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-200 transition hover:bg-red-500/15 hover:text-red-100 sm:h-9 sm:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020]"
              onClick={(event) => {
                event.stopPropagation();
                onRequestRemove(card);
              }}
              aria-label={`Remove ${card.cardName}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020]"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand(card.cardId);
              }}
              aria-label={isExpanded ? `Collapse ${card.cardName}` : `Expand ${card.cardName}`}
              aria-expanded={isExpanded}
            >
              <ChevronIcon className={cn("h-4 w-4 transition-transform duration-200 ease-out", isExpanded ? "rotate-180" : "")} />
            </button>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-2 border-t border-white/10 px-4 py-3">
          {card.benefits.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/65">
              {card.cardStatus === "no_trackable_benefits"
                ? "This card is in our catalog, but it doesn’t have any benefits we track in Memento yet."
                : "This card doesn’t have any benefits with tracking enabled in Memento yet."}
            </p>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div role="tablist" aria-label={`${card.cardName} benefit cadence`} className="inline-flex min-w-max gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                    {CADENCE_ORDER.map((cadence) => {
                      const count = cadenceCountByType[cadence];
                      const isActive = cadence === activeCadence;
                      return (
                        <button
                          key={cadence}
                          id={`tab-${card.cardId}-${cadence}`}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={`panel-${card.cardId}-${cadence}`}
                          tabIndex={isActive ? 0 : -1}
                          className={cn(
                            "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                            isActive ? "bg-white/16 text-white" : "text-white/70 hover:bg-white/10 hover:text-white/90",
                          )}
                          onClick={() => onCadenceChange(card.cardId, cadence)}
                          onKeyDown={(event) => onTabKeyDown(event, card.cardId, cadence)}
                        >
                          {formatCadenceLabel(cadence)} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div id={`panel-${card.cardId}-${activeCadence}`} role="tabpanel" aria-labelledby={`tab-${card.cardId}-${activeCadence}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{formatCadenceLabel(activeCadence)}</p>
                  <div className={cn("flex shrink-0 justify-end", BELL_COLUMN_WIDTH_CLASS)}>
                    <p className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide leading-none text-white/50">Remind Me</p>
                  </div>
                </div>

                {activeCadenceBenefits.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/65">No benefits in this cadence.</p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {activeCadenceBenefits.map((benefit) => (
                      <BenefitItem
                        key={benefit.id}
                        benefit={benefit}
                        onToggleRemindMe={onToggleRemindMe}
                        onToggleCurrentPeriodUsed={onToggleCurrentPeriodUsed}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </Surface>
  );
});

type BenefitsOnboardingProps = {
  variant?: "onboarding" | "dashboard";
};

export function BenefitsOnboarding({ variant = "onboarding" }: BenefitsOnboardingProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const isDashboardVariant = variant === "dashboard";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CardGroup[]>([]);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [activeCadenceByCardId, setActiveCadenceByCardId] = useState<Record<string, Cadence>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [removeTargetCard, setRemoveTargetCard] = useState<CardGroup | null>(null);
  const [removeCardError, setRemoveCardError] = useState<string | null>(null);
  const [removeToast, setRemoveToast] = useState<string | null>(null);
  const [isRemovingCard, setIsRemovingCard] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const removeToastTimerRef = useRef<number | null>(null);
  const removeModalRef = useRef<HTMLDivElement | null>(null);
  const expandedCardIdRef = useRef<string | null>(null);
  const activeCadenceByCardIdRef = useRef<Record<string, Cadence>>({});

  const profileOnRender = useCallback<ProfilerOnRenderCallback>((id, phase, actualDuration) => {
    if (process.env.NODE_ENV === "production") return;
    if (phase === "update" && actualDuration > 12) {
      console.debug(`[perf] ${id} update took ${actualDuration.toFixed(2)}ms`);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (removeToastTimerRef.current != null) {
        window.clearTimeout(removeToastTimerRef.current);
        removeToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    expandedCardIdRef.current = expandedCardId;
  }, [expandedCardId]);

  useEffect(() => {
    activeCadenceByCardIdRef.current = activeCadenceByCardId;
  }, [activeCadenceByCardId]);

  const loadWalletBenefits = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await loadBenefitsOnboardingData({
      supabase,
      previousExpandedCardId: expandedCardIdRef.current,
      previousActiveCadenceByCardId: activeCadenceByCardIdRef.current,
    });

    if ("errorMessage" in result) {
      setError(result.errorMessage);
      setLoading(false);
      return;
    }

    setUserId(result.userId);
    setCards(result.cards);
    setExpandedCardId(result.expandedCardId);
    setActiveCadenceByCardId(result.activeCadenceByCardId);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadWalletBenefits();
  }, [loadWalletBenefits]);

  const updateBenefitLocal = useCallback((benefitId: string, updater: (benefit: BenefitRow) => BenefitRow) => {
    setCards((prev) => {
      let changed = false;
      const nextCards = [...prev];

      for (let cardIndex = 0; cardIndex < prev.length; cardIndex += 1) {
        const card = prev[cardIndex];
        const benefitIndex = card.benefits.findIndex((benefit) => benefit.id === benefitId);
        if (benefitIndex === -1) continue;

        const previousBenefit = card.benefits[benefitIndex];
        const nextBenefit = updater(previousBenefit);
        if (nextBenefit === previousBenefit) {
          return prev;
        }

        const nextBenefits = [...card.benefits];
        nextBenefits[benefitIndex] = nextBenefit;
        nextCards[cardIndex] = { ...card, benefits: nextBenefits };
        changed = true;
        break;
      }

      return changed ? nextCards : prev;
    });
  }, []);

  const updateRemindMe = useCallback(
    async (benefit: BenefitRow, nextValue: boolean) => {
      if (!userId) return;
      if (benefit.current_period_used && nextValue) return;

      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, remind_me: nextValue }));

      const { data: savedRow, error: updateError } = await persistRemindMePreference({
        supabase,
        userId,
        benefit,
        nextValue,
      });

      if (updateError) {
        const errorDetails = describeSupabaseError(updateError);
        console.error("Failed to update remind me status", errorDetails);
        updateBenefitLocal(benefit.id, (prev) => ({ ...prev, remind_me: !nextValue }));
        return;
      }

      updateBenefitLocal(benefit.id, (prev) => ({
        ...prev,
        user_benefit_id: savedRow?.id ?? prev.user_benefit_id,
        remind_me: savedRow?.remind_me ?? nextValue,
        current_period_used: prev.current_period_used,
      }));
    },
    [supabase, updateBenefitLocal, userId],
  );

  const updateCurrentPeriodUsed = useCallback(
    async (benefit: BenefitRow, nextUsed: boolean) => {
      if (!userId) return;
      const nextRemindMe = nextUsed ? false : benefit.remind_me;

      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, current_period_used: nextUsed, remind_me: nextRemindMe }));

      const {
        savedRow,
        error: upsertError,
        nextRemindMe: persistedNextRemindMe,
      } = await persistCurrentPeriodUsedPreference({
        supabase,
        userId,
        benefit,
        nextUsed,
      });

      if (upsertError) {
        const errorDetails = describeSupabaseError(upsertError);
        console.error("Failed to update used status", errorDetails);
        updateBenefitLocal(benefit.id, (prev) => ({
          ...prev,
          current_period_used: !nextUsed,
          remind_me: benefit.remind_me,
        }));
        return;
      }

      updateBenefitLocal(benefit.id, (prev) => ({
        ...prev,
        user_benefit_id: savedRow?.id ?? prev.user_benefit_id,
        current_period_used: nextUsed,
        remind_me: savedRow?.remind_me ?? persistedNextRemindMe,
      }));
    },
    [supabase, updateBenefitLocal, userId],
  );

  const handleTabKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, cardId: string, cadence: Cadence) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const currentIndex = CADENCE_ORDER.indexOf(cadence);
    let nextCadence = cadence;

    if (event.key === "ArrowRight") {
      nextCadence = CADENCE_ORDER[(currentIndex + 1) % CADENCE_ORDER.length];
    } else if (event.key === "ArrowLeft") {
      nextCadence = CADENCE_ORDER[(currentIndex - 1 + CADENCE_ORDER.length) % CADENCE_ORDER.length];
    } else if (event.key === "Home") {
      nextCadence = CADENCE_ORDER[0];
    } else if (event.key === "End") {
      nextCadence = CADENCE_ORDER[CADENCE_ORDER.length - 1];
    }

    setActiveCadenceByCardId((prev) => ({ ...prev, [cardId]: nextCadence }));
  }, []);

  const handleToggleExpand = useCallback((cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  }, []);

  const handleCadenceChange = useCallback((cardId: string, cadence: Cadence) => {
    setActiveCadenceByCardId((prev) => ({ ...prev, [cardId]: cadence }));
  }, []);

  const activeCard = useMemo(
    () => cards.find((card) => card.cardId === expandedCardId) ?? null,
    [cards, expandedCardId],
  );
  const activeCards = cards;
  const hasActiveCards = activeCards.length > 0;

  const handleRequestRemove = useCallback((card: CardGroup) => {
    if (isRemovingCard) return;
    setRemoveTargetCard(card);
    setRemoveCardError(null);
  }, [isRemovingCard]);

  const handleCancelRemove = useCallback(() => {
    if (isRemovingCard) return;
    setRemoveTargetCard(null);
    setRemoveCardError(null);
  }, [isRemovingCard]);

  const showRemoveToast = useCallback((message: string) => {
    setRemoveToast(message);
    if (removeToastTimerRef.current != null) {
      window.clearTimeout(removeToastTimerRef.current);
    }
    removeToastTimerRef.current = window.setTimeout(() => {
      setRemoveToast(null);
      removeToastTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    if (!removeTargetCard) return;
    const modalNode = removeModalRef.current;
    if (!modalNode) return;

    const focusable = Array.from(
      modalNode.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((node) => !node.hasAttribute("disabled"));
    const firstFocusable = focusable[0];
    firstFocusable?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isRemovingCard) {
          handleCancelRemove();
        }
        return;
      }
      if (event.key !== "Tab") return;
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [handleCancelRemove, isRemovingCard, removeTargetCard]);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTargetCard || isRemovingCard) return;

    setIsRemovingCard(true);
    setRemoveCardError(null);
    const removedCardId = removeTargetCard.cardId;
    const previousCards = cards;
    const previousExpandedCardId = expandedCardId;
    const previousActiveCadenceByCardId = activeCadenceByCardId;

    const rollback = () => {
      setCards(previousCards);
      setExpandedCardId(previousExpandedCardId);
      setActiveCadenceByCardId(previousActiveCadenceByCardId);
    };

    // Optimistic removal from UI
    setCards((prev) => prev.filter((card) => card.cardId !== removedCardId));
    setExpandedCardId((prev) => (prev === removedCardId ? null : prev));
    setActiveCadenceByCardId((prev) => {
      if (!(removedCardId in prev)) return prev;
      const next = { ...prev };
      delete next[removedCardId];
      return next;
    });
    setRemoveTargetCard(null);

    try {
      const removeResult = await removeWalletCard({
        supabase,
        cardId: removeTargetCard.cardId,
      });

      if (!removeResult.ok) {
        rollback();
        setRemoveCardError(removeResult.userMessage);
        showRemoveToast("Failed to remove card. Try again.");
        setIsRemovingCard(false);
        return;
      }
    } catch (error) {
      console.error("Failed to remove card from wallet", describeSupabaseError(error));
      rollback();
      setRemoveCardError("Could not remove this card right now. Please try again.");
      showRemoveToast("Failed to remove card. Try again.");
      setIsRemovingCard(false);
      return;
    }

    setRemoveCardError(null);
    setIsRemovingCard(false);
  }, [activeCadenceByCardId, cards, expandedCardId, isRemovingCard, removeTargetCard, showRemoveToast, supabase]);

  const handleComplete = useCallback(async () => {
    if (isCompleting || !hasActiveCards) return;

    setCompleteError(null);
    setIsCompleting(true);

    try {
      const result = await persistBenefitPreferencesOnComplete({
        supabase,
        userId,
        cards: activeCards,
      });

      if (!result.ok) {
        setCompleteError(result.userMessage);
        return;
      }

      setUserId(result.userId);
      router.push("/onboarding/success");
    } catch (error) {
      console.error("Failed to persist benefit preferences on complete", describeSupabaseError(error));
      setCompleteError("Could not save your preferences right now. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  }, [activeCards, hasActiveCards, isCompleting, router, supabase, userId]);

  /**
   * Perf findings from local profiling instrumentation on this page:
   * 1) Toggle updates recreated every card + every benefit row object, triggering large list rerenders.
   * 2) Card list/cadence counts and benefit amount formatting were repeatedly recomputed during scroll/updates.
   * 3) Large numbers of translucent surfaces with backdrop blur increased paint cost while scrolling.
   */

  if (loading) {
    return (
      <AppShell className="min-h-dvh overflow-x-hidden" containerClassName="px-0 py-8 sm:py-10 md:px-6">
        <MobilePageContainer className="px-2 md:px-0">
          <Surface className="p-6 text-sm text-white/75">Loading your benefits setup…</Surface>
        </MobilePageContainer>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell className="min-h-dvh overflow-x-hidden" containerClassName="px-0 py-8 sm:py-10 md:px-6">
        <MobilePageContainer className="px-2 md:px-0">
          <Surface className="space-y-4 p-6">
            <p className="text-sm text-white/80">{error}</p>
            <Button onClick={() => void loadWalletBenefits()}>Try again</Button>
          </Surface>
        </MobilePageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell className="min-h-dvh overflow-x-hidden" containerClassName="px-0 py-8 sm:py-10 md:px-6">
      <MobilePageContainer className="px-2 md:px-0">
        <div className="w-full min-w-0">
        <div className="mb-6 min-w-0">
          {!isDashboardVariant ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">Step 2 of 2 · Benefits Setup</p>
          ) : null}
          <div className="mt-2 flex items-start gap-3">
            <span className="mt-1 h-8 w-1 rounded-full bg-[#F7C948]" aria-hidden />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white transition md:text-4xl motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0">
                {isDashboardVariant ? "Your Benefits" : "Fine-Tune Your Benefits"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 transition md:text-base motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0">
                {isDashboardVariant
                  ? "Review your current benefits, mark what you’ve used, and update reminders anytime."
                  : "Turn on reminders for the benefits you want to keep top of mind."}
              </p>
            </div>
          </div>
          <div
            className="mx-auto mt-4 h-px w-3/4 bg-gradient-to-r from-transparent via-[#F7C948]/60 to-transparent blur-[0.5px]"
            aria-hidden
          />
          {!isDashboardVariant ? (
            <button
              type="button"
              onClick={() => router.push("/onboarding/build-your-lineup")}
              className="mt-3 inline-flex items-center rounded-lg px-2 py-1 text-sm text-white/60 transition hover:text-white/85 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220]"
            >
              ← Back to Wallet Builder
            </button>
          ) : null}
        </div>

        <div className="space-y-4 pb-28 md:pb-0">
          {cards.length === 0 ? (
            <Surface className="p-6">
              <p className="text-sm text-white/75">No cards in your wallet yet. Add cards first to configure benefits.</p>
            </Surface>
          ) : (
            <Profiler id="benefits-card-list" onRender={profileOnRender}>
              <div className="space-y-3">
                {cards.map((card) => {
                  const activeCadence = activeCadenceByCardId[card.cardId] ?? getDefaultCadence(card.benefits);
                  return (
                    <CardPanel
                      key={card.cardId}
                      card={card}
                      isExpanded={expandedCardId === card.cardId}
                      activeCadence={activeCadence}
                      onToggleExpand={handleToggleExpand}
                      onCadenceChange={handleCadenceChange}
                      onTabKeyDown={handleTabKeyDown}
                      onToggleRemindMe={updateRemindMe}
                      onToggleCurrentPeriodUsed={updateCurrentPeriodUsed}
                      onRequestRemove={handleRequestRemove}
                    />
                  );
                })}
              </div>
            </Profiler>
          )}

          {!isDashboardVariant ? (
            <>
              {completeError ? <p className="text-right text-xs text-[#F4B4B4]">{completeError}</p> : null}

              <div className="sticky bottom-3 z-30 hidden items-center justify-end md:flex">
                <Button onClick={() => void handleComplete()} disabled={!hasActiveCards || isCompleting}>
                  {isCompleting ? "Saving..." : "Complete"}
                </Button>
              </div>
            </>
          ) : null}

          {activeCard ? <p className="text-center text-xs text-white/45">Currently editing: {activeCard.cardName}</p> : null}
        </div>
        </div>

      {!isDashboardVariant ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0B1220]/75 px-4 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
          <div className="mx-auto w-full max-w-6xl">
            <Button onClick={() => void handleComplete()} disabled={!hasActiveCards || isCompleting} className="w-full">
              {isCompleting ? "Saving..." : "Complete"}
            </Button>
          </div>
        </div>
      ) : null}

      {removeToast ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-lg border border-white/15 bg-[#0F172A]/90 px-3 py-2 text-sm text-white/85 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          {removeToast}
        </div>
      ) : null}

      {removeTargetCard ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/70 px-4">
          <Surface className="w-full max-w-md space-y-4 p-5">
            <div ref={removeModalRef} className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Remove card from wallet?</h2>
              <p className="text-sm text-white/70">
                This will remove this card and its benefits from your wallet. You can add it again later.
              </p>
            </div>

            {removeCardError ? <p className="text-sm text-[#F4B4B4]">{removeCardError}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={handleCancelRemove} disabled={isRemovingCard}>
                Cancel
              </Button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-[#E87979]/35 bg-[#B04646]/25 px-5 py-2.5 text-sm font-semibold text-[#F9D1D1] transition-colors hover:bg-[#B04646]/40 disabled:cursor-not-allowed disabled:border-[#E87979]/15 disabled:bg-[#B04646]/12 disabled:text-[#F9D1D1]/60"
                onClick={() => void handleConfirmRemove()}
                disabled={isRemovingCard}
              >
                {isRemovingCard ? "Removing..." : "Remove"}
              </button>
            </div>
          </Surface>
        </div>
      ) : null}
      </MobilePageContainer>
    </AppShell>
  );
}
