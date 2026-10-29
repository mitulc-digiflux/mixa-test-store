"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCart, setQty, useCart } from "@/lib/cart";
import { readAttribution, track, type ClientAttribution } from "@/lib/mixa-client";
import { formatMoney, round2 } from "@/lib/money";

export default function CartPage() {
  const router = useRouter();
  const cart = useCart();
  const [attribution, setAttribution] = useState<ClientAttribution | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const currency = cart.items[0]?.currency ?? "";
  const total = round2(cart.items.reduce((sum, i) => sum + i.price * i.qty, 0));

  useEffect(() => {
    readAttribution().then(setAttribution);
  }, []);

  useEffect(() => {
    if (!cart.items.length) return;
    track("beginCheckout", { value: total, currency, itemCount: cart.items.length });
    // fire once per visit to the cart, not on every qty change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pay(form: FormData) {
    setPaying(true);
    setError("");
    try {
      // Read again at pay time: the click may have landed in another tab.
      const a = await readAttribution();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: cart.country,
          items: cart.items.map((i) => ({ sku: i.sku, qty: i.qty })),
          couponCode: form.get("couponCode"),
          customerEmail: form.get("customerEmail"),
          attribution: a,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      clearCart();
      router.push(`/orders/${data.orderNumber}?placed=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPaying(false);
    }
  }

  if (!cart.items.length) {
    return (
      <p className="text-stone-600">
        Cart is empty. <Link href="/" className="underline">Go shopping</Link>.
      </p>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_340px]">
      <ul className="flex flex-col divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {cart.items.map((i) => (
          <li key={i.sku} className="flex gap-3 p-3">
            <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded bg-stone-100">
              {i.image && <Image src={i.image} alt="" fill sizes="64px" className="object-cover" />}
            </div>
            <div className="flex flex-1 flex-col gap-1 text-sm">
              <Link
                href={`/products/${encodeURIComponent(i.sku)}?country=${cart.country}`}
                className="line-clamp-2 font-medium"
              >
                {i.title}
              </Link>
              <span className="font-mono text-xs text-stone-400">{i.sku}</span>
              <span>{formatMoney(i.price, i.currency)}</span>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <span className="sr-only">Quantity</span>
              <input
                type="number"
                min={0}
                value={i.qty}
                onChange={(e) => setQty(i.sku, Math.max(0, Number(e.target.value) || 0))}
                className="w-16 rounded-md border border-stone-300 px-2 py-1"
              />
            </label>
          </li>
        ))}
      </ul>

      <form action={pay} className="flex h-fit flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex justify-between text-sm">
          <span>Market</span>
          <span>{cart.country}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatMoney(total, currency)}</span>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Creator coupon (optional)
          <input
            name="couponCode"
            autoComplete="off"
            className="rounded-md border border-stone-300 px-3 py-2 font-mono uppercase"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email (optional)
          <input
            name="customerEmail"
            type="email"
            autoComplete="email"
            className="rounded-md border border-stone-300 px-3 py-2"
          />
        </label>

        <div className="rounded-md bg-stone-100 p-3 text-xs">
          <p className="font-medium">Sent with the order</p>
          {attribution === null ? (
            <p className="text-stone-500">Reading click ID…</p>
          ) : attribution.clickId ? (
            <p className="break-all font-mono">
              clickId {attribution.clickId}{" "}
              <span className="text-stone-500">({attribution.source})</span>
            </p>
          ) : (
            <p className="text-amber-700">
              No click ID. Only a coupon can credit this order.
            </p>
          )}
        </div>

        <button
          disabled={paying}
          className="rounded-md bg-emerald-700 px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {paying ? "Paying…" : `Pay ${formatMoney(total, currency)} (test)`}
        </button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
    </div>
  );
}
