import { loadCatalog, rewriteRow } from "@/lib/catalog";
import { config } from "@/lib/config";
import { listFeed } from "@/lib/feed";

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * XML feed for mixa's "XML feed" source, built from the rows managed on /feed
 * (stored at runtime, so adding a product needs no deploy). One <product> per
 * row (sku + country), tags named like the CSV columns so the mapping step
 * matches them one to one.
 *
 *   /api/feed?rewrite=0  original URLs, untouched
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rewrite = params.get("rewrite") !== "0";
  const { header } = loadCatalog();

  const out = ['<?xml version="1.0" encoding="UTF-8"?>', `<products source="${xml(config.siteUrl)}">`];
  for (const row of await listFeed()) {
    const r = rewrite ? rewriteRow(row) : row;
    out.push("  <product>");
    for (const h of header) out.push(`    <${h}>${xml(r[h] ?? "")}</${h}>`);
    out.push("  </product>");
  }
  out.push("</products>");

  return new Response(out.join("\n") + "\n", {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
