"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Card = {
  id: string;
  issuer: string;
  brand: string | null;
  card_name: string;
  network: string;
  image_url: string | null;
};

const ISSUER_OPTIONS = [
  { id: "amex", label: "American Express", enabled: true },
  { id: "chase", label: "Chase", enabled: false },
  { id: "citi", label: "Citi", enabled: false },
  { id: "capital-one", label: "Capital One", enabled: false },
];

export default function CardsOnboardingPage() {
  const router = useRouter();

  const [issuer, setIssuer] = useState<string | null>(null);

  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const MIN_QUERY_LEN = 2;
  const hasQuery = query.trim().length >= MIN_QUERY_LEN;
  const [pendingCards, setPendingCards] = useState<Card[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isAmexSelected = issuer === "amex";
  const pendingCount = pendingCards.length;

  useEffect(() => {
    if (!isAmexSelected) return;
    if (cards.length > 0) return;

    const controller = new AbortController();

    const loadCards = async () => {
      setIsLoading(true);
      setFetchError(null);

      try {
        const res = await fetch("/api/cards?issuer=amex", {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load cards");

        const data = (await res.json()) as Card[];
        setCards(data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setFetchError("We couldn’t load Amex cards. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
    return () => controller.abort();
  }, [isAmexSelected, cards.length]);

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;

    return cards.filter((c) => c.card_name.toLowerCase().includes(q));
  }, [cards, query]);

  const handleSelectIssuer = (value: string, enabled: boolean) => {
    if (!enabled) return;
    setIssuer((current) => (current === value ? null : value));
    setQuery("");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleAddCard = (card: Card) => {
    setPendingCards((curr) => {
      if (curr.some((x) => x.id === card.id)) return curr;
      return [...curr, card];
    });
    setQuery("");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleRemoveCard = (cardId: string) => {
    setPendingCards((curr) => curr.filter((c) => c.id !== cardId));
  };

  const handleSave = async () => {
    if (pendingCards.length === 0 || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/wallet/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: pendingCards.map((c) => c.id) }),
      });

      if (!res.ok) throw new Error("Failed to save cards");

      setPendingCards([]);
      setSaveSuccess("Cards added successfully! Redirecting...");
      setTimeout(() => router.push("/dashboard"), 900);
    } catch {
      setSaveError("We couldn’t save your cards. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Add the credit cards you already own so we can track rewards, benefits,
          and perks automatically.
        </h1>
        <p className="text-sm text-gray-600">
          We never access your bank accounts or transactions.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-white">Issuers</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {ISSUER_OPTIONS.map((option) => {
            const isSelected = issuer === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={!option.enabled}
                onClick={() => handleSelectIssuer(option.id, option.enabled)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  option.enabled
                    ? "border-gray-200 text-gray-900 hover:border-blue-500"
                    : "cursor-not-allowed border-gray-100 text-gray-400"
                } ${
                  isSelected
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white"
                }`}
              >
                <span>{option.label}</span>
                {!option.enabled ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    Coming soon
                  </span>
                ) : null}
                {isSelected ? <span className="text-blue-600">✓</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {isAmexSelected ? (
        <section className="mt-8 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">
              Select your American Express cards
            </label>

            <div className="relative">
  <input
    type="text"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search American Express cards (e.g. Platinum, Gold)"
    className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
  />

  {!hasQuery ? null : isLoading ? (
    <div className="mt-2 text-sm text-gray-500">Loading cards...</div>
  ) : fetchError ? (
    <div className="mt-2 text-sm text-red-600">{fetchError}</div>
  ) : filteredCards.length === 0 ? (
    <div className="mt-2 text-sm text-gray-500">No results found</div>
  ) : (
    <ul className="absolute z-10 mt-2 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
      {filteredCards.slice(0, 12).map((card) => (
        <li key={card.id}>
          <button
            type="button"
            onClick={() => handleAddCard(card)}
            className="flex w-full items-center justify-between px-4 py-2 text-left text-gray-900 hover:bg-gray-100"
          >
            <span>{card.card_name}</span>
          </button>
        </li>
      ))}
    </ul>
  )}
</div>


          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Pending cards</h2>
          <span className="text-xs text-gray-500">{pendingCount} selected</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {pendingCards.length === 0 ? (
            <p className="text-sm text-gray-500">
              Select cards to add them to your wallet.
            </p>
          ) : (
            pendingCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm"
              >
                <span>{card.card_name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCard(card.id)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`Remove ${card.card_name}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {saveError ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      ) : null}

      {saveSuccess ? (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {saveSuccess}
        </div>
      ) : null}

      <div className="mt-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={pendingCount === 0 || isSaving}
          className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-black transition-colors ${
            pendingCount === 0 || isSaving
              ? "cursor-not-allowed bg-gray-300"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSaving
            ? "Adding cards..."
            : `Add ${pendingCount} card${pendingCount === 1 ? "" : "s"} to my wallet`}
        </button>
      </div>
    </main>
  );
}
