import { redirect } from "next/navigation";
import { WalletList } from "@/components/wallet/WalletList";
import { getWalletSummary } from "@/lib/wallet/get-wallet-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cards = await getWalletSummary(user.id);

  return <WalletList cards={cards} />;
}
