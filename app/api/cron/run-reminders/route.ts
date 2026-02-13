import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Reminder Cron Runner (MVP)
 *
 * Required env vars (set in Vercel Project Settings, never commit secrets):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - CRON_SECRET
 * Optional test-only env var (default off):
 * - SIMULATE_ADVANCE_RACE=1
 *
 * Local test example:
 * curl -i -X GET http://localhost:3000/api/cron/run-reminders \
 *   -H "Authorization: Bearer $CRON_SECRET"
 *
 * This endpoint requires Authorization: Bearer <CRON_SECRET>.
 * For Vercel Cron, when CRON_SECRET is set in Vercel Project Settings,
 * cron invocations include that Authorization header automatically.
 * For local testing, pass the Authorization header manually.
 */

type Cadence = "monthly" | "quarterly" | "annual";

type DueSchedule = {
  id: string;
  user_id: string;
  card_id: string;
  benefit_id: string;
  cadence: Cadence | string;
  next_send_at: string;
};

const BATCH_LIMIT = 50;
const MAX_RUNTIME_MS = 8_000;

const daysInUtcMonth = (year: number, monthIndex0: number) =>
  new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();

const addMonthsUtcClamped = (value: Date, monthsToAdd: number) => {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();

  const targetMonthTotal = month + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthTotal / 12);
  const targetMonth = targetMonthTotal % 12;
  const targetDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
};

const computeNextSendAt = (planned: Date, cadence: string) => {
  switch (cadence) {
    case "monthly":
      return addMonthsUtcClamped(planned, 1);
    case "quarterly":
      return addMonthsUtcClamped(planned, 3);
    case "annual":
      return addMonthsUtcClamped(planned, 12);
    default:
      throw new Error(`Unsupported cadence: ${cadence}`);
  }
};

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

export async function GET(request: Request) {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || bearerToken !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase env vars for reminder cron");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = randomUUID();
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();

  const { data: dueSchedules, error: fetchError } = await supabase
    .from("reminder_schedules")
    .select("id,user_id,card_id,benefit_id,cadence,next_send_at")
    .eq("enabled", true)
    // Defensive filter in case of corrupted legacy data.
    .not("card_id", "is", null)
    .lte("next_send_at", nowIso)
    .order("next_send_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    console.error("Failed to fetch due reminder schedules", {
      code: fetchError.code,
      message: fetchError.message,
      details: fetchError.details,
      hint: fetchError.hint,
      runId,
    });
    return NextResponse.json({ error: "Failed to fetch due schedules", runId }, { status: 500 });
  }

  const schedules = (dueSchedules ?? []) as DueSchedule[];

  let claimed = 0;
  let deduped = 0;
  let sent = 0;
  let advanced = 0;
  let truncated = false;

  for (let i = 0; i < schedules.length; i += 1) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) {
      truncated = true;
      break;
    }

    const schedule = schedules[i];
    const planned = new Date(schedule.next_send_at);

    if (Number.isNaN(planned.getTime())) {
      console.error("Invalid next_send_at on schedule", {
        scheduleId: schedule.id,
        next_send_at: schedule.next_send_at,
        runId,
      });
      continue;
    }

    const utcDate = planned.toISOString().slice(0, 10);
    const dedupeKey = `${schedule.id}:${utcDate}`;

    const { data: insertedLog, error: insertError } = await supabase
      .from("reminder_send_log")
      .insert({
        schedule_id: schedule.id,
        user_id: schedule.user_id,
        card_id: schedule.card_id,
        benefit_id: schedule.benefit_id,
        run_id: runId,
        dedupe_key: dedupeKey,
        planned_send_at: planned.toISOString(),
        status: "attempted",
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        deduped += 1;
        continue;
      }

      const failedDedupeKey = `${dedupeKey}:error:${runId.slice(0, 8)}:${i}`;
      const { error: fallbackInsertError } = await supabase.from("reminder_send_log").insert({
        schedule_id: schedule.id,
        user_id: schedule.user_id,
        card_id: schedule.card_id,
        benefit_id: schedule.benefit_id,
        run_id: runId,
        dedupe_key: failedDedupeKey,
        planned_send_at: planned.toISOString(),
        status: "failed",
        error: `attempted insert failed: ${insertError.message}`,
      });

      if (fallbackInsertError) {
        console.error("Failed to write fallback failed log", {
          scheduleId: schedule.id,
          runId,
          insertCode: insertError.code,
          insertMessage: insertError.message,
          fallbackCode: fallbackInsertError.code,
          fallbackMessage: fallbackInsertError.message,
        });
      }

      continue;
    }

    claimed += 1;

    const logId = insertedLog?.id as string | undefined;
    const markLogAdvanceFailed = async (details: string) => {
      if (!logId) {
        console.error("Missing logId while marking advance failure", {
          scheduleId: schedule.id,
          runId,
          details,
        });
        return;
      }

      const { error: markFailedError } = await supabase
        .from("reminder_send_log")
        .update({ status: "failed", error: `advance_failed: ${details}` })
        .eq("id", logId);

      if (markFailedError) {
        console.error("Failed to mark reminder log row as failed after advance error", {
          scheduleId: schedule.id,
          logId,
          runId,
          details,
          code: markFailedError.code,
          message: markFailedError.message,
        });
      }
    };

    let nextSendAt: Date;
    try {
      nextSendAt = computeNextSendAt(planned, String(schedule.cadence));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown cadence error";
      if (logId) {
        await supabase
          .from("reminder_send_log")
          .update({ status: "failed", error: errorMessage })
          .eq("id", logId);
      }
      console.error("Failed to compute next_send_at", {
        scheduleId: schedule.id,
        cadence: schedule.cadence,
        runId,
        error: errorMessage,
      });
      continue;
    }

    if (logId) {
      const { error: markSentError } = await supabase
        .from("reminder_send_log")
        .update({ status: "sent", error: null, skip_reason: null })
        .eq("id", logId);

      if (markSentError) {
        console.error("Failed to mark reminder log row as sent", {
          scheduleId: schedule.id,
          logId,
          runId,
          code: markSentError.code,
          message: markSentError.message,
        });
        continue;
      }
    }

    sent += 1;

    if (process.env.SIMULATE_ADVANCE_RACE === "1" && process.env.NODE_ENV !== "production") {
      const simulatedNext = new Date(planned.getTime() + 1_000).toISOString();
      const { error: simulateRaceError } = await supabase
        .from("reminder_schedules")
        .update({ next_send_at: simulatedNext })
        .eq("id", schedule.id);

      if (simulateRaceError) {
        console.error("Failed to simulate advance race", {
          scheduleId: schedule.id,
          runId,
          code: simulateRaceError.code,
          message: simulateRaceError.message,
        });
      }
    }

    const { data: advancedRows, error: advanceError } = await supabase
      .from("reminder_schedules")
      .update({
        last_sent_at: nowIso,
        next_send_at: nextSendAt.toISOString(),
      })
      .eq("id", schedule.id)
      .eq("next_send_at", schedule.next_send_at)
      .select("id");

    if (advanceError) {
      const detailParts = [advanceError.code, advanceError.message].filter(Boolean);
      await markLogAdvanceFailed(detailParts.join(": "));
      console.error("Failed to advance reminder schedule", {
        scheduleId: schedule.id,
        runId,
        code: advanceError.code,
        message: advanceError.message,
        details: advanceError.details,
      });
      continue;
    }

    if ((advancedRows ?? []).length > 0) {
      advanced += 1;
    } else {
      await markLogAdvanceFailed("concurrent_update_no_rows");
      console.error("Reminder schedule not advanced due to concurrent update", {
        scheduleId: schedule.id,
        runId,
      });
    }
  }

  return NextResponse.json(
    {
      runId,
      dueCount: schedules.length,
      claimed,
      deduped,
      sent,
      advanced,
      truncated,
      processedCount: claimed + deduped,
    },
    { status: 200 },
  );
}
