import { loadCatalog } from "@/lib/catalog";
import { config } from "@/lib/config";

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The original CSV with destinationUrl pointing at this store, so creator
 * links land here and the mixa script can save the click ID.
 *
 *   /api/catalog?limit=50   first 50 SKUs (all their market rows)
 *   /api/catalog?rewrite=0  original URLs, untouched
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const limit = Number(params.get("limit")) || 0;
  const rewrite = params.get("rewrite") !== "0";
  const { header, rows } = loadCatalog();

  const keep = new Set<string>();
  const out: string[] = [header.map(cell).join(",")];
  for (const row of rows) {
    if (limit && !keep.has(row.sku)) {
      if (keep.size >= limit) continue;
      keep.add(row.sku);
    }
    const r = { ...row };
    if (rewrite) {
      const country = (r.country || "AE").toUpperCase();
      const url = `${config.siteUrl}/products/${encodeURIComponent(r.sku)}?country=${country}`;
      r.destinationUrl = url;
      if ("destinationurl_ar" in r) r.destinationurl_ar = `${url}&lang=ar`;
    }
    out.push(header.map((h) => cell(r[h] ?? "")).join(","));
  }

  const name = `mixa-test-store-catalog${limit ? `-${limit}` : ""}.csv`;
  return new Response(out.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
