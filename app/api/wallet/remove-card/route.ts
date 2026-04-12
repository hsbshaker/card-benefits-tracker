import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { removeCard } from "@/lib/wallet/remove-card";

type RemoveCardBody = {
  userCardId?: string;
};

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as RemoveCardBody;
  const userCardId = body.userCardId?.trim();

  if (!userCardId) {
    return NextResponse.json({ error: "Missing user card id." }, { status: 400 });
  }

  try {
    const result = await removeCard(user.id, userCardId);

    if (!result) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove card.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
