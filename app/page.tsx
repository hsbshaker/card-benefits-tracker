import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { count, error } = await supabase
    .from("user_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error || !count) {
    redirect("/onboarding/cards");
  }

  redirect("/dashboard");
}
