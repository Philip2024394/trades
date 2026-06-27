// POST /api/trade-off/faq-items/reorder
// Magic-link authenticated batch sort_order update — same shape as
// downloads/reorder. Body:
//   { slug, edit_token, ordering: [{ id: string, sort_order: int }] }
// Cross-listing tamper guard: every id MUST belong to the listing.

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
      return { entries: [], error: "Invalid faq id in ordering." };
    }
    if (seen.has(id)) {
      return { entries: [], error: "Duplicate faq id in ordering." };
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

  const ownRows = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("id")
    .eq("listing_id", listing.data.id);
  if (ownRows.error) {
    console.error("[trade-off/faq-items/reorder] lookup failed:", ownRows.error);
    return NextResponse.json(
      { ok: false, error: ownRows.error.message },
      { status: 500 }
    );
  }
  const ownIds = new Set<string>((ownRows.data ?? []).map((r) => r.id as string));
  for (const e of entries) {
    if (!ownIds.has(e.id)) {
      return NextResponse.json(
        { ok: false, error: "ordering references a FAQ outside this listing." },
        { status: 400 }
      );
    }
  }

  let updated = 0;
  for (const e of entries) {
    const upd = await supabaseAdmin
      .from("hammerex_xrated_faq_items")
      .update({ sort_order: e.sort_order })
      .eq("id", e.id)
      .eq("listing_id", listing.data.id)
      .select("id")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/faq-items/reorder] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message, updated },
        { status: 500 }
      );
    }
    if (upd.data) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
