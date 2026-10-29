import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getProduct } from "@/lib/catalog";
import { round2 } from "@/lib/money";
import { newOrderNumber, saveOrder, type Attribution, type Order } from "@/lib/orders";
import { sendOrderWebhook } from "@/lib/mixa-webhook";

type CheckoutBody = {
  country?: string;
  items?: { sku: string; qty: number }[];
  couponCode?: string;
  customerEmail?: string;
  attribution?: Attribution;
};

function clean(value: unknown, max: number): string | undefined {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, max) : undefined;
}

export async function POST(req: Request) {
  const input = (await req.json().catch(() => ({}))) as CheckoutBody;
  const country = (input.country || "").toUpperCase();
  if (!country || !input.items?.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Prices come from the catalogue, never from the browser.
  const items: Order["items"] = [];
  let currency = "";
  for (const line of input.items) {
    const p = getProduct(line.sku, country);
    const qty = Math.floor(Number(line.qty));
    if (!p || !(qty > 0)) {
      return NextResponse.json({ error: `Unknown item ${line.sku}` }, { status: 400 });
    }
    currency ||= p.currency;
    items.push({ sku: p.sku, title: p.title, qty, price: p.price });
  }

  const a = input.attribution || {};
  const order: Order = {
    orderNumber: newOrderNumber(),
    createdAt: new Date().toISOString(),
    status: "paid",
    country,
    currency,
    total: round2(items.reduce((sum, i) => sum + i.price * i.qty, 0)),
    items,
    couponCode: clean(input.couponCode, 64),
    customerEmail: clean(input.customerEmail, 255),
    paymentId: `pay_${randomUUID().slice(0, 12)}`,
    attribution: {
      clickId: clean(a.clickId, 128),
      clickedAt: Number(a.clickedAt) || undefined,
      utmSource: clean(a.utmSource, 64),
      utmMedium: clean(a.utmMedium, 64),
      utmCampaign: clean(a.utmCampaign, 128),
      visitorId: clean(a.visitorId, 128),
      sessionId: clean(a.sessionId, 128),
    },
    webhooks: [],
  };

  // Payment "succeeds" here, so this is when the brand server calls mixa.
  order.webhooks.push(await sendOrderWebhook(order, "paid"));
  await saveOrder(order);

  return NextResponse.json({
    orderNumber: order.orderNumber,
    webhookStatus: order.webhooks[0].status,
  });
}
