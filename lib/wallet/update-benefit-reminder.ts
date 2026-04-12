import "server-only";

import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

async function assertOwnedBenefit(userId: string, userBenefitId: string) {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("user_benefits")
    .select("id, user_cards!inner(user_id)")
    .eq("id", userBenefitId)
    .eq("user_cards.user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateBenefitReminderOverride(
  userId: string,
  userBenefitId: string,
  reminderOverride: ReminderStyle,
) {
  const ownedBenefit = await assertOwnedBenefit(userId, userBenefitId);

  if (!ownedBenefit) {
    return null;
  }

  const supabase = getServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("user_benefits")
    .update({
      reminder_override: reminderOverride,
    })
    .eq("id", userBenefitId);

  if (error) {
    throw error;
  }

  return { userBenefitId, reminderOverride };
}
