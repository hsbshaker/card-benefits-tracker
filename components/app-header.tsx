"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type TabId = "wallet" | "dashboard" | "reminders";

type Tab = {
  id: TabId;
  label: string;
  href: string;
  comingSoon: boolean;
};

const tabs: Tab[] = [
  { id: "dashboard", label: "Dashboard (coming soon)", href: "/dashboard", comingSoon: true },
  { id: "wallet", label: "Wallet Builder", href: "/onboarding/build-your-lineup", comingSoon: false },
  { id: "reminders", label: "Personalize Reminders", href: "/onboarding/benefits", comingSoon: false },
];

export function AppHeader() {
  const pathname = usePathname();
  const [comingSoonTab, setComingSoonTab] = useState<TabId | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  const showNav = !pathname.startsWith("/onboarding/success");

  const activeTab = useMemo<TabId | null>(() => {
    if (pathname.startsWith("/dashboard")) return "dashboard";
    if (pathname.startsWith("/onboarding/build-your-lineup") || pathname.startsWith("/wallet")) return "wallet";
    if (pathname.startsWith("/onboarding/benefits") || pathname.startsWith("/benefits")) return "reminders";
    return null;
  }, [pathname]);

  const mobilePageTitle = useMemo(() => {
    if (activeTab === "wallet") return "Wallet Builder";
    if (activeTab === "reminders") return "Personalize Reminders";
    if (activeTab === "dashboard") return "Dashboard";
    return "Memento";
  }, [activeTab]);

  useEffect(() => {
    if (!comingSoonTab) return;
    const timeout = window.setTimeout(() => setComingSoonTab(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [comingSoonTab]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileDrawerOpen]);

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
    <header className="relative z-40 bg-transparent">
      <div className="md:hidden">
        <div className="flex h-14 w-full min-w-0 items-center gap-3 border-b border-white/10 bg-[#0B1220]/55 px-4 backdrop-blur-md">
          {showNav ? (
            <button
              type="button"
              aria-expanded={mobileDrawerOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setMobileDrawerOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/45"
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="h-9 w-9 shrink-0" aria-hidden />
          )}
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-white/92">{mobilePageTitle}</p>
        </div>

        <div
          className={cn(
            "fixed inset-0 z-50 transition-opacity duration-200",
            mobileDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!mobileDrawerOpen}
        >
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-[#030712]/55 backdrop-blur-[1px]"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside
            id="mobile-nav-drawer"
            className={cn(
              "absolute left-0 top-0 h-full w-[80%] max-w-xs border-r border-white/12 bg-[#0F1A2E]/95 p-4 shadow-2xl backdrop-blur-md transition-transform duration-200 ease-out",
              mobileDrawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight text-white/92">Memento</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/45"
                aria-label="Close navigation menu"
              >
                ×
              </button>
            </div>
            {showNav ? (
              <nav aria-label="Mobile navigation" className="space-y-1">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTab;
                  return (
                    <div key={tab.id} className="space-y-1">
                      <Link
                        href={tab.href}
                        onClick={(event) => {
                          setMobileDrawerOpen(false);
                          if (!tab.comingSoon) return;
                          event.preventDefault();
                          setComingSoonTab(tab.id);
                        }}
                        onKeyDown={(event) => handleComingSoonAction(tab, event)}
                        className={cn(
                          "block rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C948]/45",
                          tab.comingSoon
                            ? "cursor-not-allowed text-white/40"
                            : isActive
                              ? "bg-white/12 text-white"
                              : "text-white/75 hover:bg-white/6 hover:text-white",
                        )}
                      >
                        {tab.label}
                      </Link>
                      {comingSoonTab === tab.id ? <p className="px-3 text-xs text-[#F7C948]/90">Coming soon</p> : null}
                    </div>
                  );
                })}
              </nav>
            ) : null}
          </aside>
        </div>
      </div>

      <div className="relative mx-auto hidden h-16 w-full min-w-0 max-w-6xl items-center justify-between gap-4 bg-transparent px-6 md:flex">
        <Link href="/" className="inline-flex items-center transition-colors hover:text-white">
          <span className="text-lg font-semibold tracking-tight text-white/92">Memento</span>
        </Link>

        {showNav ? (
          <nav aria-label="Primary navigation" ref={navRef} className="relative w-full min-w-0 bg-transparent">
            <div className="hidden items-center justify-end gap-8 md:flex">
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
                        tab.comingSoon
                          ? "cursor-not-allowed text-white/40 hover:text-white/40"
                          : isActive
                            ? "text-white"
                            : "text-white/60 hover:text-white",
                      )}
                    >
                      {tab.label}
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute -bottom-1 left-0 h-0.5 rounded-full bg-[#F7C948] transition-all duration-200 ease-out",
                          isActive && !tab.comingSoon ? "w-full opacity-100" : "w-3/4 opacity-0",
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
        ) : null}
      </div>
    </header>
  );
}
