"use client";

import { Button } from "@/components/ui/Button";

type HomeHeaderProps = {
  headline: string;
  refreshing: boolean;
  onRefresh: () => void;
};

export function HomeHeader({ headline, refreshing, onRefresh }: HomeHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <h1 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-white sm:text-4xl">
          {headline}
        </h1>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing} className="shrink-0">
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
