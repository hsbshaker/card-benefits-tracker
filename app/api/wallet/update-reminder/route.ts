import { NextResponse } from "next/server";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateBenefitReminderOverride } from "@/lib/wallet/update-benefit-reminder";

type UpdateReminderBody = {
  userBenefitId?: string;
  reminderOverride?: ReminderStyle;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UpdateReminderBody;
  const userBenefitId = body.userBenefitId?.trim();
  const reminderOverride = body.reminderOverride;

  if (!userBenefitId || !reminderOverride) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await updateBenefitReminderOverride(user.id, userBenefitId, reminderOverride);

    if (!result) {
      return NextResponse.json({ error: "Benefit not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update reminder override.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
