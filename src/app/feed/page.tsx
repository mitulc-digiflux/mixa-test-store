import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { loadCatalog, type CsvRow } from "@/lib/catalog";
import { config } from "@/lib/config";
import { listFeed, STARTER_SKUS, withLinks } from "@/lib/feed";
import { AddButton, MarketEditor, RemoveButton, ResetButton } from "./feed-client";

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
        <p className="text-sm text-stone-600">
          Google Shopping RSS, like real brands send it: one URL per market and language, price as
          &quot;279.89 AED&quot;, stock only as availability, the same <code>g:id</code> in EN and
          AR. Add <code>&amp;style=channable</code> for plain title/link/description and
          &quot;in_stock&quot; (like revibe); the default is every field g:-prefixed (like ra7eek).
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {[...new Set(feed.flatMap(([, rows]) => rows.map((r) => (r.country || "AE").toUpperCase())))]
            .sort()
            .flatMap((country) =>
              (["en", "ar"] as const).map((lang) => {
                const path = `/api/feed?country=${country}&lang=${lang}`;
                return (
                  <li key={path} className="flex flex-wrap items-center gap-2">
                    <span className="w-16 text-xs text-stone-500">
                      {country} · {lang.toUpperCase()}
                    </span>
                    <a href={path} className="break-all font-mono text-xs underline">
                      {config.siteUrl}
                      {path}
                    </a>
                  </li>
                );
              }),
            )}
        </ul>
        <div>
          <ResetButton />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          In the feed: {feed.length} SKUs, {feed.reduce((n, [, rows]) => n + rows.length, 0)} rows
        </h2>
        {feed.length === 0 && <p className="text-sm text-stone-600">Empty feed. Add products below.</p>}
        {feed.length > 0 && (
          <p className="text-sm text-stone-600">
            Each <strong>market</strong> (AE, SA) has its own price, stock and status. Inside it, each{" "}
            <strong>language</strong> (EN, AR) has its own title, description and link, and can be switched off on
            its own: that is what the matching feed URL above serves.
          </p>
        )}
        {feed.map(([sku, rows]) => (
          <article key={sku} className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3">
            <header className="flex flex-wrap items-center gap-3">
              {rows[0].image_1 && (
                <Image src={rows[0].image_1} alt="" width={40} height={50} className="h-[50px] w-10 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link href={`/products/${encodeURIComponent(sku)}`} className="font-mono text-xs underline">
                    {sku}
                  </Link>
                  <span className="text-xs text-stone-500">{rows[0].brand_en}</span>
                </div>
                <p className="truncate text-sm font-medium">{rows[0].title_en}</p>
              </div>
              {rows.length > 1 && <RemoveButton sku={sku} markets={rows.length} />}
            </header>
            {rows.map((r) => (
              <MarketEditor key={`${r.sku}|${r.country}`} row={withLinks(r, true)} />
            ))}
          </article>
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
