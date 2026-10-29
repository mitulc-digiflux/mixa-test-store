import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

export function ProductCard({ product: p }: { product: Product }) {
  const discounted = p.mrp > p.price;
  return (
    <Link
      href={`/products/${encodeURIComponent(p.sku)}?country=${p.country}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white"
    >
      <div className="relative aspect-[4/5] bg-stone-100">
        {p.images[0] && (
          <Image
            src={p.images[0]}
            alt={p.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition group-hover:scale-[1.02]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
        <span className="text-xs uppercase tracking-wide text-stone-500">{p.brand}</span>
        <span className="line-clamp-2 font-medium">{p.title}</span>
        <span className="mt-auto pt-1">
          <span className="font-semibold">{formatMoney(p.price, p.currency)}</span>
          {discounted && (
            <span className="ms-2 text-xs text-stone-400 line-through">
              {formatMoney(p.mrp, p.currency)}
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] text-stone-400">{p.sku}</span>
      </div>
    </Link>
  );
}
