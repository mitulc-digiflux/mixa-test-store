import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore, type Store } from "@netlify/blobs";
import { exportRows, loadCatalog, type CsvRow } from "./catalog";

const FEED_PATH = path.join(process.cwd(), "data", "feed.json");
const BLOB_KEY = "rows";

/** A fresh feed starts with this many SKUs; add more from /feed. */
export const STARTER_SKUS = 10;

/** Fields /feed can change on a feed row. Everything else stays as in the CSV. */
export const EDITABLE = ["title_en", "mrp", "selling_price", "inventoryQuantity", "status"] as const;
export type FeedPatch = Partial<Record<(typeof EDITABLE)[number], string>>;

type Backend = {
  read(): Promise<CsvRow[] | null>;
  write(rows: CsvRow[]): Promise<void>;
};

/** Local dev: one JSON file. */
const fileBackend: Backend = {
  async read() {
    try {
      return JSON.parse(await readFile(FEED_PATH, "utf8")) as CsvRow[];
    } catch {
      return null;
    }
  },
  async write(rows) {
    await mkdir(path.dirname(FEED_PATH), { recursive: true });
    await writeFile(FEED_PATH, JSON.stringify(rows, null, 2));
  },
};

/** Netlify: Blobs, so the feed changes without a new deploy. */
function blobBackend(store: Store): Backend {
  return {
    async read() {
      // get() on a key that was never written can hang in the Netlify runtime, so check with list() first
      const { blobs } = await store.list({ prefix: BLOB_KEY });
      if (!blobs.some((b) => b.key === BLOB_KEY)) return null;
      return (await store.get(BLOB_KEY, { type: "json" })) as CsvRow[] | null;
    },
    async write(rows) {
      await store.setJSON(BLOB_KEY, rows);
    },
  };
}

let backend: Backend | null = null;

function db(): Backend {
  if (!backend) {
    try {
      // Throws outside Netlify (no Blobs context), e.g. `npm run dev`.
      backend = blobBackend(getStore({ name: "feed", consistency: "strong" }));
    } catch {
      backend = fileBackend;
    }
  }
  return backend;
}

// Serialise writes so two quick clicks cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

function update(fn: (rows: CsvRow[]) => CsvRow[]): Promise<CsvRow[]> {
  const run = queue.then(async () => {
    const rows = fn(await listFeed());
    await db().write(rows);
    return rows;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Feed rows (one per sku + country), in catalogue order. Starts with the first 10 SKUs. */
export async function listFeed(): Promise<CsvRow[]> {
  return (await db().read()) ?? exportRows({ limit: STARTER_SKUS });
}

export function addSku(sku: string): Promise<CsvRow[]> {
  const markets = loadCatalog().rows.filter((r) => r.sku === sku);
  if (!markets.length) throw new Error(`SKU ${sku} is not in data/products.csv`);
  return update((rows) => {
    if (rows.some((r) => r.sku === sku)) return rows;
    // Keep catalogue order so the feed reads like the CSV
    const order = new Map(loadCatalog().rows.map((r, i) => [`${r.sku}|${r.country}`, i]));
    const at = (r: CsvRow) => order.get(`${r.sku}|${r.country}`) ?? Infinity;
    return [...rows, ...markets.map((r) => ({ ...r }))].sort((a, b) => at(a) - at(b));
  });
}

export function updateRow(sku: string, country: string, patch: FeedPatch): Promise<CsvRow[]> {
  return update((rows) =>
    rows.map((r) => {
      if (r.sku !== sku || r.country !== country) return r;
      const next = { ...r };
      for (const key of EDITABLE) {
        const value = patch[key]?.trim();
        if (value !== undefined && value !== "") next[key] = value;
      }
      return next;
    }),
  );
}

export function removeSku(sku: string): Promise<CsvRow[]> {
  return update((rows) => rows.filter((r) => r.sku !== sku));
}

export function resetFeed(): Promise<CsvRow[]> {
  return update(() => exportRows({ limit: STARTER_SKUS }));
}
