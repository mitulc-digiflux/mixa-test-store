import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export const CSV_PATH = path.join(process.cwd(), "data", "products.csv");

export type CsvRow = Record<string, string>;

/** One CSV row = one product in one market (sku + country). */
export type Product = {
  sku: string;
  country: string;
  currency: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  brand: string;
  category: string;
  gender: string;
  images: string[];
  mrp: number;
  price: number;
  inventory: number;
  status: string;
  destinationUrl: string;
};

type Catalog = {
  header: string[];
  rows: CsvRow[];
  products: Product[];
  byKey: Map<string, Product>;
  countries: string[];
};

let cache: Catalog | null = null;

function toProduct(row: CsvRow): Product {
  return {
    sku: row.sku,
    country: (row.country || "AE").toUpperCase(),
    currency: (row.currency || "AED").toUpperCase(),
    title: row.title_en,
    titleAr: row.title_ar || "",
    description: row.description_en || "",
    descriptionAr: row.description_ar || "",
    brand: row.brand_en,
    category: row.category_en,
    gender: row.gender || "",
    images: [row.image_1, row.image_2, row.image_3].filter(Boolean),
    mrp: Number(row.mrp),
    price: Number(row.selling_price),
    inventory: Number(row.inventoryQuantity),
    status: (row.status || "").toUpperCase(),
    destinationUrl: row.destinationUrl,
  };
}

export function loadCatalog(): Catalog {
  if (cache) return cache;
  const text = readFileSync(CSV_PATH, "utf8");
  const rows: CsvRow[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });
  const header = Object.keys(rows[0] ?? {});
  const products = rows.map(toProduct);
  const byKey = new Map(products.map((p) => [`${p.sku}|${p.country}`, p]));
  const countries = [...new Set(products.map((p) => p.country))].sort();
  cache = { header, rows, products, byKey, countries };
  return cache;
}

export function getProduct(sku: string, country: string): Product | undefined {
  return loadCatalog().byKey.get(`${sku}|${country.toUpperCase()}`);
}

export function getMarkets(sku: string): Product[] {
  return loadCatalog().products.filter((p) => p.sku === sku);
}

export const PAGE_SIZE = 24;

export function searchProducts(opts: { q?: string; country: string; page: number }) {
  const q = (opts.q || "").trim().toLowerCase();
  const list = loadCatalog().products.filter(
    (p) =>
      p.country === opts.country &&
      p.status === "ACTIVE" &&
      (!q ||
        p.title.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)),
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);
  return {
    total: list.length,
    page,
    pages,
    items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}
