import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

type CardStatus = "active" | "no_trackable_benefits";
type BenefitCadence =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "multi_year"
  | "one_time"
  | "per_booking";
type TrackInMemento = "yes" | "later" | "no";

type RawRow = {
  row_number: number;
  card_name: string;
  benefit_name: string | null;
  benefit_value: string | null;
  cadence: string | null;
  reset_timing: string | null;
  enrollment_required: string | null;
  requires_setup: string | null;
  track_in_memento: string | null;
  source_url: string;
  notes: string | null;
  card_status: string;
};

type ValidationError = {
  type:
    | "missing_headers"
    | "missing_required_field"
    | "invalid_enum"
    | "invalid_boolean"
    | "conflicting_card_status"
    | "card_code_collision"
    | "benefit_code_collision"
    | "unresolved_card"
    | "active_row_missing_benefit_fields";
  message: string;
  row_numbers?: number[];
  field?: string;
  value?: string | null;
  details?: Record<string, unknown>;
};

type Warning = {
  type:
    | "placeholder_detail_fields_discarded"
    | "multiple_card_source_urls"
    | "no_canonical_card_url_found";
  message: string;
  row_numbers?: number[];
  details?: Record<string, unknown>;
};

type CardPreview = {
  issuer: "amex";
  card_code: string;
  card_name: string;
  source_url: string;
  card_status: CardStatus;
  source_row_numbers: number[];
};

type BenefitPreview = {
  issuer: "amex";
  card_code: string;
  benefit_code: string;
  benefit_name: string;
  benefit_value: string;
  cadence: BenefitCadence;
  reset_timing: string;
  enrollment_required: boolean;
  requires_setup: boolean;
  track_in_memento: TrackInMemento;
  source_url: string;
  notes: string | null;
  benefit_hash: string;
  last_verified_at: string;
  source_row_number: number;
};

type BenefitHistoryPreview = {
  card_code: string;
  benefit_code: string;
  benefit_name: string;
  benefit_value: string;
  cadence: BenefitCadence;
  reset_timing: string;
  enrollment_required: boolean;
  requires_setup: boolean;
  track_in_memento: TrackInMemento;
  source_url: string;
  notes: string | null;
  benefit_hash: string;
  change_type: "created";
  change_summary: string;
  effective_start_date: string;
  effective_end_date: null;
  verified_at: string;
  created_at: string;
  source_row_number: number;
};

type CardInsert = {
  id: string;
  issuer: "amex";
  card_code: string;
  card_name: string;
  source_url: string;
  card_status: CardStatus;
};

type BenefitInsert = {
  id: string;
  card_id: string;
  benefit_code: string;
  benefit_name: string;
  benefit_value: string;
  cadence: BenefitCadence;
  reset_timing: string;
  enrollment_required: boolean;
  requires_setup: boolean;
  track_in_memento: TrackInMemento;
  source_url: string;
  notes: string | null;
  benefit_hash: string;
  last_verified_at: string;
};

type BenefitHistoryInsert = {
  id: string;
  benefit_id: string;
  card_id: string;
  benefit_code: string;
  benefit_name: string;
  benefit_value: string;
  cadence: BenefitCadence;
  reset_timing: string;
  enrollment_required: boolean;
  requires_setup: boolean;
  track_in_memento: TrackInMemento;
  source_url: string;
  notes: string | null;
  benefit_hash: string;
  change_type: "created";
  change_summary: string;
  effective_start_date: string;
  effective_end_date: null;
  verified_at: string;
  created_at: string;
};

const REQUIRED_HEADERS = [
  "card_name",
  "benefit_name",
  "benefit_value",
  "cadence",
  "reset_timing",
  "enrollment_required",
  "requires_setup",
  "track_in_memento",
  "source_url",
  "notes",
  "card_status",
] as const;

const DATASET_EFFECTIVE_START_DATE = "2026-01-01";

const CARD_STATUS_VALUES = new Set<CardStatus>([
  "active",
  "no_trackable_benefits",
]);
const CADENCE_VALUES = new Set<BenefitCadence>([
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "multi_year",
  "one_time",
  "per_booking",
]);
const TRACK_VALUES = new Set<TrackInMemento>(["yes", "later", "no"]);
const BOOLEAN_VALUES = new Set(["yes", "no"]);
const PLACEHOLDER_DETAIL_FIELDS = [
  "benefit_name",
  "benefit_value",
  "cadence",
  "reset_timing",
  "enrollment_required",
  "requires_setup",
  "track_in_memento",
  "notes",
] as const;

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

  return {
    headers: rows.shift() ?? [],
    rows,
  };
};

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const normalizeText = (value?: string | null) =>
  (value ?? "").replace(/\s+/g, " ").trim();

const normalizeOptionalText = (value?: string | null) => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

const normalizeUrl = (value?: string | null) => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const slugify = (value: string) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[™®℠]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const cardCodeFor = (cardName: string) => `amex_${slugify(cardName)}`;

const benefitCodeFor = (cardCode: string, benefitName: string) =>
  `${cardCode}_${slugify(benefitName)}`;

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const outputFileNames = [
  "cards.preview.json",
  "benefits.preview.json",
  "benefit_history.preview.json",
  "import_summary.json",
  "validation_errors.json",
  "warnings.json",
] as const;

const getCliArgValue = (flag: string) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

const getCardUrlPriority = (url: string) => {
  if (
    url.includes("/credit-cards/card/") ||
    url.includes("/business/credit-cards/")
  ) {
    return 1;
  }

  if (
    url.includes("/credit-cards/") &&
    !url.includes("credit-intel") &&
    !url.includes("prospect/terms")
  ) {
    return 2;
  }

  if (url.includes("global.americanexpress.com/card-benefits/")) {
    return 3;
  }

  if (
    url.includes("credit-intel") ||
    url.includes("prospect/terms") ||
    url.includes("/benefits/") ||
    url.includes("/articles/") ||
    url.includes("/trends-and-insights/")
  ) {
    return 4;
  }

  return 4;
};

const pickBestCardSourceUrl = (urls: Iterable<string>) =>
  [...urls].sort((left, right) => {
    const priorityDiff = getCardUrlPriority(left) - getCardUrlPriority(right);
    if (priorityDiff !== 0) return priorityDiff;

    const lengthDiff = left.length - right.length;
    if (lengthDiff !== 0) return lengthDiff;

    return left.localeCompare(right);
  })[0];

const assertHeaders = (headers: string[]): string[] => {
  const normalized = headers.map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((header) => !normalized.includes(header));

  if (missing.length > 0) {
    const error = new Error(`Missing required headers: ${missing.join(", ")}`);
    (error as Error & { validationErrors?: ValidationError[] }).validationErrors = [
      {
        type: "missing_headers",
        message: `Missing required headers: ${missing.join(", ")}`,
        details: { missing_headers: missing },
      },
    ];
    throw error;
  }

  return normalized;
};

const rowToRecord = (headers: string[], row: string[], rowNumber: number): RawRow => {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });

  return {
    row_number: rowNumber,
    card_name: normalizeText(record.card_name),
    benefit_name: normalizeOptionalText(record.benefit_name),
    benefit_value: normalizeOptionalText(record.benefit_value),
    cadence: normalizeOptionalText(record.cadence)?.toLowerCase() ?? null,
    reset_timing: normalizeOptionalText(record.reset_timing),
    enrollment_required:
      normalizeOptionalText(record.enrollment_required)?.toLowerCase() ?? null,
    requires_setup:
      normalizeOptionalText(record.requires_setup)?.toLowerCase() ?? null,
    track_in_memento:
      normalizeOptionalText(record.track_in_memento)?.toLowerCase() ?? null,
    source_url: normalizeUrl(record.source_url) ?? "",
    notes: normalizeOptionalText(record.notes),
    card_status: normalizeText(record.card_status).toLowerCase(),
  };
};

const writeJson = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const removeIfExists = async (filePath: string) => {
  await fs.rm(filePath, { force: true });
};

const getDatabaseUrl = () =>
  process.env.DATABASE_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.POSTGRES_URL ??
  null;

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const assertNoExistingCodes = async (
  client: Client,
  cards: CardInsert[],
  benefits: BenefitInsert[],
) => {
  const cardCodes = cards.map((card) => card.card_code);
  const benefitCodes = benefits.map((benefit) => benefit.benefit_code);

  if (cardCodes.length > 0) {
    const result = await client.query<{ card_code: string }>(
      "select card_code from public.cards where card_code = any($1::text[])",
      [cardCodes],
    );

    if (result.rows.length > 0) {
      throw new Error(
        `Commit mode aborted: card_code already exists in database: ${result.rows
          .map((row) => row.card_code)
          .join(", ")}`,
      );
    }
  }

  if (benefitCodes.length > 0) {
    const result = await client.query<{ benefit_code: string }>(
      "select benefit_code from public.benefits where benefit_code = any($1::text[])",
      [benefitCodes],
    );

    if (result.rows.length > 0) {
      throw new Error(
        `Commit mode aborted: benefit_code already exists in database: ${result.rows
          .map((row) => row.benefit_code)
          .join(", ")}`,
      );
    }
  }
};

const commitImport = async (
  cards: CardPreview[],
  benefits: BenefitPreview[],
  benefitHistory: BenefitHistoryPreview[],
) => {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "Missing DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL. Commit mode requires a direct Postgres connection string.",
    );
  }

  const cardIdByCode = new Map<string, string>();
  const benefitIdByCode = new Map<string, string>();

  const cardInserts: CardInsert[] = cards.map((card) => {
    const id = randomUUID();
    cardIdByCode.set(card.card_code, id);
    return {
      id,
      issuer: card.issuer,
      card_code: card.card_code,
      card_name: card.card_name,
      source_url: card.source_url,
      card_status: card.card_status,
    };
  });

  const benefitInserts: BenefitInsert[] = benefits.map((benefit) => {
    const cardId = cardIdByCode.get(benefit.card_code);
    if (!cardId) {
      throw new Error(
        `Commit mode aborted: missing card_id mapping for benefit ${benefit.benefit_code}.`,
      );
    }

    const id = randomUUID();
    benefitIdByCode.set(benefit.benefit_code, id);
    return {
      id,
      card_id: cardId,
      benefit_code: benefit.benefit_code,
      benefit_name: benefit.benefit_name,
      benefit_value: benefit.benefit_value,
      cadence: benefit.cadence,
      reset_timing: benefit.reset_timing,
      enrollment_required: benefit.enrollment_required,
      requires_setup: benefit.requires_setup,
      track_in_memento: benefit.track_in_memento,
      source_url: benefit.source_url,
      notes: benefit.notes,
      benefit_hash: benefit.benefit_hash,
      last_verified_at: benefit.last_verified_at,
    };
  });

  const historyInserts: BenefitHistoryInsert[] = benefitHistory.map((row) => {
    const cardId = cardIdByCode.get(row.card_code);
    const benefitId = benefitIdByCode.get(row.benefit_code);

    if (!cardId || !benefitId) {
      throw new Error(
        `Commit mode aborted: missing foreign key mapping for history row ${row.benefit_code}.`,
      );
    }

    return {
      id: randomUUID(),
      benefit_id: benefitId,
      card_id: cardId,
      benefit_code: row.benefit_code,
      benefit_name: row.benefit_name,
      benefit_value: row.benefit_value,
      cadence: row.cadence,
      reset_timing: row.reset_timing,
      enrollment_required: row.enrollment_required,
      requires_setup: row.requires_setup,
      track_in_memento: row.track_in_memento,
      source_url: row.source_url,
      notes: row.notes,
      benefit_hash: row.benefit_hash,
      change_type: row.change_type,
      change_summary: row.change_summary,
      effective_start_date: row.effective_start_date,
      effective_end_date: row.effective_end_date,
      verified_at: row.verified_at,
      created_at: row.created_at,
    };
  });

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");
    await assertNoExistingCodes(client, cardInserts, benefitInserts);

    for (const batch of chunk(cardInserts, 100)) {
      for (const card of batch) {
        await client.query(
          `
            insert into public.cards (
              id,
              issuer,
              card_code,
              card_name,
              source_url,
              card_status
            ) values ($1, $2, $3, $4, $5, $6)
          `,
          [
            card.id,
            card.issuer,
            card.card_code,
            card.card_name,
            card.source_url,
            card.card_status,
          ],
        );
      }
    }

    for (const batch of chunk(benefitInserts, 100)) {
      for (const benefit of batch) {
        await client.query(
          `
            insert into public.benefits (
              id,
              card_id,
              benefit_code,
              benefit_name,
              benefit_value,
              cadence,
              reset_timing,
              enrollment_required,
              requires_setup,
              track_in_memento,
              source_url,
              notes,
              benefit_hash,
              last_verified_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `,
          [
            benefit.id,
            benefit.card_id,
            benefit.benefit_code,
            benefit.benefit_name,
            benefit.benefit_value,
            benefit.cadence,
            benefit.reset_timing,
            benefit.enrollment_required,
            benefit.requires_setup,
            benefit.track_in_memento,
            benefit.source_url,
            benefit.notes,
            benefit.benefit_hash,
            benefit.last_verified_at,
          ],
        );
      }
    }

    for (const batch of chunk(historyInserts, 100)) {
      for (const row of batch) {
        await client.query(
          `
            insert into public.benefit_history (
              id,
              benefit_id,
              card_id,
              benefit_code,
              benefit_name,
              benefit_value,
              cadence,
              reset_timing,
              enrollment_required,
              requires_setup,
              track_in_memento,
              source_url,
              notes,
              benefit_hash,
              change_type,
              change_summary,
              effective_start_date,
              effective_end_date,
              verified_at,
              created_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          `,
          [
            row.id,
            row.benefit_id,
            row.card_id,
            row.benefit_code,
            row.benefit_name,
            row.benefit_value,
            row.cadence,
            row.reset_timing,
            row.enrollment_required,
            row.requires_setup,
            row.track_in_memento,
            row.source_url,
            row.notes,
            row.benefit_hash,
            row.change_type,
            row.change_summary,
            row.effective_start_date,
            row.effective_end_date,
            row.verified_at,
            row.created_at,
          ],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
};

const main = async () => {
  const commitMode = hasFlag("--commit");
  const explicitInput = getCliArgValue("--input");
  const inputPath = path.resolve(
    process.cwd(),
    explicitInput ?? "amex_cards_and_benefits.csv",
  );
  const outputDir = path.resolve(
    process.cwd(),
    path.join("data", "previews", "memento"),
  );

  console.log(`Using input CSV: ${inputPath}`);

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all(
    outputFileNames.map((fileName) => removeIfExists(path.join(outputDir, fileName))),
  );

  const importRunAt = new Date().toISOString();

  let headers: string[] = [];
  let rawRows: string[][] = [];
  const warnings: Warning[] = [];
  const validationErrors: ValidationError[] = [];

  try {
    const parsed = await parseCsv(inputPath);
    headers = assertHeaders(parsed.headers);
    rawRows = parsed.rows.filter((row) =>
      row.some((value) => value.trim().length > 0),
    );
  } catch (error) {
    const knownErrors =
      error instanceof Error &&
      "validationErrors" in error &&
      Array.isArray((error as Error & { validationErrors?: ValidationError[] }).validationErrors)
        ? (error as Error & { validationErrors?: ValidationError[] }).validationErrors ?? []
        : [];

    const errorsToWrite =
      knownErrors.length > 0
        ? knownErrors
        : [
            {
              type: "missing_headers",
              message:
                error instanceof Error ? error.message : "Failed to parse input CSV.",
            } satisfies ValidationError,
          ];

    await writeJson(path.join(outputDir, "validation_errors.json"), errorsToWrite);
    await writeJson(path.join(outputDir, "import_summary.json"), {
      mode: commitMode ? "commit" : "dry_run",
      status: "failed",
      issuer: "amex",
      input_csv: inputPath,
      output_dir: outputDir,
      import_run_at: importRunAt,
      total_rows: 0,
      active_benefit_rows: 0,
      placeholder_rows: 0,
      cards_count: 0,
      benefits_count: 0,
      benefit_history_count: 0,
      validation_error_count: errorsToWrite.length,
      warning_count: 0,
    });
    throw error;
  }

  const rows = rawRows.map((row, index) => rowToRecord(headers, row, index + 2));
  const cardsByCode = new Map<
    string,
    {
      card: CardPreview;
      sourceUrls: Set<string>;
      normalizedCardName: string;
    }
  >();
  const benefitCodes = new Map<string, number[]>();
  const cardCodeIdentity = new Map<
    string,
    { normalizedCardName: string; rowNumbers: number[] }
  >();
  const activeRows: RawRow[] = [];
  let placeholderRowCount = 0;

  for (const row of rows) {
    if (!row.card_name) {
      validationErrors.push({
        type: "missing_required_field",
        message: "Missing required field card_name.",
        row_numbers: [row.row_number],
        field: "card_name",
      });
    }

    if (!row.source_url) {
      validationErrors.push({
        type: "missing_required_field",
        message: "Missing required field source_url.",
        row_numbers: [row.row_number],
        field: "source_url",
      });
    }

    if (!row.card_status) {
      validationErrors.push({
        type: "missing_required_field",
        message: "Missing required field card_status.",
        row_numbers: [row.row_number],
        field: "card_status",
      });
      continue;
    }

    if (!CARD_STATUS_VALUES.has(row.card_status as CardStatus)) {
      validationErrors.push({
        type: "invalid_enum",
        message: `Invalid card_status "${row.card_status}".`,
        row_numbers: [row.row_number],
        field: "card_status",
        value: row.card_status,
      });
      continue;
    }

    const cardStatus = row.card_status as CardStatus;
    const cardCode = cardCodeFor(row.card_name);
    const cardIdentity = cardCodeIdentity.get(cardCode);
    if (cardIdentity) {
      if (cardIdentity.normalizedCardName !== row.card_name) {
        validationErrors.push({
          type: "card_code_collision",
          message: `Generated card_code "${cardCode}" collides across distinct card names.`,
          row_numbers: [...cardIdentity.rowNumbers, row.row_number],
          details: {
            existing_card_name: cardIdentity.normalizedCardName,
            incoming_card_name: row.card_name,
            card_code: cardCode,
          },
        });
      } else {
        cardIdentity.rowNumbers.push(row.row_number);
      }
    } else {
      cardCodeIdentity.set(cardCode, {
        normalizedCardName: row.card_name,
        rowNumbers: [row.row_number],
      });
    }

    const existingCard = cardsByCode.get(cardCode);
    if (existingCard) {
      if (existingCard.card.card_status !== cardStatus) {
        validationErrors.push({
          type: "conflicting_card_status",
          message: `Conflicting card_status values for card_code "${cardCode}".`,
          row_numbers: [...existingCard.card.source_row_numbers, row.row_number],
          details: {
            card_code: cardCode,
            existing_card_status: existingCard.card.card_status,
            incoming_card_status: cardStatus,
          },
        });
      }

      existingCard.card.source_row_numbers.push(row.row_number);
      existingCard.sourceUrls.add(row.source_url);
    } else {
      cardsByCode.set(cardCode, {
        card: {
          issuer: "amex",
          card_code: cardCode,
          card_name: row.card_name,
          source_url: row.source_url,
          card_status: cardStatus,
          source_row_numbers: [row.row_number],
        },
        sourceUrls: new Set([row.source_url]),
        normalizedCardName: row.card_name,
      });
    }

    if (cardStatus === "no_trackable_benefits") {
      placeholderRowCount += 1;
      const discardedFields = PLACEHOLDER_DETAIL_FIELDS.filter((field) => {
        const value = row[field];
        return typeof value === "string" ? value.length > 0 : value !== null;
      });

      if (discardedFields.length > 0) {
        warnings.push({
          type: "placeholder_detail_fields_discarded",
          message:
            "Placeholder row contained benefit-detail fields that were discarded.",
          row_numbers: [row.row_number],
          details: {
            card_code: cardCode,
            discarded_fields: discardedFields,
          },
        });
      }

      continue;
    }

    const activeMissingFields: Array<keyof RawRow> = [];
    if (!row.benefit_name) activeMissingFields.push("benefit_name");
    if (!row.benefit_value) activeMissingFields.push("benefit_value");
    if (!row.cadence) activeMissingFields.push("cadence");
    if (!row.reset_timing) activeMissingFields.push("reset_timing");
    if (!row.enrollment_required) activeMissingFields.push("enrollment_required");
    if (!row.requires_setup) activeMissingFields.push("requires_setup");
    if (!row.track_in_memento) activeMissingFields.push("track_in_memento");

    if (activeMissingFields.length > 0) {
      validationErrors.push({
        type: "active_row_missing_benefit_fields",
        message: `Active benefit row is missing required benefit fields: ${activeMissingFields.join(", ")}.`,
        row_numbers: [row.row_number],
        details: { missing_fields: activeMissingFields },
      });
      continue;
    }

    if (!CADENCE_VALUES.has(row.cadence as BenefitCadence)) {
      validationErrors.push({
        type: "invalid_enum",
        message: `Invalid cadence "${row.cadence}".`,
        row_numbers: [row.row_number],
        field: "cadence",
        value: row.cadence,
      });
    }

    if (!TRACK_VALUES.has(row.track_in_memento as TrackInMemento)) {
      validationErrors.push({
        type: "invalid_enum",
        message: `Invalid track_in_memento "${row.track_in_memento}".`,
        row_numbers: [row.row_number],
        field: "track_in_memento",
        value: row.track_in_memento,
      });
    }

    if (!BOOLEAN_VALUES.has(row.enrollment_required)) {
      validationErrors.push({
        type: "invalid_boolean",
        message: `Invalid enrollment_required "${row.enrollment_required}". Expected yes or no.`,
        row_numbers: [row.row_number],
        field: "enrollment_required",
        value: row.enrollment_required,
      });
    }

    if (!BOOLEAN_VALUES.has(row.requires_setup)) {
      validationErrors.push({
        type: "invalid_boolean",
        message: `Invalid requires_setup "${row.requires_setup}". Expected yes or no.`,
        row_numbers: [row.row_number],
        field: "requires_setup",
        value: row.requires_setup,
      });
    }

    activeRows.push(row);
  }

  for (const [cardCode, entry] of cardsByCode) {
    const bestSourceUrl = pickBestCardSourceUrl(entry.sourceUrls);
    if (bestSourceUrl) {
      entry.card.source_url = bestSourceUrl;
    }

    const hasCanonicalCardUrl = [...entry.sourceUrls].some((url) => {
      const priority = getCardUrlPriority(url);
      return priority === 1 || priority === 2;
    });

    if (!hasCanonicalCardUrl) {
      warnings.push({
        type: "no_canonical_card_url_found",
        message:
          "No Priority 1 or Priority 2 card-level URL was found for this card.",
        row_numbers: entry.card.source_row_numbers,
        details: {
          card_code: cardCode,
          retained_source_url: entry.card.source_url,
          observed_source_urls: [...entry.sourceUrls],
        },
      });
    }

    if (entry.sourceUrls.size > 1) {
      warnings.push({
        type: "multiple_card_source_urls",
        message:
          "Multiple source_url values were observed for the same card; the highest-ranked URL was retained for the card preview.",
        row_numbers: entry.card.source_row_numbers,
        details: {
          card_code: cardCode,
          retained_source_url: entry.card.source_url,
          observed_source_urls: [...entry.sourceUrls],
        },
      });
    }
  }

  const benefits: BenefitPreview[] = [];
  const benefitHistory: BenefitHistoryPreview[] = [];

  for (const row of activeRows) {
    if (
      !row.benefit_name ||
      !row.benefit_value ||
      !row.cadence ||
      !row.reset_timing ||
      !row.enrollment_required ||
      !row.requires_setup ||
      !row.track_in_memento
    ) {
      continue;
    }

    if (
      !CADENCE_VALUES.has(row.cadence as BenefitCadence) ||
      !TRACK_VALUES.has(row.track_in_memento as TrackInMemento) ||
      !BOOLEAN_VALUES.has(row.enrollment_required) ||
      !BOOLEAN_VALUES.has(row.requires_setup)
    ) {
      continue;
    }

    const cardCode = cardCodeFor(row.card_name);
    const card = cardsByCode.get(cardCode)?.card;

    if (!card) {
      validationErrors.push({
        type: "unresolved_card",
        message: `Benefit row could not resolve an extracted card for card_code "${cardCode}".`,
        row_numbers: [row.row_number],
        details: { card_code: cardCode, card_name: row.card_name },
      });
      continue;
    }

    const benefitCode = benefitCodeFor(cardCode, row.benefit_name);
    const seenRows = benefitCodes.get(benefitCode) ?? [];
    seenRows.push(row.row_number);
    benefitCodes.set(benefitCode, seenRows);

    const enrollmentRequired = row.enrollment_required === "yes";
    const requiresSetup = row.requires_setup === "yes";
    const hashInput = [
      benefitCode,
      row.benefit_value,
      row.cadence,
      row.reset_timing,
      String(enrollmentRequired),
      String(requiresSetup),
      row.track_in_memento,
    ].join("|");
    const benefitHash = sha256(hashInput);

    benefits.push({
      issuer: "amex",
      card_code: cardCode,
      benefit_code: benefitCode,
      benefit_name: row.benefit_name,
      benefit_value: row.benefit_value,
      cadence: row.cadence as BenefitCadence,
      reset_timing: row.reset_timing,
      enrollment_required: enrollmentRequired,
      requires_setup: requiresSetup,
      track_in_memento: row.track_in_memento as TrackInMemento,
      source_url: row.source_url,
      notes: row.notes,
      benefit_hash: benefitHash,
      last_verified_at: importRunAt,
      source_row_number: row.row_number,
    });

    benefitHistory.push({
      card_code: cardCode,
      benefit_code: benefitCode,
      benefit_name: row.benefit_name,
      benefit_value: row.benefit_value,
      cadence: row.cadence as BenefitCadence,
      reset_timing: row.reset_timing,
      enrollment_required: enrollmentRequired,
      requires_setup: requiresSetup,
      track_in_memento: row.track_in_memento as TrackInMemento,
      source_url: row.source_url,
      notes: row.notes,
      benefit_hash: benefitHash,
      change_type: "created",
      change_summary: "Initial import snapshot",
      effective_start_date: DATASET_EFFECTIVE_START_DATE,
      effective_end_date: null,
      verified_at: importRunAt,
      created_at: importRunAt,
      source_row_number: row.row_number,
    });
  }

  for (const [benefitCode, rowNumbers] of benefitCodes) {
    if (rowNumbers.length > 1) {
      validationErrors.push({
        type: "benefit_code_collision",
        message: `Generated benefit_code "${benefitCode}" collides across multiple rows.`,
        row_numbers: rowNumbers,
        details: { benefit_code: benefitCode },
      });
    }
  }

  if (validationErrors.length > 0) {
    await writeJson(path.join(outputDir, "validation_errors.json"), validationErrors);
    if (warnings.length > 0) {
      await writeJson(path.join(outputDir, "warnings.json"), warnings);
    }
    await writeJson(path.join(outputDir, "import_summary.json"), {
      mode: commitMode ? "commit" : "dry_run",
      status: "failed",
      issuer: "amex",
      input_csv: inputPath,
      output_dir: outputDir,
      import_run_at: importRunAt,
      total_rows: rows.length,
      active_benefit_rows: activeRows.length,
      placeholder_rows: placeholderRowCount,
      cards_count: cardsByCode.size,
      benefits_count: benefits.length,
      benefit_history_count: benefitHistory.length,
      validation_error_count: validationErrors.length,
      warning_count: warnings.length,
    });
    throw new Error(
      `Dry run failed with ${validationErrors.length} validation error(s). See ${path.join(outputDir, "validation_errors.json")}.`,
    );
  }

  const cards = [...cardsByCode.values()]
    .map((entry) => entry.card)
    .sort((a, b) => a.card_code.localeCompare(b.card_code));
  const sortedBenefits = benefits.sort((a, b) =>
    a.benefit_code.localeCompare(b.benefit_code),
  );
  const sortedHistory = benefitHistory.sort((a, b) =>
    a.benefit_code.localeCompare(b.benefit_code),
  );

  await writeJson(path.join(outputDir, "cards.preview.json"), cards);
  await writeJson(path.join(outputDir, "benefits.preview.json"), sortedBenefits);
  await writeJson(
    path.join(outputDir, "benefit_history.preview.json"),
    sortedHistory,
  );
  await writeJson(path.join(outputDir, "import_summary.json"), {
    mode: commitMode ? "commit" : "dry_run",
    status: "ok",
    issuer: "amex",
    input_csv: inputPath,
    output_dir: outputDir,
    import_run_at: importRunAt,
    total_rows: rows.length,
    active_benefit_rows: activeRows.length,
    placeholder_rows: placeholderRowCount,
    cards_count: cards.length,
    benefits_count: sortedBenefits.length,
    benefit_history_count: sortedHistory.length,
    validation_error_count: 0,
    warning_count: warnings.length,
  });

  if (warnings.length > 0) {
    await writeJson(path.join(outputDir, "warnings.json"), warnings);
  }

  if (commitMode) {
    await commitImport(cards, sortedBenefits, sortedHistory);
  }

  console.log(
    commitMode ? "Memento commit completed." : "Memento dry run completed.",
  );
  console.log(`- Input CSV: ${inputPath}`);
  console.log(`- Output dir: ${outputDir}`);
  console.log(`- Cards: ${cards.length}`);
  console.log(`- Benefits: ${sortedBenefits.length}`);
  console.log(`- Benefit history rows: ${sortedHistory.length}`);
  console.log(`- Warnings: ${warnings.length}`);
  if (commitMode) {
    console.log("- Database writes: committed in a single transaction");
  }
};

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Memento dry run failed.",
  );
  process.exit(1);
});
