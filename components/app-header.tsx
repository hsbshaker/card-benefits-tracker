"use client";

import Link from "next/link";

export function AppHeader() {
  return (
    <header className="relative z-30 h-16 bg-transparent">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center bg-transparent px-6">
        <Link href="/" className="inline-flex items-center transition-colors hover:text-white">
          <span className="text-lg font-semibold tracking-tight text-white/92">Memento</span>
        </Link>
      </div>
    </header>
  );
}
