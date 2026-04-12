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

export async function updateBenefitConditionalValue(userId: string, userBenefitId: string, conditionalValue: string | null) {
  const ownedBenefit = await assertOwnedBenefit(userId, userBenefitId);

  if (!ownedBenefit) {
    return null;
  }

  const supabase = getServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("user_benefits")
    .update({
      conditional_value: conditionalValue,
    })
    .eq("id", userBenefitId);

  if (error) {
    throw error;
  }

  return { userBenefitId, conditionalValue };
}
