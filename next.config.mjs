const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const missing = required.filter((k) => !process.env[k]);

if (missing.length) {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  throw new Error(
    `Missing env var(s): ${missing.join(", ")}. Set them in Vercel Project Settings for the *${env}* environment, then redeploy.`,
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
