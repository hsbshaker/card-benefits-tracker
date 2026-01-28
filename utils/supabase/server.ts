import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
    },
    cookies: {
      getAll() {
        if (typeof cookieStore.getAll === "function") {
          return cookieStore.getAll();
        }

        // Next.js cookies() may not implement getAll(); fall back to the
        // iterable cookieStore and normalize to { name, value } entries.
        return Array.from(cookieStore).map((cookie) => ({
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
        return Array.from(request.cookies).map((cookie) => ({
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
