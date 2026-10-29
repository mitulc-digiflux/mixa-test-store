import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarkets, getProduct } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { ProductActions } from "./product-actions";

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/products/[sku]">) {
  const { sku: rawSku } = await params;
  const sp = await searchParams;
  const sku = decodeURIComponent(rawSku);
  const markets = getMarkets(sku);
  const country = (typeof sp.country === "string" ? sp.country : markets[0]?.country) || "AE";
  const p = getProduct(sku, country);
  if (!p) notFound();

  const ar = sp.lang === "ar" && !!p.titleAr;
  const title = ar ? p.titleAr : p.title;
  const description = ar ? p.descriptionAr || p.description : p.description;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="grid grid-cols-3 gap-2">
        {p.images.map((src, i) => (
          <div
            key={src}
            className={`relative aspect-[4/5] overflow-hidden rounded-lg bg-stone-100 ${i === 0 ? "col-span-3" : ""}`}
          >
            <Image
              src={src}
              alt={i === 0 ? title : ""}
              fill
              priority={i === 0}
              sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "17vw"}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-stone-500">{p.sku}</span>
          {markets.map((m) => (
            <Link
              key={m.country}
              href={`/products/${encodeURIComponent(sku)}?country=${m.country}`}
              className={`rounded-full border px-2 py-0.5 ${m.country === p.country ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
            >
              {m.country} · {m.currency}
            </Link>
          ))}
          {p.titleAr && (
            <Link
              href={`/products/${encodeURIComponent(sku)}?country=${p.country}${ar ? "" : "&lang=ar"}`}
              className="ms-auto underline"
            >
              {ar ? "English" : "العربية"}
            </Link>
          )}
        </div>

        <div dir={ar ? "rtl" : "ltr"} className="flex flex-col gap-2">
          <span className="text-sm uppercase tracking-wide text-stone-500">{p.brand}</span>
          <h1 className="text-2xl font-semibold text-balance">{title}</h1>
          <p className="text-sm text-stone-500">
            {p.category}
            {p.gender && ` · ${p.gender}`}
          </p>
        </div>

        <p className="text-xl">
          <span className="font-semibold">{formatMoney(p.price, p.currency)}</span>
          {p.mrp > p.price && (
            <span className="ms-3 text-base text-stone-400 line-through">
              {formatMoney(p.mrp, p.currency)}
            </span>
          )}
        </p>

        <ProductActions
          country={p.country}
          item={{
            sku: p.sku,
            title: p.title,
            price: p.price,
            currency: p.currency,
            image: p.images[0],
          }}
          inStock={p.inventory > 0 && p.status === "ACTIVE"}
        />

        <p dir={ar ? "rtl" : "ltr"} className="text-sm leading-relaxed text-stone-700">
          {description}
        </p>
        <p className="text-xs text-stone-400">
          Stock {p.inventory} · status {p.status}
        </p>
      </div>
    </div>
  );
}
