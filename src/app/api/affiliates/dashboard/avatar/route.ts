// POST /api/affiliates/dashboard/avatar
//
// Affiliate-side profile-photo upload. Multipart, one file at a time.
// Mirrors the trade-off/upload-photo pattern: drops the bytes into
// the shared `product-images` bucket under
// `affiliate-avatars/<affiliate_id>.<ext>` (upsert=true so a re-upload
// overwrites the previous file) and returns a public URL the client
// then PATCHes onto avatar_url via /api/affiliates/profile.
//
// Validation: image/jpeg | image/png | image/webp only, 5 MB cap.
// Heavier filtering (face detection, NSFW etc.) is out of scope for
// Phase-1 — banned at the admin layer if abused.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid form body" },
      { status: 400 }
    );
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return NextResponse.json(
      { ok: false, error: "No file provided" },
      { status: 400 }
    );
  }
  if (!ALLOWED.has(raw.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Photo must be PNG, JPEG or WEBP."
      },
      { status: 400 }
    );
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Photo exceeds 5 MB." },
      { status: 400 }
    );
  }

  const ext = extFromMime(raw.type);
  const path = `affiliate-avatars/${session.affiliate_id}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());

  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: raw.type,
      upsert: true // re-upload overwrites the previous avatar
    });
  if (up.error) {
    console.error("[affiliates/dashboard/avatar] upload failed:", up.error);
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 }
    );
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  // Cache-busting query — same path with upsert=true means CDN may
  // serve the old image; appending a version param forces a refetch.
  const url = `${pub.data.publicUrl}?v=${Date.now()}`;

  // Stamp the URL onto the affiliate row immediately. The client also
  // PATCHes the profile but doing it here means a refresh shows the
  // new photo even if the client never sent the follow-up call.
  const upd = await supabaseAdmin
    .from("hammerex_affiliates")
    .update({ avatar_url: url })
    .eq("affiliate_id", session.affiliate_id);
  if (upd.error) {
    console.error(
      "[affiliates/dashboard/avatar] avatar_url update failed:",
      upd.error
    );
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "profile.avatar_upload",
    target_id: String(session.affiliate_id),
    details: { path, content_type: raw.type, bytes: raw.size }
  });

  return NextResponse.json({ ok: true, url });
}
