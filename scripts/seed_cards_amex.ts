/**
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Example: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed_cards_amex.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type CardRow = {
  issuer: string;
  brand?: string | null;
  card_name: string;
  network: string;
};

type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

const REQUIRED_HEADERS = ["issuer", "brand", "card_name", "network"];

const normalizeValue = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const buildKey = (row: Pick<CardRow, "issuer" | "card_name">) =>
  [row.issuer, row.card_name].map(normalizeValue).join("||");

const parseCsv = async (filePath: string): Promise<ParsedCsv> => {
  const raw = await fs.readFile(filePath, "utf8");
  const rows: string[][] = [];
  let current: string[] = [];
  let buffer = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (char === "\"" && raw[i + 1] === "\"") {
      buffer += "\"";
      i += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(buffer);
      buffer = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && raw[i + 1] === "\n") {
        i += 1;
      }
      if (buffer.length > 0 || current.length > 0) {
        current.push(buffer);
        rows.push(current);
        current = [];
        buffer = "";
      }
      continue;
    }

    buffer += char;
  }

  if (buffer.length > 0 || current.length > 0) {
    current.push(buffer);
    rows.push(current);
  }

  const headers = rows.shift() ?? [];

  return { headers, rows };
};

const ensureHeaders = (headers: string[]) => {
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter(
    (header) => !normalizedHeaders.includes(header)
  );

  if (missing.length > 0) {
    throw new Error(`Missing headers in CSV: ${missing.join(", ")}`);
  }

  return normalizedHeaders;
};

const rowToCard = (headers: string[], row: string[]): CardRow => {
  const record: Record<string, string> = {};

  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });

  // Canonicalize issuer to "American Express" to keep stored values consistent.
  const trimmedIssuer = record.issuer.trim();
  const issuer =
    normalizeValue(trimmedIssuer) === "amex"
      ? "American Express"
      : trimmedIssuer;
  const trimmedBrand = record.brand.trim();

  return {
    issuer,
    brand: trimmedBrand.length > 0 ? trimmedBrand : null,
    card_name: record.card_name.trim(),
    network: record.network.trim(),
  };
};

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const main = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. This script must be run with service role credentials."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const csvPath = path.resolve(
    process.cwd(),
    "data",
    "seed",
    "cards_amex.csv"
  );
  const { headers, rows } = await parseCsv(csvPath);
  const normalizedHeaders = ensureHeaders(headers);

  const csvCards = rows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) => rowToCard(normalizedHeaders, row));

  const { data: existingCards, error: existingError } = await supabase
    .from("cards")
    .select("issuer, card_name")
    .eq("issuer", "American Express");

  if (existingError) {
    throw existingError;
  }

  const existingKeys = new Set(
    (existingCards ?? []).map((card) =>
      buildKey({
        issuer: card.issuer,
        card_name: card.card_name,
      })
    )
  );

  const toInsert: CardRow[] = [];
  const skipped: CardRow[] = [];

  for (const card of csvCards) {
    const key = buildKey(card);
    if (existingKeys.has(key)) {
      skipped.push(card);
      continue;
    }
    existingKeys.add(key);
    toInsert.push(card);
  }

  const batches = chunk(toInsert, 500);
  let insertedCount = 0;

  for (const batch of batches) {
    const { error } = await supabase.from("cards").insert(batch);
    if (error) {
      throw error;
    }
    insertedCount += batch.length;
  }

  console.log("Seed cards summary:");
  console.log(`- Inserted: ${insertedCount}`);
  console.log(`- Skipped (already present): ${skipped.length}`);
  if (insertedCount === 0) {
    console.log("No new cards inserted (all rows already present).");
  }

  if (insertedCount > 0) {
    console.log("Inserted cards:");
    toInsert.forEach((card) => {
      console.log(
        `  - ${card.issuer} | ${card.brand ?? ""} | ${card.card_name} | ${card.network}`
      );
    });
  }

  if (skipped.length > 0) {
    console.log("Skipped cards:");
    skipped.forEach((card) => {
      console.log(
        `  - ${card.issuer} | ${card.brand ?? ""} | ${card.card_name} | ${card.network}`
      );
    });
  }
};

main().catch((error) => {
  console.error("Failed to seed cards:", error);
  process.exit(1);
});
