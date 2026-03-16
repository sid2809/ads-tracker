/**
 * Normalize URL for comparison: lowercase, strip trailing slash, strip www.
 */
export function normalizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url.trim().toLowerCase());
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${host}${path}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}
