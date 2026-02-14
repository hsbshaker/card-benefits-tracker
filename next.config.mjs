const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const missing = required.filter((k) => !process.env[k]);

// Note: changing env vars in Vercel requires a new deploy.
// Existing builds do not receive updated env values retroactively.
if (missing.length) {
  const vercelEnv = process.env.VERCEL_ENV || "unknown";
  const nodeEnv = process.env.NODE_ENV || "unknown";
  throw new Error(
    `Missing env var(s): ${missing.join(", ")}. VERCEL_ENV=${vercelEnv}, NODE_ENV=${nodeEnv}. Set these in Vercel Project Settings -> Environment Variables, ensure the correct Production/Preview/Development scopes are checked, then redeploy.`,
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
