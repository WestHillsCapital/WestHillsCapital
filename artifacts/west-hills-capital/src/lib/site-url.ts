// Matches the live domain's existing non-www -> www redirect.
export const PUBLIC_SITE_ORIGIN = "https://www.westhillscapital.com";

export function canonicalSiteUrl(value: string): string {
  const url = new URL(value, PUBLIC_SITE_ORIGIN);
  if (url.hostname === "westhillscapital.com" || url.hostname === "www.westhillscapital.com") {
    return `${PUBLIC_SITE_ORIGIN}${url.pathname}`;
  }
  return value;
}
