// POST /api/trade-off/products/reorder
// Magic-link authenticated batch sort_order update for the Shop Mode /
// Services Prices product list. Body:
//   { slug, edit_token, ordering: [{ id: string, sort_order: int }] }
//
// Auth: constant-time edit_token compare against the listing row (mirrors
// upsert / delete). Cross-listing tamper guard: every id in `ordering`
// MUST belong to the listing — we fetch the listing's product ids first
// and reject the whole batch if any foreign id slips in.
//
// Writes are applied serially (one UPDATE per row) because Supabase has
// no native batch-by-id-value primitive. Order matters when multiple
// rows happen to share a tied sort_order — assigning gapped values
// (10, 20, 30…) on the client side keeps tie-breaks deterministic for
// future inserts.
//
// Response: { ok: true, updated: <count> } or { ok: false, error, status }.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_ENTRIES = 100;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type OrderingEntry = { id: string; sort_order: number };

function parseOrdering(v: unknown): { entries: OrderingEntry[]; error: string | null } {
  if (!Array.isArray(v)) {
    return { entries: [], error: "ordering must be an array." };
  }
  if (v.length === 0) {
    return { entries: [], error: "ordering must not be empty." };
  }
  if (v.length > MAX_ENTRIES) {
    return { entries: [], error: `ordering capped at ${MAX_ENTRIES} entries.` };
  }
  const out: OrderingEntry[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") {
      return { entries: [], error: "Each ordering entry must be an object." };
    }
    const rec = raw as Record<string, unknown>;
    const id = s(rec.id);
    if (!UUID_RE.test(id)) {
      return { entries: [], error: "Invalid product id in ordering." };
    }
    if (seen.has(id)) {
      return { entries: [], error: "Duplicate product id in ordering." };
    }
    seen.add(id);
    const n = Number(rec.sort_order);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000 || Math.floor(n) !== n) {
      return { entries: [], error: "sort_order must be a non-negative integer." };
    }
    out.push({ id, sort_order: n });
  }
  return { entries: out, error: null };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const { entries, error: orderingErr } = parseOrdering(body.ordering);
  if (orderingErr) {
    return NextResponse.json({ ok: false, error: orderingErr }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  // Cross-listing tamper guard — fetch every product id that lives under
  // this listing and reject if `ordering` references an id outside it.
  const productRows = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id")
    .eq("listing_id", listing.data.id);
  if (productRows.error) {
    console.error("[trade-off/products/reorder] product lookup failed:", productRows.error);
    return NextResponse.json(
      { ok: false, error: productRows.error.message },
      { status: 500 }
    );
  }
  const ownIds = new Set<string>((productRows.data ?? []).map((r) => r.id as string));
  for (const e of entries) {
    if (!ownIds.has(e.id)) {
      return NextResponse.json(
        { ok: false, error: "ordering references a product outside this listing." },
        { status: 400 }
      );
    }
  }

  // Apply updates serially. Supabase has no native batch-update-by-id-value
  // RPC for arbitrary integers; doing this in a loop is acceptable for the
  // ≤100-entry cap and keeps the auth check + listing_id constraint in one
  // place.
  let updated = 0;
  for (const e of entries) {
    const upd = await supabaseAdmin
      .from("hammerex_xrated_products")
      .update({ sort_order: e.sort_order })
      .eq("id", e.id)
      .eq("listing_id", listing.data.id)
      .select("id")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/products/reorder] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message, updated },
        { status: 500 }
      );
    }
    if (upd.data) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
