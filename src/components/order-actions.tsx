"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Order, WebhookKind } from "@/lib/orders";

const LABEL: Record<Exclude<WebhookKind, "paid">, string> = {
  cancel: "Cancel",
  refund: "Refund",
  resend: "Resend paid",
};

export function OrderActions({ orderNumber, status }: Pick<Order, "orderNumber" | "status">) {
  const router = useRouter();
  const [busy, setBusy] = useState<WebhookKind | null>(null);
  const [result, setResult] = useState("");

  async function run(kind: Exclude<WebhookKind, "paid">) {
    if (kind !== "resend" && !confirm(`${LABEL[kind]} order ${orderNumber}?`)) return;
    setBusy(kind);
    setResult("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      setResult(data.error ? `error: ${data.error}` : `mixa → ${data.status}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(LABEL) as (keyof typeof LABEL)[])
        .filter((k) => k === "resend" || status === "paid")
        .map((k) => (
          <button
            key={k}
            onClick={() => run(k)}
            disabled={busy !== null}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
              k === "resend" ? "border-stone-300" : "border-red-300 text-red-700"
            }`}
          >
            {busy === k ? "Sending…" : LABEL[k]}
          </button>
        ))}
      {result && <span role="status" className="font-mono text-xs text-stone-600">{result}</span>}
    </div>
  );
}
