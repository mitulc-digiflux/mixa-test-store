import Link from "next/link";
import { loadCatalog, searchProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export default async function ShopPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
  const { countries } = loadCatalog();
  const country = countries.includes(one(sp.country).toUpperCase())
    ? one(sp.country).toUpperCase()
    : (countries[0] ?? "AE");
  const q = one(sp.q);
  const result = searchProducts({ q, country, page: Number(one(sp.page)) || 1 });

  const pageHref = (page: number) => {
    const p = new URLSearchParams({ country, page: String(page) });
    if (q) p.set("q", q);
    return `/?${p}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-wrap items-end gap-3" action="/">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">Search</span>
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Title, brand or SKU"
            className="w-64 rounded-md border border-stone-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">Market</span>
          <select
            name="country"
            defaultValue={country}
            className="rounded-md border border-stone-300 bg-white px-3 py-2"
          >
            {countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white">
          Apply
        </button>
        <span className="ms-auto text-sm text-stone-500">
          {result.total.toLocaleString()} active products in {country}
        </span>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {result.items.map((p) => (
          <ProductCard key={`${p.sku}-${p.country}`} product={p} />
        ))}
      </div>

      {result.pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {result.page > 1 && (
            <Link href={pageHref(result.page - 1)} className="rounded-md border px-3 py-1.5">
              Previous
            </Link>
          )}
          <span className="text-stone-500">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages && (
            <Link href={pageHref(result.page + 1)} className="rounded-md border px-3 py-1.5">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
