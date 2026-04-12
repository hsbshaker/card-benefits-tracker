import "server-only";

import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export async function removeCard(userId: string, userCardId: string) {
  const supabase = getServiceRoleSupabaseClient();

  const { data: ownedCard, error: lookupError } = await supabase
    .from("user_cards")
    .select("id")
    .eq("id", userCardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!ownedCard) {
    return null;
  }

  const { error: deleteError } = await supabase.from("user_cards").delete().eq("id", userCardId);

  if (deleteError) {
    throw deleteError;
  }

  return { userCardId };
}
