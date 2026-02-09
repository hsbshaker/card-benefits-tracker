import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const issuerParam = searchParams.get("issuer") ?? "";

  // Map short URL params to the issuer values you store in the DB
  const issuerMap: Record<string, string> = {
    amex: "American Express",
    chase: "Chase",
    citi: "Citi",
    "capital-one": "Capital One",
  };

  const issuer = issuerMap[issuerParam] ?? issuerParam;

  const supabase = await createClient();

  // Require auth (optional, but consistent with your onboarding)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("cards")
    .select("id, issuer, brand, card_name, network")
    .eq("issuer", issuer)
    .order("card_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 200 });
}
