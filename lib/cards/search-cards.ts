import "server-only";

import { getIssuerDisplayName } from "@/lib/format-card";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { CardSearchResult } from "@/lib/types/server-data";
import { normalizeCardArtUrl } from "@/lib/benefits/format-benefit-labels";

type CanonicalCardRow = {
  id: string;
  card_name: string;
  display_name: string | null;
  issuer: string | null;
  source_url: string | null;
  card_status: "active" | "no_trackable_benefits" | null;
};

const DEFAULT_LIMIT = 20;

function escapeIlikeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSearchScore(row: CanonicalCardRow, normalizedQuery: string) {
  const cardName = normalizeSearchText(row.card_name);
  const displayName = normalizeSearchText(row.display_name);
  const issuer = normalizeSearchText(row.issuer);
  const composite = normalizeSearchText(`${issuer} ${displayName || cardName}`);

  if (cardName === normalizedQuery || displayName === normalizedQuery || composite === normalizedQuery) {
    return 300;
  }

  if (
    cardName.startsWith(normalizedQuery) ||
    displayName.startsWith(normalizedQuery) ||
    composite.startsWith(normalizedQuery)
  ) {
    return 200;
  }

  if (
    cardName.includes(normalizedQuery) ||
    displayName.includes(normalizedQuery) ||
    composite.includes(normalizedQuery)
  ) {
    return 100;
  }

  return 0;
}

function mapCardSearchResult(row: CanonicalCardRow): CardSearchResult | null {
  if (row.card_status !== "active" && row.card_status !== "no_trackable_benefits") {
    return null;
  }

  return {
    cardId: row.id,
    cardName: row.card_name,
    displayName: row.display_name,
    issuer: getIssuerDisplayName(row.issuer ?? ""),
    cardArtUrl: normalizeCardArtUrl(row.source_url),
    cardStatus: row.card_status,
  };
}

export async function searchCards(query: string): Promise<CardSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  const supabase = getServiceRoleSupabaseClient();

  let dbQuery = supabase
    .from("cards")
    .select("id, card_name, display_name, issuer, source_url, card_status")
    .in("card_status", ["active", "no_trackable_benefits"])
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("card_name", { ascending: true })
    .limit(DEFAULT_LIMIT * 3);

  if (normalizedQuery.length > 0) {
    const escaped = escapeIlikeValue(normalizedQuery);
    dbQuery = dbQuery.or(
      `card_name.ilike.%${escaped}%,display_name.ilike.%${escaped}%,issuer.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await dbQuery;
  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as CanonicalCardRow[])
    .map((row) => ({ row, score: normalizedQuery ? buildSearchScore(row, normalizedQuery) : 0 }))
    .filter(({ score }) => normalizedQuery.length === 0 || score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        normalizeSearchText(a.row.display_name ?? a.row.card_name).localeCompare(
          normalizeSearchText(b.row.display_name ?? b.row.card_name),
        ),
    )
    .slice(0, DEFAULT_LIMIT)
    .map(({ row }) => mapCardSearchResult(row))
    .filter((row): row is CardSearchResult => row !== null);

  return rows;
}
