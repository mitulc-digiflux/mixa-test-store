import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { config } from "./config";
import type { Order, WebhookKind, WebhookLog } from "./orders";

/**
 * Body per the CSV integration guide (Section 3) plus the fields the
 * tracking-service DTO accepts. Note: `shopUrl` is required by the backend
 * (assertWebhookOrderFields) even though the guide does not list it.
 */
function buildBody(order: Order, kind: WebhookKind): Record<string, unknown> {
  const a = order.attribution;
  const body: Record<string, unknown> = {
    brandId: config.brandId,
    orderNumber: order.orderNumber,
    orderValue: order.total,
    currency: order.currency,
    shopUrl: config.siteUrl,
    clickId: a.clickId,
    couponCode: order.couponCode,
    customerEmail: order.customerEmail,
    paymentId: order.paymentId,
    paymentProvider: "mixa-test-store",
    utmSource: a.utmSource,
    utmMedium: a.utmMedium,
    utmCampaign: a.utmCampaign,
    visitorId: a.visitorId,
    sessionId: a.sessionId,
    timestamp: Date.parse(order.createdAt),
    lineItems: order.items.map((i) => ({
      title: i.title.slice(0, 255),
      quantity: i.qty,
      price: i.price,
      sku: i.sku,
    })),
  };
  if (kind === "cancel") body.event = "order.cancelled";
  // The guide does not define a refund format ("confirmed at onboarding").
  // order.refunded is what the Salla mapper already understands.
  if (kind === "refund") body.event = "order.refunded";

  for (const k of Object.keys(body)) {
    if (body[k] === undefined || body[k] === "") delete body[k];
  }
  return body;
}

export async function sendOrderWebhook(order: Order, kind: WebhookKind): Promise<WebhookLog> {
  const rawBody = JSON.stringify(buildBody(order, kind));
  // Fresh timestamp + signature on every call, retries included.
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hex = createHmac("sha256", config.webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const headers = {
    "Content-Type": "application/json",
    "X-Mixa-Brand-Id": config.brandId,
    "X-Mixa-Timestamp": timestamp,
    "X-Mixa-Signature": `sha256=${hex}`,
  };

  const log: WebhookLog = {
    id: randomUUID(),
    kind,
    at: new Date().toISOString(),
    url: config.webhookUrl,
    requestHeaders: headers,
    body: rawBody,
    status: null,
    response: "",
    durationMs: 0,
  };

  const started = Date.now();
  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(20_000),
    });
    log.status = res.status;
    log.response = await res.text();
  } catch (err) {
    log.error = err instanceof Error ? err.message : String(err);
  }
  log.durationMs = Date.now() - started;
  return log;
}
