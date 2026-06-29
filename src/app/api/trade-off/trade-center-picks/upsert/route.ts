// POST /api/trade-off/trade-center-picks/upsert
// Magic-link authenticated. Body: { slug, edit_token, pick: { id?, ... } }.
// When `id` is present, UPDATE WHERE listing_id matches (cross-listing
// tamper guard). Otherwise INSERT — but only if the listing has fewer
// than 24 picks already, and only if the product_id belongs to the
// same listing (we never let a merchant pin another merchant's
// product).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_PICKS_PER_LISTING = 24;
const NOTE_MAX = 200;
// Commercial-detail field limits — kept in lock-step with the DB CHECK
// constraints on the picks table and the editor's client-side caps.
const LONG_DESC_MAX = 1200;
const CTA_LABEL_MAX = 60;
const ARRIVAL_WINDOW_MAX = 60;
const VALID_STATUSES = new Set([
  "on_promo",
  "new_arrival",
  "just_arrived",
  "pre_order"
]);

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function stringOrNull(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// Display-only price in pence. NULL = unset. Negative / non-finite =
// reject (the DB CHECK would catch this but we'd rather 400 cleanly).
function pencePriceOrNull(v: unknown): number | null | "invalid" {
  if (v === null || typeof v === "undefined" || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return "invalid";
  if (n < 0) return "invalid";
  return Math.round(n);
}

// Three-state boolean — TRUE / FALSE / NULL. Anything else (string,
// number, undefined) becomes NULL so the editor's "Not specified"
// default round-trips cleanly.
function tristateBoolean(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  return null;
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
  const pickIn = (body.pick && typeof body.pick === "object"
    ? body.pick
    : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 403 }
    );
  }

  const product_id = s(pickIn.product_id);
  if (!product_id || !UUID_RE.test(product_id)) {
    return NextResponse.json(
      { ok: false, error: "Pick a product first." },
      { status: 400 }
    );
  }

  const status = s(pickIn.status);
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { ok: false, error: "Pick a status." },
      { status: 400 }
    );
  }

  const arrival_at = isoOrNull(pickIn.arrival_at);
  const expires_at = isoOrNull(pickIn.expires_at);
  const note = stringOrNull(pickIn.note, NOTE_MAX);
  const sort_order = nonNegInt(pickIn.sort_order);

  // ── Commercial-detail fields (all optional, NULL is valid) ──────────
  const long_description = stringOrNull(pickIn.long_description, LONG_DESC_MAX);
  const cta_price_raw = pencePriceOrNull(pickIn.cta_price_pence);
  if (cta_price_raw === "invalid") {
    return NextResponse.json(
      { ok: false, error: "Price must be a non-negative number." },
      { status: 400 }
    );
  }
  const cta_price_pence = cta_price_raw;
  const cta_price_label = stringOrNull(pickIn.cta_price_label, CTA_LABEL_MAX);
  const arrival_window_label = stringOrNull(
    pickIn.arrival_window_label,
    ARRIVAL_WINDOW_MAX
  );
  const delivery_available = tristateBoolean(pickIn.delivery_available);
  const installation_available = tristateBoolean(pickIn.installation_available);

  // Cross-listing tamper guard — only the listing's own products can
  // be pinned. This is the defence behind the DB FK; we want a clean
  // 400 instead of an opaque FK violation when a stale token POSTs an
  // alien product id.
  const prod = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .eq("id", product_id)
    .maybeSingle();
  if (!prod.data) {
    return NextResponse.json(
      { ok: false, error: "Product not found." },
      { status: 404 }
    );
  }
  if (prod.data.listing_id !== listing.data.id) {
    return NextResponse.json(
      { ok: false, error: "Product does not belong to this listing." },
      { status: 403 }
    );
  }

  const idRaw = s(pickIn.id);

  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid pick id." },
        { status: 400 }
      );
    }
    const patch = {
      status,
      arrival_at,
      expires_at,
      note,
      sort_order,
      long_description,
      cta_price_pence,
      cta_price_label,
      arrival_window_label,
      delivery_available,
      installation_available
    };
    const upd = await supabaseAdmin
      .from("hammerex_xrated_trade_center_picks")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-center-picks/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "Pick not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, pick: upd.data });
  }

  // INSERT path — enforce per-listing cap.
  const countRes = await supabaseAdmin
    .from("hammerex_xrated_trade_center_picks")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing.data.id);
  if (countRes.error) {
    console.error("[trade-center-picks/upsert] count failed:", countRes.error);
    return NextResponse.json(
      { ok: false, error: countRes.error.message },
      { status: 500 }
    );
  }
  if ((countRes.count ?? 0) >= MAX_PICKS_PER_LISTING) {
    return NextResponse.json(
      {
        ok: false,
        error: `You already have ${MAX_PICKS_PER_LISTING} picks. Remove one first.`
      },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_trade_center_picks")
    .insert({
      listing_id: listing.data.id,
      product_id,
      status,
      arrival_at,
      expires_at,
      note,
      sort_order,
      long_description,
      cta_price_pence,
      cta_price_label,
      arrival_window_label,
      delivery_available,
      installation_available,
      effective_at: new Date().toISOString()
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[trade-center-picks/upsert] insert failed:", ins.error);
    // A unique-violation here means the merchant tried to pin a
    // product they've already pinned — translate to a friendlier
    // message so the UI doesn't surface raw Postgres errors.
    const dup =
      typeof ins.error?.message === "string" &&
      ins.error.message.toLowerCase().includes("duplicate");
    return NextResponse.json(
      {
        ok: false,
        error: dup
          ? "That product is already pinned — edit the existing pick instead."
          : ins.error?.message ?? "Insert failed"
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, pick: ins.data });
}
