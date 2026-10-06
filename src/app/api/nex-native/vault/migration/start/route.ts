// POST /api/nex-native/vault/migration/start
//
// Vault Phase A · Commit A.6 · acquire migration attempt + issue a
// short-lived legacy signed URL so the client can download bytes.
//
// Flow:
//   1. Authenticate + fresh vault_unlock step-up
//   2. Reconcile the file (§M.3) · may complete / rollback / orphan
//      cleanup / do nothing · outcome returned to client
//   3. If after reconciliation the file is still in a pre-encrypted
//      state (legacy or failed), insert a new attempt row (status=
//      'started'). Partial unique index enforces at most one active.
//      Returns 409 if another attempt is already active.
//   4. Issue a 60-second signed download URL for the legacy bytes
//      via the existing vault-file-service.createSignedDownloadUrl.
//
// Request body: { file_id, device_id }
// Response:
//   · reconciled 'noop' or similar · file became encrypted mid-flight →
//     { ok: true, migration_state: 'encrypted' } (no attempt row)
//   · ready → { ok: true, attempt_id, download_url, file: {...},
//               rotation_generation }

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { createSignedDownloadUrl } from "@/lib/nex-native/vault-file-service";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import {
  getFileForMigration,
  reconcile,
  startAttempt,
  getActiveAttempt,
} from "@/lib/nex-native/vault/migration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  file_id?: unknown;
  device_id?: unknown;
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

  // Migration requires Vault to be unlocked (user must have VMK in
  // memory to wrap K_f client-side).
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
  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (!fileId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }

  // Reconcile first · may clean orphans / finalize / rollback.
  const reconcileResult = await reconcile({
    accountId: session.account.id,
    fileId,
  });

  // After reconciliation re-read the row.
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
    return NextResponse.json({
      ok: true,
      migration_state: "encrypted",
      reconciliation: reconcileResult.outcome,
    });
  }
  if (file.migration_state === "migrating") {
    // Reconciliation left it 'migrating' → caller should re-try the
    // finalize step with the previous attempt's data. Return 409 to
    // force the client to call /migration/queue again.
    return NextResponse.json(
      {
        ok: false,
        error: "file_in_migrating_state",
        reconciliation: reconcileResult.outcome,
      },
      { status: 409 },
    );
  }
  // migration_state is 'legacy' or 'failed'. Need an active attempt.
  const existing = await getActiveAttempt({
    accountId: session.account.id,
    fileId,
  });
  let attemptId: string;
  if (existing) {
    attemptId = existing.id;
  } else {
    try {
      const attempt = await startAttempt({
        accountId: session.account.id,
        fileId,
        startedByDeviceId: deviceId,
      });
      attemptId = attempt.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Partial unique index collision · another attempt landed between
      // our check and insert.
      return NextResponse.json(
        { ok: false, error: "attempt_already_active", detail: msg },
        { status: 409 },
      );
    }
  }

  // Issue signed download URL for the legacy bytes.
  const signed = await createSignedDownloadUrl(session.account.id, fileId);
  if (!signed) {
    return NextResponse.json(
      { ok: false, error: "legacy_signed_url_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    migration_state: file.migration_state,
    attempt_id: attemptId,
    download_url: signed.url,
    file: {
      id: file.id,
      byte_size: file.byte_size,
      rotation_generation: file.rotation_generation,
    },
    reconciliation: reconcileResult.outcome,
  });
}
