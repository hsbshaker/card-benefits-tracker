import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AppEntry() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login"); // or "/auth" — whichever is your real sign-in page
  redirect("/dashboard");
}
