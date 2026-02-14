import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ERROR_REDIRECT = "/auth/error?reason=oauth_callback_failed&detail=exchange_failed";
const SUCCESS_REDIRECT = "/onboarding/benefits";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  const pathname = request.nextUrl.pathname;

  if (!code) {
    console.error("Auth callback missing code", {
      origin,
      pathname,
      hasCode: false,
    });
    return NextResponse.redirect(new URL(ERROR_REDIRECT, origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback exchange failed", {
        origin,
        pathname,
        hasCode: true,
        message: error.message,
        status: error.status,
      });
      return NextResponse.redirect(new URL(ERROR_REDIRECT, origin));
    }

    return NextResponse.redirect(new URL(SUCCESS_REDIRECT, origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown callback exchange error";
    console.error("Auth callback threw", {
      origin,
      pathname,
      hasCode: true,
      message,
    });
    return NextResponse.redirect(new URL(ERROR_REDIRECT, origin));
  }
}
