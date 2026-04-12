import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const escapeIlikeValue = (value: string) => value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const issuerParam = (searchParams.get("issuer") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();

  const issuerMap: Record<string, string> = {
    amex: "American Express",
    chase: "Chase",
    citi: "Citi",
    "capital-one": "Capital One",
  };

  const issuer = issuerMap[issuerParam] ?? issuerParam;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("cards")
    .select("id, issuer, card_name, display_name, network, card_status")
    .in("card_status", ["active", "no_trackable_benefits"])
    .order("card_status", { ascending: true })
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("card_name", { ascending: true });

  if (issuer.length > 0) {
    query = query.eq("issuer", issuer);
  }

  if (q.length > 0) {
    const escapedQuery = escapeIlikeValue(q);
    query = query.or(
      `card_name.ilike.%${escapedQuery}%,display_name.ilike.%${escapedQuery}%,issuer.ilike.%${escapedQuery}%,network.ilike.%${escapedQuery}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch cards", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      issuer,
      q,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 200 });
}
