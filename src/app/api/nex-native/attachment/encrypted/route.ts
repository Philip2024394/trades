// src/app/api/nex-native/attachment/encrypted/route.ts
//
// Bridge 81 · Upload endpoint for encrypted peer-chat attachments.
// ----------------------------------------------------------------
// Client sends raw ciphertext bytes as the request body (via a
// Content-Type header the client controls). Server writes to the
// existing nex-peer-chat-attachments bucket under an `enc/<sender_id>/`
// prefix so encrypted files are visibly separated from legacy plaintext
// uploads and Bridge 78 purge can target them precisely.
//
// The server NEVER sees the plaintext bytes · what lands here is
// nacl.secretbox ciphertext produced by attachment-envelope
// encryptFileBytes(). Storage returns a public URL · the client
// includes it in the envelope + posts the envelope with the encrypted
// peer message (via the existing /peer-message/encrypted endpoint).
//
// Size cap mirrors the existing NEX_PEER_ATTACHMENT_MAX_BYTES so the
// old plaintext + new encrypted paths share one upper limit.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NEX_PEER_ATTACHMENT_MAX_BYTES } from "@/lib/nex-native/peer-message-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Encrypted attachments include a 16-byte Poly1305 tag so ciphertext is
// slightly larger than plaintext · we accept the same body size cap plus
// a small overhead slot.
const MAX_UPLOAD_BYTES = NEX_PEER_ATTACHMENT_MAX_BYTES + 1024;
const BUCKET = "nex-peer-chat-attachments";
const ENCRYPTED_PREFIX = "enc";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  // Client is expected to POST the ciphertext as application/octet-stream
  // with a X-Nex-Enc-Ext header identifying a safe extension for the
  // storage object name (bin fallback if omitted).
  const ext = safeExt(req.headers.get("x-nex-enc-ext"));

  let bytes: Uint8Array;
  try {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "too_large" },
        { status: 413 },
      );
    }
    if (buf.byteLength === 0) {
      return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    }
    bytes = new Uint8Array(buf);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const objectPath = `${ENCRYPTED_PREFIX}/${session.account.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const bucket = nexSupabaseAdmin.storage.from(BUCKET);
  const { error } = await bucket.upload(objectPath, bytes, {
    // Encrypted bytes have no meaningful MIME · treat as generic
    // binary so browsers don't try to sniff/preview accidentally.
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: `storage_upload: ${error.message}` },
      { status: 500 },
    );
  }
  const { data: publicData } = bucket.getPublicUrl(objectPath);
  return NextResponse.json({
    ok: true,
    storage_url: publicData.publicUrl,
    storage_path: objectPath,
    size_bytes: bytes.byteLength,
  });
}

/** Accept only a short whitelist of safe extensions from the client
 *  header · fall back to `bin` for anything unexpected. Prevents an
 *  attacker from writing to path segments that break the storage
 *  layout or aliasing a legacy plaintext file. */
function safeExt(raw: string | null): string {
  if (!raw) return "bin";
  const cleaned = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (cleaned.length === 0 || cleaned.length > 6) return "bin";
  const whitelist = new Set([
    "bin", "enc",
    "png", "jpg", "jpeg", "webp", "gif", "avif",
    "mp4", "webm", "mov",
    "m4a", "mp3", "ogg", "wav", "opus",
  ]);
  return whitelist.has(cleaned) ? cleaned : "bin";
}
