// POST /api/trade-off/products/pair-with
//   { slug, edit_token, product_id, pairs: [{accessory_product_id, reason?, sort_order?}] }
//
// Replace-all semantics — the client sends the full pair list every
// save and the server wipes + re-inserts. Matches how gallery_urls +
// compare_with are handled elsewhere in the shop editor and keeps the
// client simple (one state array, one save call).
//
// Guards:
//   • Auth via slug + edit_token (constant-time compare)
//   • Anchor product must belong to the trade's listing
//   • Every accessory_product_id must also belong to the same listing
//   • Anchor ≠ accessory (self-pair enforced at DB level too)
//   • Cap at 12 pair rows per anchor
//
// GET /api/trade-off/products/pair-with?slug=&edit_token=&product_id=
// returns the current rows enriched with accessory name + cover_url.
// Used by the editor to seed its state on first open.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAIRS = 12;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function resolveListing(slug: string, token: string) {
  if (!slug || !token) {
    return { error: "Missing slug or edit_token." as const, status: 400 };
  }
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!res.data) {
    return { error: "Listing not found." as const, status: 404 };
  }
  if (!constantTimeEq(res.data.edit_token, token)) {
    return { error: "Invalid edit token." as const, status: 403 };
  }
  return { listingId: res.data.id as string };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = s(url.searchParams.get("slug"));
  const token = s(url.searchParams.get("edit_token"));
  const productId = s(url.searchParams.get("product_id"));
  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid product_id" },
      { status: 400 }
    );
  }
  const gate = await resolveListing(slug, token);
  if ("error" in gate) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status }
    );
  }

  // Confirm the anchor belongs to this listing.
  const anchor = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .eq("id", productId)
    .maybeSingle();
  if (!anchor.data || anchor.data.listing_id !== gate.listingId) {
    return NextResponse.json(
      { ok: false, error: "product_not_yours" },
      { status: 404 }
    );
  }

  const pairsRes = await supabaseAdmin
    .from("hammerex_xrated_pair_with")
    .select("id, accessory_product_id, reason, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  const pairRows = pairsRes.data ?? [];

  let enriched: Array<{
    id: string;
    accessory_product_id: string;
    accessory_name: string;
    accessory_cover_url: string | null;
    reason: string | null;
    sort_order: number;
  }> = [];
  if (pairRows.length > 0) {
    const ids = pairRows.map((r) => r.accessory_product_id);
    const accRes = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id, name, cover_url, listing_id")
      .in("id", ids);
    const accMap = new Map(
      (accRes.data ?? [])
        .filter((a) => a.listing_id === gate.listingId)
        .map((a) => [a.id as string, a])
    );
    enriched = pairRows
      .map((r) => {
        const acc = accMap.get(r.accessory_product_id);
        if (!acc) return null;
        return {
          id: r.id as string,
          accessory_product_id: r.accessory_product_id as string,
          accessory_name: acc.name as string,
          accessory_cover_url: (acc.cover_url as string | null) ?? null,
          reason: (r.reason as string | null) ?? null,
          sort_order: r.sort_order as number
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  return NextResponse.json({ ok: true, pairs: enriched });
}

type PairIn = {
  accessory_product_id?: unknown;
  reason?: unknown;
  sort_order?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const productId = s(body.product_id);
  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid product_id" },
      { status: 400 }
    );
  }
  const rawPairs = Array.isArray(body.pairs) ? (body.pairs as PairIn[]) : [];
  if (rawPairs.length > MAX_PAIRS) {
    return NextResponse.json(
      { ok: false, error: `Cap ${MAX_PAIRS} pairs per product.` },
      { status: 400 }
    );
  }

  const gate = await resolveListing(slug, token);
  if ("error" in gate) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status }
    );
  }

  // Anchor gate
  const anchor = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .eq("id", productId)
    .maybeSingle();
  if (!anchor.data || anchor.data.listing_id !== gate.listingId) {
    return NextResponse.json(
      { ok: false, error: "product_not_yours" },
      { status: 404 }
    );
  }

  // Normalise + validate every pair before touching the DB.
  const seen = new Set<string>();
  const cleaned: Array<{
    accessory_product_id: string;
    reason: string | null;
    sort_order: number;
  }> = [];
  for (let i = 0; i < rawPairs.length; i++) {
    const p = rawPairs[i];
    const acc = s(p.accessory_product_id);
    if (!UUID_RE.test(acc)) continue;
    if (acc === productId) continue; // self-pair skip
    if (seen.has(acc)) continue; // dedupe
    seen.add(acc);
    const rsn = s(p.reason);
    const so =
      typeof p.sort_order === "number" && Number.isFinite(p.sort_order)
        ? Math.max(0, Math.round(p.sort_order))
        : i;
    cleaned.push({
      accessory_product_id: acc,
      reason: rsn.length > 0 ? rsn.slice(0, 140) : null,
      sort_order: so
    });
  }

  // Ownership check on accessories in bulk.
  if (cleaned.length > 0) {
    const accCheck = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id, listing_id")
      .in(
        "id",
        cleaned.map((c) => c.accessory_product_id)
      );
    const ownedIds = new Set(
      (accCheck.data ?? [])
        .filter((r) => r.listing_id === gate.listingId)
        .map((r) => r.id as string)
    );
    for (const c of cleaned) {
      if (!ownedIds.has(c.accessory_product_id)) {
        return NextResponse.json(
          {
            ok: false,
            error: "accessory_not_yours",
            accessory_id: c.accessory_product_id
          },
          { status: 400 }
        );
      }
    }
  }

  // Replace-all — delete existing, insert cleaned.
  const del = await supabaseAdmin
    .from("hammerex_xrated_pair_with")
    .delete()
    .eq("product_id", productId);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: del.error.message },
      { status: 500 }
    );
  }

  if (cleaned.length > 0) {
    const ins = await supabaseAdmin
      .from("hammerex_xrated_pair_with")
      .insert(
        cleaned.map((c) => ({
          product_id: productId,
          accessory_product_id: c.accessory_product_id,
          reason: c.reason,
          sort_order: c.sort_order
        }))
      );
    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: "insert_failed", detail: ins.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, saved: cleaned.length });
}
