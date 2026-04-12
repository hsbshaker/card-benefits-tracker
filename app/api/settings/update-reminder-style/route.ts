import { NextResponse } from "next/server";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateGlobalReminderStyle } from "@/lib/settings/update-global-reminder-style";

type UpdateReminderStyleBody = {
  reminderStyle?: ReminderStyle;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UpdateReminderStyleBody;
  const reminderStyle = body.reminderStyle;

  if (!reminderStyle) {
    return NextResponse.json({ error: "Missing reminder style." }, { status: 400 });
  }

  try {
    const result = await updateGlobalReminderStyle(user.id, reminderStyle);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update reminder style.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
