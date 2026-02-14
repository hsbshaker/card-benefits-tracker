const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getSiteUrl() {
  if (typeof window !== "undefined") {
    return trimTrailingSlash(window.location.origin);
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) {
    return trimTrailingSlash(configuredSiteUrl);
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return trimTrailingSlash(`https://${vercelUrl}`);
  }

  return "http://localhost:3000";
}
