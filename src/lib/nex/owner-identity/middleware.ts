// src/lib/nex/owner-identity/middleware.ts
//
// FOUNDER MASTER ACCESS · middleware hook ready to wire into any chat surface
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// This function is the single wiring point that would go into
// `src/app/api/conversations/engagement/[engagementId]/route.ts` (or any
// other chat entry point) BEFORE the message is persisted. It is NOT
// installed into any production route by this mission · installation is a
// separate Founder-authorized diff.
//
// USAGE (documentation only for the wiring diff Founder must approve):
//
//   const ingested = await processIncomingChatMessage({
//     raw_text: body.body,
//     device_fingerprint_hint: req.headers.get("user-agent") ?? undefined,
//     network_hint: req.headers.get("x-forwarded-for") ?? undefined,
//   });
//   const persistable_text = ingested.safe_to_persist_text;
//   if (ingested.session) { /* store session · attach cookie */ }
//   // Then continue: supabaseAdmin.from("os_messages").insert({ body: persistable_text, ... })

import type { OwnerCredentialHash } from "./hash";
import type { OwnerSession } from "./session";
import { ingestUserMessage } from "./redaction";
import { createOwnerSession } from "./session";
import { appendOwnerAuditEvent, hashHintForAudit } from "./audit";

export type ChatIngestionResult = {
  safe_to_persist_text: string;    // ALWAYS safe · never contains credential
  session: OwnerSession | null;    // non-null iff credential verified
  audit_event_id: string;
  ingestion_kind: "no_credential_detected" | "credential_detected_verified" | "credential_detected_invalid";
};

/** Process an incoming chat message · applies redaction · verifies against
 *  known credential hashes · returns text SAFE to persist + optional session.
 *  Never touches the raw credential after this returns. */
export function processIncomingChatMessage(input: {
  raw_text: string;
  known_credential_hashes: readonly OwnerCredentialHash[];
  device_fingerprint_hint?: string;
  network_hint?: string;
  repoRoot?: string;
}): ChatIngestionResult {
  const deviceHash = hashHintForAudit(input.device_fingerprint_hint);
  const networkHash = hashHintForAudit(input.network_hint);

  const ingested = ingestUserMessage({
    raw_message: input.raw_text,
    known_credential_hashes: input.known_credential_hashes,
  });

  if (ingested.kind === "no_credential_detected") {
    // No audit event needed for ordinary messages
    return {
      safe_to_persist_text: ingested.safe_to_persist_message,
      session: null,
      audit_event_id: "no_event",
      ingestion_kind: "no_credential_detected",
    };
  }

  if (ingested.kind === "credential_detected_invalid") {
    const evt = appendOwnerAuditEvent({
      event_kind: "AUTH_FAILURE",
      device_fingerprint_hash: deviceHash,
      network_hint_hash: networkHash,
      outcome: "REJECTED",
      request_summary: "credential-shaped token detected but no matching hash",
    }, { repoRoot: input.repoRoot });
    return {
      safe_to_persist_text: ingested.safe_to_persist_message,
      session: null,
      audit_event_id: evt.event_id,
      ingestion_kind: "credential_detected_invalid",
    };
  }

  // credential_detected_verified · create session
  const session = createOwnerSession({
    credential_verified: true,
    device_fingerprint_hash: deviceHash ?? undefined,
    network_hint_hash: networkHash ?? undefined,
  });
  const evt = appendOwnerAuditEvent({
    event_kind: "AUTH_SUCCESS",
    session_id: session.session_id,
    device_fingerprint_hash: deviceHash,
    network_hint_hash: networkHash,
    matched_hash_fingerprint: ingested.matched_hash_fingerprint,
    outcome: "OK",
    request_summary: "founder credential verified · session established",
  }, { repoRoot: input.repoRoot });
  return {
    safe_to_persist_text: ingested.safe_to_persist_message,
    session,
    audit_event_id: evt.event_id,
    ingestion_kind: "credential_detected_verified",
  };
}
