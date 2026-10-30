import Link from "next/link";
import { connection } from "next/server";
import { config, configProblems } from "@/lib/config";
import { loadCatalog } from "@/lib/catalog";
import { MIXA_SDK_SRC } from "@/components/tracking-scripts";
import { AttributionDebug } from "./attribution-debug";

function mask(secret: string): string {
  return secret ? `${secret.slice(0, 4)}…${secret.slice(-2)} (${secret.length} chars)` : "—";
}

export default async function SetupPage() {
  await connection(); // show the env this server is running with
  const problems = configProblems();
  const { products, countries } = loadCatalog();
  const skuCount = new Set(products.map((p) => p.sku)).size;
  const sample = products.find((p) => p.status === "ACTIVE");
  const gtmSnippet = `<script async src="${MIXA_SDK_SRC}"\n        data-brand="${config.brandId || "YOUR_BRAND_ID"}"></script>`;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Setup</h1>

      {problems.length > 0 && (
        <ul className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {problems.map((p) => (
            <li key={p}>• {p} (edit .env.local and restart)</li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">1. Catalogue CSV for the mixa Brands portal</h2>
        <p className="text-sm text-stone-600">
          {skuCount.toLocaleString()} SKUs, {products.length.toLocaleString()} rows, markets{" "}
          {countries.join(", ")}. The export rewrites <code>destinationUrl</code> to{" "}
          <code>{config.siteUrl}/products/…</code> so creator links land on this store. Upload it in
          Catalog → Upload CSV.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {[10, 0].map((n) => (
            <a
              key={n}
              href={`/api/catalog${n ? `?limit=${n}` : ""}`}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5"
            >
              Download {n ? `${n} SKUs` : "all SKUs"}
            </a>
          ))}
          <a href="/api/catalog?rewrite=0" className="rounded-md px-3 py-1.5 text-stone-500 underline">
            data/products.csv as stored
          </a>
        </div>
        <p className="text-sm text-stone-600">
          Or add <code>{config.siteUrl}/api/feed?country=AE&amp;lang=en</code> as an XML feed
          (Catalog → XML feed). It is Google Shopping RSS like real brands send, one URL per market
          and language. Pick which products are in it on{" "}
          <Link href="/feed" className="underline">XML feed</Link>.
        </p>
        {config.siteUrl.includes("localhost") && (
          <p className="text-xs text-amber-700">
            SITE_URL is localhost. Creator links from mixa will only open on this machine, and mixa
            can&apos;t fetch the XML feed at all. Use a tunnel (ngrok / cloudflared) or a deploy URL.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">2. Website tracking</h2>
        <p className="text-sm text-stone-600">
          Mode <b>{config.trackingMode}</b>
          {config.trackingMode === "gtm" && <> · container <code>{config.gtmId || "—"}</code></>}
          {config.trackingMode === "direct" && <> · data-brand <code>{config.publicBrandId || "—"}</code></>}
        </p>
        {config.trackingMode === "gtm" && (
          <div className="text-sm text-stone-600">
            In GTM: Tags → New → <b>Custom HTML</b>, paste this, trigger <b>All Pages</b>, then
            Submit / Publish.
            <pre className="mt-2 overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">{gtmSnippet}</pre>
          </div>
        )}
        <AttributionDebug sampleUrl={sample ? `/products/${encodeURIComponent(sample.sku)}?country=${sample.country}` : "/"} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">3. Order webhook</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-stone-500">URL</dt>
          <dd className="font-mono">{config.webhookUrl}</dd>
          <dt className="text-stone-500">Brand ID</dt>
          <dd className="font-mono">{config.brandId || "—"}</dd>
          <dt className="text-stone-500">Secret</dt>
          <dd className="font-mono">{mask(config.webhookSecret)}</dd>
          <dt className="text-stone-500">shopUrl sent</dt>
          <dd className="font-mono">{config.siteUrl}</dd>
        </dl>
        <p className="text-xs text-stone-500">
          Paid = sent when you press Pay. Cancel sends <code>event: order.cancelled</code>. Refund
          sends <code>event: order.refunded</code> (the guide leaves the refund format to
          onboarding).
        </p>
      </section>
    </div>
  );
}
