/** Always two decimals: "AED 80.00". */
export function formatMoney(value: number, currency: string): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
