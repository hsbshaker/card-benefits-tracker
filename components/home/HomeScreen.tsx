"use client";

import { startTransition, useMemo, useState } from "react";
import type { HomeFeedItem, HomeFeedResult } from "@/lib/types/server-data";
import { buildHomeHeader } from "@/lib/home/build-home-header";
import { AppShell } from "@/components/ui/AppShell";
import { MobilePageContainer } from "@/components/ui/MobilePageContainer";
import { Surface } from "@/components/ui/Surface";
import { HomeHeader } from "@/components/home/HomeHeader";
import { UseSoonList } from "@/components/home/UseSoonList";
import { ComingUpSection } from "@/components/home/ComingUpSection";
import { WalletSummaryRow } from "@/components/home/WalletSummaryRow";
import { BenefitActionOverlay } from "@/components/home/BenefitActionOverlay";
import { AllClearState } from "@/components/home/AllClearState";
import { EmptyHomeState } from "@/components/home/EmptyHomeState";

type HomeScreenProps = {
  initialFeed: HomeFeedResult;
};

type FeedResponse = HomeFeedResult & {
  error?: string;
};

function rebuildHeader(feed: HomeFeedResult, useSoonCount: number, comingUpCount: number) {
  return buildHomeHeader({
    trackedCards: feed.walletSummary.trackedCards,
    trackedBenefits: feed.walletSummary.trackedBenefits,
    useSoonCount,
    comingUpCount,
  });
}

function removeItemFromFeed(feed: HomeFeedResult, item: HomeFeedItem): HomeFeedResult {
  const wasUseSoon = feed.useSoon.some((candidate) => candidate.userBenefitId === item.userBenefitId);
  const wasComingUp = feed.comingUp.some((candidate) => candidate.userBenefitId === item.userBenefitId);
  const nextUseSoon = feed.useSoon.filter((candidate) => candidate.userBenefitId !== item.userBenefitId);
  const nextComingUp = feed.comingUp.filter((candidate) => candidate.userBenefitId !== item.userBenefitId);
  const nextUseSoonCount = Math.max(0, nextUseSoon.length + feed.useSoonHiddenCount - (wasUseSoon ? 1 : 0));
  const nextComingUpCount = Math.max(0, feed.comingUpCount - (wasComingUp ? 1 : 0));

  return {
    ...feed,
    header: rebuildHeader(feed, nextUseSoonCount, nextComingUpCount),
    useSoon: nextUseSoon,
    useSoonHiddenCount: Math.max(0, nextUseSoonCount - nextUseSoon.length),
    comingUp: nextComingUp,
    comingUpCount: nextComingUpCount,
    isAllClear: feed.walletSummary.trackedCards > 0 && nextUseSoonCount === 0 && nextComingUpCount === 0,
  };
}

export function HomeScreen({ initialFeed }: HomeScreenProps) {
  const [feed, setFeed] = useState(initialFeed);
  const [overlayItem, setOverlayItem] = useState<HomeFeedItem | null>(null);
  const [pendingById, setPendingById] = useState<Record<string, "mark-used" | "snooze" | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const noUseSoon = feed.useSoon.length === 0 && feed.useSoonHiddenCount === 0;
  const showAllClear = !feed.isEmpty && noUseSoon;

  const visibleHeadline = useMemo(() => {
    if (feed.isEmpty) {
      return "Add your first card to get started.";
    }

    if (showAllClear && feed.comingUpCount > 0) {
      return "You’re on track for now.";
    }

    if (showAllClear) {
      return "All caught up.";
    }

    return feed.header;
  }, [feed.header, feed.isEmpty, feed.comingUpCount, showAllClear]);

  const refreshFeed = async () => {
    setRefreshing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/home/feed", {
        method: "GET",
        credentials: "include",
      });
      const payload = (await response.json()) as FeedResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to refresh.");
      }

      startTransition(() => {
        setFeed(payload);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn’t refresh. Showing last known state.");
    } finally {
      setRefreshing(false);
    }
  };

  const runMutation = async (item: HomeFeedItem, route: "/api/home/mark-used" | "/api/home/snooze", action: "mark-used" | "snooze") => {
    const previousFeed = feed;
    setPendingById((current) => ({ ...current, [item.userBenefitId]: action }));
    setErrorMessage(null);
    setFeed(removeItemFromFeed(feed, item));
    setOverlayItem((current) => (current?.userBenefitId === item.userBenefitId ? null : current));

    try {
      const response = await fetch(route, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userBenefitId: item.userBenefitId,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save.");
      }

      void refreshFeed();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn’t refresh. Showing last known state.");
      setFeed(previousFeed);
      void refreshFeed();
    } finally {
      setPendingById((current) => ({ ...current, [item.userBenefitId]: null }));
    }
  };

  if (feed.isEmpty) {
    return (
      <AppShell containerClassName="max-w-4xl px-0 md:px-6">
        <MobilePageContainer className="pb-20">
          <EmptyHomeState />
        </MobilePageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell containerClassName="max-w-4xl px-0 md:px-6">
      <MobilePageContainer className="pb-20">
        <div className="space-y-6 pt-6">
          <HomeHeader headline={visibleHeadline} refreshing={refreshing} onRefresh={() => void refreshFeed()} />

          {errorMessage ? (
            <Surface className="rounded-2xl border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>Couldn’t refresh. Showing last known state.</p>
                <button type="button" onClick={() => void refreshFeed()} className="text-left font-semibold underline decoration-amber-100/40 underline-offset-4">
                  Retry
                </button>
              </div>
            </Surface>
          ) : null}

          {showAllClear ? <AllClearState headline={visibleHeadline} /> : null}

          <UseSoonList
            items={feed.useSoon}
            hiddenCount={feed.useSoonHiddenCount}
            pendingById={pendingById}
            onOpenItem={setOverlayItem}
            onMarkUsed={(item) => void runMutation(item, "/api/home/mark-used", "mark-used")}
            onSnooze={(item) => void runMutation(item, "/api/home/snooze", "snooze")}
          />

          <ComingUpSection items={feed.comingUp} count={feed.comingUpCount} onOpenItem={setOverlayItem} />

          <WalletSummaryRow
            trackedBenefits={feed.walletSummary.trackedBenefits}
            trackedCards={feed.walletSummary.trackedCards}
          />
        </div>

        <BenefitActionOverlay
          item={overlayItem}
          open={overlayItem !== null}
          loading={overlayItem ? pendingById[overlayItem.userBenefitId] === "mark-used" : false}
          onClose={() => setOverlayItem(null)}
          onMarkUsed={(item) => void runMutation(item, "/api/home/mark-used", "mark-used")}
        />
      </MobilePageContainer>
    </AppShell>
  );
}
