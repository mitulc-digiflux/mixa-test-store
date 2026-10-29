import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { OrderActions } from "@/components/order-actions";
import { HttpPill, StatusPill } from "@/components/status-pill";

function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const { placed } = await searchParams;
  const order = await getOrder(orderNumber);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      {placed && (
        <p className="rounded-lg bg-emerald-50 p-4 text-emerald-900">
          Thank you! Payment succeeded and the order was sent to mixa.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.orderNumber}</h1>
        <StatusPill status={order.status} />
        <span className="text-stone-500">{formatMoney(order.total, order.currency)}</span>
        <span className="ms-auto">
          <OrderActions orderNumber={order.orderNumber} status={order.status} />
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Items</h2>
          <ul className="flex flex-col gap-1">
            {order.items.map((i) => (
              <li key={i.sku} className="flex justify-between gap-3">
                <span>
                  {i.qty} × {i.title} <span className="font-mono text-xs text-stone-400">{i.sku}</span>
                </span>
                <span className="whitespace-nowrap">{formatMoney(i.price * i.qty, order.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium">Attribution saved with the order</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            {Object.entries({ ...order.attribution, couponCode: order.couponCode }).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-stone-500">{k}</dt>
                <dd className="break-all">{v ? String(v) : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Webhook calls ({order.webhooks.length})</h2>
        {[...order.webhooks].reverse().map((w) => (
          <details key={w.id} className="rounded-lg border border-stone-200 bg-white" open={w === order.webhooks.at(-1)}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium">{w.kind}</span>
              <HttpPill status={w.status} error={w.error} />
              <span className="text-stone-500">{w.durationMs} ms</span>
              <span className="ms-auto text-xs text-stone-400">{new Date(w.at).toLocaleString("en-GB")}</span>
            </summary>
            <div className="grid gap-3 border-t border-stone-100 p-3 text-xs md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="font-medium">POST {w.url}</span>
                <pre className="overflow-x-auto rounded bg-stone-900 p-3 text-stone-100">
                  {Object.entries(w.requestHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}
                  {"\n\n"}
                  {pretty(w.body)}
                </pre>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium">Response</span>
                <pre className="overflow-x-auto rounded bg-stone-100 p-3">
                  {w.error ? `Network error: ${w.error}` : pretty(w.response) || "(empty body)"}
                </pre>
              </div>
            </div>
          </details>
        ))}
      </section>

      <Link href="/orders" className="text-sm underline">All orders</Link>
    </div>
  );
}
