import { notFound, redirect } from "next/navigation";
import { CardDetailScreen } from "@/components/wallet/CardDetailScreen";
import { getCardDetail } from "@/lib/wallet/get-card-detail";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WalletCardDetailPageProps = {
  params: Promise<{
    userCardId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function WalletCardDetailPage({ params }: WalletCardDetailPageProps) {
  const { userCardId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const detail = await getCardDetail(user.id, userCardId);

  if (!detail) {
    notFound();
  }

  return <CardDetailScreen initialDetail={detail} />;
}
