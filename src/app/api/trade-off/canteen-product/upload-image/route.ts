// POST /api/trade-off/canteen-product/upload-image
//
// Multipart file upload endpoint for the merchant product editor.
// Uses the same magic-link auth pattern as the sibling `save` endpoint
// (slug + edit_token) rather than the signed session cookie — this
// keeps the product editor self-contained and works from deep-links.
//
// Body (multipart/form-data):
//   file        — the image blob
//   slug        — merchant slug
//   edit_token  — magic-link token
//
// Response:
//   { ok: true, url, path, sizeBytes }
//
// Uploads to bucket "network-uploads" at:
//   merchant/{slug}/canteen-product/{uuid}.{ext}
//
// Editorial rules: NONE (per ADR-0007). Only file-hygiene gates:
//   - MIME must be image/*
//   - Size cap at 10 MB (cost control, not editorial)
//   - Rejects 0-byte files

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readTradeSession } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "network-uploads";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

function extensionForBlob(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "image/avif") return ".avif";
  return ".jpg";
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_multipart" }, { status: 400 });
  }

  const file = form.get("file");
  const providedSlug = String(form.get("slug") ?? "").trim();
  const providedToken = String(form.get("edit_token") ?? "").trim();

  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  // File-hygiene gates only. No editorial rules per ADR-0007.
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "not_an_image" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "too_large", limitBytes: MAX_BYTES },
      { status: 413 }
    );
  }

  // Auth precedence: body token → cookie session (Dev · Pass / normal
  // login). Either path resolves the merchant listing that owns the
  // upload path.
  let listing: { id: string; slug: string; edit_token: string; status: string } | null = null;
  if (providedSlug && providedToken) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, edit_token, status")
      .eq("slug", providedSlug)
      .maybeSingle();
    if (data && constantTimeEq(data.edit_token, providedToken)) {
      listing = data;
    }
  }
  if (!listing) {
    const session = readTradeSession(req as NextRequest);
    if (session?.listing_id) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, edit_token, status")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data) listing = data;
    }
  }
  if (!listing) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (listing.status !== "live") {
    return NextResponse.json({ ok: false, error: "listing_not_live" }, { status: 403 });
  }

  const ext = extensionForBlob(file);
  const path = `merchant/${listing.slug}/canteen-product/${crypto.randomUUID()}${ext}`;

  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      cacheControl: "31536000",
      upsert: false
    });

  if (upload.error) {
    // eslint-disable-next-line no-console
    console.error("[canteen-product/upload-image] storage upload", upload.error);
    return NextResponse.json(
      { ok: false, error: "storage_failed", detail: upload.error.message },
      { status: 500 }
    );
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(upload.data.path);

  return NextResponse.json({
    ok: true,
    url: urlData.publicUrl,
    path: upload.data.path,
    sizeBytes: file.size
  });
}
