// POST /api/trade-off/lead-photos
// Multipart upload helper for the Xrated contact form. Customer-selected
// photos land in Supabase Storage at:
//   product-images/trade-leads/<listingId>/<random>.<ext>
// and the public URL is returned to the form so the form can include the
// URL list in the eventual /api/trade-off/messages POST (email path) and
// in the wa.me text body (WhatsApp path).
//
// Constraints: max 6 photos per form (enforced client-side), 5 MB per
// file (enforced here), images only.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);
const BUCKET = "product-images";

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  return "jpg";
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid upload" },
      { status: 400 }
    );
  }

  const listingId = String(form.get("listing_id") ?? "").trim();
  const file = form.get("file");
  if (!listingId) {
    return NextResponse.json(
      { ok: false, error: "Missing listing id" },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file attached" },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Only JPG, PNG, WebP or HEIC images." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File is over 5 MB." },
      { status: 413 }
    );
  }

  // Cheap existence + listing-live guard so spammers can't fill our
  // bucket without a real target.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, status, contact_form_enabled")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found" },
      { status: 404 }
    );
  }
  if (listing.data.status !== "live" || !listing.data.contact_form_enabled) {
    return NextResponse.json(
      { ok: false, error: "Contact form not active" },
      { status: 403 }
    );
  }

  const path = `trade-leads/${listingId}/${randomUUID()}.${extFor(file.type)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false
    });
  if (up.error) {
    console.error("[trade-off/lead-photos] upload failed:", up.error);
    return NextResponse.json(
      { ok: false, error: "Upload failed — try again." },
      { status: 500 }
    );
  }

  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.data.publicUrl });
}
