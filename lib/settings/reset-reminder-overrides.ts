import "server-only";

import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export async function resetReminderOverrides(userId: string) {
  const supabase = getServiceRoleSupabaseClient();

  const { data: ownedCards, error: cardsError } = await supabase
    .from("user_cards")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (cardsError) {
    throw cardsError;
  }

  const userCardIds = (ownedCards ?? []).map((row) => (row as { id: string }).id);

  if (userCardIds.length === 0) {
    return { resetCount: 0 };
  }

  const { data: clearedOverrides, error } = await supabase
    .from("user_benefits")
    .update({ reminder_override: null })
    .in("user_card_id", userCardIds)
    .not("reminder_override", "is", null)
    .select("id");

  if (error) {
    throw error;
  }

  return {
    resetCount: clearedOverrides?.length ?? 0,
  };
}
