// GET /api/nex-native/vault/migration/read-encrypted?file_id=...&generation=...
//
// Vault Phase A · Commit A.6 · read-only owner-scoped fetch of the
// opaque encrypted ciphertext.
//
// Used by the client's self-check round-trip: after uploading
// encrypted bytes the client re-downloads them, decrypts locally with
// K_f, and verifies the plaintext hash matches the original. Only
// AFTER this round-trip passes does the client call finalize-metadata.
//
// The server returns the raw ciphertext bytes · the server never
// interprets them. Owner-scoped.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import {
  encryptedPathFor,
  VAULT_BUCKET,
} from "@/lib/nex-native/vault/ciphertext-structural-validator";
import { getFileForMigration } from "@/lib/nex-native/vault/migration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const url = new URL(req.url);
  const fileId = url.searchParams.get("file_id") ?? "";
  const generationStr = url.searchParams.get("generation") ?? "";
  if (!fileId || !generationStr) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }
  const generation = Number(generationStr);
  if (!Number.isInteger(generation) || generation < 1) {
    return NextResponse.json(
      { ok: false, error: "invalid_generation" },
      { status: 400 },
    );
  }

  // Owner-scope check via the file row.
  const file = await getFileForMigration({
    accountId: session.account.id,
    fileId,
  });
  if (!file) {
    return NextResponse.json(
      { ok: false, error: "file_not_found" },
      { status: 404 },
    );
  }
  if (file.rotation_generation !== generation) {
    return NextResponse.json(
      { ok: false, error: "generation_mismatch" },
      { status: 409 },
    );
  }

  // Read the ciphertext bytes · owner path is deterministic.
  const path = encryptedPathFor(session.account.id, fileId, generation);
  const storage = getObjectStorage();
  const result = await storage.get(VAULT_BUCKET, path);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "ciphertext_absent" },
      { status: 404 },
    );
  }
  return new Response(result.body as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/x-nex-vault-ciphertext",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
