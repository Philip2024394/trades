// POST /api/trade-off/downloads/upsert
// Magic-link authenticated. Body: { slug, edit_token, download: { id?, ... } }.
// When id is present, UPDATE WHERE listing_id matches (cross-listing
// tamper guard). Otherwise INSERT — but only if the listing has fewer
// than 20 live downloads already (per-listing cap mirrors the editor
// nudge).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_LIVE_PER_LISTING = 20;

const FILE_TYPES = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "other"
]);
const CATEGORIES = new Set([
  "brochure", "form", "compliance", "catalogue", "qualification", "other"
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

function nonNegIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
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
  const dlIn = (body.download && typeof body.download === "object"
    ? body.download
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
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const name = s(dlIn.name).slice(0, 120);
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "File name is required." },
      { status: 400 }
    );
  }

  const descriptionRaw = s(dlIn.description);
  const description =
    descriptionRaw.length > 0 ? descriptionRaw.slice(0, 1000) : null;

  const file_url = s(dlIn.file_url).slice(0, 600);
  if (!file_url) {
    return NextResponse.json(
      { ok: false, error: "Upload a file first." },
      { status: 400 }
    );
  }

  const fileTypeRaw = s(dlIn.file_type).toLowerCase();
  if (!FILE_TYPES.has(fileTypeRaw)) {
    return NextResponse.json(
      { ok: false, error: "file_type must be one of the allowed values." },
      { status: 400 }
    );
  }

  const categoryRaw = s(dlIn.category).toLowerCase();
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "other";

  const requires_email = dlIn.requires_email === true || dlIn.requires_email === "true";

  const coverRaw = s(dlIn.cover_image_url);
  const cover_image_url = coverRaw.length > 0 ? coverRaw.slice(0, 600) : null;

  const statusRaw = s(dlIn.status);
  const status: "live" | "archived" =
    statusRaw === "archived" ? "archived" : "live";
  const sort_order = nonNegInt(dlIn.sort_order);
  const file_size_bytes = nonNegIntOrNull(dlIn.file_size_bytes);

  const patch = {
    name,
    description,
    file_url,
    file_type: fileTypeRaw,
    file_size_bytes,
    category,
    requires_email,
    cover_image_url,
    status,
    sort_order
  };

  const idRaw = s(dlIn.id);
  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid download id." },
        { status: 400 }
      );
    }
    const upd = await supabaseAdmin
      .from("hammerex_xrated_downloads")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/downloads/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "Download not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, download: upd.data });
  }

  // INSERT path — enforce the per-listing cap server-side. The editor
  // also caps client-side, but a leaked token shouldn't be able to spam
  // the table beyond the documented limit.
  if (status === "live") {
    const countRes = await supabaseAdmin
      .from("hammerex_xrated_downloads")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.data.id)
      .eq("status", "live");
    if (countRes.error) {
      console.error("[trade-off/downloads/upsert] count failed:", countRes.error);
      return NextResponse.json(
        { ok: false, error: countRes.error.message },
        { status: 500 }
      );
    }
    if ((countRes.count ?? 0) >= MAX_LIVE_PER_LISTING) {
      return NextResponse.json(
        {
          ok: false,
          error: `You already have ${MAX_LIVE_PER_LISTING} live downloads. Archive one first.`
        },
        { status: 400 }
      );
    }
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_downloads")
    .insert({ ...patch, listing_id: listing.data.id })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[trade-off/downloads/upsert] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, download: ins.data });
}
