import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildMonthlyDigest,
  DIGEST_SECTION_ORDER,
  getDigestConsideredBenefits,
  getDigestEligibleBenefits,
  getDigestSectionsForMonth,
  type DigestSection,
  type MonthlyDigest,
} from "@/lib/reminders/monthly-digest";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type DigestItem = {
  cardDisplayName: string;
  benefitDisplayName: string;
  valueCents: number | null;
  notes: string | null;
};

type UserDigestPayload = Record<DigestSection, DigestItem[]>;

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

const isValidYYYYMMDD = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getUtcTodayISO = (value: Date = new Date()) => value.toISOString().slice(0, 10);

const safeErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 300);
  }
  return "unknown_error";
};

const toUtcDateOnly = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const toUtcMonthStart = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

const buildSubject = (sections: DigestSection[]) => {
  const sectionTitles = sections.map((section) => section[0].toUpperCase() + section.slice(1));
  return `Your card benefits reminder digest (${sectionTitles.join(", ")})`;
};

const toPayload = (digest: MonthlyDigest): UserDigestPayload => ({
  monthly: digest.sections.monthly.map((item) => ({
    cardDisplayName: item.cardDisplayName,
    benefitDisplayName: item.benefitDisplayName,
    valueCents: item.valueCents,
    notes: item.notes,
  })),
  quarterly: digest.sections.quarterly.map((item) => ({
    cardDisplayName: item.cardDisplayName,
    benefitDisplayName: item.benefitDisplayName,
    valueCents: item.valueCents,
    notes: item.notes,
  })),
  semiannual: digest.sections.semiannual.map((item) => ({
    cardDisplayName: item.cardDisplayName,
    benefitDisplayName: item.benefitDisplayName,
    valueCents: item.valueCents,
    notes: item.notes,
  })),
  annual: digest.sections.annual.map((item) => ({
    cardDisplayName: item.cardDisplayName,
    benefitDisplayName: item.benefitDisplayName,
    valueCents: item.valueCents,
    notes: item.notes,
  })),
});

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

const resolveRecipientEmail = async ({
  supabase,
  userId,
  emailToOverride,
}: {
  supabase: ReturnType<typeof getServiceRoleSupabaseClient>;
  userId: string;
  emailToOverride: string | null;
}): Promise<string> => {
  if (emailToOverride) {
    return emailToOverride;
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) {
    throw new Error("resolve_user_email_failed");
  }

  const userEmail = userData.user?.email;
  if (!userEmail) {
    throw new Error("resolve_user_email_failed");
  }

  return userEmail;
};

const sendDigestEmail = async ({
  resend,
  toEmail,
  emailFrom,
  subject,
  payload,
  sections,
}: {
  resend: Resend;
  toEmail: string;
  emailFrom: string;
  subject: string;
  payload: UserDigestPayload;
  sections: DigestSection[];
}): Promise<{ providerMessageId: string | null }> => {
  const { data, error } = await resend.emails.send({
    from: emailFrom,
    to: [toEmail],
    subject,
    text: renderDigestText(payload, sections),
    html: renderDigestHtml(payload, sections),
  });

  if (error) {
    throw new Error("provider_send_failed");
  }

  return { providerMessageId: data?.id ?? null };
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const todayParam = requestUrl.searchParams.get("today");
  const vercelEnv = process.env.VERCEL_ENV ?? null;
  const bearerToken = parseBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || bearerToken !== cronSecret) {
    return NextResponse.json(
      { version: "cron-digest-v3", vercelEnv, todayParam, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let supabase: ReturnType<typeof getServiceRoleSupabaseClient>;
  try {
    supabase = getServiceRoleSupabaseClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown service client configuration error";
    console.error("Missing Supabase env vars for digest cron", { error: errorMessage });
    return NextResponse.json(
      { version: "cron-digest-v3", vercelEnv, todayParam, error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const runId = randomUUID();
  const dryRun = requestUrl.searchParams.get("dryRun") === "1";
  let todayISO = getUtcTodayISO();
  const allowTodayOverride =
    typeof vercelEnv === "string" ? vercelEnv !== "production" : process.env.NODE_ENV !== "production";

  if (allowTodayOverride && todayParam !== null) {
    if (!isValidYYYYMMDD(todayParam)) {
      return NextResponse.json(
        { version: "cron-digest-v3", vercelEnv, todayParam, error: "Invalid today. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }
    todayISO = todayParam;
  }

  const nowUtc = new Date();
  const monthStart = toUtcMonthStart(toUtcDateOnly(new Date(`${todayISO}T00:00:00.000Z`)));
  const monthKey = dateKey(monthStart).slice(0, 7);
  const monthStartISO = dateKey(monthStart);
  const dueSections = getDigestSectionsForMonth(monthStart);
  const emailToOverride = process.env.EMAIL_TO_OVERRIDE?.trim() || null;
  const toOverride = emailToOverride !== null;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const emailFrom = process.env.EMAIL_FROM || "Memento <onboarding@resend.dev>";

  let consideredBenefits;
  try {
    consideredBenefits = await getDigestConsideredBenefits({
      monthStart,
      supabase,
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    console.error("Failed to fetch considered digest candidates", { error: errorMessage, runId, monthKey });
    return NextResponse.json(
      { version: "cron-digest-v3", vercelEnv, todayParam, error: "Failed to fetch digest candidates", runId, monthKey },
      { status: 500 },
    );
  }

  let eligibleBenefits;
  try {
    eligibleBenefits = await getDigestEligibleBenefits({
      monthStart,
      supabase,
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    console.error("Failed to fetch eligible digest benefits", { error: errorMessage, runId, monthKey });
    return NextResponse.json(
      { version: "cron-digest-v3", vercelEnv, todayParam, error: "Failed to fetch eligible digest users", runId, monthKey },
      { status: 500 },
    );
  }

  const usersConsidered = new Set(consideredBenefits.map((benefit) => benefit.userId)).size;
  const digestsByUser = buildMonthlyDigest(eligibleBenefits, monthStart);

  let sentCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;
  let attemptedCount = 0;
  let missingResendKey = false;
  const attemptedSends: Array<{ userId: string; toEmailUsed: string | null; status: "sent" | "failed" }> = [];

  for (const [userId, digest] of digestsByUser.entries()) {
    const populatedSections = DIGEST_SECTION_ORDER.filter((section) => digest.sections[section].length > 0);
    if (populatedSections.length === 0) {
      continue;
    }

    const payload = toPayload(digest);
    const dedupeKey = `${userId}:${digest.monthKey}`;
    const subject = buildSubject(populatedSections);

    const { data: insertedLog, error: insertError } = await supabase
      .from("email_send_log")
      .insert({
        user_id: userId,
        run_id: runId,
        send_date: monthStartISO,
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
        monthKey,
        code: insertError.code,
        message: insertError.message,
      });
      continue;
    }

    const logId = insertedLog?.id as string | undefined;
    attemptedCount += 1;

    let toEmailUsed = emailToOverride ?? "unresolved";
    try {
      toEmailUsed = await resolveRecipientEmail({
        supabase,
        userId,
        emailToOverride,
      });
      console.info("[digest] resolved recipient", { userId, toEmailUsed, toOverride, monthKey });

      let providerMessageId: string | null = null;
      if (!dryRun) {
        const resendClient = resend;
        if (!resendClient) {
          missingResendKey = true;
          throw new Error("missing_resend_api_key");
        }
        const sendResult = await sendDigestEmail({
          resend: resendClient,
          toEmail: toEmailUsed,
          emailFrom,
          subject,
          payload,
          sections: populatedSections,
        });
        providerMessageId = sendResult.providerMessageId;
      }

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
            monthKey,
            code: markSentError.code,
            message: markSentError.message,
          });
          continue;
        }
      }

      attemptedSends.push({ userId, toEmailUsed: toOverride ? toEmailUsed : null, status: "sent" });
      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      const errorMessage = safeErrorMessage(error);
      attemptedSends.push({ userId, toEmailUsed: toOverride ? toEmailUsed : null, status: "failed" });

      if (logId) {
        await supabase
          .from("email_send_log")
          .update({
            status: "failed",
            provider_message_id: null,
            error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      console.error("Failed to send digest email", {
        userId,
        runId,
        monthKey,
        error: errorMessage,
      });
    }
  }

  const responseBody = {
    version: "cron-digest-v3",
    vercelEnv,
    todayParam,
    runId,
    todayISO,
    monthKey,
    monthStartISO,
    dryRun,
    dueSections,
    toOverride,
    counts: {
      eligible: digestsByUser.size,
      attempted: attemptedCount,
      sent: sentCount,
      skipped_dedupe: dedupedCount,
      failed: failedCount,
    },
    attemptedSends,
    usersConsidered,
    usersEligible: digestsByUser.size,
    sentCount,
    dedupedCount,
    failedCount,
  };

  if (missingResendKey) {
    return NextResponse.json(
      {
        ...responseBody,
        error: "Email provider is not configured for live sends.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(responseBody);
}
