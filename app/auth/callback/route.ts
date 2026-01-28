import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Default fallback if something goes wrong
  const errorRedirect = NextResponse.redirect(
    new URL("/login?error=oauth", request.url)
  );

  if (!code) return errorRedirect;

  const response = NextResponse.redirect(new URL("/", request.url));
  const supabase = createRouteHandlerClient(request, response);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return errorRedirect;

  return response;
}
