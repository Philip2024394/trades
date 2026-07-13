// POST /api/uploads
//
// Accepts a multipart form with:
//   - file (Blob)
//   - kind ("review-photo" | "canteen-image" | "canteen-video" |
//           "profile-image" | "yard-image" | "trade-center-product-image")
//   - ownerKind ("merchant" | "reviewer")
//   - ownerSlug (merchant slug OR anonymous reviewer cookie value)
//
// Runs the tier gate with the REAL byte count, uploads to Supabase
// Storage bucket "network-uploads", records usage, returns { url }.
// This replaces the client-supplied-URL model — clients POST to /api/uploads
// first, then POST the returned URL to /api/reviews/create or the canteen
// endpoints. That closes the "cheat the tier gate by lying about photo
// count" loophole.
//
// Auth for merchant uploads: signed trade session cookie. Auth for
// reviewer uploads: matches the network_reviewer_id cookie.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { assertUploadAllowedFromDb, recordUpload, type UploadOwnerKind } from "@/lib/tierGates.server";
import { UploadGateError, type UploadKind } from "@/lib/tierGates";

const BUCKET = "network-uploads";
const REVIEWER_COOKIE = "network_reviewer_id";

const VALID_KINDS: UploadKind[] = [
  "canteen-image", "canteen-video", "profile-image", "review-photo",
  "yard-image", "yard-video", "trade-center-product-image", "other"
];

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-multipart" }, { status: 400 });
  }

  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "");
  const ownerKindRaw = String(form.get("ownerKind") ?? "merchant") as UploadOwnerKind;
  const providedOwnerSlug = String(form.get("ownerSlug") ?? "");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kindRaw as UploadKind)) {
    return NextResponse.json({ ok: false, error: "invalid-kind" }, { status: 400 });
  }
  const kind = kindRaw as UploadKind;

  // ─── Auth ────────────────────────────────────────────
  let ownerSlug: string | null = null;
  if (ownerKindRaw === "merchant") {
    // Signed session — ignore ownerSlug from the form (client-supplied)
    // and trust the cookie.
    ownerSlug = await getMerchantSlug();
    if (!ownerSlug) {
      return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
    }
  } else if (ownerKindRaw === "reviewer") {
    const jar = await cookies();
    const cookieId = jar.get(REVIEWER_COOKIE)?.value;
    if (!cookieId) {
      return NextResponse.json({ ok: false, error: "no-reviewer-cookie" }, { status: 401 });
    }
    ownerSlug = cookieId;
    // Client can also pass ownerSlug — we cross-check but the cookie
    // is authoritative.
    if (providedOwnerSlug && providedOwnerSlug !== cookieId) {
      return NextResponse.json({ ok: false, error: "owner-mismatch" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "invalid-owner-kind" }, { status: 400 });
  }

  const sizeBytes = file.size;
  const tier = "free"; // Real tier lookup lands with merchant profile fetch

  // ─── Tier gate ───────────────────────────────────────
  try {
    await assertUploadAllowedFromDb({
      ownerSlug,
      ownerKind: ownerKindRaw,
      uploadKind: kind,
      tier,
      sizeBytes
    });
  } catch (err) {
    if (err instanceof UploadGateError) {
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: 402 });
    }
    throw err;
  }

  // ─── Upload ──────────────────────────────────────────
  const ext = extensionForBlob(file);
  const path = `${ownerKindRaw}/${ownerSlug}/${kind}/${crypto.randomUUID()}${ext}`;
  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
      upsert: false
    });

  if (upload.error) {
    // eslint-disable-next-line no-console
    console.error("[uploads] storage upload failed", upload.error);
    return NextResponse.json(
      { ok: false, error: "storage-upload-failed", detail: upload.error.message },
      { status: 500 }
    );
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(upload.data.path);
  const publicUrl = urlData.publicUrl;

  // ─── Record usage ────────────────────────────────────
  await recordUpload({
    ownerSlug,
    ownerKind: ownerKindRaw,
    uploadKind: kind,
    tier,
    sizeBytes,
    storageUrl: publicUrl
  });

  return NextResponse.json({ ok: true, url: publicUrl, path: upload.data.path, sizeBytes });
}

function extensionForBlob(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/quicktime") return ".mov";
  return "";
}
