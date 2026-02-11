import { MOCK_CARDS, MOCK_ISSUERS } from "./mock-data";
import { Issuer, WalletCard } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchIssuers(): Promise<Issuer[]> {
  await delay(280);
  return MOCK_ISSUERS;
}

export async function fetchCards(issuer?: string): Promise<WalletCard[]> {
  await delay(360);
  if (!issuer || issuer === "all") return MOCK_CARDS;
  return MOCK_CARDS.filter((card) => card.issuerId === issuer);
}

export async function saveWallet(selectedCardIds: string[]): Promise<{ success: true; selectedCardIds: string[] }> {
  await delay(450);

  const response = await fetch("/api/wallet/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardIds: selectedCardIds }),
  }).catch(() => null);

  if (response && !response.ok) {
    throw new Error("Unable to save wallet");
  }

  return { success: true, selectedCardIds };
}
