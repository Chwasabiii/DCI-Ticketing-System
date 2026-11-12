const siteUrlError =
  "NEXT_PUBLIC_SITE_URL must be an HTTPS URL. HTTP is allowed only for localhost during development.";

export function getSiteOrigin(
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv = process.env.NODE_ENV
): string {
  const siteUrl = configuredSiteUrl
    ?? (nodeEnv === "development" ? "http://localhost:3000" : null);

  if (!siteUrl) {
    throw new Error("Set NEXT_PUBLIC_SITE_URL to this app's public URL before sending invitations.");
  }

  let parsedSiteUrl: URL;
  try {
    parsedSiteUrl = new URL(siteUrl);
  } catch {
    throw new Error(siteUrlError);
  }

  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(parsedSiteUrl.hostname);
  const isAllowedHttp = nodeEnv === "development" && isLocalhost;
  if (
    (parsedSiteUrl.protocol !== "https:" && !(parsedSiteUrl.protocol === "http:" && isAllowedHttp)) ||
    parsedSiteUrl.username ||
    parsedSiteUrl.password
  ) {
    throw new Error(siteUrlError);
  }

  return parsedSiteUrl.origin;
}
