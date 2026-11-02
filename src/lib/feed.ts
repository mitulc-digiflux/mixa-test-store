import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore, type Store } from "@netlify/blobs";
import { exportRows, loadCatalog, rewriteRow, type CsvRow } from "./catalog";

const FEED_PATH = path.join(process.cwd(), "data", "feed.json");
const BLOB_KEY = "rows";

/** A fresh feed starts with this many SKUs; add more from /feed. */
export const STARTER_SKUS = 10;

/** Fields /feed can change on a feed row. Everything else stays as in the CSV. */
export const EDITABLE = [
  "title_en",
  "title_ar",
  "description_en",
  "description_ar",
  "destinationUrl",
  "destinationurl_ar",
  "mrp",
  "selling_price",
  "inventoryQuantity",
  "status",
  "status_en",
  "status_ar",
] as const;
export type FeedPatch = Partial<Record<(typeof EDITABLE)[number], string>>;

/** Link fields. The feed points them at this store unless they were edited on /feed. */
export const URL_KEYS = ["destinationUrl", "destinationurl_ar"] as const;
type UrlKey = (typeof URL_KEYS)[number];
export const customFlag = (key: UrlKey) => `_custom_${key}`;

/** Per-language switch: a row can be ACTIVE for the market but left out of one language's feed. */
export const LANG_STATUS = { en: "status_en", ar: "status_ar" } as const;

export function inLangFeed(row: CsvRow, lang: keyof typeof LANG_STATUS): boolean {
  return (row[LANG_STATUS[lang]] || "ACTIVE").toUpperCase() === "ACTIVE";
}

/** The row as the feed serves it: store links by default, edited links kept as typed. */
export function withLinks(row: CsvRow, rewrite: boolean): CsvRow {
  if (!rewrite) return row;
  const out = rewriteRow(row);
  for (const key of URL_KEYS) if (row[customFlag(key)]) out[key] = row[key];
  return out;
}

function checkUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Not a valid URL: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`URL must start with https://: ${value}`);
  return url.toString();
}

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
  // Validate before queueing so bad input fails without touching the feed.
  for (const key of Object.values(LANG_STATUS)) {
    const value = patch[key]?.trim().toUpperCase();
    if (value && value !== "ACTIVE" && value !== "INACTIVE") throw new Error(`${key} must be ACTIVE or INACTIVE`);
  }
  const urls: Partial<Record<UrlKey, string>> = {};
  for (const key of URL_KEYS) {
    const value = patch[key]?.trim();
    if (value) urls[key] = checkUrl(value);
  }
  return update((rows) => {
    if (!rows.some((r) => r.sku === sku && r.country === country)) {
      throw new Error(`${sku} (${country}) is not in the feed`);
    }
    return rows.map((r) => {
      if (r.sku !== sku || r.country !== country) return r;
      const next = { ...r };
      for (const key of EDITABLE) {
        if ((URL_KEYS as readonly string[]).includes(key)) continue;
        const value = patch[key]?.trim();
        if (value !== undefined && value !== "") next[key] = value;
      }
      for (const key of URL_KEYS) {
        if (patch[key] === undefined) continue;
        if (urls[key]) {
          next[key] = urls[key];
          next[customFlag(key)] = "1";
        } else {
          // Cleared: back to the catalogue link (the feed rewrites it to this store).
          const original = loadCatalog().rows.find((c) => c.sku === sku && c.country === country);
          next[key] = original?.[key] ?? "";
          delete next[customFlag(key)];
        }
      }
      return next;
    });
  });
}

export function removeSku(sku: string): Promise<CsvRow[]> {
  return update((rows) => rows.filter((r) => r.sku !== sku));
}

/** Drop one market row (sku + country), keep the SKU's other markets. */
export function removeRow(sku: string, country: string): Promise<CsvRow[]> {
  return update((rows) => rows.filter((r) => r.sku !== sku || r.country !== country));
}

export function resetFeed(): Promise<CsvRow[]> {
  return update(() => exportRows({ limit: STARTER_SKUS }));
}
