import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("cards")
    .select("id, issuer, brand, card_name")
    .eq("issuer", issuer)
    .order("card_name", { ascending: true });

  if (q.length > 0) {
    query = query.ilike("card_name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 200 });
}
