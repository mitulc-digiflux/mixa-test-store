"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { readAttribution, type ClientAttribution } from "@/lib/mixa-client";

export function CartLink() {
  const cart = useCart();
  const count = cart.items.reduce((n, i) => n + i.qty, 0);
  return (
    <Link href="/cart" className="rounded-md bg-stone-900 px-3 py-1.5 font-medium text-white">
      Cart{count ? ` (${count})` : ""}
    </Link>
  );
}

/** Quick check that a creator link's click ID was saved (guide: "Check it"). */
export function ClickIdBadge() {
  const [a, setA] = useState<ClientAttribution | null>(null);
  useEffect(() => {
    readAttribution().then(setA);
  }, []);

  if (!a) return <span className="text-xs text-stone-400">checking click ID…</span>;
  if (!a.clickId)
    return (
      <Link href="/setup" className="text-xs text-amber-700">
        no click ID
      </Link>
    );
  return (
    <Link href="/setup" className="font-mono text-xs text-emerald-700" title={`source: ${a.source}`}>
      click {a.clickId.slice(0, 10)}…
    </Link>
  );
}
