"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type TabId = "wallet" | "dashboard" | "benefits";

type Tab = {
  id: TabId;
  label: string;
  href: string;
  comingSoon: boolean;
};

const tabs: Tab[] = [
  { id: "wallet", label: "Wallet Builder", href: "/onboarding/cards", comingSoon: false },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", comingSoon: true },
  { id: "benefits", label: "Benefits Tracker", href: "/benefits", comingSoon: true },
];

export function AppHeader() {
  const pathname = usePathname();
  const [comingSoonTab, setComingSoonTab] = useState<TabId | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  const activeTab = useMemo<TabId | null>(() => {
    if (pathname.startsWith("/onboarding/cards") || pathname.startsWith("/wallet")) return "wallet";
    if (pathname.startsWith("/dashboard")) return "dashboard";
    if (pathname.startsWith("/benefits")) return "benefits";
    return null;
  }, [pathname]);

  useEffect(() => {
    if (!comingSoonTab) return;
    const timeout = window.setTimeout(() => setComingSoonTab(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [comingSoonTab]);

  useEffect(() => {
    if (!comingSoonTab) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (event.target instanceof Node && !navRef.current.contains(event.target)) {
        setComingSoonTab(null);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setComingSoonTab(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [comingSoonTab]);

  const handleComingSoonAction = (tab: Tab, event?: KeyboardEvent<HTMLAnchorElement>) => {
    if (!tab.comingSoon) return;
    if (event && event.key !== "Enter" && event.key !== " ") return;
    setComingSoonTab(tab.id);
  };

  return (
    <header className="sticky top-0 z-40">
      <div className="h-px bg-gradient-to-r from-[#0B1220] via-emerald-300/60 to-[#0B1220]" />
      <div className="border-b border-white/10 bg-gradient-to-r from-[#0B1220] via-emerald-400/12 to-[#0B1220]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="inline-flex items-center transition-colors hover:text-white">
            <span className="text-[2rem] font-semibold tracking-tight text-white/92">Viero</span>
          </Link>

          <nav aria-label="Primary navigation" ref={navRef}>
            <div className="flex items-center gap-10">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const showComingSoon = tab.id === comingSoonTab;
                const tooltipId = `coming-soon-${tab.id}`;

                return (
                  <div key={tab.id} className="relative">
                    <Link
                      href={tab.href}
                      aria-describedby={showComingSoon ? tooltipId : undefined}
                      onClick={(event) => {
                        if (!tab.comingSoon) return;
                        event.preventDefault();
                        setComingSoonTab(tab.id);
                      }}
                      onKeyDown={(event) => handleComingSoonAction(tab, event)}
                      className={cn(
                        "relative inline-flex items-center py-1 text-lg transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/45",
                        isActive ? "font-medium text-white" : "text-white/62 hover:text-white",
                      )}
                    >
                      {tab.label}
                      {isActive ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 -bottom-1 h-px bg-[#F7C948]/95 motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0"
                        />
                      ) : null}
                    </Link>

                    {showComingSoon ? (
                      <div
                        id={tooltipId}
                        role="status"
                        className="absolute left-1/2 top-[calc(100%+8px)] z-50 -translate-x-1/2 rounded-lg border border-white/15 bg-[#0F1A2E]/95 px-2.5 py-1.5 text-xs text-white/90 shadow-lg backdrop-blur"
                      >
                        Coming soon
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
