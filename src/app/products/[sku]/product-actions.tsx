"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addToCart, type CartItem } from "@/lib/cart";
import { track } from "@/lib/mixa-client";

type Props = {
  country: string;
  item: Omit<CartItem, "qty">;
  inStock: boolean;
};

export function ProductActions({ country, item, inStock }: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    track("productView", {
      productId: item.sku,
      sku: item.sku,
      title: item.title,
      price: item.price,
      currency: item.currency,
    });
  }, [item.sku, item.title, item.price, item.currency]);

  function add(goToCart: boolean) {
    const switched = addToCart(country, item, qty);
    track("addToCart", {
      productId: item.sku,
      sku: item.sku,
      title: item.title,
      price: item.price,
      currency: item.currency,
      quantity: qty,
    });
    if (goToCart) return router.push("/cart");
    setNote(
      switched
        ? `Cart switched to ${country}. Items from the other market were removed.`
        : "Added to cart.",
    );
  }

  if (!inStock) return <p className="text-sm text-red-700">Out of stock</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Qty
          <input
            type="number"
            min={1}
            max={10}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-md border border-stone-300 px-2 py-1.5"
          />
        </label>
        <button
          onClick={() => add(false)}
          className="rounded-md border border-stone-900 px-4 py-2 text-sm font-medium"
        >
          Add to cart
        </button>
        <button
          onClick={() => add(true)}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white"
        >
          Buy now
        </button>
      </div>
      <p role="status" className="text-sm text-stone-600">
        {note}
      </p>
    </div>
  );
}
