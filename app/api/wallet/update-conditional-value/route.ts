import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateBenefitConditionalValue } from "@/lib/wallet/update-benefit-conditional-value";

type UpdateConditionalValueBody = {
  userBenefitId?: string;
  conditionalValue?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UpdateConditionalValueBody;
  const userBenefitId = body.userBenefitId?.trim();
  const conditionalValue =
    typeof body.conditionalValue === "string" ? body.conditionalValue.trim() || null : body.conditionalValue ?? null;

  if (!userBenefitId) {
    return NextResponse.json({ error: "Missing user benefit id." }, { status: 400 });
  }

  try {
    const result = await updateBenefitConditionalValue(user.id, userBenefitId, conditionalValue);

    if (!result) {
      return NextResponse.json({ error: "Benefit not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update conditional value.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
