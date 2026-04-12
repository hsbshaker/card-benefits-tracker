import "server-only";

import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export async function markBenefitUsed(userId: string, userBenefitId: string) {
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

  const usedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("user_benefits")
    .update({
      is_used_this_period: true,
      last_used_at: usedAt,
      snoozed_until: null,
    })
    .eq("id", userBenefitId);

  if (updateError) {
    throw updateError;
  }

  return {
    userBenefitId,
    lastUsedAt: usedAt,
  };
}
