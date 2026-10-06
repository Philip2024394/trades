// POST /api/nex-native/vault/migration/finalize-metadata
//
// Vault Phase A · Commit A.6 · structural-validate + write encryption
// metadata · flips file to 'migrating'.
//
// Called after the browser has:
//   · uploaded the encrypted bytes
//   · self-checked (download back + decrypt + hash match) per §M.4
//
// Server validates the inbound wrapped_content_key + content_nonce +
// algorithm shape per sealed §P.2, verifies the encrypted object
// exists at the deterministic path, writes metadata, flips state to
// 'migrating'. Does NOT delete legacy bytes yet · that is the next
// endpoint.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import {
  getFileForMigration,
  getActiveAttempt,
  updateAttemptStatus,
  writeEncryptionMetadata,
} from "@/lib/nex-native/vault/migration-service";
import {
  headEncryptedObject,
  validateMetadataShape,
} from "@/lib/nex-native/vault/ciphertext-structural-validator";
import { PHASE_A_ALGORITHM } from "@/lib/nex-native/vault/key-hierarchy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  file_id?: unknown;
  attempt_id?: unknown;
  wrapped_content_key_hex?: unknown;
  content_nonce_hex?: unknown;
  encryption_algorithm?: unknown;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const sessionKey = currentSessionKey(req);
  if (!sessionKey) {
    return NextResponse.json(
      { ok: false, error: "no_session_token" },
      { status: 401 },
    );
  }
  const nexSessionId = await lookupNexSessionId({
    accountId: session.account.id,
    supabaseSessionKey: sessionKey,
  });
  if (!nexSessionId) {
    return NextResponse.json(
      { ok: false, error: "session_touch_not_yet_landed" },
      { status: 409 },
    );
  }
  const unlockVerdict = await requireStepUp(nexSessionId, {
    vault_unlock: "fresh",
  });
  if (!unlockVerdict.ok) {
    return NextResponse.json(
      { ok: false, error: "step_up_required", required: ["vault_unlock"] },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const fileId = typeof body.file_id === "string" ? body.file_id : "";
  const attemptId = typeof body.attempt_id === "string" ? body.attempt_id : "";
  const wrappedHex =
    typeof body.wrapped_content_key_hex === "string" ? body.wrapped_content_key_hex : "";
  const nonceHex =
    typeof body.content_nonce_hex === "string" ? body.content_nonce_hex : "";
  if (!fileId || !attemptId) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }
  let wrapped: Uint8Array;
  let nonce: Uint8Array;
  try {
    wrapped = hexToBytes(wrappedHex);
    nonce = hexToBytes(nonceHex);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_hex_input" },
      { status: 400 },
    );
  }
  const shape = validateMetadataShape({
    wrapped_content_key: wrapped,
    content_nonce: nonce,
    encryption_algorithm: body.encryption_algorithm,
  });
  if (!shape.ok) {
    return NextResponse.json({ ok: false, error: shape.error }, { status: 400 });
  }

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
  if (file.migration_state === "encrypted") {
    return NextResponse.json(
      { ok: false, error: "already_encrypted" },
      { status: 409 },
    );
  }
  if (file.migration_state === "migrating") {
    return NextResponse.json(
      { ok: false, error: "already_migrating" },
      { status: 409 },
    );
  }

  const activeAttempt = await getActiveAttempt({
    accountId: session.account.id,
    fileId,
  });
  if (!activeAttempt || activeAttempt.id !== attemptId) {
    return NextResponse.json(
      { ok: false, error: "attempt_mismatch" },
      { status: 403 },
    );
  }

  // Verify encrypted object exists at the deterministic path with
  // correct size BEFORE writing metadata (§P.3 pre-check).
  const encHead = await headEncryptedObject({
    accountId: session.account.id,
    fileId,
    rotationGeneration: file.rotation_generation,
  });
  if (!encHead.exists) {
    return NextResponse.json(
      { ok: false, error: "encrypted_object_absent" },
      { status: 400 },
    );
  }
  const expectedSize = file.byte_size + 16;
  if (encHead.sizeBytes !== expectedSize) {
    return NextResponse.json(
      {
        ok: false,
        error: "encrypted_object_size_mismatch",
        detail: `expected=${expectedSize} got=${encHead.sizeBytes}`,
      },
      { status: 400 },
    );
  }

  // Write metadata · state flips to 'migrating'.
  try {
    await writeEncryptionMetadata({
      accountId: session.account.id,
      fileId,
      wrappedContentKey: wrapped,
      contentNonce: nonce,
      encryptionAlgorithm: PHASE_A_ALGORITHM,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "metadata_write_failed", detail: msg },
      { status: 500 },
    );
  }

  await updateAttemptStatus({
    accountId: session.account.id,
    attemptId,
    status: "verified",
  });

  return NextResponse.json({ ok: true });
}
