import "server-only";

import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function snoozeBenefit(userId: string, userBenefitId: string) {
  const supabase = getServiceRoleSupabaseClient();

  const { data: ownedBenefit, error: ownershipError } = await supabase
    .from("user_benefits")
    .select("id, user_cards!inner(user_id)")
    .eq("id", userBenefitId)
    .eq("user_cards.user_id", userId)
    .maybeSingle();

  if (ownershipError) {
    throw ownershipError;
  }

  if (!ownedBenefit) {
    return null;
  }

  const snoozedUntil = new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString();
  const { error: updateError } = await supabase
    .from("user_benefits")
    .update({
      snoozed_until: snoozedUntil,
    })
    .eq("id", userBenefitId);

  if (updateError) {
    throw updateError;
  }

  return {
    userBenefitId,
    snoozedUntil,
  };
}
