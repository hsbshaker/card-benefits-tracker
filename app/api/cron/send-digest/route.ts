import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type DigestSection = "monthly" | "quarterly" | "semiannual" | "annual";

type BenefitRecord = {
  display_name: string;
  cadence: string;
  value_cents: number | null;
  notes: string | null;
  cards: {
    issuer: string;
    card_name: string;
  } | null;
};

type DigestUserRow = {
  user_id: string;
  benefits: BenefitRecord | BenefitRecord[] | null;
};

type DigestItem = {
  cardDisplayName: string;
  benefitDisplayName: string;
  valueCents: number | null;
  notes: string | null;
};

type UserDigestPayload = Record<DigestSection, DigestItem[]>;

const CADENCE_BY_SECTION: Record<DigestSection, string[]> = {
  monthly: ["monthly"],
  quarterly: ["quarterly"],
  semiannual: ["semi_annual", "semiannual"],
  annual: ["annual"],
};

const OFFSETS_BY_SECTION: Record<DigestSection, number[]> = {
  monthly: [7],
  quarterly: [14, 7],
  semiannual: [14, 7],
  annual: [60, 30, 14],
};

const SECTION_ORDER: DigestSection[] = ["monthly", "quarterly", "semiannual", "annual"];

const parseBearerToken = (header: string | null) => {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
};

const toUtcDateOnly = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addUtcDays = (value: Date, days: number) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days));

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

const endOfMonthUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));

const endOfQuarterUtc = (value: Date) => {
  const quarterEndMonth = Math.floor(value.getUTCMonth() / 3) * 3 + 2;
  return new Date(Date.UTC(value.getUTCFullYear(), quarterEndMonth + 1, 0));
};

const endOfSemiannualUtc = (todayUtcDateOnly: Date) => {
  const year = todayUtcDateOnly.getUTCFullYear();
  const jun30 = new Date(Date.UTC(year, 5, 30));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  return todayUtcDateOnly.getTime() < jun30.getTime() ? jun30 : dec31;
};

const endOfYearUtc = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), 11, 31));

const dueSectionsToday = (nowUtc: Date): DigestSection[] => {
  const todayUtcDateOnly = toUtcDateOnly(nowUtc);
  const todayKey = dateKey(todayUtcDateOnly);

  const boundaries: Record<DigestSection, Date> = {
    monthly: endOfMonthUtc(todayUtcDateOnly),
    quarterly: endOfQuarterUtc(todayUtcDateOnly),
    semiannual: endOfSemiannualUtc(todayUtcDateOnly),
    annual: endOfYearUtc(todayUtcDateOnly),
  };

  return SECTION_ORDER.filter((section) => {
    const boundary = boundaries[section];
    return OFFSETS_BY_SECTION[section].some((offsetDays) => {
      const sendDate = addUtcDays(boundary, -offsetDays);
      return dateKey(sendDate) === todayKey;
    });
  });
};

const cadenceToSection = (cadence: string): DigestSection | null => {
  if (CADENCE_BY_SECTION.monthly.includes(cadence)) return "monthly";
  if (CADENCE_BY_SECTION.quarterly.includes(cadence)) return "quarterly";
  if (CADENCE_BY_SECTION.semiannual.includes(cadence)) return "semiannual";
  if (CADENCE_BY_SECTION.annual.includes(cadence)) return "annual";
  return null;
};

const buildSubject = (sections: DigestSection[]) => {
  const sectionTitles = sections.map((section) => section[0].toUpperCase() + section.slice(1));
  return `Your card benefits reminder digest (${sectionTitles.join(", ")})`;
};

const renderDigestText = (payload: UserDigestPayload, sections: DigestSection[]) => {
  const lines: string[] = ["You have upcoming card benefit deadlines:", ""];

  for (const section of sections) {
    const title = section[0].toUpperCase() + section.slice(1);
    lines.push(`${title}:`);
    for (const item of payload[section]) {
      const value = typeof item.valueCents === "number" ? ` ($${(item.valueCents / 100).toFixed(2)})` : "";
      const notes = item.notes ? ` - ${item.notes}` : "";
      lines.push(`- ${item.cardDisplayName}: ${item.benefitDisplayName}${value}${notes}`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

const renderDigestHtml = (payload: UserDigestPayload, sections: DigestSection[]) => {
  const sectionHtml = sections
    .map((section) => {
      const title = section[0].toUpperCase() + section.slice(1);
      const items = payload[section]
        .map((item) => {
          const value = typeof item.valueCents === "number" ? ` ($${(item.valueCents / 100).toFixed(2)})` : "";
          const notes = item.notes ? ` - ${item.notes}` : "";
          return `<li><strong>${item.cardDisplayName}</strong>: ${item.benefitDisplayName}${value}${notes}</li>`;
        })
        .join("");
      return `<h3>${title}</h3><ul>${items}</ul>`;
    })
    .join("");

  return `<p>You have upcoming card benefit deadlines:</p>${sectionHtml}`;
};

const sendDigestEmail = async ({
  supabase,
  userId,
  subject,
  payload,
  sections,
}: {
  supabase: ReturnType<typeof getServiceRoleSupabaseClient>;
  userId: string;
  subject: string;
  payload: UserDigestPayload;
  sections: DigestSection[];
}): Promise<{ providerMessageId: string | null }> => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    console.info("[digest] would send email", {
      userId,
      subject,
      sections,
      itemCount: sections.reduce((sum, section) => sum + payload[section].length, 0),
    });
    return { providerMessageId: null };
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) {
    throw new Error(`resolve_user_email_failed: ${userError.message}`);
  }

  const toEmail = process.env.EMAIL_TO_OVERRIDE || userData.user?.email;
  if (!toEmail) {
    throw new Error("resolve_user_email_failed: missing_email");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [toEmail],
      subject,
      text: renderDigestText(payload, sections),
      html: renderDigestHtml(payload, sections),
    }),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`provider_send_failed:${response.status}:${responseBody}`);
  }

  let parsed: { id?: string } = {};
  try {
    parsed = JSON.parse(responseBody) as { id?: string };
  } catch {
    parsed = {};
  }

  return { providerMessageId: parsed.id ?? null };
};

export async function GET(request: Request) {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || bearerToken !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getServiceRoleSupabaseClient>;
  try {
    supabase = getServiceRoleSupabaseClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown service client configuration error";
    console.error("Missing Supabase env vars for digest cron", { error: errorMessage });
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const runId = randomUUID();
  const nowUtc = new Date();
  const todayUtcDateOnly = toUtcDateOnly(nowUtc);
  const todayUtcKey = dateKey(todayUtcDateOnly);
  const dueSections = dueSectionsToday(nowUtc);

  if (dueSections.length === 0) {
    return NextResponse.json({
      runId,
      dueSections,
      usersConsidered: 0,
      usersEligible: 0,
      sentCount: 0,
      dedupedCount: 0,
      failedCount: 0,
    });
  }

  const dueCadences = dueSections.flatMap((section) => CADENCE_BY_SECTION[section]);

  const selectExpr =
    "user_id, benefits!inner(display_name,cadence,value_cents,notes,cards!inner(issuer,card_name))";

  const { data: consideredRows, error: consideredError } = await supabase
    .from("user_benefits")
    .select(selectExpr)
    .eq("remind_me", true)
    .in("benefits.cadence", dueCadences)
    .returns<DigestUserRow[]>();

  if (consideredError) {
    console.error("Failed to fetch considered digest users", {
      code: consideredError.code,
      message: consideredError.message,
      details: consideredError.details,
      hint: consideredError.hint,
      runId,
    });
    return NextResponse.json({ error: "Failed to fetch digest candidates", runId }, { status: 500 });
  }

  const usersConsidered = new Set((consideredRows ?? []).map((row) => row.user_id)).size;

  const { data: eligibleRows, error: eligibleError } = await supabase
    .from("user_benefits")
    .select(selectExpr)
    .eq("remind_me", true)
    .eq("used", false)
    .in("benefits.cadence", dueCadences)
    .returns<DigestUserRow[]>();

  if (eligibleError) {
    console.error("Failed to fetch eligible digest users", {
      code: eligibleError.code,
      message: eligibleError.message,
      details: eligibleError.details,
      hint: eligibleError.hint,
      runId,
    });
    return NextResponse.json({ error: "Failed to fetch eligible digest users", runId }, { status: 500 });
  }

  const payloadByUser = new Map<string, UserDigestPayload>();

  for (const row of eligibleRows ?? []) {
    const benefitRows = Array.isArray(row.benefits) ? row.benefits : row.benefits ? [row.benefits] : [];
    for (const benefit of benefitRows) {
      const cadence = benefit.cadence;
      if (!cadence) {
        continue;
      }

      const section = cadenceToSection(cadence);
      if (!section || !dueSections.includes(section)) {
        continue;
      }

      const card = benefit.cards;
      const cardDisplayName = card ? `${card.issuer} ${card.card_name}` : "Unknown Card";
      const item: DigestItem = {
        cardDisplayName,
        benefitDisplayName: benefit.display_name ?? "Unnamed Benefit",
        valueCents: benefit.value_cents ?? null,
        notes: benefit.notes ?? null,
      };

      if (!payloadByUser.has(row.user_id)) {
        payloadByUser.set(row.user_id, {
          monthly: [],
          quarterly: [],
          semiannual: [],
          annual: [],
        });
      }

      payloadByUser.get(row.user_id)?.[section].push(item);
    }
  }

  let sentCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  for (const [userId, payload] of payloadByUser.entries()) {
    const populatedSections = SECTION_ORDER.filter((section) => payload[section].length > 0);
    if (populatedSections.length === 0) {
      continue;
    }

    const dedupeKey = `${userId}:${todayUtcKey}`;
    const subject = buildSubject(populatedSections);

    const { data: insertedLog, error: insertError } = await supabase
      .from("email_send_log")
      .insert({
        user_id: userId,
        run_id: runId,
        send_date: todayUtcKey,
        dedupe_key: dedupeKey,
        status: "attempted",
        planned_send_at: nowUtc.toISOString(),
        subject,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        dedupedCount += 1;
        continue;
      }

      failedCount += 1;
      console.error("Failed to claim email_send_log row", {
        userId,
        runId,
        code: insertError.code,
        message: insertError.message,
      });
      continue;
    }

    const logId = insertedLog?.id as string | undefined;

    try {
      const { providerMessageId } = await sendDigestEmail({
        supabase,
        userId,
        subject,
        payload,
        sections: populatedSections,
      });

      if (logId) {
        const { error: markSentError } = await supabase
          .from("email_send_log")
          .update({
            status: "sent",
            provider_message_id: providerMessageId,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", logId);

        if (markSentError) {
          failedCount += 1;
          console.error("Failed to mark email_send_log as sent", {
            userId,
            logId,
            runId,
            code: markSentError.code,
            message: markSentError.message,
          });
          continue;
        }
      }

      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      const errorMessage = error instanceof Error ? error.message : "unknown_send_error";

      if (logId) {
        await supabase
          .from("email_send_log")
          .update({
            status: "failed",
            error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      console.error("Failed to send digest email", {
        userId,
        runId,
        error: errorMessage,
      });
    }
  }

  return NextResponse.json({
    runId,
    dueSections,
    usersConsidered,
    usersEligible: payloadByUser.size,
    sentCount,
    dedupedCount,
    failedCount,
  });
}
