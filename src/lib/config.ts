import "server-only";

/**
 * Netlify sets URL to the site's main address; SITE_URL wins if given.
 * A localhost SITE_URL copied from .env.local into Netlify would put
 * localhost links in the feed and CSV, so on Netlify it is ignored.
 */
function resolveSiteUrl(): string {
  const site = (process.env.SITE_URL || "").trim();
  const onNetlify = process.env.NETLIFY === "true" || !!process.env.URL;
  const usable = site && !(onNetlify && /localhost|127\.0\.0\.1/.test(site));
  return ((usable ? site : process.env.URL) || "http://localhost:3000").replace(/\/+$/, "");
}

export const config = {
  siteUrl: resolveSiteUrl(),
  brandId: (process.env.MIXA_BRAND_ID || "").trim(),
  webhookSecret: (process.env.MIXA_WEBHOOK_SECRET || "").trim(),
  webhookUrl: (
    process.env.MIXA_WEBHOOK_URL || "https://api.mixa.global/v1/orders/webhook"
  ).trim(),
  trackingMode: (process.env.NEXT_PUBLIC_TRACKING_MODE || "gtm") as
    | "gtm"
    | "direct"
    | "none",
  gtmId: (process.env.NEXT_PUBLIC_GTM_ID || "").trim(),
  publicBrandId: (process.env.NEXT_PUBLIC_MIXA_BRAND_ID || "").trim(),
};

/** Problems that would make every webhook call fail. Shown on /setup. */
export function configProblems(): string[] {
  const out: string[] = [];
  if (!config.brandId) out.push("MIXA_BRAND_ID is empty");
  if (!config.webhookSecret) out.push("MIXA_WEBHOOK_SECRET is empty");
  if (config.trackingMode === "gtm" && !config.gtmId)
    out.push("NEXT_PUBLIC_TRACKING_MODE=gtm but NEXT_PUBLIC_GTM_ID is empty");
  if (config.trackingMode === "direct" && !config.publicBrandId)
    out.push("NEXT_PUBLIC_TRACKING_MODE=direct but NEXT_PUBLIC_MIXA_BRAND_ID is empty");
  return out;
}
