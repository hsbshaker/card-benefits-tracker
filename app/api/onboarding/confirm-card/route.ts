import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmAddCard } from "@/lib/wallet/confirm-add-card";
import type { ConfirmAddCardSelectionInput } from "@/lib/types/server-data";

type ConfirmCardRequestBody = {
  cardId?: string;
  reminderStyle?: "balanced" | "earlier" | "minimal";
  selections?: ConfirmAddCardSelectionInput[];
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ConfirmCardRequestBody;
  const cardId = body.cardId?.trim();
  const reminderStyle = body.reminderStyle;
  const selections = Array.isArray(body.selections) ? body.selections : [];

  if (!cardId || !reminderStyle) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await confirmAddCard({
      userId: user.id,
      cardId,
      reminderStyle,
      selections,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm card.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
