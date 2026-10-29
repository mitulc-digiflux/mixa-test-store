import Link from "next/link";
import { connection } from "next/server";
import { loadCatalog, type CsvRow } from "@/lib/catalog";
import { config } from "@/lib/config";
import { listFeed, STARTER_SKUS } from "@/lib/feed";
import { AddButton, RemoveButton, ResetButton, RowEditor } from "./feed-client";

function bySku(rows: CsvRow[]): [string, CsvRow[]][] {
  const groups = new Map<string, CsvRow[]>();
  for (const r of rows) groups.set(r.sku, [...(groups.get(r.sku) ?? []), r]);
  return [...groups];
}

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  await connection(); // the feed changes at runtime
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const feed = bySku(await listFeed());
  const inFeed = new Set(feed.map(([sku]) => sku));

  // Catalogue SKUs not in the feed yet, filtered by the search box
  const candidates = bySku(loadCatalog().rows)
    .filter(([sku]) => !inFeed.has(sku))
    .filter(
      ([sku, [r]]) =>
        !q || sku.toLowerCase().includes(q) || r.title_en.toLowerCase().includes(q) || r.brand_en.toLowerCase().includes(q),
    )
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">XML feed</h1>
        <p className="text-sm text-stone-600">
          Products in mixa&apos;s XML feed. Starts with the first {STARTER_SKUS} SKUs. Add, edit or
          remove here and the feed changes right away, no deploy. mixa picks it up on its next sync.
          Prices here only change the feed; checkout on this store still uses the CSV price.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <code className="rounded-md bg-stone-100 px-2 py-1">{config.siteUrl}/api/feed</code>
          <a href="/api/feed" className="rounded-md border border-stone-300 bg-white px-3 py-1.5">
            Open feed
          </a>
          <ResetButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          In the feed: {feed.length} SKUs, {feed.reduce((n, [, rows]) => n + rows.length, 0)} rows
        </h2>
        {feed.length === 0 && <p className="text-sm text-stone-600">Empty feed. Add products below.</p>}
        {feed.map(([sku, rows]) => (
          <div key={sku} className="rounded-lg border border-stone-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-3 py-2">
              <Link href={`/products/${encodeURIComponent(sku)}`} className="font-mono text-xs underline">
                {sku}
              </Link>
              <span className="text-xs text-stone-500">{rows[0].brand_en}</span>
              <span className="ms-auto">
                <RemoveButton sku={sku} />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-stone-500">
                  <tr>
                    <th className="p-2 text-start font-normal">Market</th>
                    <th className="p-2 text-start font-normal">Title</th>
                    <th className="p-2 text-start font-normal">MRP</th>
                    <th className="p-2 text-start font-normal">Price</th>
                    <th className="p-2" />
                    <th className="p-2 text-start font-normal">Stock</th>
                    <th className="p-2 text-start font-normal">Status</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r) => (
                    <RowEditor key={`${r.sku}|${r.country}|${JSON.stringify(r)}`} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Add from data/products.csv</h2>
        <form className="flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search SKU, title or brand"
            className="w-72 rounded-md border border-stone-300 px-3 py-1.5"
          />
          <button className="rounded-md border border-stone-300 bg-white px-3 py-1.5">Search</button>
        </form>
        {candidates.length === 0 ? (
          <p className="text-sm text-stone-600">
            {inFeed.size === new Set(loadCatalog().rows.map((r) => r.sku)).size
              ? "Every SKU is already in the feed."
              : "No match."}
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white text-sm">
            {candidates.map(([sku, rows]) => (
              <li key={sku} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="font-mono text-xs">{sku}</span>
                <span className="min-w-0 flex-1 truncate">{rows[0].title_en}</span>
                <span className="text-xs text-stone-500">{rows.map((r) => r.country).join(", ")}</span>
                <AddButton sku={sku} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
