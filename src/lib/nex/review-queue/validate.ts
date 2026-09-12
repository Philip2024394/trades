// src/lib/nex/review-queue/validate.ts
//
// Stage 6 · pure-function validation for change requests before they hit
// the DB. Cheap defence-in-depth · authoritative constraints remain in
// nex.change_request CHECK clauses.

import type { ChangeRequestInput, ChangeRequestValidation } from "./types";

const CAPABILITY_RE = /^CAP-\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANIFEST_ID_RE = /^[A-Za-z0-9_-]+$/;

const MIN_MESSAGE_LEN = 3;
const MAX_MESSAGE_LEN = 8000;
const MAX_ATTACHMENTS = 32;

export function validateChangeRequest(input: ChangeRequestInput): ChangeRequestValidation {
  if (!CAPABILITY_RE.test(input.targetCapabilityId)) {
    return { ok: false, code: "sec.change_request_bad_capability", reason: `Invalid capability "${input.targetCapabilityId}"` };
  }
  if (!UUID_RE.test(input.targetRevisionId)) {
    return { ok: false, code: "sec.change_request_bad_revision_id", reason: `Invalid revision UUID` };
  }
  const msg = input.founderMessage?.trim() ?? "";
  if (msg.length < MIN_MESSAGE_LEN) {
    return { ok: false, code: "sec.change_request_empty_message", reason: `Founder message must be ≥ ${MIN_MESSAGE_LEN} chars` };
  }
  if (msg.length > MAX_MESSAGE_LEN) {
    return { ok: false, code: "sec.change_request_message_too_long", reason: `Founder message must be ≤ ${MAX_MESSAGE_LEN} chars` };
  }
  if (!input.founderSignature || input.founderSignature.trim().length === 0) {
    return { ok: false, code: "sec.change_request_missing_signature", reason: `Founder signature required` };
  }
  if (input.attachedManifestIds.length > MAX_ATTACHMENTS) {
    return { ok: false, code: "sec.change_request_too_many_attachments", reason: `Max ${MAX_ATTACHMENTS} attachments` };
  }
  for (const m of input.attachedManifestIds) {
    if (!MANIFEST_ID_RE.test(m)) {
      return { ok: false, code: "sec.change_request_bad_manifest_id", reason: `Invalid manifest id "${m}"` };
    }
  }
  return { ok: true };
}
