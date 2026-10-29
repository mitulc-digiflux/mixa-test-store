import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_PATH = path.join(process.cwd(), "data", "orders.json");

export type WebhookKind = "paid" | "cancel" | "refund" | "resend";

export type WebhookLog = {
  id: string;
  kind: WebhookKind;
  at: string;
  url: string;
  requestHeaders: Record<string, string>;
  body: string;
  status: number | null;
  response: string;
  durationMs: number;
  error?: string;
};

export type OrderItem = { sku: string; title: string; qty: number; price: number };

export type Attribution = {
  clickId?: string;
  clickedAt?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorId?: string;
  sessionId?: string;
};

export type Order = {
  orderNumber: string;
  createdAt: string;
  status: "paid" | "cancelled" | "refunded";
  country: string;
  currency: string;
  total: number;
  items: OrderItem[];
  couponCode?: string;
  customerEmail?: string;
  paymentId: string;
  attribution: Attribution;
  webhooks: WebhookLog[];
};

async function readAll(): Promise<Order[]> {
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8")) as Order[];
  } catch {
    return [];
  }
}

// Serialise writes so two quick clicks cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (orders: Order[]) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const orders = await readAll();
    const result = await fn(orders);
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(orders, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function listOrders(): Promise<Order[]> {
  return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(orderNumber: string): Promise<Order | undefined> {
  return (await readAll()).find((o) => o.orderNumber === orderNumber);
}

export function saveOrder(order: Order): Promise<void> {
  return mutate((orders) => {
    orders.push(order);
  });
}

export function updateOrder(
  orderNumber: string,
  fn: (order: Order) => void,
): Promise<Order | undefined> {
  return mutate((orders) => {
    const order = orders.find((o) => o.orderNumber === orderNumber);
    if (order) fn(order);
    return order;
  });
}

export function newOrderNumber(): string {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TS${stamp}-${rand}`;
}
