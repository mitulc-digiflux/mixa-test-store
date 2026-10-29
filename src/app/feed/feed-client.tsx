"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function RemoveButton({ sku }: { sku: string }) {
  const { busy, run } = useFeedAction();
  return (
    <button
      onClick={() => run({ action: "remove", sku }, `Remove ${sku} (all markets) from the feed?`)}
      disabled={busy}
      className={`${button} border-red-300 text-red-700`}
    >
      {busy ? "Removing…" : "Remove"}
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

const input = "w-full rounded border border-stone-300 px-1.5 py-1 text-xs";

/** One market row: edit what mixa syncs (title, prices, stock, status). */
export function RowEditor({ row }: { row: CsvRow }) {
  const { busy, result, run } = useFeedAction();
  const [patch, setPatch] = useState({
    title_en: row.title_en,
    mrp: row.mrp,
    selling_price: row.selling_price,
    inventoryQuantity: row.inventoryQuantity,
    status: (row.status || "").toUpperCase(),
  });
  const set = (key: keyof typeof patch) => (e: { target: { value: string } }) =>
    setPatch((p) => ({ ...p, [key]: e.target.value }));
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).some(
    (k) => patch[k] !== (k === "status" ? (row.status || "").toUpperCase() : row[k]),
  );

  return (
    <tr className="align-middle">
      <td className="p-2 font-mono text-xs">{row.country}</td>
      <td className="p-2">
        <input value={patch.title_en} onChange={set("title_en")} className={input} aria-label="Title" />
      </td>
      <td className="p-2">
        <input value={patch.mrp} onChange={set("mrp")} inputMode="decimal" className={`${input} w-20`} aria-label={`MRP (${row.currency})`} />
      </td>
      <td className="p-2">
        <input value={patch.selling_price} onChange={set("selling_price")} inputMode="decimal" className={`${input} w-20`} aria-label={`Selling price (${row.currency})`} />
      </td>
      <td className="p-2 text-xs text-stone-500">{row.currency}</td>
      <td className="p-2">
        <input value={patch.inventoryQuantity} onChange={set("inventoryQuantity")} inputMode="numeric" className={`${input} w-16`} aria-label="Stock" />
      </td>
      <td className="p-2">
        <select value={patch.status} onChange={set("status")} className={input} aria-label="Status">
          <option value="ACTIVE">ACTIVE</option>
          <option value="DRAFT">DRAFT</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </td>
      <td className="p-2 whitespace-nowrap">
        <button
          onClick={() => run({ action: "update", sku: row.sku, country: row.country, patch })}
          disabled={busy || !changed}
          className={button}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {result.startsWith("error") && <span className="ms-2 text-xs text-red-700">{result}</span>}
      </td>
    </tr>
  );
}
