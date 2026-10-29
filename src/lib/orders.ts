import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore, type Store } from "@netlify/blobs";

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

type Backend = {
  all(): Promise<Order[]>;
  get(orderNumber: string): Promise<Order | undefined>;
  put(order: Order): Promise<void>;
};

/** Local dev: one JSON file. */
const fileBackend: Backend = {
  async all() {
    try {
      return JSON.parse(await readFile(STORE_PATH, "utf8")) as Order[];
    } catch {
      return [];
    }
  },
  async get(orderNumber) {
    return (await this.all()).find((o) => o.orderNumber === orderNumber);
  },
  async put(order) {
    const orders = (await this.all()).filter((o) => o.orderNumber !== order.orderNumber);
    orders.push(order);
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(orders, null, 2));
  },
};

/** Netlify: the function filesystem is read-only, so use Blobs, one key per order. */
function blobBackend(store: Store): Backend {
  return {
    async all() {
      const { blobs } = await store.list();
      const orders = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      return orders.filter(Boolean) as Order[];
    },
    async get(orderNumber) {
      // get() on a key that was never written can hang in the Netlify runtime, so check with list() first
      const { blobs } = await store.list({ prefix: orderNumber });
      if (!blobs.some((b) => b.key === orderNumber)) return undefined;
      return ((await store.get(orderNumber, { type: "json" })) as Order | null) ?? undefined;
    },
    async put(order) {
      await store.setJSON(order.orderNumber, order);
    },
  };
}

let backend: Backend | null = null;

function db(): Backend {
  if (!backend) {
    try {
      // Throws outside Netlify (no Blobs context), e.g. `npm run dev`.
      backend = blobBackend(getStore({ name: "orders", consistency: "strong" }));
    } catch {
      backend = fileBackend;
    }
  }
  return backend;
}

// Serialise writes so two quick clicks cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function listOrders(): Promise<Order[]> {
  return (await db().all()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrder(orderNumber: string): Promise<Order | undefined> {
  return db().get(orderNumber);
}

export function saveOrder(order: Order): Promise<void> {
  return serial(() => db().put(order));
}

export function updateOrder(
  orderNumber: string,
  fn: (order: Order) => void,
): Promise<Order | undefined> {
  return serial(async () => {
    const order = await db().get(orderNumber);
    if (!order) return undefined;
    fn(order);
    await db().put(order);
    return order;
  });
}

export function newOrderNumber(): string {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TS${stamp}-${rand}`;
}
