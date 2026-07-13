// POST /api/trade-off/upload-video
// Multipart video upload. Currently used by plant hire AND The Yard
// composer. Drops the bytes into the `product-images` bucket under
// trade-off-video/<uuid>.<ext> and returns the public URL.
//
// Paid-tier gate: if slug + edit_token are provided we resolve the
// listing's tier and reject standard-tier uploads with
// `video_requires_paid`. This is the enforcement layer for The Yard
// video feature — plant hire callers that don't pass auth still work
// (their access is already gated at a higher level).
//
// Constraints:
//   - video/* MIME only
//   - 30 MB size cap — 60s of 1080p H.264 ≈ 15-25 MB at reasonable bitrate
//   - Duration must be checked client-side before upload (browser reads
//     video.duration). Server can't ffprobe without extra tooling.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 30 * 1024 * 1024;
const PAID_TIERS = new Set(["app_trial", "app_paid", "verified"]);

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

function extFromMime(mime: string): string {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  if (mime === "video/x-matroska") return "mkv";
  if (mime === "video/x-msvideo") return "avi";
  return "bin";
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form body" }, { status: 400 });
  }

  // Optional Yard-composer auth. When present, enforces paid tier.
  const slug = String(form.get("slug") ?? "").trim();
  const editToken = String(form.get("edit_token") ?? "").trim();
  if (slug && editToken) {
    const { data: listing } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("edit_token, tier, status")
      .eq("slug", slug)
      .maybeSingle();
    if (!listing || !constantTimeEq(listing.edit_token, editToken)) {
      return NextResponse.json(
        { ok: false, error: "unauthorised" },
        { status: 401 }
      );
    }
    if (listing.status !== "live") {
      return NextResponse.json(
        { ok: false, error: "listing_not_live" },
        { status: 403 }
      );
    }
    const tier = (listing as { tier?: string }).tier ?? "standard";
    if (!PAID_TIERS.has(tier)) {
      return NextResponse.json(
        {
          ok: false,
          error: "video_requires_paid",
          detail:
            "Video posts are a paid-tier feature. Upgrade to include video in your Yard posts."
        },
        { status: 403 }
      );
    }
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }
  if (!raw.type.startsWith("video/")) {
    return NextResponse.json({ ok: false, error: "File must be a video." }, { status: 400 });
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 30 MB — reduce quality or trim to under a minute." },
      { status: 400 }
    );
  }

  const ext = extFromMime(raw.type);
  const path = `trade-off-video/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: raw.type, upsert: false });
  if (up.error) {
    console.error("[trade-off/upload-video] upload failed:", up.error);
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.data.publicUrl });
}
