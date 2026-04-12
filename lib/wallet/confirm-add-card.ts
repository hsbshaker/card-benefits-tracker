import "server-only";

import { getAddCardFlowPreview } from "@/lib/cards/get-add-card-flow-preview";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { ConfirmAddCardInput, ConfirmAddCardResult } from "@/lib/types/server-data";

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export async function confirmAddCard(input: ConfirmAddCardInput): Promise<ConfirmAddCardResult> {
  const supabase = getServiceRoleSupabaseClient();
  const preview = await getAddCardFlowPreview(input.cardId);

  if (!preview) {
    throw new Error("Card preview not found.");
  }

  const { count: existingCardCount, error: existingCardError } = await supabase
    .from("user_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("card_id", input.cardId)
    .neq("status", "removed");

  if (existingCardError) {
    throw existingCardError;
  }

  const { data: insertedUserCard, error: userCardError } = await supabase
    .from("user_cards")
    .insert({
      user_id: input.userId,
      card_id: input.cardId,
      status: "active",
    })
    .select("id")
    .single();

  if (userCardError || !insertedUserCard) {
    throw userCardError ?? new Error("Failed to create user card.");
  }

  const validBenefitIds = new Set(preview.allBenefits.map((benefit) => benefit.benefitId));
  const selectionByBenefitId = new Map(
    input.selections
      .filter((selection) => validBenefitIds.has(selection.benefitId))
      .map((selection) => [selection.benefitId, selection]),
  );

  const userBenefitRows = unique(preview.allBenefits.map((benefit) => benefit.benefitId)).map((benefitId) => {
    const selection = selectionByBenefitId.get(benefitId);
    return {
      user_card_id: insertedUserCard.id,
      benefit_id: benefitId,
      is_active: selection?.enabled ?? true,
      conditional_value: selection?.conditionalValue?.trim() || null,
    };
  });

  if (userBenefitRows.length > 0) {
    const { error: userBenefitsError } = await supabase.from("user_benefits").insert(userBenefitRows);
    if (userBenefitsError) {
      await supabase.from("user_cards").delete().eq("id", insertedUserCard.id);
      throw userBenefitsError;
    }
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: input.userId,
      global_reminder_style: input.reminderStyle,
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw profileError;
  }

  return {
    userCardId: insertedUserCard.id,
    duplicateStatus: (existingCardCount ?? 0) > 0 ? "possible_duplicate" : "none",
    redirectTo: "/home",
  };
}
