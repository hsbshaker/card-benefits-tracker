import "server-only";

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

export async function setBenefitUsed(userId: string, userBenefitId: string, isUsedThisPeriod: boolean) {
  const ownedBenefit = await assertOwnedBenefit(userId, userBenefitId);

  if (!ownedBenefit) {
    return null;
  }

  const supabase = getServiceRoleSupabaseClient();
  const lastUsedAt = isUsedThisPeriod ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("user_benefits")
    .update({
      is_used_this_period: isUsedThisPeriod,
      last_used_at: lastUsedAt,
    })
    .eq("id", userBenefitId);

  if (error) {
    throw error;
  }

  return { userBenefitId, isUsedThisPeriod, lastUsedAt };
}
