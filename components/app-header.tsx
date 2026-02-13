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
    <header className="relative z-30 h-16 bg-transparent">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 bg-transparent px-6">
        <Link href="/" className="inline-flex items-center transition-colors hover:text-white">
          <span className="text-lg font-semibold tracking-tight text-white/92">Viero</span>
        </Link>

        <nav aria-label="Primary navigation" ref={navRef} className="bg-transparent">
          <div className="flex items-center gap-8">
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
                      "relative inline-flex items-center py-1 text-sm transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/45",
                      isActive ? "text-white" : "text-white/60 hover:text-white",
                    )}
                  >
                    {tab.label}
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute -bottom-1 left-0 h-0.5 rounded-full bg-[#F7C948] transition-all duration-200 ease-out",
                        isActive ? "w-full opacity-100" : "w-3/4 opacity-0",
                      )}
                    />
                  </Link>

                  {showComingSoon ? (
                    <div
                      id={tooltipId}
                      role="status"
                      className="absolute left-1/2 top-[calc(100%+8px)] z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-[#0F1A2E]/90 px-2.5 py-1.5 text-xs text-white/85 shadow-md backdrop-blur-sm"
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
    </header>
  );
}
