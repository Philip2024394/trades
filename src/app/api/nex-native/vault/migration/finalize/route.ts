// POST /api/nex-native/vault/migration/finalize
//
// Vault Phase A · Commit A.6 · delete legacy bytes + flip to
// 'encrypted'.
//
// Precondition: file is in 'migrating' state (set by prior
// finalize-metadata call). Server:
//   1. Re-verifies encrypted object still exists at the deterministic
//      path with correct size (§P.3).
//   2. Deletes legacy bytes via the object-storage abstraction.
//   3. Flips nex_vault_file to migration_state='encrypted', clears
//      legacy_bytes_path, sets migrated_at.
//   4. Marks attempt row 'finalized'.
//   5. Logs 'legacy_file_migrated' audit event.
//
// Crash points (§M.3): if the server dies between step 2 and step 3,
// reconciliation on next retry detects (encrypted exists, legacy
// missing) and finalizes the DB state from partial deletion.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import {
  getFileForMigration,
  getActiveAttempt,
  finalizeEncrypted,
  updateAttemptStatus,
} from "@/lib/nex-native/vault/migration-service";
import {
  encryptedPathFor,
  validateFinalizeState,
} from "@/lib/nex-native/vault/ciphertext-structural-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  file_id?: unknown;
  attempt_id?: unknown;
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
  if (!fileId || !attemptId) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
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

  // Final structural pre-check (§P.3).
  const check = await validateFinalizeState({
    file,
    encryptedPath: encryptedPathFor(
      session.account.id,
      fileId,
      file.rotation_generation,
    ),
  });
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.error, detail: check.detail },
      { status: 409 },
    );
  }

  try {
    await finalizeEncrypted({
      accountId: session.account.id,
      fileId,
      legacyBytesPath: file.legacy_bytes_path!,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "finalize_failed", detail: msg },
      { status: 500 },
    );
  }

  await updateAttemptStatus({
    accountId: session.account.id,
    attemptId,
    status: "finalized",
  });

  await logSignInEvent({
    account_id: session.account.id,
    event_type: "legacy_file_migrated",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
