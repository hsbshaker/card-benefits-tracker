import { NextResponse } from "next/server";
import { buildHomeFeed } from "@/lib/home/build-home-feed";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const feed = await buildHomeFeed(user.id);
    return NextResponse.json(feed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load home feed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
