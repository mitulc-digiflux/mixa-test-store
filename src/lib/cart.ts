"use client";

import { useSyncExternalStore } from "react";

export type CartItem = {
  sku: string;
  title: string;
  price: number;
  currency: string;
  image?: string;
  qty: number;
};

/** One market per cart, because an order has a single currency. */
export type Cart = { country: string | null; items: CartItem[] };

const KEY = "mts_cart";
const EMPTY: Cart = { country: null, items: [] };
const listeners = new Set<() => void>();
let snapshot: Cart | null = null;

function read(): Cart {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(localStorage.getItem(KEY) || "null") ?? EMPTY;
  } catch {
    snapshot = EMPTY;
  }
  return snapshot!;
}

function write(next: Cart) {
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: cart lives for this tab only
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    snapshot = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Returns true when the cart had to be cleared because the market changed. */
export function addToCart(country: string, item: Omit<CartItem, "qty">, qty = 1): boolean {
  const cart = read();
  const switched = !!cart.country && cart.country !== country && cart.items.length > 0;
  const items = switched ? [] : [...cart.items];
  const existing = items.find((i) => i.sku === item.sku);
  if (existing) existing.qty += qty;
  else items.push({ ...item, qty });
  write({ country, items: items.map((i) => ({ ...i })) });
  return switched;
}

export function setQty(sku: string, qty: number) {
  const cart = read();
  const items = cart.items
    .map((i) => (i.sku === sku ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  write({ country: items.length ? cart.country : null, items });
}

export function clearCart() {
  write(EMPTY);
}
