/** Keep production auth cookies and redirects on the configured public site.
 * Netlify can supply its main-branch alias as Request.url inside the runtime.
 * Preview deployments and local development must retain their own origins.
 */
export function getAuthOrigin(requestUrl: string) {
  const incoming = new URL(requestUrl);
  if (!/^main--[^.]+\.netlify\.app$/i.test(incoming.hostname)) return incoming.origin;

  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredSite) return incoming.origin;
  try {
    const canonical = new URL(configuredSite.includes("://") ? configuredSite : `https://${configuredSite}`);
    if (canonical.protocol === "https:" || canonical.protocol === "http:") return canonical.origin;
  } catch {
    // An invalid optional canonical URL must never become an open redirect.
  }
  return incoming.origin;
}
