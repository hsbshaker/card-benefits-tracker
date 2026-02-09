import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const errorRedirect = NextResponse.redirect(new URL("/login", request.url));

  if (!code) return errorRedirect;

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return errorRedirect;

  return NextResponse.redirect(new URL(next, request.url));
}
