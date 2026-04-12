import { NextResponse } from "next/server";
import { snoozeBenefit } from "@/lib/home/snooze-benefit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SnoozeRequestBody = {
  userBenefitId?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SnoozeRequestBody;
  const userBenefitId = body.userBenefitId?.trim();

  if (!userBenefitId) {
    return NextResponse.json({ error: "Missing user benefit id." }, { status: 400 });
  }

  try {
    const result = await snoozeBenefit(user.id, userBenefitId);

    if (!result) {
      return NextResponse.json({ error: "Benefit not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to snooze benefit.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
