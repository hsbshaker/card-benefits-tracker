"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import type {
  AddCardFlowPreviewResult,
  CardSearchResult,
  ConfirmAddCardResult,
  ConfirmAddCardSelectionInput,
} from "@/lib/types/server-data";
import { AddCardSearch } from "@/components/wallet/AddCardSearch";
import { BenefitConfirmation } from "@/components/wallet/BenefitConfirmation";
import { BenefitPreview } from "@/components/wallet/BenefitPreview";
import { ReminderStylePicker } from "@/components/wallet/ReminderStylePicker";
import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Step = "search" | "preview" | "confirm" | "reminder";
type BenefitSelectionState = Record<string, { enabled: boolean; conditionalValue?: string | null }>;

type SearchCardsResponse = {
  results?: CardSearchResult[];
  error?: string;
};

type PreviewResponse = AddCardFlowPreviewResult & {
  error?: string;
};

type ConfirmResponse = ConfirmAddCardResult & {
  error?: string;
};

function createDefaultSelections(preview: AddCardFlowPreviewResult): BenefitSelectionState {
  return Object.fromEntries(
    preview.allBenefits.map((benefit) => [
      benefit.benefitId,
      {
        enabled: true,
        conditionalValue: null,
      },
    ]),
  );
}

export function AddCardFlow() {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [searchResults, setSearchResults] = useState<CardSearchResult[]>([]);
  const [suggestedCards, setSuggestedCards] = useState<CardSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardSearchResult | null>(null);
  const [step, setStep] = useState<Step>("search");
  const [preview, setPreview] = useState<AddCardFlowPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [benefitSelections, setBenefitSelections] = useState<BenefitSelectionState>({});
  const [reminderStyle, setReminderStyle] = useState<ReminderStyle>("balanced");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCount = useMemo(
    () => Object.values(benefitSelections).filter((selection) => selection.enabled).length,
    [benefitSelections],
  );

  useEffect(() => {
    let mounted = true;

    const verifyUser = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        if (!user) {
          router.replace("/login");
          return;
        }

        setAuthResolved(true);
      } catch {
        if (!mounted) return;
        router.replace("/login");
      }
    };

    void verifyUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  const runSearch = async (value: string) => {
    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/cards/search?query=${encodeURIComponent(value)}`, {
        method: "GET",
        credentials: "include",
      });
      const payload = (await response.json()) as SearchCardsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to search cards.");
      }

      if (value.trim()) {
        setSearchResults(payload.results ?? []);
      } else {
        setSuggestedCards(payload.results ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to search cards.";
      setSearchError(message);
      if (value.trim()) {
        setSearchResults([]);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!authResolved) return;

    const timeoutId = window.setTimeout(() => {
      void runSearch(deferredQuery.trim());
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [authResolved, deferredQuery]);

  useEffect(() => {
    if (!authResolved) return;
    if (suggestedCards.length > 0) return;
    void runSearch("");
  }, [authResolved, suggestedCards.length]);

  const loadPreview = async (card: CardSearchResult) => {
    setSelectedCard(card);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setStep("preview");

    try {
      const response = await fetch(`/api/cards/${card.cardId}/preview`, {
        method: "GET",
        credentials: "include",
      });
      const payload = (await response.json()) as PreviewResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load card preview.");
      }

      setPreview(payload);
      setBenefitSelections(createDefaultSelections(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load card preview.";
      setPreviewError(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRetryPreview = () => {
    if (!selectedCard) return;
    void loadPreview(selectedCard);
  };

  const handleToggleBenefit = (benefitId: string, enabled: boolean) => {
    setBenefitSelections((current) => ({
      ...current,
      [benefitId]: {
        ...current[benefitId],
        enabled,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedCard || !preview) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const selections: ConfirmAddCardSelectionInput[] = preview.allBenefits.map((benefit) => ({
        benefitId: benefit.benefitId,
        enabled: benefitSelections[benefit.benefitId]?.enabled !== false,
        conditionalValue: benefitSelections[benefit.benefitId]?.conditionalValue ?? null,
      }));

      const response = await fetch("/api/onboarding/confirm-card", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: selectedCard.cardId,
          reminderStyle,
          selections,
        }),
      });

      const payload = (await response.json()) as ConfirmResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save card.");
      }

      const redirectTo =
        payload.duplicateStatus === "possible_duplicate"
          ? `${payload.redirectTo}?duplicate=possible_duplicate`
          : payload.redirectTo;

      router.push(redirectTo);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save card.");
      setSubmitting(false);
    }
  };

  if (!authResolved) {
    return (
      <AppShell>
        <MobilePageContainer className="pt-8">
          <div className="space-y-4">
            <div className="h-6 w-36 animate-pulse rounded-full bg-white/10" />
            <Surface className="rounded-3xl border-white/10 bg-white/6 p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-48 rounded-full bg-white/10" />
                <div className="h-12 w-full rounded-2xl bg-white/8" />
              </div>
            </Surface>
          </div>
        </MobilePageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        {step === "search" ? (
          <AddCardSearch
            query={query}
            onQueryChange={setQuery}
            results={searchResults}
            loading={searchLoading && deferredQuery.trim().length > 0}
            error={searchError}
            suggestedCards={suggestedCards}
            onSelectCard={(card) => void loadPreview(card)}
            onRetry={() => void runSearch(deferredQuery.trim())}
          />
        ) : null}

        {step === "preview" ? (
          <BenefitPreview
            preview={preview}
            loading={previewLoading}
            error={previewError}
            onBack={() => setStep("search")}
            onRetry={handleRetryPreview}
            onContinue={() => setStep("confirm")}
          />
        ) : null}

        {step === "confirm" && preview ? (
          <BenefitConfirmation
            preview={preview}
            selections={benefitSelections}
            onToggleBenefit={handleToggleBenefit}
            onBack={() => setStep("preview")}
            onContinue={() => setStep("reminder")}
          />
        ) : null}

        {step === "reminder" ? (
          <ReminderStylePicker
            value={reminderStyle}
            submitting={submitting}
            error={submitError}
            onBack={() => setStep("confirm")}
            onChange={setReminderStyle}
            onSubmit={() => void handleSubmit()}
          />
        ) : null}

        {step !== "search" && preview ? (
          <div className="mt-4 text-center text-xs text-white/40">
            {selectedCount > 0 ? `${selectedCount} benefits selected` : "No reminders selected"}
          </div>
        ) : null}
      </MobilePageContainer>
    </AppShell>
  );
}
