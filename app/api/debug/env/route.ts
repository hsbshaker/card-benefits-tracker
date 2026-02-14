import { NextResponse } from "next/server";

export const runtime = "nodejs";

const parseBearerToken = (header: string | null) => {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

const maskPublicUrlPreview = (value: string | undefined) => {
  if (!value) return null;
  const visible = value.slice(0, 25);
  return value.length > 25 ? `${visible}...` : visible;
};

export async function GET(request: Request) {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || bearerToken !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      nextPublicSupabaseUrlPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      nextPublicSupabaseAnonKeyPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseUrlPresent: Boolean(process.env.SUPABASE_URL),
      supabaseServiceRoleKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      cronSecretPresent: Boolean(process.env.CRON_SECRET),
      nextPublicSupabaseUrlPreview: maskPublicUrlPreview(process.env.NEXT_PUBLIC_SUPABASE_URL),
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    { status: 200 },
  );
}
