export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-emerald-100 text-emerald-800"
      : status === "cancelled"
        ? "bg-stone-200 text-stone-700"
        : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

/** HTTP status from mixa, coloured like the guide's response table. */
export function HttpPill({ status, error }: { status: number | null; error?: string }) {
  if (status === null)
    return <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-800" title={error}>ERR</span>;
  const tone = status < 300 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  return <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${tone}`}>{status}</span>;
}
