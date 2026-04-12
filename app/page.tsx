import { redirect } from "next/navigation";
import { PublicLandingPage } from "@/components/landing/PublicLandingPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return <PublicLandingPage />;
}
