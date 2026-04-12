import "server-only";

import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export async function updateGlobalReminderStyle(userId: string, reminderStyle: ReminderStyle) {
  const supabase = getServiceRoleSupabaseClient();

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      global_reminder_style: reminderStyle,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return {
    userId,
    reminderStyle,
  };
}
