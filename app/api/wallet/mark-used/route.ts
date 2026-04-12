import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setBenefitUsed } from "@/lib/wallet/mark-benefit-used";

type MarkBenefitUsedBody = {
  userBenefitId?: string;
  isUsedThisPeriod?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as MarkBenefitUsedBody;
  const userBenefitId = body.userBenefitId?.trim();

  if (!userBenefitId || typeof body.isUsedThisPeriod !== "boolean") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await setBenefitUsed(user.id, userBenefitId, body.isUsedThisPeriod);

    if (!result) {
      return NextResponse.json({ error: "Benefit not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update used status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
