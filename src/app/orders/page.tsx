import Link from "next/link";
import { connection } from "next/server";
import { listOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { OrderActions } from "@/components/order-actions";
import { HttpPill, StatusPill } from "@/components/status-pill";

export default async function OrdersPage() {
  await connection(); // orders.json changes at runtime
  const orders = await listOrders();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-stone-500">
          Every action here is sent to mixa server to server, signed. Open an order to see the exact
          request and response.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-stone-600">
          No orders yet. <Link href="/" className="underline">Buy something</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-start text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="p-3 text-start">Order</th>
                <th className="p-3 text-start">Total</th>
                <th className="p-3 text-start">Status</th>
                <th className="p-3 text-start">Click ID / coupon</th>
                <th className="p-3 text-start">Webhooks</th>
                <th className="p-3 text-start">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((o) => (
                <tr key={o.orderNumber} className="align-top">
                  <td className="p-3">
                    <Link href={`/orders/${o.orderNumber}`} className="font-mono underline">
                      {o.orderNumber}
                    </Link>
                    <div className="text-xs text-stone-400">
                      {new Date(o.createdAt).toLocaleString("en-GB")}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatMoney(o.total, o.currency)}</td>
                  <td className="p-3"><StatusPill status={o.status} /></td>
                  <td className="p-3 font-mono text-xs">
                    <div>{o.attribution.clickId ?? <span className="text-stone-400">no click</span>}</div>
                    {o.couponCode && <div className="text-stone-500">coupon {o.couponCode}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {o.webhooks.map((w) => (
                        <span key={w.id} className="flex items-center gap-1 text-xs">
                          {w.kind} <HttpPill status={w.status} error={w.error} />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <OrderActions orderNumber={o.orderNumber} status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
