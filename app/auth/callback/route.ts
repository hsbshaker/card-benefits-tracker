import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSiteURL } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = "/onboarding/benefits";
  const origin = request.nextUrl.origin || getSiteURL();

  const errorRedirect = NextResponse.redirect(new URL("/login", origin));

  if (!code) {
    console.error("Auth callback missing code parameter", {
      pathname: url.pathname,
      hasCode: false,
    });
    return errorRedirect;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed to exchange code for session", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return errorRedirect;
  }

  return NextResponse.redirect(new URL(next, origin));
}
