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
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Cadence = "monthly" | "quarterly" | "semi_annual" | "annual" | "one_time";

type BenefitRow = {
  id: string;
  display_name: string;
  description: string | null;
  cadence: Cadence;
  cadence_detail: Record<string, unknown> | null;
  value_cents: number | null;
  notes: string | null;
  user_benefit_id: string | null;
  remind_me: boolean;
  used: boolean;
};

type CardGroup = {
  cardId: string;
  cardName: string;
  productKey: string | null;
  issuer: string;
  network: string | null;
  benefits: BenefitRow[];
};

type UserBenefitRecord = {
  id: string;
  benefit_id: string;
  remind_me?: boolean | null;
  used?: boolean | null;
  is_enabled?: boolean | null;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const CADENCE_ORDER: Cadence[] = ["monthly", "quarterly", "semi_annual", "annual", "one_time"];
const BENEFIT_AMOUNT_ACCENT_CLASS = "text-[#F7C948]";
const ISSUER_DISPLAY_MAP: Record<string, string> = {
  amex: "American Express",
  "american express": "American Express",
  chase: "Chase",
  citi: "Citi",
  "capital-one": "Capital One",
  "capital one": "Capital One",
  discover: "Discover",
  wellsfargo: "Wells Fargo",
  "wells fargo": "Wells Fargo",
  usbank: "US Bank",
  "us bank": "US Bank",
  bankofamerica: "Bank of America",
  "bank of america": "Bank of America",
};
const NETWORK_DISPLAY_MAP: Record<string, string> = {
  amex: "Amex",
  "american express": "Amex",
  visa: "Visa",
  mastercard: "Mastercard",
  "master card": "Mastercard",
  mc: "Mastercard",
  discover: "Discover",
};
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
  if (cadence === "semi_annual") return "Semi-Annually";
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
  if (cadence === "semi_annual") return `${amount}/semi-annual`;
  return `${amount}/year`;
}

function normalizeCadence(cadence: string | null | undefined): Cadence {
  if (cadence === "monthly" || cadence === "quarterly" || cadence === "semi_annual" || cadence === "annual" || cadence === "one_time") {
    return cadence;
  }

  return "annual";
}

function toTitleCase(raw: string) {
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeIssuerDisplayName(rawIssuer: string) {
  const normalizedKey = rawIssuer.trim().toLowerCase();
  return ISSUER_DISPLAY_MAP[normalizedKey] ?? toTitleCase(rawIssuer);
}

function normalizeNetworkDisplayName(rawNetwork: string | null) {
  if (!rawNetwork) return null;
  const normalizedKey = rawNetwork.trim().toLowerCase();
  return NETWORK_DISPLAY_MAP[normalizedKey] ?? toTitleCase(rawNetwork);
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

function getIssuerShortLabel(issuer: string) {
  const value = (issuer || "").toLowerCase();
  if (value.includes("american express")) return "AMEX";
  return issuer;
}

function describeSupabaseError(error: unknown) {
  const err = (error ?? {}) as SupabaseErrorLike;
  return {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    raw: error,
    stringified:
      typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
  };
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

function KebabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="15.5" r="1.5" />
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
  onToggleUsed: (benefit: BenefitRow, nextUsed: boolean) => void;
};

const BenefitItem = memo(function BenefitItem({ benefit, onToggleRemindMe, onToggleUsed }: BenefitItemProps) {
  const formattedAmount = useMemo(() => formatBenefitAmount(benefit.value_cents, benefit.cadence), [benefit.value_cents, benefit.cadence]);
  const descriptionText = benefit.description?.trim();
  const enrollmentUrl = useMemo(() => getEnrollmentUrl(benefit.display_name), [benefit.display_name]);
  const isEnrollmentBenefit = Boolean(enrollmentUrl);
  const remindMeDisabled = benefit.used;
  const isRowDimmed = isEnrollmentBenefit ? benefit.used : !benefit.remind_me;
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
        "border-b border-white/10 transition-colors last:border-b-0",
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
            <p className="min-w-0 truncate text-sm font-medium leading-tight text-white/95">{benefit.display_name}</p>
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
                  benefit.used
                    ? "border-[#86EFAC]/35 bg-[#86EFAC]/10 text-[#BBF7D0]"
                    : "border-white/12 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleUsed(benefit, !benefit.used);
                }}
              >
                Already Enrolled
                {benefit.used ? <CheckmarkIcon className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>

              {!benefit.used ? (
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

            <div className="flex shrink-0 items-start">
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
            <div className="space-y-2 border-t border-white/10 pt-2">
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
  isRemoved: boolean;
  removedCardName: string | null;
  activeCadence: Cadence;
  onToggleExpand: (cardId: string) => void;
  onCadenceChange: (cardId: string, cadence: Cadence) => void;
  onTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>, cardId: string, cadence: Cadence) => void;
  onToggleRemindMe: (benefit: BenefitRow, nextValue: boolean) => void;
  onToggleUsed: (benefit: BenefitRow, nextUsed: boolean) => void;
  onRequestRemove: (card: CardGroup) => void;
};

const CardPanel = memo(function CardPanel({
  card,
  isExpanded,
  isRemoved,
  removedCardName,
  activeCadence,
  onToggleExpand,
  onCadenceChange,
  onTabKeyDown,
  onToggleRemindMe,
  onToggleUsed,
  onRequestRemove,
}: CardPanelProps) {
  const shortCardName = useMemo(() => getShortCardName(card.cardName, card.issuer), [card.cardName, card.issuer]);
  const issuerShortLabel = useMemo(() => getIssuerShortLabel(card.issuer), [card.issuer]);
  const cadenceCountByType = useMemo(() => {
    const counts: Record<Cadence, number> = {
      monthly: 0,
      quarterly: 0,
      semi_annual: 0,
      annual: 0,
      one_time: 0,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const kebabButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = kebabButtonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 210;
    const viewportPadding = 12;
    const nextLeft = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );
    setMenuPosition({ top: rect.bottom + 6, left: nextLeft });
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    updateMenuPosition();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    const onViewportChange = () => updateMenuPosition();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [isMenuOpen, updateMenuPosition]);

  if (isRemoved) {
    return (
      <Surface className="p-4">
        <p className="text-sm text-white/60">{`${removedCardName ?? card.cardName} Removed From Wallet`}</p>
      </Surface>
    );
  }

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
            <p className="min-w-0 line-clamp-2 text-xl font-semibold leading-tight text-white">{shortCardName}</p>
            <p className="min-w-0 text-sm leading-snug text-white/60">{issuerShortLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              ref={kebabButtonRef}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1020]"
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    requestAnimationFrame(() => updateMenuPosition());
                  }
                  return next;
                });
              }}
              aria-label={`${isMenuOpen ? "Close" : "Open"} actions for ${card.cardName}`}
              aria-expanded={isMenuOpen}
            >
              <KebabIcon className="h-4 w-4" />
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

        {isMenuOpen && menuPosition
          ? createPortal(
              <>
                <button
                  type="button"
                  aria-label="Close card actions"
                  className="fixed inset-0 z-[90] cursor-default bg-transparent"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div
                  className="fixed z-[100] min-w-[210px] rounded-xl border border-white/15 bg-[#0F172A] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                  style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-[#F8C1C1] transition hover:bg-[#B04646]/30"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRequestRemove(card);
                    }}
                  >
                    Remove card from wallet
                  </button>
                  <button
                    type="button"
                    className="mt-1 flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white/90"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>

      {isExpanded ? (
        <div className="space-y-3 border-t border-white/10 px-4 py-4">
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

          <div id={`panel-${card.cardId}-${activeCadence}`} role="tabpanel" aria-labelledby={`tab-${card.cardId}-${activeCadence}`} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{formatCadenceLabel(activeCadence)}</p>
            </div>

            {activeCadenceBenefits.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/65">No benefits in this cadence.</p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                {activeCadenceBenefits.map((benefit) => (
                  <BenefitItem key={benefit.id} benefit={benefit} onToggleRemindMe={onToggleRemindMe} onToggleUsed={onToggleUsed} />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Surface>
  );
});

function getDefaultCadence(benefits: BenefitRow[]) {
  if (benefits.some((benefit) => benefit.cadence === "monthly")) return "monthly";
  return CADENCE_ORDER.find((cadence) => benefits.some((benefit) => benefit.cadence === cadence)) ?? "monthly";
}

export function BenefitsOnboarding() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CardGroup[]>([]);
  const [removedCardIds, setRemovedCardIds] = useState<string[]>([]);
  const [removedCardNamesById, setRemovedCardNamesById] = useState<Record<string, string>>({});
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [activeCadenceByCardId, setActiveCadenceByCardId] = useState<Record<string, Cadence>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [removeTargetCard, setRemoveTargetCard] = useState<CardGroup | null>(null);
  const [removeCardError, setRemoveCardError] = useState<string | null>(null);
  const [isRemovingCard, setIsRemovingCard] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const removeNoticeTimersRef = useRef<Record<string, number>>({});

  const profileOnRender = useCallback<ProfilerOnRenderCallback>((id, phase, actualDuration) => {
    if (process.env.NODE_ENV === "production") return;
    if (phase === "update" && actualDuration > 12) {
      console.debug(`[perf] ${id} update took ${actualDuration.toFixed(2)}ms`);
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(removeNoticeTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      removeNoticeTimersRef.current = {};
    };
  }, []);

  const loadWalletBenefits = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Could not verify your account. Please log in again.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    // Invariant: user_cards is unique per (user_id, card_id), enforced by DB unique index and idempotent upserts.
    const { data: walletRows, error: walletError } = await supabase
      .from("user_cards")
      .select("card_id, cards!inner(id, card_name, display_name, product_key, issuer, network)")
      .eq("user_id", user.id);

    if (walletError) {
      console.error("Failed to load wallet cards", walletError);
      setError("Could not load your cards right now.");
      setLoading(false);
      return;
    }

    type WalletRow = {
      card_id: string;
      cards: { id: string; card_name: string; display_name: string | null; product_key: string | null; issuer: string; network: string | null };
    };

    const wallet = (walletRows ?? []) as unknown as WalletRow[];
    if (process.env.NODE_ENV !== "production") {
      const seenCardIds = new Set<string>();
      const duplicateCardIds = new Set<string>();
      for (const row of wallet) {
        if (seenCardIds.has(row.card_id)) duplicateCardIds.add(row.card_id);
        seenCardIds.add(row.card_id);
      }
      if (duplicateCardIds.size > 0) {
        console.warn("[benefits-onboarding] duplicate wallet card_ids detected after load", {
          user_id: user.id,
          card_ids: Array.from(duplicateCardIds),
        });
      }
    }

    if (wallet.length === 0) {
      setCards([]);
      setRemovedCardIds([]);
      setRemovedCardNamesById({});
      setExpandedCardId(null);
      setLoading(false);
      return;
    }

    const cardIds = wallet.map((row) => row.cards.id);
    const { data: benefitRows, error: benefitsError } = await supabase
      .from("benefits")
      .select("id, card_id, display_name, description, cadence, cadence_detail, value_cents, requires_enrollment, requires_selection, notes")
      .in("card_id", cardIds);

    if (benefitsError) {
      console.error("Failed to load card benefits", benefitsError);
      setError("Could not load card benefits right now.");
      setLoading(false);
      return;
    }

    const benefits = (benefitRows ?? []) as unknown as Array<{
      card_id: string;
      id: string;
      display_name: string;
      description: string | null;
      cadence: string | null;
      cadence_detail: Record<string, unknown> | null;
      value_cents: number | null;
      notes: string | null;
    }>;

    if (process.env.NODE_ENV !== "production") {
      const benefitCountByCard = new Map<string, number>();
      for (const row of benefits) {
        benefitCountByCard.set(row.card_id, (benefitCountByCard.get(row.card_id) ?? 0) + 1);
      }

      for (const walletCard of wallet) {
        console.debug("[benefits-onboarding] card benefit match", {
          card_id: walletCard.cards.id,
          product_key: walletCard.cards.product_key,
          matched_benefits: benefitCountByCard.get(walletCard.cards.id) ?? 0,
        });
      }
    }

    const benefitIds = Array.from(new Set(benefits.map((row) => row.id)));

    let { data: userBenefitRows, error: userBenefitsError } = await supabase
      .from("user_benefits")
      .select("*")
      .eq("user_id", user.id)
      .in("benefit_id", benefitIds);

    if (userBenefitsError) {
      console.error("Failed to load user benefits", userBenefitsError);
      setError("Could not load your benefit settings right now.");
      setLoading(false);
      return;
    }

    const userBenefitMap = new Map(((userBenefitRows ?? []) as UserBenefitRecord[]).map((row) => [row.benefit_id, row]));

    const cardsMissingUserBenefits = new Set<string>();
    for (const card of wallet) {
      const cardBenefitIds = benefits.filter((row) => row.card_id === card.cards.id).map((row) => row.id);
      if (cardBenefitIds.some((benefitId) => !userBenefitMap.has(benefitId))) {
        cardsMissingUserBenefits.add(card.cards.id);
      }
    }

    if (cardsMissingUserBenefits.size > 0) {
      for (const cardId of cardsMissingUserBenefits) {
        const { error: bootstrapError } = await supabase.rpc("bootstrap_user_benefits_for_card", {
          p_user_id: user.id,
          p_card_id: cardId,
        });
        if (bootstrapError) {
          console.error(`Failed to bootstrap missing user benefits for card ${cardId}`, bootstrapError);
        }
      }

      const refetch = await supabase
        .from("user_benefits")
        .select("*")
        .eq("user_id", user.id)
        .in("benefit_id", benefitIds);

      userBenefitRows = refetch.data ?? userBenefitRows;
      userBenefitsError = refetch.error;

      if (userBenefitsError) {
        console.error("Failed to reload user benefits", userBenefitsError);
        setError("Could not load your benefit settings right now.");
        setLoading(false);
        return;
      }
    }

    const refreshedUserBenefitMap = new Map(((userBenefitRows ?? []) as UserBenefitRecord[]).map((row) => [row.benefit_id, row]));

    const nextCards: CardGroup[] = wallet
      .map((walletCard) => {
        const benefitsForCard = benefits
          .filter((benefit) => benefit.card_id === walletCard.cards.id)
          .sort(
            (a, b) =>
              CADENCE_ORDER.indexOf(normalizeCadence(a.cadence)) -
                CADENCE_ORDER.indexOf(normalizeCadence(b.cadence)) ||
              a.display_name.localeCompare(b.display_name),
          )
          .map((benefit) => {
            const userBenefit = refreshedUserBenefitMap.get(benefit.id);

            return {
              id: benefit.id,
              display_name: benefit.display_name,
              description: benefit.description,
              cadence: normalizeCadence(benefit.cadence),
              cadence_detail: benefit.cadence_detail,
              value_cents: benefit.value_cents,
              notes: benefit.notes,
              user_benefit_id: userBenefit?.id ?? null,
              remind_me:
                typeof userBenefit?.remind_me === "boolean"
                  ? userBenefit.remind_me
                  : typeof userBenefit?.is_enabled === "boolean"
                    ? userBenefit.is_enabled
                    : true,
              used: typeof userBenefit?.used === "boolean" ? userBenefit.used : false,
            };
          });

        return {
          cardId: walletCard.cards.id,
          cardName: walletCard.cards.display_name ?? walletCard.cards.card_name,
          productKey: walletCard.cards.product_key,
          issuer: normalizeIssuerDisplayName(walletCard.cards.issuer),
          network: normalizeNetworkDisplayName(walletCard.cards.network),
          benefits: benefitsForCard,
        };
      })
      .sort((a, b) => a.cardName.localeCompare(b.cardName));

    setCards(nextCards);
    setRemovedCardIds((prev) => prev.filter((cardId) => nextCards.some((card) => card.cardId === cardId)));
    setRemovedCardNamesById((prev) => {
      const next: Record<string, string> = {};
      for (const cardId of Object.keys(prev)) {
        if (nextCards.some((card) => card.cardId === cardId)) {
          next[cardId] = prev[cardId];
        }
      }
      return next;
    });
    setExpandedCardId((prev) => (prev && nextCards.some((card) => card.cardId === prev) ? prev : null));
    setActiveCadenceByCardId((prev) => {
      const next: Record<string, Cadence> = {};
      for (const card of nextCards) {
        const existing = prev[card.cardId];
        if (existing && card.benefits.some((benefit) => benefit.cadence === existing)) {
          next[card.cardId] = existing;
          continue;
        }

        next[card.cardId] = getDefaultCadence(card.benefits);
      }
      return next;
    });
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
      if (benefit.used && nextValue) return;

      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, remind_me: nextValue }));

      const { data: savedRow, error: updateError } = await supabase
        .from("user_benefits")
        .upsert(
          {
            user_id: userId,
            benefit_id: benefit.id,
            remind_me: nextValue,
            used: benefit.used,
          },
          { onConflict: "user_id,benefit_id" },
        )
        .select("id, benefit_id, remind_me, used")
        .single();

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
        used: savedRow?.used ?? prev.used,
      }));
    },
    [supabase, updateBenefitLocal, userId],
  );

  const updateUsed = useCallback(
    async (benefit: BenefitRow, nextUsed: boolean) => {
      if (!userId) return;
      const nextRemindMe = nextUsed ? false : benefit.remind_me;

      updateBenefitLocal(benefit.id, (prev) => ({ ...prev, used: nextUsed, remind_me: nextRemindMe }));

      const { data: savedRow, error: upsertError } = await supabase
        .from("user_benefits")
        .upsert(
          {
            user_id: userId,
            benefit_id: benefit.id,
            used: nextUsed,
            remind_me: nextRemindMe,
          },
          { onConflict: "user_id,benefit_id" },
        )
        .select("id, benefit_id, remind_me, used")
        .single();

      if (upsertError) {
        const errorDetails = describeSupabaseError(upsertError);
        console.error("Failed to update used status", errorDetails);
        updateBenefitLocal(benefit.id, (prev) => ({ ...prev, used: !nextUsed, remind_me: benefit.remind_me }));
        return;
      }

      updateBenefitLocal(benefit.id, (prev) => ({
        ...prev,
        user_benefit_id: savedRow?.id ?? prev.user_benefit_id,
        used: savedRow?.used ?? nextUsed,
        remind_me: savedRow?.remind_me ?? nextRemindMe,
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
    () => cards.find((card) => card.cardId === expandedCardId && !removedCardIds.includes(card.cardId)) ?? null,
    [cards, expandedCardId, removedCardIds],
  );
  const activeCards = useMemo(
    () => cards.filter((card) => !removedCardIds.includes(card.cardId)),
    [cards, removedCardIds],
  );
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

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTargetCard || isRemovingCard) return;

    setIsRemovingCard(true);
    setRemoveCardError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setRemoveCardError("Could not verify your account. Please try again.");
      setIsRemovingCard(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", user.id)
      .eq("card_id", removeTargetCard.cardId);

    if (deleteError) {
      console.error("Failed to remove card from wallet", describeSupabaseError(deleteError));
      setRemoveCardError("Could not remove this card right now. Please try again.");
      setIsRemovingCard(false);
      return;
    }

    const removedCardId = removeTargetCard.cardId;
    setRemovedCardIds((prev) => (prev.includes(removedCardId) ? prev : [...prev, removedCardId]));
    setRemovedCardNamesById((prev) => ({ ...prev, [removedCardId]: removeTargetCard.cardName }));
    setExpandedCardId((prev) => (prev === removedCardId ? null : prev));
    setActiveCadenceByCardId((prev) => {
      if (!(removedCardId in prev)) return prev;
      const next = { ...prev };
      delete next[removedCardId];
      return next;
    });
    setRemoveTargetCard(null);
    setRemoveCardError(null);
    setIsRemovingCard(false);

    removeNoticeTimersRef.current[removedCardId] = window.setTimeout(() => {
      setCards((prev) => prev.filter((card) => card.cardId !== removedCardId));
      setRemovedCardIds((prev) => prev.filter((cardId) => cardId !== removedCardId));
      setRemovedCardNamesById((prev) => {
        if (!(removedCardId in prev)) return prev;
        const next = { ...prev };
        delete next[removedCardId];
        return next;
      });
      delete removeNoticeTimersRef.current[removedCardId];
    }, 1500);
  }, [isRemovingCard, removeTargetCard, supabase]);

  const handleComplete = useCallback(async () => {
    if (isCompleting || !hasActiveCards) return;

    setCompleteError(null);
    setIsCompleting(true);

    try {
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setCompleteError("Could not verify your account. Please try again.");
          return;
        }

        resolvedUserId = user.id;
        setUserId(user.id);
      }

      const preferenceRows = activeCards.flatMap((card) =>
        card.benefits.map((benefit) => ({
          user_id: resolvedUserId,
          benefit_id: benefit.id,
          remind_me: benefit.remind_me,
          used: benefit.used,
        })),
      );

      if (preferenceRows.length > 0) {
        const { error: saveError } = await supabase.from("user_benefits").upsert(preferenceRows, {
          onConflict: "user_id,benefit_id",
        });

        if (saveError) {
          console.error("Failed to persist benefit preferences on complete", describeSupabaseError(saveError));
          setCompleteError("Could not save your preferences right now. Please try again.");
          return;
        }
      }

      router.push("/onboarding/success");
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
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">Step 2 of 2 · Benefits Setup</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="mt-1 h-8 w-1 rounded-full bg-[#F7C948]" aria-hidden />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white transition md:text-4xl motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0">
                Fine-Tune Your Benefits
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 transition md:text-base motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0">
                Turn on reminders for the benefits you want to keep top of mind.
              </p>
            </div>
          </div>
          <div
            className="mx-auto mt-4 h-px w-3/4 bg-gradient-to-r from-transparent via-[#F7C948]/60 to-transparent blur-[0.5px]"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => router.push("/onboarding/build-your-lineup")}
            className="mt-3 inline-flex items-center rounded-lg px-2 py-1 text-sm text-white/60 transition hover:text-white/85 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220]"
          >
            ← Back to Wallet Builder
          </button>
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
                      isRemoved={removedCardIds.includes(card.cardId)}
                      removedCardName={removedCardNamesById[card.cardId] ?? null}
                      isExpanded={expandedCardId === card.cardId}
                      activeCadence={activeCadence}
                      onToggleExpand={handleToggleExpand}
                      onCadenceChange={handleCadenceChange}
                      onTabKeyDown={handleTabKeyDown}
                      onToggleRemindMe={updateRemindMe}
                      onToggleUsed={updateUsed}
                      onRequestRemove={handleRequestRemove}
                    />
                  );
                })}
              </div>
            </Profiler>
          )}

          {completeError ? <p className="text-right text-xs text-[#F4B4B4]">{completeError}</p> : null}

          <div className="sticky bottom-3 z-30 hidden items-center justify-end md:flex">
            <Button onClick={() => void handleComplete()} disabled={!hasActiveCards || isCompleting}>
              {isCompleting ? "Saving..." : "Complete"}
            </Button>
          </div>

          {activeCard ? <p className="text-center text-xs text-white/45">Currently editing: {activeCard.cardName}</p> : null}
        </div>
        </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0B1220]/75 px-4 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="mx-auto w-full max-w-6xl">
          <Button onClick={() => void handleComplete()} disabled={!hasActiveCards || isCompleting} className="w-full">
            {isCompleting ? "Saving..." : "Complete"}
          </Button>
        </div>
      </div>

      {removeTargetCard ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030712]/70 px-4">
          <Surface className="w-full max-w-md space-y-4 p-5">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Remove {removeTargetCard.cardName} from your wallet?</h2>
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
                {isRemovingCard ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </Surface>
        </div>
      ) : null}
      </MobilePageContainer>
    </AppShell>
  );
}
