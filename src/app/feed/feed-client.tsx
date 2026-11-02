"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { CsvRow } from "@/lib/catalog";

async function send(body: object): Promise<string> {
  const res = await fetch("/api/feed/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.error ? `error: ${data.error}` : `feed now has ${data.skus} SKUs (${data.rows} rows)`;
}

function useFeedAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function run(body: object, ask?: string) {
    if (ask && !confirm(ask)) return;
    setBusy(true);
    setResult("");
    try {
      setResult(await send(body));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return { busy, result, run };
}

const button = "rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-50";
const danger = `${button} border-red-300 text-red-700`;
const primary = "rounded-md border border-stone-900 bg-stone-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50";

export function AddButton({ sku }: { sku: string }) {
  const { busy, result, run } = useFeedAction();
  return (
    <span className="flex items-center gap-2">
      <button onClick={() => run({ action: "add", sku })} disabled={busy} className={button}>
        {busy ? "Adding…" : "Add to feed"}
      </button>
      {result.startsWith("error") && <span className="text-xs text-red-700">{result}</span>}
    </span>
  );
}

export function RemoveButton({ sku, markets }: { sku: string; markets: number }) {
  const { busy, run } = useFeedAction();
  return (
    <button
      type="button"
      onClick={() => run({ action: "remove", sku }, `Remove ${sku} from the feed in all ${markets} markets?`)}
      disabled={busy}
      className={danger}
    >
      {busy ? "Removing…" : `Remove SKU (all ${markets} markets)`}
    </button>
  );
}

export function ResetButton() {
  const { busy, result, run } = useFeedAction();
  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => run({ action: "reset" }, "Reset the feed to the first 10 SKUs? Your edits are lost.")}
        disabled={busy}
        className={button}
      >
        {busy ? "Resetting…" : "Reset to first 10"}
      </button>
      {result && <span role="status" className="font-mono text-xs text-stone-600">{result}</span>}
    </span>
  );
}

const input = "w-full rounded border border-stone-300 px-2 py-1 text-xs";
const label = "text-xs text-stone-500";

const FIELDS = [
  "title_en",
  "title_ar",
  "description_en",
  "description_ar",
  "destinationUrl",
  "destinationurl_ar",
  "mrp",
  "selling_price",
  "inventoryQuantity",
  "status",
] as const;
type Field = (typeof FIELDS)[number];

const LANGS = [
  { code: "en", name: "EN", dir: "ltr", title: "title_en", description: "description_en", url: "destinationUrl", status: "status_en" },
  { code: "ar", name: "AR", dir: "rtl", title: "title_ar", description: "description_ar", url: "destinationurl_ar", status: "status_ar" },
] as const;

function initial(row: CsvRow): Record<Field, string> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, row[k] ?? ""])) as Record<Field, string>;
  values.status = values.status.toUpperCase();
  return values;
}

/**
 * One market of a SKU (one CSV row): price, stock and status for the market,
 * then one block per language (EN / AR feed) with its own on/off switch,
 * title, link and description. Save sends only the fields that changed.
 */
export function MarketEditor({ row }: { row: CsvRow }) {
  const { busy, result, run } = useFeedAction();
  const id = useId();
  const start = initial(row);
  const [values, setValues] = useState(start);
  // After a save the server sends the new row: take it as the new baseline,
  // but keep fields the user is still editing (e.g. a one-click EN/AR toggle mid-edit).
  const snapshot = JSON.stringify(row);
  const [seen, setSeen] = useState(snapshot);
  if (seen !== snapshot) {
    const before = initial(JSON.parse(seen) as CsvRow);
    setSeen(snapshot);
    setValues((v) => {
      const next = { ...start };
      for (const k of FIELDS) if (v[k] !== before[k]) next[k] = v[k];
      return next;
    });
  }

  const set = (key: Field) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const patch = Object.fromEntries(FIELDS.filter((k) => values[k] !== start[k]).map((k) => [k, values[k]]));
  const changed = Object.keys(patch).length > 0;
  const error = result.startsWith("error") ? result : "";
  const marketOff = values.status !== "ACTIVE";
  const savedMarketOff = (row.status || "").toUpperCase() !== "ACTIVE";

  return (
    <section aria-labelledby={`${id}-market`} className="rounded-md border border-stone-200">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2">
        <h3 id={`${id}-market`} className="text-sm font-medium">
          {row.country} market
        </h3>
        <span className="text-xs text-stone-500">prices in {row.currency}</span>
        <span className="ms-auto flex items-center gap-2">
          {changed && <span className="text-xs text-amber-700">Unsaved changes</span>}
          {!changed && result && !error && (
            <span role="status" className="text-xs text-green-700">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => run({ action: "update", sku: row.sku, country: row.country, patch })}
            disabled={busy || !changed}
            className={changed ? primary : button}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() =>
              run(
                { action: "removeRow", sku: row.sku, country: row.country },
                `Remove ${row.sku} from the ${row.country} feeds (EN and AR)? Other markets stay.`,
              )
            }
            disabled={busy}
            className={danger}
          >
            Remove {row.country} market
          </button>
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-mrp`} className={label}>
            MRP ({row.currency})
          </label>
          <input id={`${id}-mrp`} value={values.mrp} onChange={set("mrp")} inputMode="decimal" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-price`} className={label}>
            Selling price ({row.currency})
          </label>
          <input id={`${id}-price`} value={values.selling_price} onChange={set("selling_price")} inputMode="decimal" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-stock`} className={label}>
            Stock
          </label>
          <input id={`${id}-stock`} value={values.inventoryQuantity} onChange={set("inventoryQuantity")} inputMode="numeric" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-status`} className={label}>
            Market status (EN + AR)
          </label>
          <select id={`${id}-status`} value={values.status} onChange={set("status")} className={input}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 px-3 pb-3 md:grid-cols-2">
        {LANGS.map((lang) => {
          const langOff = (row[lang.status] || "ACTIVE").toUpperCase() !== "ACTIVE";
          const off = marketOff || langOff;
          const feedName = `${row.country} · ${lang.name}`;
          const custom = row[`_custom_${lang.url}`] === "1";
          const f = (name: string) => `${id}-${lang.code}-${name}`;
          return (
            <div
              key={lang.code}
              role="group"
              aria-labelledby={f("head")}
              className={`flex flex-col gap-2 rounded border p-2.5 ${off ? "border-dashed border-stone-300 bg-stone-50" : "border-stone-200"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 id={f("head")} className="text-xs font-semibold">
                  {row.country} · {lang.name} feed
                </h4>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${off ? "bg-stone-200 text-stone-600" : "bg-green-100 text-green-800"}`}>
                  {off ? "not in feed" : "in feed"}
                </span>
                {/* Saves right away, only this language's switch. */}
                <button
                  type="button"
                  onClick={() =>
                    run(
                      { action: "update", sku: row.sku, country: row.country, patch: { [lang.status]: langOff ? "ACTIVE" : "INACTIVE" } },
                      langOff
                        ? undefined
                        : `Remove ${row.sku} from the ${feedName} feed? It stays in the other language. You can add it back here.`,
                    )
                  }
                  disabled={busy || savedMarketOff}
                  className={`ms-auto ${langOff ? button : danger}`}
                >
                  {langOff ? `Add back to ${lang.name} feed` : `Remove from ${lang.name} feed`}
                </button>
              </div>
              {marketOff && <p className="text-xs text-stone-500">The whole {row.country} market is {values.status}.</p>}

              <label htmlFor={f("title")} className={label}>
                Title
              </label>
              <input id={f("title")} value={values[lang.title]} onChange={set(lang.title)} dir={lang.dir} lang={lang.code} className={input} />

              <label htmlFor={f("url")} className={label}>
                Link{" "}
                <span className="text-stone-400">{custom ? "(custom, clear it to use the store link)" : "(store link)"}</span>
              </label>
              <input
                id={f("url")}
                type="url"
                value={values[lang.url]}
                onChange={set(lang.url)}
                dir="ltr"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={`${input} font-mono`}
              />

              <details>
                <summary className={`${label} cursor-pointer`}>Description</summary>
                <textarea
                  id={f("desc")}
                  aria-label={`${lang.name} description`}
                  value={values[lang.description]}
                  onChange={set(lang.description)}
                  dir={lang.dir}
                  lang={lang.code}
                  rows={4}
                  className={`${input} mt-1 resize-y [field-sizing:content] min-h-16 max-h-60`}
                />
              </details>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="px-3 pb-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
