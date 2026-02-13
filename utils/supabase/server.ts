import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
type CookiePair = { name: string; value: string };

function hasGetAllMethod(value: unknown): value is { getAll: () => CookiePair[] } {
  return typeof value === "object" && value !== null && "getAll" in value && typeof value.getAll === "function";
}

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll() {
        if (hasGetAllMethod(cookieStore)) {
          return cookieStore.getAll();
        }
        return Array.from(cookieStore as Iterable<CookiePair>).map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });
};


export const createRouteHandlerClient = (
  request: NextRequest,
  response: NextResponse
) =>
  createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
    },
    cookies: {
      getAll() {
        if (typeof request.cookies.getAll === "function") {
          return request.cookies.getAll();
        }

        // Next.js request cookies may not support getAll(); normalize iterable entries.
        return Array.from(request.cookies).map(([, cookie]) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });
