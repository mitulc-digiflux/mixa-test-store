import { NextResponse } from "next/server";
import { addSku, removeSku, resetFeed, updateRow, type FeedPatch } from "@/lib/feed";

type FeedAction =
  | { action: "add"; sku: string }
  | { action: "update"; sku: string; country: string; patch: FeedPatch }
  | { action: "remove"; sku: string }
  | { action: "reset" };

/** Changes the rows /api/feed serves. Used by the /feed page. */
export async function POST(req: Request) {
  const input = (await req.json().catch(() => ({}))) as Partial<FeedAction>;
  try {
    let rows;
    switch (input.action) {
      case "add":
        rows = await addSku(String(input.sku ?? ""));
        break;
      case "update":
        rows = await updateRow(String(input.sku ?? ""), String(input.country ?? ""), input.patch ?? {});
        break;
      case "remove":
        rows = await removeSku(String(input.sku ?? ""));
        break;
      case "reset":
        rows = await resetFeed();
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ rows: rows.length, skus: new Set(rows.map((r) => r.sku)).size });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
