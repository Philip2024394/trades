// Owner-side receipt storage helper. Uploads to the private
// `notebook-receipts` bucket and returns the storage path + a signed
// URL (30 days) for the owner to view later.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "node:crypto";

const BUCKET = "notebook-receipts";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf"
]);

export async function uploadReceipt(input: {
  partyId: string;
  tradeId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<
  | { ok: true; path: string; signedUrl: string }
  | { ok: false; error: string }
> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    return { ok: false, error: "unsupported_mime_type" };
  }
  const ext = input.fileName.split(".").pop() || "bin";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  const key = `${input.partyId}/${input.tradeId}/${Date.now()}-${randomUUID()}.${safeExt}`;

  const buffer = Buffer.from(input.bytes);
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType: input.mimeType,
      cacheControl: "3600",
      upsert: false
    });
  if (upErr) {
    return { ok: false, error: `upload_failed: ${upErr.message}` };
  }

  const { data: signed, error: sigErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (sigErr || !signed) {
    return { ok: false, error: "signed_url_failed" };
  }

  return { ok: true, path: key, signedUrl: signed.signedUrl };
}

export async function refreshSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
