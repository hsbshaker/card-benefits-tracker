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
        return cookieStore.getAll();
      },
      setAll() {
        // Server Components can read cookies but cannot set them.
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
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });
