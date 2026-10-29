import { NextResponse } from "next/server";
import { getOrder, updateOrder, type WebhookKind } from "@/lib/orders";
import { sendOrderWebhook } from "@/lib/mixa-webhook";

const KINDS: WebhookKind[] = ["cancel", "refund", "resend"];

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/orders/[orderNumber]/events">,
) {
  const { orderNumber } = await ctx.params;
  const { kind } = (await req.json().catch(() => ({}))) as { kind?: WebhookKind };
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "kind must be cancel, refund or resend" }, { status: 400 });
  }

  const order = await getOrder(orderNumber);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Status changes locally whatever mixa answers, like a real shop would.
  const log = await sendOrderWebhook(order, kind);
  await updateOrder(orderNumber, (o) => {
    o.webhooks.push(log);
    if (kind === "cancel") o.status = "cancelled";
    if (kind === "refund") o.status = "refunded";
  });

  return NextResponse.json({ status: log.status, response: log.response, error: log.error });
}
