/**
 * Shared card and issuer formatting utilities.
 *
 * Centralizes display-name logic that was previously duplicated across
 * wallet-builder, card-results-list, and benefits-onboarding.
 */

const ISSUER_FULL_NAME: Record<string, string> = {
  amex: "American Express",
  "american express": "American Express",
  chase: "Chase",
  citi: "Citi",
  "capital-one": "Capital One",
  "capital one": "Capital One",
  discover: "Discover",
  wellsfargo: "Wells Fargo",
  "wells fargo": "Wells Fargo",
  usbank: "US Bank",
  "us bank": "US Bank",
  bankofamerica: "Bank of America",
  "bank of america": "Bank of America",
};

function toTitleCase(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Full issuer display name (e.g. "amex" → "American Express").
 * Falls back to title-cased input for unknown issuers.
 */
export function getIssuerDisplayName(rawIssuer: string): string {
  const key = rawIssuer.trim().toLowerCase();
  return ISSUER_FULL_NAME[key] ?? toTitleCase(rawIssuer);
}

/**
 * Short issuer label suitable for badges and subtitles (e.g. "amex" → "AMEX").
 * Falls back to trimmed input for unknown issuers.
 */
export function getIssuerShortLabel(rawIssuer: string): string {
  const key = rawIssuer.trim().toLowerCase();
  if (key === "amex" || key === "american express") return "AMEX";
  if (key === "capital one" || key === "capitalone" || key === "capital-one") return "Capital One";
  if (key === "chase") return "Chase";
  if (key === "citi") return "Citi";
  return rawIssuer.trim();
}

/**
 * Cleaned card name for display: prefers display_name over card_name,
 * strips the "American Express " issuer prefix and trailing " Card" suffix.
 */
export function getCleanCardName(displayName: string | null, cardName: string): string {
  let name = displayName ?? cardName;
  if (name.startsWith("American Express ")) name = name.slice("American Express ".length);
  if (name.endsWith(" Card")) name = name.slice(0, -" Card".length);
  return name;
}
