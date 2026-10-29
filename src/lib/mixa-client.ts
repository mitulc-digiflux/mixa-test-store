// Browser-only helpers around window.mixaSDK (loaded by GTM or directly).

type SdkAttribution = {
  clickId?: string;
  clickedAt?: number;
  utm?: Record<string, string | undefined>;
  visitorId?: string;
  sessionId?: string;
};

type MixaSDK = {
  getAttribution?: () => SdkAttribution;
  productView?: (p: Record<string, unknown>) => unknown;
  addToCart?: (p: Record<string, unknown>) => unknown;
  beginCheckout?: (p: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    mixaSDK?: MixaSDK;
  }
}

export type ClientAttribution = {
  source: "sdk" | "cookie" | "none";
  clickId?: string;
  clickedAt?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorId?: string;
  sessionId?: string;
};

/** GTM loads the SDK after hydration, so give it a moment to appear. */
export function waitForSdk(timeoutMs = 4000): Promise<MixaSDK | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.mixaSDK) return resolve(window.mixaSDK);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(tick, 150);
    };
    tick();
  });
}

function cookie(name: string): string | undefined {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

function stored(name: string): string | undefined {
  try {
    return localStorage.getItem(name) || undefined;
  } catch {
    return undefined;
  }
}

/** Guide Section 2: read the click ID so the server can save it with the order. */
export async function readAttribution(): Promise<ClientAttribution> {
  const sdk = await waitForSdk();
  const a = sdk?.getAttribution?.();
  if (a?.clickId) {
    const utm = a.utm || {};
    return {
      source: "sdk",
      clickId: a.clickId,
      clickedAt: a.clickedAt,
      utmSource: utm.utm_source ?? utm.source,
      utmMedium: utm.utm_medium ?? utm.medium,
      utmCampaign: utm.utm_campaign ?? utm.campaign,
      visitorId: a.visitorId,
      sessionId: a.sessionId,
    };
  }
  // SDK missing or blocked: fall back to what it would have stored.
  const clickId = cookie("mixa_clickId") || stored("mixa_clickId");
  return {
    source: clickId ? "cookie" : "none",
    clickId,
    visitorId: a?.visitorId,
    sessionId: a?.sessionId,
  };
}

/** Optional journey events. Never block the UI on them. */
export function track(
  name: "productView" | "addToCart" | "beginCheckout",
  payload: Record<string, unknown>,
): void {
  waitForSdk().then((sdk) => {
    try {
      sdk?.[name]?.(payload);
    } catch {
      // analytics only
    }
  });
}
