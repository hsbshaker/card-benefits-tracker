import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAddCardFlowPreview } from "@/lib/cards/get-add-card-flow-preview";

type RouteContext = {
  params: Promise<{
    cardId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cardId } = await context.params;

  try {
    const preview = await getAddCardFlowPreview(cardId);
    if (!preview) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load card preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
