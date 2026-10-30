import { rewriteRow, type CsvRow } from "@/lib/catalog";
import { config } from "@/lib/config";
import { listFeed } from "@/lib/feed";
import { xml } from "@/lib/xml";

type Style = "salla" | "channable";

/**
 * XML feed for mixa's "XML feed" source, built from the rows managed on /feed
 * (stored at runtime, so adding a product needs no deploy). Google Shopping
 * RSS shaped like the feeds real brands send: one URL per market + language,
 * prices as "279.89 AED", stock only as availability (no quantity), the same
 * g:id in EN and AR.
 *
 *   /api/feed?country=AE&lang=en&style=salla   (these are the defaults)
 *   /api/feed?rewrite=0                         original URLs, untouched
 *
 * style=salla      every field g:-prefixed, guid, "in stock" (Salla stores, e.g. ra7eek)
 * style=channable  plain title/link/description, "in_stock" (Shopify via Channable, e.g. revibe)
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const country = (params.get("country") || "AE").toUpperCase();
  const ar = params.get("lang") === "ar";
  const style: Style = params.get("style") === "channable" ? "channable" : "salla";
  const rewrite = params.get("rewrite") !== "0";

  // Real feeds leave out products the shop does not sell, so drop INACTIVE/DRAFT.
  const rows = (await listFeed())
    .filter((r) => (r.country || "AE").toUpperCase() === country && r.status === "ACTIVE")
    .map((r) => (rewrite ? rewriteRow(r) : r));

  const lang = ar ? "AR" : "EN";
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    "  <channel>",
    `    <title>${xml(`Product Feed - mixa Test Store (${lang}, ${country})`)}</title>`,
    `    <link>${xml(config.siteUrl)}</link>`,
    `    <description>${xml(`Product feed for ${lang} language, market ${country}`)}</description>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
  ];
  if (style === "salla") out.push(`    <language>${ar ? "ar" : "en"}</language>`);
  for (const r of rows) out.push(...item(r, ar, style));
  out.push("  </channel>", "</rss>");

  return new Response(out.join("\n") + "\n", {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function item(r: CsvRow, ar: boolean, style: Style): string[] {
  const pick = (base: string) => (ar && r[`${base}_ar`]) || r[`${base}_en`] || "";
  const currency = (r.currency || "AED").toUpperCase();
  const money = (v: string) => `${Number(v).toFixed(2)} ${currency}`;
  const inStock = Number(r.inventoryQuantity) > 0;
  const link = (ar && r.destinationurl_ar) || r.destinationUrl;

  // Salla puts the core fields in the g: namespace too; Channable leaves them plain.
  const core = style === "salla" ? "g:" : "";
  const tags: [string, string][] = [
    ["g:id", r.sku],
    [`${core}title`, pick("title")],
    [`${core}description`, pick("description") || pick("title")],
    [`${core}link`, link],
    ["g:image_link", r.image_1],
    ...[r.image_2, r.image_3].filter(Boolean).map((u): [string, string] => ["g:additional_image_link", u]),
    ["g:availability", style === "salla" ? (inStock ? "in stock" : "out of stock") : inStock ? "in_stock" : "out_of_stock"],
    ["g:price", money(r.mrp)],
    // Like the real feeds, sale_price only appears when there is a discount.
    ...(Number(r.selling_price) < Number(r.mrp) ? [["g:sale_price", money(r.selling_price)] as [string, string]] : []),
    ["g:brand", pick("brand")],
    ["g:product_type", pick("category")],
    ["g:condition", "new"],
    ["g:item_group_id", r.sku],
  ];
  if (r.gender) tags.push(["g:gender", r.gender.toLowerCase()]);

  const lines = ["    <item>"];
  if (style === "salla") lines.push(`      <guid isPermaLink="false">${xml(r.sku)}</guid>`);
  for (const [tag, value] of tags) if (value) lines.push(`      <${tag}>${xml(value)}</${tag}>`);
  lines.push("    </item>");
  return lines;
}
