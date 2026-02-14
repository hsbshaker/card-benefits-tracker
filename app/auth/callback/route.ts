import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const getErrorRedirect = (origin: string, detail: string) =>
  NextResponse.redirect(new URL(`/auth/error?reason=oauth_callback_failed&detail=${detail}`, origin));

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  const pathname = request.nextUrl.pathname;

  console.info("Auth callback hit", {
    origin,
    pathname,
    hasCode: Boolean(code),
  });

  if (!code) {
    return getErrorRedirect(origin, "missing_code");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingEnvError = new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.error("Auth callback missing Supabase env vars", {
      origin,
      pathname,
      hasNextPublicSupabaseUrl: Boolean(supabaseUrl),
      hasNextPublicSupabaseAnonKey: Boolean(supabaseAnonKey),
      message: missingEnvError.message,
    });
    return NextResponse.redirect(new URL("/auth/error?reason=missing_env", origin));
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL("/onboarding/benefits", origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback exchange failed", {
      origin,
      pathname,
      hasCode: true,
      message: error.message,
      status: error.status,
    });
    return getErrorRedirect(origin, "exchange_failed");
  }

  return response;
}
