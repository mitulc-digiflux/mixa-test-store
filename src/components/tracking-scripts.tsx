import { GoogleTagManager } from "@next/third-parties/google";
import { config } from "@/lib/config";

export const MIXA_SDK_SRC = "https://sdk.mixa.global/v1/mixa-core.min.js";

/**
 * Guide Section 2: load the mixa script ONE way only.
 *  - gtm:    GTM container; the mixa script lives in a Custom HTML tag there.
 *  - direct: Option A, the script tag in <head> on every page.
 */
export function TrackingScripts() {
  if (config.trackingMode === "gtm" && config.gtmId) {
    return <GoogleTagManager gtmId={config.gtmId} />;
  }
  if (config.trackingMode === "direct" && config.publicBrandId) {
    return <script async src={MIXA_SDK_SRC} data-brand={config.publicBrandId} />;
  }
  return null;
}
