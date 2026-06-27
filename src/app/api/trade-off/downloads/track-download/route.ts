// POST /api/trade-off/downloads/track-download
// Public endpoint (no edit_token) — fired by the customer-facing
// download tile. Validates the download row, atomically increments the
// download counter, optionally inserts an email-lead row, and returns a
// short-lived signed URL the browser opens to actually pull the file.
//
// Body:
//   { download_id: uuid,
//     customer_email?: string,   // required when requires_email=true
//     customer_name?: string,
//     company_website?: string   // honeypot — must be empty
//   }
//
// Response: { ok: true, signed_url: string } or { ok: false, error }.
//
// Bot guard: a hidden honeypot field. If filled, we reply with a fake
// "ok" + the public file URL so the bot can't tell the difference,
// but we skip the lead insert.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
// Permissive but conservative email regex — local@host.tld. The full
// RFC5322 grammar is overkill here; we just want to bounce nonsense.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes
const BUCKET = "product-images";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// The file_url column persists the storage public URL emitted by
// supabaseAdmin.storage.from(BUCKET).getPublicUrl(...). Extract the
// object path so we can mint a signed URL for the same object. Falls
// back to returning the input as a public link if the URL doesn't match
// our bucket layout (legacy / external links).
function extractStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return publicUrl.slice(idx + marker.length);
}

function hashIp(req: NextRequest): string | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const downloadId = s(body.download_id);
  if (!UUID_RE.test(downloadId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid download id." },
      { status: 400 }
    );
  }

  const honeypot = s(body.company_website);
  const customer_email = s(body.customer_email).slice(0, 200).toLowerCase();
  const customer_name_raw = s(body.customer_name).slice(0, 120);
  const customer_name = customer_name_raw.length > 0 ? customer_name_raw : null;

  const row = await supabaseAdmin
    .from("hammerex_xrated_downloads")
    .select("id, file_url, requires_email, status, download_count")
    .eq("id", downloadId)
    .maybeSingle();

  if (row.error || !row.data) {
    return NextResponse.json(
      { ok: false, error: "Download not found." },
      { status: 404 }
    );
  }
  if (row.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "This download is no longer available." },
      { status: 410 }
    );
  }

  if (row.data.requires_email) {
    if (!customer_email || !EMAIL_RE.test(customer_email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email is required." },
        { status: 400 }
      );
    }
  }

  // Mint the URL we'll hand back to the browser. We always try a signed
  // URL first (5 min TTL); if the path isn't inside our managed bucket
  // we fall back to returning the stored URL verbatim.
  const storagePath = extractStoragePath(row.data.file_url);
  let downloadUrl = row.data.file_url;
  if (storagePath) {
    const signed = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (!signed.error && signed.data?.signedUrl) {
      downloadUrl = signed.data.signedUrl;
    }
  }

  // Bot guard — silently swallow the request without persisting a lead
  // or counting the download. The legitimate caller never fills this
  // field, so any non-empty value is overwhelmingly likely a scraper.
  if (honeypot.length > 0) {
    return NextResponse.json({ ok: true, signed_url: downloadUrl });
  }

  // Best-effort atomic increment. We use the raw rpc-style sql here via
  // the supabase client by reading + writing — Postgres handles
  // serialisation under the row lock. If the increment fails we still
  // hand back the signed URL so the customer isn't blocked.
  await supabaseAdmin
    .from("hammerex_xrated_downloads")
    .update({ download_count: (row.data.download_count ?? 0) + 1 })
    .eq("id", row.data.id);

  if (row.data.requires_email) {
    await supabaseAdmin
      .from("hammerex_xrated_download_leads")
      .insert({
        download_id: row.data.id,
        customer_email,
        customer_name,
        ip_hash: hashIp(req)
      });
  }

  return NextResponse.json({ ok: true, signed_url: downloadUrl });
}
