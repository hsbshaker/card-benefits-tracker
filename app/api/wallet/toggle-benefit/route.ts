import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toggleBenefit } from "@/lib/wallet/toggle-benefit";

type ToggleBenefitBody = {
  userBenefitId?: string;
  isActive?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ToggleBenefitBody;
  const userBenefitId = body.userBenefitId?.trim();

  if (!userBenefitId || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await toggleBenefit(user.id, userBenefitId, body.isActive);

    if (!result) {
      return NextResponse.json({ error: "Benefit not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update benefit.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
