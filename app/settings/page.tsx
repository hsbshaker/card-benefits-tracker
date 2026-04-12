import { redirect } from "next/navigation";
import type { ReminderStyle } from "@/lib/constants/memento-schema";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UserProfileRow = {
  global_reminder_style: ReminderStyle;
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_reminder_style")
    .eq("user_id", user.id)
    .maybeSingle();

  const reminderStyle = ((profile as UserProfileRow | null)?.global_reminder_style ?? "balanced") as ReminderStyle;

  return <SettingsScreen initialReminderStyle={reminderStyle} email={user.email ?? null} />;
}
