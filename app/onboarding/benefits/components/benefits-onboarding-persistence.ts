import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBenefitUsageUpdate } from "@/lib/benefits/usage-state";
import type { BenefitRow, CardGroup } from "./benefits-onboarding-data";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type UserBenefitPersistenceRow = {
  id: string;
  benefit_id: string;
  remind_me: boolean;
  used: boolean;
};

type RemoveWalletCardResult =
  | { ok: true }
  | { ok: false; userMessage: string };

type PersistBenefitPreferencesResult =
  | { ok: true; userId: string }
  | { ok: false; userMessage: string };

export function describeSupabaseError(error: unknown) {
  const err = (error ?? {}) as SupabaseErrorLike;
  return {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    raw: error,
    stringified:
      typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
  };
}

export async function persistRemindMePreference({
  supabase,
  userId,
  benefit,
  nextValue,
}: {
  supabase: SupabaseClient;
  userId: string;
  benefit: BenefitRow;
  nextValue: boolean;
}) {
  return supabase
    .from("user_benefits")
    .upsert(
      {
        user_id: userId,
        benefit_id: benefit.id,
        remind_me: nextValue,
        used: benefit.current_period_used,
      },
      { onConflict: "user_id,benefit_id" },
    )
    .select("id, benefit_id, remind_me, used")
    .single<UserBenefitPersistenceRow>();
}

export async function persistCurrentPeriodUsedPreference({
  supabase,
  userId,
  benefit,
  nextUsed,
}: {
  supabase: SupabaseClient;
  userId: string;
  benefit: BenefitRow;
  nextUsed: boolean;
}) {
  const nextRemindMe = nextUsed ? false : benefit.remind_me;
  const usageUpdate = buildBenefitUsageUpdate({
    userId,
    benefitId: benefit.id,
    cadence: benefit.cadence,
    nextUsed,
  });

  if (usageUpdate.periodStatusUpsert) {
    const { error: periodStatusError } = await supabase
      .from("user_benefit_period_status")
      .upsert(usageUpdate.periodStatusUpsert, { onConflict: "user_id,benefit_id,period_key" });

    if (periodStatusError) {
      return { savedRow: null, error: periodStatusError, nextRemindMe } as const;
    }
  }

  const { data, error } = await supabase
    .from("user_benefits")
    .upsert(
      {
        user_id: userId,
        benefit_id: benefit.id,
        used: usageUpdate.compatibilityUsed,
        remind_me: nextRemindMe,
      },
      { onConflict: "user_id,benefit_id" },
    )
    .select("id, benefit_id, remind_me, used")
    .single<UserBenefitPersistenceRow>();

  return { savedRow: data ?? null, error, nextRemindMe } as const;
}

export async function removeWalletCard({
  supabase,
  cardId,
}: {
  supabase: SupabaseClient;
  cardId: string;
}): Promise<RemoveWalletCardResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, userMessage: "Could not verify your account. Please try again." };
  }

  const { error: deleteError } = await supabase
    .from("user_cards")
    .delete()
    .eq("user_id", user.id)
    .eq("card_id", cardId);

  if (deleteError) {
    throw deleteError;
  }

  return { ok: true };
}

export async function persistBenefitPreferencesOnComplete({
  supabase,
  userId,
  cards,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  cards: CardGroup[];
}): Promise<PersistBenefitPreferencesResult> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, userMessage: "Could not verify your account. Please try again." };
    }

    resolvedUserId = user.id;
  }

  const preferenceRows = cards.flatMap((card) =>
    card.benefits.map((benefit) => ({
      user_id: resolvedUserId,
      benefit_id: benefit.id,
      remind_me: benefit.remind_me,
      used: benefit.current_period_used,
    })),
  );

  if (preferenceRows.length > 0) {
    const { error: saveError } = await supabase.from("user_benefits").upsert(preferenceRows, {
      onConflict: "user_id,benefit_id",
    });

    if (saveError) {
      throw saveError;
    }
  }

  return { ok: true, userId: resolvedUserId };
}
