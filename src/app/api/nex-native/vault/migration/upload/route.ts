// POST /api/nex-native/vault/migration/upload
//
// Vault Phase A · Commit A.6 · accept opaque encrypted ciphertext
// bytes from the browser and PUT them at the deterministic encrypted
// path. The server NEVER inspects, decrypts, or interprets these
// bytes. This endpoint exists so the browser doesn't need direct
// signed-upload access to the private vault bucket at a
// generation-scoped path.
//
// The multipart body carries { file_id, attempt_id, generation,
// ciphertext_file }. Server validates ownership, attempt belongs to
// caller, generation matches, then PUTs bytes via the sealed
// object-storage abstraction.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import { uploadEncryptedObject } from "@/lib/nex-native/vault/ciphertext-structural-validator";
import {
  getFileForMigration,
  updateAttemptStatus,
  getActiveAttempt,
} from "@/lib/nex-native/vault/migration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }
  const fileId = String(form.get("file_id") ?? "");
  const attemptId = String(form.get("attempt_id") ?? "");
  const generationStr = String(form.get("generation") ?? "");
  const ciphertextFile = form.get("ciphertext_file");
  if (!fileId || !attemptId || !generationStr || !(ciphertextFile instanceof Blob)) {
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

  // Expected size: plaintext byte_size + 16 (AES-GCM tag).
  const expectedSize = file.byte_size + 16;
  const bodyArrayBuffer = await ciphertextFile.arrayBuffer();
  if (bodyArrayBuffer.byteLength !== expectedSize) {
    return NextResponse.json(
      {
        ok: false,
        error: "ciphertext_size_mismatch",
        detail: `expected=${expectedSize} got=${bodyArrayBuffer.byteLength}`,
      },
      { status: 400 },
    );
  }
  const bytes = new Uint8Array(bodyArrayBuffer);

  await uploadEncryptedObject({
    accountId: session.account.id,
    fileId,
    rotationGeneration: generation,
    ciphertext: bytes,
  });

  await updateAttemptStatus({
    accountId: session.account.id,
    attemptId,
    status: "uploaded",
  });

  return NextResponse.json({ ok: true });
}
