import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSiteURL } from "@/lib/site-url";

function hasHint(e: unknown): e is { hint?: string } {
  return typeof e === "object" && e !== null && "hint" in e;
}

function hasCode(e: unknown): e is { code?: string } {
  return typeof e === "object" && e !== null && "code" in e;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return "Failed to complete auth callback";
}

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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const hint = hasHint(error) ? error.hint : undefined;
      const code = hasCode(error) ? error.code : undefined;
      console.error("Auth callback failed to exchange code for session", {
        message: getErrorMessage(error),
        code,
        hint,
      });
      return errorRedirect;
    }
  } catch (error: unknown) {
    const hint = hasHint(error) ? error.hint : undefined;
    const code = hasCode(error) ? error.code : undefined;
    console.error("Auth callback threw while exchanging code for session", {
      message: getErrorMessage(error),
      code,
      hint,
    });
    return errorRedirect;
  }

  return NextResponse.redirect(new URL(next, origin));
}
